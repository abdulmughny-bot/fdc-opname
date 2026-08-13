import { useEffect, useState } from 'react'
import { getClinicRankings } from '../../lib/api'
import { Card, CardHeader, CardTitle, CardBody, Badge } from '../../components'
import type { ClinicRanking } from '../../lib/api'

interface ClinicRankingsProps {
  periodType?: 'month' | 'quarter' | 'year'
}

export function ClinicRankings({ periodType = 'month' }: ClinicRankingsProps) {
  const [rankings, setRankings] = useState<ClinicRanking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRankings()
  }, [periodType])

  async function loadRankings() {
    setLoading(true)
    try {
      const data = await getClinicRankings(periodType)
      setRankings(data || [])
    } catch (error) {
      console.error('Error loading clinic rankings:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="text-center py-8 text-ink-soft">Loading rankings...</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>🏆 Clinic Performance Ranking</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="space-y-3">
          {rankings.length === 0 ? (
            <p className="text-sm text-ink-soft">No audit data available for this period.</p>
          ) : (
            rankings.map((clinic, index) => {
              const medal =
                index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`

              const stars = Math.round(clinic.ketersesuaian_pct / 20) // 0-5 stars
              const starDisplay = '⭐'.repeat(stars) + '☆'.repeat(5 - stars)

              const trendIcon =
                clinic.trend_direction === 'Excellent'
                  ? '↗️'
                  : clinic.trend_direction === 'Good'
                    ? '→'
                    : clinic.trend_direction === 'Fair'
                      ? '↘️'
                      : '📉'

              const dateStr = clinic.last_audit_date
                ? new Date(clinic.last_audit_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Never'

              const daysAgo = clinic.last_audit_date
                ? Math.floor((Date.now() - new Date(clinic.last_audit_date).getTime()) / (1000 * 60 * 60 * 24))
                : 999

              return (
                <div
                  key={clinic.clinic_id}
                  className="border border-line rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-teal-deep">{medal}</span>
                      <div>
                        <h3 className="font-semibold text-ink">{clinic.clinic_name}</h3>
                        <p className="text-xs text-ink-lighter">
                          Last audit: {dateStr} ({daysAgo} days ago)
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-ink">{clinic.ketersesuaian_pct}%</div>
                      <p className="text-xs text-ink-soft">{starDisplay}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-teal-wash rounded p-2">
                      <p className="text-xs text-ink-soft">Audited</p>
                      <p className="font-semibold text-teal-deep">
                        {clinic.audited_stations}/{clinic.total_stations}
                      </p>
                    </div>
                    <div className="bg-rust-wash rounded p-2">
                      <p className="text-xs text-ink-soft">Variance</p>
                      <p className="font-semibold text-rust">
                        Rp {(clinic.variance_value || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-line-soft rounded p-2">
                      <p className="text-xs text-ink-soft">Status</p>
                      <p className="font-semibold text-ink-soft">{trendIcon}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Badge
                      variant={
                        clinic.trend_direction === 'Excellent'
                          ? 'success'
                          : clinic.trend_direction === 'Good'
                            ? 'info'
                            : clinic.trend_direction === 'Fair'
                              ? 'warning'
                              : 'error'
                      }
                      size="sm"
                    >
                      {clinic.trend_direction}
                    </Badge>
                    {daysAgo > 30 && (
                      <Badge variant="warning" size="sm">
                        ⏰ Overdue
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
