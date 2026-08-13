import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, CardHeader, CardTitle, CardBody, Button, Dialog } from '../../components'
import type { ItemMasterRow, ItemPricingRow } from '../../lib/api'
import { updateItemPricing } from '../../lib/api'
import { useAuth } from '../auth'

interface ItemWithPricing extends ItemMasterRow {
  pricing?: ItemPricingRow
}

const CATEGORIES = ['Logistic', 'BHP']
const UNITS = ['Box', 'Pcs', 'Syringe', 'Ml']

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

export function ItemsManagement() {
  const { permissions } = useAuth()
  const canViewPricing = permissions.canViewPricing
  const [items, setItems] = useState<ItemWithPricing[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Edit mode
  const [editingItem, setEditingItem] = useState<ItemWithPricing | null>(null)
  const [editSKU, setEditSKU] = useState('')
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editPrice, setEditPrice] = useState('')

  // Add single item
  const [showAddModal, setShowAddModal] = useState(false)
  const [newSKU, setNewSKU] = useState('')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newUnit, setNewUnit] = useState('Box')
  const [addingItem, setAddingItem] = useState(false)
  const [addItemError, setAddItemError] = useState('')

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null)

  const bulkFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [itemsRes, pricingRes] = await Promise.all([
        supabase.from('item_master').select('*').eq('status', 'Active').order('sku'),
        supabase.from('item_pricing').select('*').is('clinic_id', null),
      ])

      if (itemsRes.error) throw itemsRes.error
      if (pricingRes.error) throw pricingRes.error

      const itemsData: ItemWithPricing[] = itemsRes.data || []
      const pricingMap = new Map((pricingRes.data || []).map((p) => [p.item_id, p]))

      itemsData.forEach((item) => {
        item.pricing = pricingMap.get(item.id)
      })

      setItems(itemsData)
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
      }

      const { error } = await supabase.from('item_master').update(updateData).eq('id', editingItem.id)

      if (error) throw error

      // Update pricing if provided
      if (editPrice && canViewPricing) {
        await updateItemPricing(editingItem.id, parseFloat(editPrice))
      }

      setEditingItem(null)
      await loadData()
    } catch (error) {
      console.error('Error saving item:', error)
    }
  }

  async function handleDeleteItem(id: string) {
    setDeleteBusyId(id)
    try {
      const { error } = await supabase.from('item_master').delete().eq('id', id)
      if (error) throw error
      setDeletingId(null)
      await loadData()
    } catch (error) {
      console.error('Error deleting item:', error)
    } finally {
      setDeleteBusyId(null)
    }
  }

  async function handleBulkImport(file: File) {
    try {
      const text = await file.text()
      const lines = text.split('\n').filter((line) => line.trim())
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())

      const rows = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim())
        const row: any = {}
        headers.forEach((header, index) => {
          row[header] = values[index]
        })
        return row
      })

      const validItems = rows
        .filter((row: any) => row.sku && row.name)
        .map((row: any) => ({
          sku: row.sku,
          name: row.name,
          category: row.category || null,
          unit: row.unit || 'Box',
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

  async function handleAddSingleItem() {
    setAddItemError('')
    if (!newSKU.trim() || !newName.trim()) {
      setAddItemError('SKU and Name are required.')
      return
    }

    setAddingItem(true)
    try {
      const { error } = await supabase.from('item_master').insert({
        sku: newSKU.trim(),
        name: newName.trim(),
        category: newCategory.trim() || null,
        unit: newUnit.trim() || 'Box',
      })
      if (error) throw error

      setNewSKU('')
      setNewName('')
      setNewCategory('')
      setNewUnit('Box')
      setShowAddModal(false)
      await loadData()
    } catch (error: any) {
      setAddItemError(error?.message || 'Failed to add item.')
    } finally {
      setAddingItem(false)
    }
  }

  const filteredItems = items.filter((item) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return item.sku.toLowerCase().includes(q) || item.name.toLowerCase().includes(q) || (item.category ?? '').toLowerCase().includes(q)
  })

  if (loading) return <div className="text-center py-12 text-ink-soft">Loading item master...</div>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Item Master Database ({filteredItems.length})</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search SKU, name, category…"
                className="border border-line rounded-lg px-3 py-1.5 text-sm w-56"
              />
              <input
                ref={bulkFileRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleBulkImport(e.target.files[0])
                }}
              />
              <Button variant="secondary" size="sm" onClick={() => bulkFileRef.current?.click()}>
                Import CSV
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
                + Add Item
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="overflow-auto max-h-[65vh]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-soft">
                  <th className="text-left py-2 font-semibold text-ink bg-paper sticky top-0">SKU</th>
                  <th className="text-left py-2 font-semibold text-ink bg-paper sticky top-0">Name</th>
                  <th className="text-left py-2 font-semibold text-ink bg-paper sticky top-0">Category</th>
                  <th className="text-left py-2 font-semibold text-ink bg-paper sticky top-0">Unit</th>
                  {canViewPricing && <th className="text-right py-2 font-semibold text-ink bg-paper sticky top-0">Price</th>}
                  <th className="text-left py-2 font-semibold text-ink bg-paper sticky top-0">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={canViewPricing ? 6 : 5} className="py-8 text-center text-ink-soft">
                      {items.length === 0 ? 'No items yet — add one or import a CSV.' : 'No items match your search.'}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    return (
                      <tr key={item.id} className="border-b border-line-soft hover:bg-paper-secondary">
                        <td className="py-2.5 font-mono text-xs text-teal-deep">{item.sku}</td>
                        <td className="py-2.5">{item.name}</td>
                        <td className="py-2.5 text-ink-soft text-xs">{item.category || '—'}</td>
                        <td className="py-2.5">{item.unit}</td>
                        {canViewPricing && (
                          <td className="py-2.5 text-right font-semibold">
                            Rp {item.pricing?.selling_price?.toLocaleString() || '—'}
                          </td>
                        )}
                        <td className="py-2.5">
                          {deletingId === item.id ? (
                            <span className="inline-flex items-center gap-2 text-xs">
                              <span className="text-ink-soft">Delete?</span>
                              <button
                                type="button"
                                disabled={deleteBusyId === item.id}
                                onClick={() => handleDeleteItem(item.id)}
                                className="text-rust font-semibold hover:underline disabled:opacity-50"
                              >
                                {deleteBusyId === item.id ? 'Working…' : 'Yes'}
                              </button>
                              <button type="button" onClick={() => setDeletingId(null)} className="text-ink-soft hover:underline">
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setEditingItem(item)
                                  setEditSKU(item.sku)
                                  setEditName(item.name)
                                  setEditCategory(item.category || '')
                                  setEditUnit(item.unit)
                                  setEditPrice(item.pricing?.selling_price?.toString() || '')
                                }}
                              >
                                Edit
                              </Button>
                              <button
                                type="button"
                                onClick={() => setDeletingId(item.id)}
                                title="Delete item"
                                className="text-rust hover:bg-rust-wash rounded-md p-1.5 transition-colors"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

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
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full border border-line rounded-lg p-2 text-sm"
              >
                <option value="">—</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-soft block mb-1">Unit</label>
              <select
                value={editUnit}
                onChange={(e) => setEditUnit(e.target.value)}
                className="w-full border border-line rounded-lg p-2 text-sm"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            {canViewPricing && (
              <div>
                <h4 className="text-xs font-semibold text-ink-soft mb-2">Pricing</h4>
                <div>
                  <label className="text-xs text-ink-soft block mb-1">Price (Rp) *</label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full border border-line rounded-lg p-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Add Item Modal */}
      <Dialog
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Item"
        size="sm"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddSingleItem} disabled={addingItem}>
              {addingItem ? 'Adding…' : 'Add Item'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-ink-soft block mb-1">SKU *</label>
            <input
              value={newSKU}
              onChange={(e) => setNewSKU(e.target.value)}
              className="w-full border border-line rounded-lg p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft block mb-1">Name *</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-line rounded-lg p-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink-soft block mb-1">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full border border-line rounded-lg p-2 text-sm"
              >
                <option value="">—</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-soft block mb-1">Unit</label>
              <select
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="w-full border border-line rounded-lg p-2 text-sm"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {addItemError && <p className="text-xs text-error">{addItemError}</p>}
        </div>
      </Dialog>
    </div>
  )
}
