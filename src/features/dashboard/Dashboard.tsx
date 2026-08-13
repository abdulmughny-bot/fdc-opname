import { useMemo, useState } from 'react'
import { useAuth } from '../auth'
import { periodMonth, periodQuarter, periodYear } from '../../lib/period'
import { useDashboardData } from './useDashboardData'
import { FilterBar } from './FilterBar'
import { Gauge } from './Gauge'
import { ClinicTable, type ClinicRow } from './ClinicTable'
import { SessionsList } from './SessionsList'
import { defaultFilters } from './types'
import { Button, Card, CardHeader, CardTitle, CardBody } from '../../components'
import { ClinicRankings } from './ClinicRankings'
import { ItemVarianceSection } from './ItemVarianceSection'
import type { SessionWithStations } from './types'

// Surfaces the sessions someone is actually likely to click right now
// (in progress or not yet started), independent of the analytics period
// filter below — resuming an audit shouldn't depend on which month is selected.
function QuickAccessSessions({
  sessions,
  onSelect,
  onStartNew,
}: {
  sessions: SessionWithStations[]
  onSelect: (sessionId: string) => void
  onStartNew: () => void
}) {
  const actionable = sessions.filter((s) => s.derivedStatus !== 'Finished').slice(0, 6)

  if (actionable.length === 0) {
    return (
      <button
        type="button"
        onClick={onStartNew}
        className="w-full text-left bg-teal-wash border border-teal rounded-[12px] px-5 py-4 hover:shadow-md transition-shadow"
      >
        <div className="font-display font-bold text-teal-deep">No audits in progress</div>
        <div className="text-sm text-teal-deep/80 mt-0.5">✚ Start a new audit</div>
      </button>
    )
  }

  return (
    <div>
      <h2 className="font-display text-sm font-bold text-ink-soft mb-2.5">Continue your audits</h2>
      <div className="grid grid-cols-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1 gap-3">
        {actionable.map(({ session, stations, derivedStatus }) => {
          const submitted = stations.filter((s) => s.status === 'Submitted').length
          // Same audit-type colour coding as the TrackBadge pill in SessionsList:
          // Offline = teal (green), Self = amber (red).
          const wash = session.audit_type === 'Offline' ? 'bg-teal-wash' : 'bg-amber-wash'
          return (
            <button
              key={session.id}
              type="button"
              onClick={() => onSelect(session.id)}
              className={'text-left rounded-[12px] px-4 py-3.5 hover:shadow-md transition-shadow ' + wash}
            >
              <div className="font-semibold text-sm text-ink truncate">{session.clinic_name}</div>
              <div className="text-xs text-ink-soft font-mono mt-1">
                {submitted}/{stations.length} dental
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="font-mono text-[10px] tracking-wider uppercase text-ink-soft">{session.audit_type}</span>
                <span className="text-[10px] font-semibold text-ink-soft">· {derivedStatus}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Dashboard({
  onNewAuditLog,
  onSelectSession,
}: {
  onNewAuditLog: () => void
  onSelectSession: (sessionId: string) => void
}) {
  const { visibleClinics } = useAuth()
  const { sessions, loading, error, reload } = useDashboardData()
  const [filters, setFilters] = useState(defaultFilters())

  const agents = useMemo(() => {
    const set = new Set(sessions.map((s) => s.session.started_by))
    return Array.from(set).sort()
  }, [sessions])

  const filtered = useMemo(() => {
    const clinicIds = filters.clinicIds === 'all' ? null : new Set(filters.clinicIds)
    return sessions.filter(({ session, derivedStatus }) => {
      if (clinicIds && !clinicIds.has(session.clinic_id)) return false
      if (filters.status !== 'all' && derivedStatus !== filters.status) return false
      if (filters.auditType !== 'all' && session.audit_type !== filters.auditType) return false
      if (filters.agent !== 'all' && session.started_by !== filters.agent) return false
      if (filters.periodType === 'custom') {
        if (!filters.customRange) return true
        const startedDate = session.started_at.slice(0, 10)
        return startedDate >= filters.customRange.start && startedDate <= filters.customRange.end
      }
      const started = new Date(session.started_at)
      const sessionPeriod =
        filters.periodType === 'month'
          ? periodMonth(started)
          : filters.periodType === 'quarter'
            ? periodQuarter(started)
            : periodYear(started)
      return sessionPeriod === filters.period
    })
  }, [sessions, filters])

  const activeCount = filtered.filter((s) => s.session.status === 'Active').length
  const finishedCount = filtered.filter((s) => s.session.status === 'Finished').length

  // Ketersesuaian is a straight (unweighted) average of each submitted
  // station's own % — not a pooled matched/scorable ratio. A clinic with one
  // 20-item station and one 200-item station counts them equally, matching
  // how the number reads in the sessions/stations lists.
  const { companyPct, clinicRows } = useMemo(() => {
    const companyPcts: number[] = []
    const byClinic = new Map<string, number[]>()
    filtered.forEach(({ session, stations }) => {
      if (session.status !== 'Finished') return
      stations
        .filter((s) => s.status === 'Submitted' && s.ketersesuaian !== null)
        .forEach((s) => {
          companyPcts.push(s.ketersesuaian as number)
          const entry = byClinic.get(session.clinic_name) ?? []
          entry.push(s.ketersesuaian as number)
          byClinic.set(session.clinic_name, entry)
        })
    })
    const mean = (arr: number[]) => Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
    const companyPct = companyPcts.length ? mean(companyPcts) : null
    const clinicRows: ClinicRow[] = Array.from(byClinic.entries())
      .filter(([, pcts]) => pcts.length > 0)
      .map(([name, pcts]) => ({ name, pct: mean(pcts) }))
    return { companyPct, clinicRows }
  }, [filtered])

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink mb-1">Dashboard</h1>
          <p className="text-ink-soft">Manage and monitor your warehouse audits</p>
        </div>
        <Button variant="primary" size="lg" onClick={onNewAuditLog}>
          ✚ New Audit
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-error-wash border border-red-200 rounded-lg px-4 py-3 text-sm">
          <p className="font-semibold text-error mb-1">Unable to load dashboard</p>
          <p className="text-error text-xs">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-paper-secondary border border-line rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-line rounded w-1/2 mb-2" />
              <div className="h-8 bg-line rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Quick Access */}
          <QuickAccessSessions sessions={sessions} onSelect={onSelectSession} onStartNew={onNewAuditLog} />

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink-soft font-medium">Active Audits</p>
                  <p className="text-3xl font-bold text-teal-deep mt-1">{activeCount}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-teal-wash flex items-center justify-center text-xl">
                  ▶
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink-soft font-medium">Finished Audits</p>
                  <p className="text-3xl font-bold text-success mt-1">{finishedCount}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-success-wash flex items-center justify-center text-xl">
                  ✓
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink-soft font-medium">Overall Match %</p>
                  <p className="text-3xl font-bold text-ink mt-1">
                    {companyPct !== null ? `${companyPct}%` : '—'}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-rust-wash flex items-center justify-center text-xl">
                  📊
                </div>
              </div>
            </Card>
          </div>

          {/* Filters */}
          <div className="bg-paper border border-line rounded-lg p-4">
            <FilterBar clinics={visibleClinics} agents={agents} filters={filters} onChange={setFilters} />
          </div>

          {/* Analytics Section */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6 max-[900px]:grid-cols-1">
              <Card>
                <CardHeader>
                  <CardTitle>Ketersesuaian All Clinic</CardTitle>
                </CardHeader>
                <CardBody>
                  <p className="text-xs text-ink-soft mb-4">Across finished sessions in this period, both audit types.</p>
                  <Gauge pct={companyPct} />
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance by Clinic</CardTitle>
                </CardHeader>
                <CardBody>
                  <p className="text-xs text-ink-soft mb-4">Based on finished sessions only.</p>
                  <ClinicTable rows={clinicRows} />
                </CardBody>
              </Card>
            </div>

            {/* Clinic Rankings */}
            <ClinicRankings periodType={filters.periodType === 'month' ? 'month' : filters.periodType === 'quarter' ? 'quarter' : 'year'} />

            {/* Item Variance Analysis */}
            <ItemVarianceSection
              periodDays={30}
              filters={filters}
            />
          </div>

          {/* Sessions List */}
          <Card>
            <CardHeader>
              <CardTitle>Audit Sessions</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-xs text-ink-soft mb-4">Active sessions can be resumed. Finished sessions show the report.</p>
              <SessionsList items={filtered} onSelect={onSelectSession} onDeleted={reload} />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
