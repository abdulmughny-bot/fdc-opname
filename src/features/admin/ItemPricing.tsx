import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { updateItemPricing } from '../../lib/api'
import { Card, CardHeader, CardTitle, CardBody, Button, Dialog } from '../../components'
import type { ItemMasterRow, ItemPricingRow } from '../../lib/api'
import { useAuth } from '../auth'

export function ItemPricing() {
  const { profile } = useAuth()
  const [items, setItems] = useState<(ItemMasterRow & { pricing?: ItemPricingRow })[]>([])
  const [loading, setLoading] = useState(true)
  const [editingItem, setEditingItem] = useState<ItemMasterRow | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [editCost, setEditCost] = useState('')

  // Only Leads can access pricing
  if (profile?.role !== 'Lead') {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-ink-soft">🔒 Only Leads can manage item pricing.</p>
        </CardBody>
      </Card>
    )
  }

  useEffect(() => {
    loadPricing()
  }, [])

  async function loadPricing() {
    setLoading(true)
    try {
      const [itemsRes, pricingRes] = await Promise.all([
        supabase.from('item_master').select('*').eq('status', 'Active').order('sku'),
        supabase.from('item_pricing').select('*').is('clinic_id', null),
      ])

      if (itemsRes.error) throw itemsRes.error

      const itemsData: (ItemMasterRow & { pricing?: ItemPricingRow })[] = itemsRes.data || []
      const pricingMap = new Map((pricingRes.data || []).map((p) => [p.item_id, p]))

      itemsData.forEach((item) => {
        item.pricing = pricingMap.get(item.id)
      })

      setItems(itemsData)
    } catch (error) {
      console.error('Error loading pricing:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePrice() {
    if (!editingItem || !editPrice) return

    try {
      const sellingPrice = parseFloat(editPrice)
      const costPrice = editCost ? parseFloat(editCost) : undefined

      await updateItemPricing(editingItem.id, sellingPrice, costPrice)
      setEditingItem(null)
      await loadPricing()
    } catch (error) {
      console.error('Error updating price:', error)
    }
  }

  if (loading) return <div className="text-center py-12 text-ink-soft">Loading pricing data...</div>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Item Pricing Management</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-soft">
                  <th className="text-left py-2 font-semibold text-ink">SKU</th>
                  <th className="text-left py-2 font-semibold text-ink">Item Name</th>
                  <th className="text-right py-2 font-semibold text-ink">Cost Price</th>
                  <th className="text-right py-2 font-semibold text-ink">Selling Price</th>
                  <th className="text-right py-2 font-semibold text-ink">Margin %</th>
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
                      <td className="py-2.5 text-right text-ink-soft">
                        Rp {item.pricing?.cost_price?.toLocaleString() || '—'}
                      </td>
                      <td className="py-2.5 text-right font-semibold">
                        Rp {item.pricing?.selling_price?.toLocaleString() || '—'}
                      </td>
                      <td className="py-2.5 text-right">
                        {marginPct !== '—' ? `${marginPct}%` : '—'}
                      </td>
                      <td className="py-2.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditingItem(item)
                            setEditPrice(item.pricing?.selling_price?.toString() || '')
                            setEditCost(item.pricing?.cost_price?.toString() || '')
                          }}
                        >
                          Edit
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

      {/* Edit Price Modal */}
      <Dialog
        isOpen={editingItem !== null}
        onClose={() => setEditingItem(null)}
        title={`Edit Price: ${editingItem?.name}`}
        size="sm"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSavePrice} disabled={!editPrice}>
              Save Price
            </Button>
          </div>
        }
      >
        {editingItem && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink-soft block mb-1">Cost Price (Rp)</label>
              <input
                type="number"
                value={editCost}
                onChange={(e) => setEditCost(e.target.value)}
                placeholder="0"
                className="w-full border border-line rounded-lg p-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-soft block mb-1">Selling Price (Rp) *</label>
              <input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="0"
                className="w-full border border-line rounded-lg p-2 text-sm"
                autoFocus
              />
              {editPrice && editCost && (
                <p className="text-xs text-teal-deep mt-2">
                  Margin: {(((parseFloat(editPrice) - parseFloat(editCost)) / parseFloat(editCost)) * 100).toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
