import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, CardHeader, CardTitle, CardBody, Badge, Button, Dialog } from '../../components'
import type { ItemMasterRow, ItemApprovalRow, ItemPricingRow } from '../../lib/api'
import { approveItem, rejectItem, updateItemPricing } from '../../lib/api'
import { useAuth } from '../auth'

interface ItemWithPricing extends ItemMasterRow {
  pricing?: ItemPricingRow
}

export function ItemsManagement() {
  const { profile } = useAuth()
  const [items, setItems] = useState<ItemWithPricing[]>([])
  const [approvals, setApprovals] = useState<ItemApprovalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'browse' | 'approvals' | 'import'>('browse')

  // Edit mode
  const [editingItem, setEditingItem] = useState<ItemWithPricing | null>(null)
  const [editSKU, setEditSKU] = useState('')
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editStdQty, setEditStdQty] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCost, setEditCost] = useState('')

  // Approval mode
  const [selectedApproval, setSelectedApproval] = useState<ItemApprovalRow | null>(null)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const bulkFileRef = useRef<HTMLInputElement>(null)
  const personalFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [itemsRes, approvalsRes, pricingRes] = await Promise.all([
        supabase.from('item_master').select('*').eq('status', 'Active').order('sku'),
        supabase.from('item_approval').select('*').order('created_at', { ascending: false }),
        supabase.from('item_pricing').select('*').is('clinic_id', null),
      ])

      if (itemsRes.error) throw itemsRes.error

      const itemsData: ItemWithPricing[] = itemsRes.data || []
      const pricingMap = new Map((pricingRes.data || []).map((p) => [p.item_id, p]))

      itemsData.forEach((item) => {
        item.pricing = pricingMap.get(item.id)
      })

      setItems(itemsData)
      setApprovals(approvalsRes.data || [])
    } catch (error) {
      console.error('Error loading items:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveItem() {
    if (!editingItem || !editSKU || !editName) return

    try {
      const updateData: any = {
        sku: editSKU,
        name: editName,
        category: editCategory || null,
        unit: editUnit,
        std_qty_per_location: editStdQty ? parseInt(editStdQty) : null,
      }

      const { error } = await supabase.from('item_master').update(updateData).eq('id', editingItem.id)

      if (error) throw error

      // Update pricing if provided
      if (editPrice && profile?.role === 'Lead') {
        await updateItemPricing(editingItem.id, parseFloat(editPrice), editCost ? parseFloat(editCost) : undefined)
      }

      setEditingItem(null)
      await loadData()
    } catch (error) {
      console.error('Error saving item:', error)
    }
  }

  async function handleApprove() {
    if (!selectedApproval) return
    try {
      await approveItem(selectedApproval.id)
      setSelectedApproval(null)
      setApprovalAction(null)
      await loadData()
    } catch (error) {
      console.error('Error approving item:', error)
    }
  }

  async function handleReject() {
    if (!selectedApproval || !rejectionReason) return
    try {
      await rejectItem(selectedApproval.id, rejectionReason)
      setSelectedApproval(null)
      setApprovalAction(null)
      setRejectionReason('')
      await loadData()
    } catch (error) {
      console.error('Error rejecting item:', error)
    }
  }

  async function handleBulkImport(file: File) {
    try {
      const text = await file.text()
      const lines = text.split('\n').filter((line) => line.trim())
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())

      const items = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim())
        const row: any = {}
        headers.forEach((header, index) => {
          row[header] = values[index]
        })
        return row
      })

      const validItems = items
        .filter((row: any) => row.sku && row.name)
        .map((row: any) => ({
          sku: row.sku,
          name: row.name,
          category: row.category || null,
          unit: row.unit || 'Box',
          std_qty_per_location: row.std_qty_per_location ? parseInt(row.std_qty_per_location) : null,
          cost_price: row.cost_price ? parseFloat(row.cost_price) : null,
        }))

      if (validItems.length > 0) {
        const { error } = await supabase.from('item_master').insert(validItems)
        if (error) throw error
        await loadData()
      }

      if (bulkFileRef.current) bulkFileRef.current.value = ''
    } catch (error) {
      console.error('Error importing bulk items:', error)
    }
  }

  if (loading) return <div className="text-center py-12 text-ink-soft">Loading item master...</div>

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-line overflow-x-auto">
        {['browse', 'approvals', 'import'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'text-teal-deep border-teal-deep'
                : 'text-ink-soft border-transparent hover:text-ink'
            }`}
          >
            {tab === 'browse' && `📦 Items (${items.length})`}
            {tab === 'approvals' && `⏳ Approvals (${approvals.filter((a) => a.status === 'Pending').length})`}
            {tab === 'import' && '📤 Import'}
          </button>
        ))}
      </div>

      {/* BROWSE TAB */}
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
                    {profile?.role === 'Lead' && (
                      <>
                        <th className="text-right py-2 font-semibold text-ink">Cost</th>
                        <th className="text-right py-2 font-semibold text-ink">Price</th>
                        <th className="text-right py-2 font-semibold text-ink">Margin %</th>
                      </>
                    )}
                    <th className="text-left py-2 font-semibold text-ink">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const marginPct = item.pricing
                      ? (((item.pricing.selling_price - (item.pricing.cost_price || 0)) /
                          (item.pricing.cost_price || 1)) *
                          100).toFixed(1)
                      : '—'

                    return (
                      <tr key={item.id} className="border-b border-line-soft hover:bg-paper-secondary">
                        <td className="py-2.5 font-mono text-xs text-teal-deep">{item.sku}</td>
                        <td className="py-2.5">{item.name}</td>
                        <td className="py-2.5 text-ink-soft text-xs">{item.category || '—'}</td>
                        <td className="py-2.5">{item.unit}</td>
                        <td className="py-2.5 text-right">{item.std_qty_per_location || '—'}</td>
                        {profile?.role === 'Lead' && (
                          <>
                            <td className="py-2.5 text-right text-ink-soft">
                              Rp {item.pricing?.cost_price?.toLocaleString() || '—'}
                            </td>
                            <td className="py-2.5 text-right font-semibold">
                              Rp {item.pricing?.selling_price?.toLocaleString() || '—'}
                            </td>
                            <td className="py-2.5 text-right">{marginPct !== '—' ? `${marginPct}%` : '—'}</td>
                          </>
                        )}
                        <td className="py-2.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingItem(item)
                              setEditSKU(item.sku)
                              setEditName(item.name)
                              setEditCategory(item.category || '')
                              setEditUnit(item.unit)
                              setEditStdQty(item.std_qty_per_location?.toString() || '')
                              setEditPrice(item.pricing?.selling_price?.toString() || '')
                              setEditCost(item.pricing?.cost_price?.toString() || '')
                            }}
                          >
                            ✎ Edit
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* APPROVALS TAB */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {approvals
            .filter((a) => a.status === 'Pending')
            .map((approval) => (
              <Card key={approval.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
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

      {/* IMPORT TAB */}
      {activeTab === 'import' && (
        <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>📤 Bulk Import (Excel)</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-ink-soft mb-4">
                Upload Excel file with columns: SKU, Name, Category, Unit, Std Qty, Cost Price
              </p>
              <input
                ref={bulkFileRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleBulkImport(e.target.files[0])
                }}
                className="hidden"
              />
              <Button onClick={() => bulkFileRef.current?.click()} variant="primary" className="w-full">
                Choose Excel File
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>➕ Personal Import</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-ink-soft mb-4">Add a single item to the master list</p>
              <input
                ref={personalFileRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleBulkImport(e.target.files[0])
                }}
                className="hidden"
              />
              <Button onClick={() => personalFileRef.current?.click()} variant="primary" className="w-full">
                Add Single Item
              </Button>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Edit Item Modal */}
      <Dialog
        isOpen={editingItem !== null}
        onClose={() => setEditingItem(null)}
        title={`Edit Item: ${editingItem?.name}`}
        size="md"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveItem}>
              Save Item
            </Button>
          </div>
        }
      >
        {editingItem && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-ink-soft block mb-1">SKU *</label>
              <input
                type="text"
                value={editSKU}
                onChange={(e) => setEditSKU(e.target.value)}
                className="w-full border border-line rounded-lg p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-soft block mb-1">Name *</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full border border-line rounded-lg p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-soft block mb-1">Category</label>
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full border border-line rounded-lg p-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1">Unit</label>
                <input
                  type="text"
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                  placeholder="Box"
                  className="w-full border border-line rounded-lg p-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-1">Std Qty</label>
                <input
                  type="number"
                  value={editStdQty}
                  onChange={(e) => setEditStdQty(e.target.value)}
                  className="w-full border border-line rounded-lg p-2 text-sm"
                />
              </div>
            </div>

            {profile?.role === 'Lead' && (
              <div>
                <h4 className="text-xs font-semibold text-ink-soft mb-2">💰 Pricing (Lead Only)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-ink-soft block mb-1">Cost Price (Rp)</label>
                    <input
                      type="number"
                      value={editCost}
                      onChange={(e) => setEditCost(e.target.value)}
                      className="w-full border border-line rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ink-soft block mb-1">Selling Price (Rp) *</label>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-full border border-line rounded-lg p-2 text-sm"
                    />
                  </div>
                </div>
                {editPrice && editCost && (
                  <p className="text-xs text-teal-deep mt-2">
                    Margin: {(((parseFloat(editPrice) - parseFloat(editCost)) / parseFloat(editCost)) * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Approval Modal */}
      <Dialog
        isOpen={approvalAction !== null && selectedApproval !== null}
        onClose={() => {
          setApprovalAction(null)
          setSelectedApproval(null)
          setRejectionReason('')
        }}
        title={approvalAction === 'approve' ? 'Approve Item' : 'Reject Item'}
        size="sm"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => {
              setApprovalAction(null)
              setSelectedApproval(null)
            }}>
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
        {selectedApproval && approvalAction === 'reject' && (
          <div className="space-y-3">
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
          </div>
        )}
        {selectedApproval && approvalAction === 'approve' && (
          <p className="text-sm text-ink-soft">Approve this item to add it to the master database?</p>
        )}
      </Dialog>
    </div>
  )
}
