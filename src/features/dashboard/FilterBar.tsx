import type { VisibleClinic } from '../auth'
import {
  currentPeriodMonth,
  currentPeriodQuarter,
  currentPeriodYear,
  shiftMonthPeriod,
  shiftQuarterPeriod,
  shiftYearPeriod,
} from '../../lib/period'
import type { DashboardFilters, DerivedStatus } from './types'

const STATUS_OPTIONS: DerivedStatus[] = ['Active', 'In Progress', 'Finished']
const AUDIT_TYPE_OPTIONS = ['Offline', 'Self'] as const

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function FilterBar({
  clinics,
  agents,
  filters,
  onChange,
}: {
  clinics: VisibleClinic[]
  agents: string[]
  filters: DashboardFilters
  onChange: (next: DashboardFilters) => void
}) {
  function setPeriodType(periodType: DashboardFilters['periodType']) {
    if (periodType === 'custom') {
      onChange({ ...filters, periodType, customRange: filters.customRange ?? { start: todayIso(), end: todayIso() } })
      return
    }
    const period =
      periodType === 'month' ? currentPeriodMonth() : periodType === 'quarter' ? currentPeriodQuarter() : currentPeriodYear()
    onChange({ ...filters, periodType, period })
  }

  function shiftPeriod(delta: number) {
    const period =
      filters.periodType === 'month'
        ? shiftMonthPeriod(filters.period, delta)
        : filters.periodType === 'quarter'
          ? shiftQuarterPeriod(filters.period, delta)
          : shiftYearPeriod(filters.period, delta)
    onChange({ ...filters, period })
  }

  function setCustomRange(patch: Partial<{ start: string; end: string }>) {
    const base = filters.customRange ?? { start: todayIso(), end: todayIso() }
    onChange({ ...filters, customRange: { ...base, ...patch } })
  }

  function toggleClinic(id: string) {
    const current = filters.clinicIds === 'all' ? clinics.map((c) => c.id) : filters.clinicIds
    const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    onChange({ ...filters, clinicIds: next.length === clinics.length ? 'all' : next })
  }

  const selectedClinicIds = filters.clinicIds === 'all' ? clinics.map((c) => c.id) : filters.clinicIds

  return (
    <div className="bg-paper border border-line rounded-[10px] p-4 mb-4 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-1.5">
        <select
          value={filters.periodType}
          onChange={(e) => setPeriodType(e.target.value as DashboardFilters['periodType'])}
          className="rounded-md border border-line text-xs font-mono px-2 py-1.5"
        >
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
          <option value="year">Year</option>
          <option value="custom">Custom range</option>
        </select>
        {filters.periodType === 'custom' ? (
          <>
            <input
              type="date"
              value={filters.customRange?.start ?? todayIso()}
              onChange={(e) => setCustomRange({ start: e.target.value })}
              className="rounded-md border border-line text-xs font-mono px-2 py-1.5"
            />
            <span className="text-ink-soft text-xs">to</span>
            <input
              type="date"
              value={filters.customRange?.end ?? todayIso()}
              onChange={(e) => setCustomRange({ end: e.target.value })}
              className="rounded-md border border-line text-xs font-mono px-2 py-1.5"
            />
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              className="w-6 h-6 rounded border border-line text-ink-soft hover:border-ink-soft"
              aria-label="Previous period"
            >
              ‹
            </button>
            <span className="font-mono text-xs text-ink min-w-[64px] text-center">{filters.period}</span>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              className="w-6 h-6 rounded border border-line text-ink-soft hover:border-ink-soft"
              aria-label="Next period"
            >
              ›
            </button>
          </>
        )}
      </div>

      <details className="relative">
        <summary className="cursor-pointer rounded-md border border-line text-xs px-2 py-1.5 list-none select-none">
          Clinics {filters.clinicIds === 'all' ? `(All ${clinics.length})` : `(${selectedClinicIds.length})`}
        </summary>
        <div className="absolute z-10 mt-1 bg-paper border border-line rounded-md shadow p-2 min-w-[180px] max-h-56 overflow-auto">
          {clinics.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-xs py-1 px-1 cursor-pointer">
              <input type="checkbox" checked={selectedClinicIds.includes(c.id)} onChange={() => toggleClinic(c.id)} />
              {c.name}
            </label>
          ))}
        </div>
      </details>

      <select
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value as DashboardFilters['status'] })}
        className="rounded-md border border-line text-xs px-2 py-1.5"
      >
        <option value="all">All statuses</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        value={filters.auditType}
        onChange={(e) => onChange({ ...filters, auditType: e.target.value as DashboardFilters['auditType'] })}
        className="rounded-md border border-line text-xs px-2 py-1.5"
      >
        <option value="all">All audit types</option>
        {AUDIT_TYPE_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <select
        value={filters.agent}
        onChange={(e) => onChange({ ...filters, agent: e.target.value })}
        className="rounded-md border border-line text-xs px-2 py-1.5"
      >
        <option value="all">All agents</option>
        {agents.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </div>
  )
}
