import { useEffect, useState } from 'react'
import { getItemVarianceAnalysis } from '../../lib/api'
import { Card, CardHeader, CardTitle, CardBody, Badge } from '../../components'
import type { ItemVarianceAnalysis } from '../../lib/api'

interface ItemVarianceSectionProps {
  periodDays?: number
  clinicIds?: string[] | 'all'
}

export function ItemVarianceSection({ periodDays = 30, clinicIds }: ItemVarianceSectionProps) {
  const [variance, setVariance] = useState<ItemVarianceAnalysis[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadVariance()
  }, [periodDays, clinicIds])

  async function loadVariance() {
    setLoading(true)
    try {
      const ids = clinicIds && clinicIds !== 'all' && Array.isArray(clinicIds) ? clinicIds : undefined
      const data = await getItemVarianceAnalysis(periodDays, ids)
      // Filter to only items with actual discrepancy (Sistem != Fisik) and sort by absolute variance
      const withDiscrepancy = (data || [])
        .filter((item) => item.variance_qty !== 0)
        .sort((a, b) => Math.abs(b.variance_value_rp || 0) - Math.abs(a.variance_value_rp || 0))
        .slice(0, 15)
      setVariance(withDiscrepancy)
    } catch (error) {
      console.error('Error loading item variance:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="text-center py-8 text-ink-soft">Loading variance data...</div>

  const totalVariance = variance.reduce((sum, item) => sum + (item.variance_value_rp || 0), 0)
  const showClinicGrouping = clinicIds && clinicIds !== 'all' && Array.isArray(clinicIds) && clinicIds.length > 1

  // Group items by clinic if multiple clinics selected
  const variantsByClinic: Array<[string, ItemVarianceAnalysis[]]> = showClinicGrouping
    ? Array.from(
        variance.reduce(
          (map, item) => {
            const clinic = item.most_affected_clinic
            if (!map.has(clinic)) map.set(clinic, [])
            map.get(clinic)!.push(item)
            return map
          },
          new Map<string, ItemVarianceAnalysis[]>()
        ).entries()
      )
    : [['All Clinics', variance]]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Item Variance Analysis</CardTitle>
        <p className="text-xs text-ink-soft mt-1">
          {showClinicGrouping
            ? `Top discrepancies by clinic (${variance.length} items)`
            : `Top discrepancies (${variance.length} items)`}
        </p>
      </CardHeader>
      <CardBody>
        {variance.length === 0 ? (
          <p className="text-sm text-ink-soft text-center py-8">No variance data available.</p>
        ) : (
          <div className="space-y-6">
            {/* Summary Box */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-rust-wash rounded-lg p-4 border border-rust-wash/2">
                <p className="text-xs text-ink-soft font-medium mb-1">Total Loss Value</p>
                <p className="text-2xl font-bold text-rust font-mono">
                  Rp {totalVariance.toLocaleString()}
                </p>
              </div>
              <div className="bg-teal-wash rounded-lg p-4 border border-teal-wash/2">
                <p className="text-xs text-ink-soft font-medium mb-1">Items with Discrepancy</p>
                <p className="text-2xl font-bold text-teal-deep font-mono">{variance.length}</p>
              </div>
            </div>

            {/* Items grouped by clinic if needed */}
            {variantsByClinic.map(([clinic, items]) => (
              <div key={clinic}>
                {showClinicGrouping && (
                  <div className="mb-3">
                    <h3 className="font-semibold text-sm text-ink">{clinic}</h3>
                    <div className="h-px bg-line mt-1" />
                  </div>
                )}

                <div className="space-y-2">
                  {items.map((item) => {
                    // Invert variance sign: API returns positive when Sistem > Fisik, but should be negative (shortage)
                    const invertedVariance = -(item.variance_qty || 0)
                    const isShortage = invertedVariance < 0
                    const varianceClass = isShortage ? 'text-rust' : 'text-ink-soft'
                    const bgClass = isShortage ? 'bg-rust-wash/40' : 'bg-line/20'
                    const badgeVariant = isShortage ? 'error' : 'warning'
                    const isCritical = Math.abs(item.variance_pct) > 20

                    return (
                      <div
                        key={item.item_id}
                        className={`border border-line rounded-lg p-3.5 hover:shadow-sm transition-shadow ${bgClass}`}
                      >
                        {/* Header with SKU, Name, Variance */}
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="font-mono text-xs font-bold text-teal-deep shrink-0">
                                {item.sku}
                              </span>
                              {isCritical && <Badge variant={badgeVariant} size="sm">CRITICAL</Badge>}
                            </div>
                            <p className="text-sm font-semibold text-ink truncate">{item.item_name}</p>
                            {item.category && (
                              <p className="text-xs text-ink-soft mt-0.5">{item.category}</p>
                            )}
                          </div>

                          {/* Variance amount and % */}
                          <div className="text-right shrink-0">
                            <p className={`font-mono font-bold text-lg ${varianceClass}`}>
                              {invertedVariance < 0 ? '−' : '+'}
                              {Math.abs(invertedVariance)}
                            </p>
                            <p className={`text-xs font-semibold ${varianceClass}`}>
                              {item.variance_pct}%
                            </p>
                          </div>
                        </div>

                        {/* Quantities and Financial Impact */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-ink-soft font-medium mb-1">Sistem</p>
                            <p className="font-mono font-semibold text-ink">
                              {item.total_sistem_qty}
                            </p>
                          </div>
                          <div>
                            <p className="text-ink-soft font-medium mb-1">Fisik</p>
                            <p className="font-mono font-semibold text-ink">
                              {item.total_fisik_qty}
                            </p>
                          </div>
                          <div>
                            <p className="text-ink-soft font-medium mb-1">Loss Value</p>
                            <p className={`font-mono font-semibold ${invertedVariance < 0 ? 'text-rust' : 'text-ink-soft'}`}>
                              {invertedVariance < 0
                                ? `Rp ${Math.abs(item.variance_value_rp || 0).toLocaleString()}`
                                : '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
