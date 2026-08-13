import { useEffect, useState } from 'react'
import { getItemVarianceAnalysis } from '../../lib/api'
import { Card, CardHeader, CardTitle, CardBody, Badge } from '../../components'
import type { ItemVarianceAnalysis } from '../../lib/api'

interface ItemVarianceSectionProps {
  periodDays?: number
}

export function ItemVarianceSection({ periodDays = 30 }: ItemVarianceSectionProps) {
  const [variance, setVariance] = useState<ItemVarianceAnalysis[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadVariance()
  }, [periodDays])

  async function loadVariance() {
    setLoading(true)
    try {
      const data = await getItemVarianceAnalysis(periodDays)
      setVariance((data || []).slice(0, 10)) // Top 10 items by variance
    } catch (error) {
      console.error('Error loading item variance:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="text-center py-8 text-ink-soft">Loading variance data...</div>

  const totalVariance = variance.reduce((sum, item) => sum + (item.variance_value_rp || 0), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>📊 Item Variance Analysis (Top Issues)</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="mb-4 p-3 bg-rust-wash rounded-lg">
          <p className="text-xs text-ink-soft mb-1">Total Variance Value (Last {periodDays} days)</p>
          <p className="text-2xl font-bold text-rust">Rp {totalVariance.toLocaleString()}</p>
        </div>

        <div className="space-y-2">
          {variance.length === 0 ? (
            <p className="text-sm text-ink-soft">No variance data available.</p>
          ) : (
            variance.map((item, index) => {
              const isLoss = item.variance_qty < 0
              const varianceColor = isLoss ? 'text-rust' : 'text-success'
              const varianceBg = isLoss ? 'bg-rust-wash' : 'bg-success-wash'

              return (
                <div
                  key={item.item_id}
                  className="border border-line rounded-lg p-3 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-semibold text-teal-deep">
                          {index + 1}. {item.sku}
                        </span>
                        <span className="text-xs text-ink-soft">{item.category || 'General'}</span>
                      </div>
                      <p className="text-sm font-medium text-ink">{item.item_name}</p>
                      <p className="text-xs text-ink-lighter mt-0.5">
                        📍 {item.most_affected_clinic}
                      </p>
                    </div>
                    <div className={`text-right ${varianceColor}`}>
                      <p className="font-bold text-lg">{item.variance_qty}</p>
                      <p className="text-xs">{item.variance_pct}%</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="text-xs">
                      <p className="text-ink-lighter">Sistem vs Fisik</p>
                      <p className="font-mono">
                        {item.total_sistem_qty} → {item.total_fisik_qty}
                      </p>
                    </div>
                    <div className={`text-xs ${varianceBg} p-2 rounded`}>
                      <p className="text-ink-soft">Financial Impact</p>
                      <p className={`font-bold ${varianceColor}`}>
                        Rp {(item.variance_value_rp || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {Math.abs(item.variance_pct) > 30 && (
                      <Badge variant="error" size="sm">
                        🚨 CRITICAL
                      </Badge>
                    )}
                    {Math.abs(item.variance_pct) > 15 && Math.abs(item.variance_pct) <= 30 && (
                      <Badge variant="warning" size="sm">
                        ⚠️ High
                      </Badge>
                    )}
                    {isLoss ? (
                      <Badge variant="error" size="sm">
                        📉 Loss
                      </Badge>
                    ) : (
                      <Badge variant="info" size="sm">
                        📈 Overstock
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardBody>
    </Card>
  )
}
