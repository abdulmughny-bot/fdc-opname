import { useMemo, useState } from 'react'
import { useAuth } from '../auth'
import { periodMonth, periodQuarter, periodYear } from '../../lib/period'
import { useDashboardData } from './useDashboardData'
import { FilterBar } from './FilterBar'
import { StatRow } from './StatRow'
import { Gauge } from './Gauge'
import { ClinicTable, type ClinicRow } from './ClinicTable'
import { SessionsList } from './SessionsList'
import { defaultFilters } from './types'

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
  const { companyPct, totalFilled, clinicRows } = useMemo(() => {
    let totalFilled = 0
    const companyPcts: number[] = []
    const byClinic = new Map<string, number[]>()
    filtered.forEach(({ session, stations }) => {
      if (session.status !== 'Finished') return
      stations
        .filter((s) => s.status === 'Submitted' && s.ketersesuaian !== null)
        .forEach((s) => {
          totalFilled += s.scorable_count
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
    return { companyPct, totalFilled, clinicRows }
  }, [filtered])

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={onNewAuditLog}
          className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2.5 hover:bg-teal transition-colors"
        >
          + New audit log
        </button>
      </div>

      <FilterBar clinics={visibleClinics} agents={agents} filters={filters} onChange={setFilters} />

      {error && <div className="bg-rust-wash text-rust border border-[#EEC2AC] rounded-lg px-3.5 py-3 text-sm mb-4">{error}</div>}
      {loading ? (
        <div className="text-center py-12 text-sm text-ink-soft">Loading…</div>
      ) : (
        <>
          <StatRow activeCount={activeCount} finishedCount={finishedCount} companyPct={companyPct} totalFilled={totalFilled} />

          <div className="grid grid-cols-[1.15fr_1fr] max-[860px]:grid-cols-1 gap-[18px]">
            <div className="bg-paper border border-line rounded-[10px] p-[22px_24px]">
              <h2 className="font-display text-base font-bold mb-1.5">Ketersesuaian — company-wide</h2>
              <p className="text-[13px] text-ink-soft mb-4">Across finished sessions in this period, both tracks.</p>
              <Gauge pct={companyPct} />
            </div>
            <div className="bg-paper border border-line rounded-[10px] p-[22px_24px]">
              <h2 className="font-display text-base font-bold mb-1.5">By clinic</h2>
              <p className="text-[13px] text-ink-soft mb-4">From finished sessions only.</p>
              <ClinicTable rows={clinicRows} />
            </div>
          </div>

          <div className="bg-paper border border-line rounded-[10px] p-[22px_24px] mt-[18px]">
            <h2 className="font-display text-base font-bold mb-1.5">Audit sessions</h2>
            <p className="text-[13px] text-ink-soft mb-4">Active sessions can be resumed. Finished sessions show the report.</p>
            <SessionsList items={filtered} onSelect={onSelectSession} onDeleted={reload} />
          </div>
        </>
      )}
    </div>
  )
}
