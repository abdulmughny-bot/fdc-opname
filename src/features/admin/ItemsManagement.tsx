import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, CardHeader, CardTitle, CardBody, Badge, Button, Dialog } from '../../components'
import type { ItemMasterRow, ItemApprovalRow } from '../../lib/api'
import { approveItem, rejectItem } from '../../lib/api'

export function ItemsManagement() {
  const [items, setItems] = useState<ItemMasterRow[]>([])
  const [approvals, setApprovals] = useState<ItemApprovalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'browse' | 'approvals'>('browse')
  const [selectedApproval, setSelectedApproval] = useState<ItemApprovalRow | null>(null)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [itemsRes, approvalsRes] = await Promise.all([
        supabase.from('item_master').select('*').order('created_at', { ascending: false }),
        supabase.from('item_approval').select('*').order('created_at', { ascending: false }),
      ])

      if (itemsRes.error) throw itemsRes.error
      if (approvalsRes.error) throw approvalsRes.error

      setItems(itemsRes.data || [])
      setApprovals(approvalsRes.data || [])
    } catch (error) {
      console.error('Error loading items:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove() {
    if (!selectedApproval) return
    try {
      await approveItem(selectedApproval.id, adminNotes)
      setSelectedApproval(null)
      setApprovalAction(null)
      setAdminNotes('')
      await loadData()
    } catch (error) {
      console.error('Error approving item:', error)
    }
  }

  async function handleReject() {
    if (!selectedApproval || !rejectionReason) return
    try {
      await rejectItem(selectedApproval.id, rejectionReason, adminNotes)
      setSelectedApproval(null)
      setApprovalAction(null)
      setRejectionReason('')
      setAdminNotes('')
      await loadData()
    } catch (error) {
      console.error('Error rejecting item:', error)
    }
  }

  if (loading) return <div className="text-center py-12 text-ink-soft">Loading items...</div>

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-line">
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === 'browse'
              ? 'text-teal-deep border-teal-deep'
              : 'text-ink-soft border-transparent hover:text-ink'
          }`}
        >
          Browse Items ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === 'approvals'
              ? 'text-teal-deep border-teal-deep'
              : 'text-ink-soft border-transparent hover:text-ink'
          }`}
        >
          Pending Approvals ({approvals.filter((a) => a.status === 'Pending').length})
        </button>
      </div>

      {activeTab === 'browse' && (
        <Card>
          <CardHeader>
            <CardTitle>Item Master Database</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-soft">
                    <th className="text-left py-2 font-semibold text-ink">SKU</th>
                    <th className="text-left py-2 font-semibold text-ink">Name</th>
                    <th className="text-left py-2 font-semibold text-ink">Category</th>
                    <th className="text-left py-2 font-semibold text-ink">Unit</th>
                    <th className="text-left py-2 font-semibold text-ink">Std Qty</th>
                    <th className="text-left py-2 font-semibold text-ink">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-line-soft hover:bg-paper-secondary">
                      <td className="py-2.5 font-mono text-xs text-teal-deep">{item.sku}</td>
                      <td className="py-2.5">{item.name}</td>
                      <td className="py-2.5 text-ink-soft text-xs">{item.category || '—'}</td>
                      <td className="py-2.5">{item.unit}</td>
                      <td className="py-2.5 text-right">{item.std_qty_per_location || '—'}</td>
                      <td className="py-2.5">
                        <Badge variant={item.status === 'Active' ? 'success' : 'neutral'} size="sm">
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {approvals
            .filter((a) => a.status === 'Pending')
            .map((approval) => (
              <Card key={approval.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-ink">{approval.item_id}</h3>
                    <p className="text-sm text-ink-soft mt-1">Uploaded by: {approval.uploaded_by}</p>
                    <p className="text-xs text-ink-lighter mt-1">
                      {new Date(approval.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedApproval(approval)
                        setApprovalAction('approve')
                      }}
                    >
                      ✓ Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setSelectedApproval(approval)
                        setApprovalAction('reject')
                      }}
                    >
                      ✗ Reject
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      )}

      {/* Approval Modal */}
      <Dialog
        isOpen={approvalAction !== null && selectedApproval !== null}
        onClose={() => {
          setApprovalAction(null)
          setSelectedApproval(null)
          setRejectionReason('')
          setAdminNotes('')
        }}
        title={approvalAction === 'approve' ? 'Approve Item' : 'Reject Item'}
        size="md"
        actions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setApprovalAction(null)
                setSelectedApproval(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant={approvalAction === 'approve' ? 'primary' : 'danger'}
              onClick={approvalAction === 'approve' ? handleApprove : handleReject}
              disabled={approvalAction === 'reject' && !rejectionReason}
            >
              {approvalAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </div>
        }
      >
        {selectedApproval && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink-soft">Item ID</label>
              <p className="text-sm font-mono mt-1">{selectedApproval.item_id}</p>
            </div>

            {approvalAction === 'reject' && (
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1">Rejection Reason *</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Why is this item being rejected?"
                  className="w-full border border-line rounded-lg p-2 text-sm"
                  rows={3}
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-ink-soft block mb-1">Admin Notes</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Optional notes for the team..."
                className="w-full border border-line rounded-lg p-2 text-sm"
                rows={2}
              />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
