import type { ReactNode } from 'react'
import { SUBMIT_THRESHOLD, type WizardStep } from './types'

export function TrackBadge({ auditType }: { auditType: 'Offline' | 'Self' }) {
  const offline = auditType === 'Offline'
  return (
    <span
      className={
        'font-mono text-[10.5px] tracking-wider uppercase px-2.5 py-1 rounded-md border ' +
        (offline ? 'border-[#C3DDD5] text-teal-deep bg-teal-wash' : 'border-[#EAD9B4] text-amber bg-amber-wash')
      }
    >
      {auditType} audit
    </span>
  )
}

export function Banner({ kind, children }: { kind: 'success' | 'warn' | 'error'; children: ReactNode }) {
  const styles = {
    success: 'bg-teal-wash text-teal-deep border-[#C3DDD5]',
    warn: 'bg-amber-wash text-amber border-[#EAD9B4]',
    error: 'bg-rust-wash text-rust border-[#EEC2AC]',
  }[kind]
  return <div className={'rounded-lg px-3.5 py-3 text-sm border mb-3 ' + styles}>{children}</div>
}

export function ProgressBar({ pct }: { pct: number }) {
  const color = pct < 50 ? 'bg-rust' : pct < SUBMIT_THRESHOLD ? 'bg-amber' : 'bg-teal'
  return (
    <div className="h-2 rounded-full bg-[#EFEFEA] overflow-hidden">
      <div className={'h-full rounded-full transition-all ' + color} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function BackButton({ label = '← Back', onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink-soft"
    >
      {label}
    </button>
  )
}

// Every step's back control lives here, always left-aligned, always at the
// top of the card — so its position never has to be re-decided per step.
export function StepHeader({
  onBack,
  backLabel,
  children,
}: {
  onBack?: () => void
  backLabel?: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      {onBack ? <BackButton label={backLabel} onClick={onBack} /> : <span />}
      {children}
    </div>
  )
}

const STEP_ORDER: { step: WizardStep; label: string }[] = [
  { step: 'type', label: 'Audit type' },
  { step: 'clinic', label: 'Station' },
  { step: 'sistem', label: 'System qty' },
  { step: 'hub', label: 'Stations' },
  { step: 'dentallog', label: 'Line log' },
  { step: 'report', label: 'Report' },
]

// A dot-and-line stepper instead of a text breadcrumb with arrow separators
// — less visual clutter, and it reads at a glance which steps are done vs.
// upcoming without relying on repeated "→" characters.
export function Breadcrumb({ step }: { step: WizardStep }) {
  const order = step === 'report' ? ['type', 'clinic', 'sistem', 'hub', 'report'] : STEP_ORDER.map((s) => s.step)
  const currentIdx = order.indexOf(step)
  return (
    <div className="flex items-center mb-5">
      {order.map((s, i) => {
        const label = STEP_ORDER.find((o) => o.step === s)?.label ?? s
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={s} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <span className={'w-1.5 h-1.5 rounded-full ' + (active ? 'bg-teal-deep' : done ? 'bg-teal' : 'bg-line')} />
              <span
                className={
                  'text-[11px] font-mono uppercase tracking-wide whitespace-nowrap ' +
                  (active ? 'text-teal-deep font-semibold' : done ? 'text-ink-soft' : 'text-ink-soft/50')
                }
              >
                {label}
              </span>
            </div>
            {i < order.length - 1 && <span className="w-4 h-px bg-line mx-2 shrink-0" />}
          </div>
        )
      })}
    </div>
  )
}

export interface PageOf<T> {
  pageItems: T[]
  page: number
  totalPages: number
}

export function paginate<T>(items: T[], page: number, pageSize = 10): PageOf<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const clampedPage = Math.min(Math.max(1, page), totalPages)
  return { pageItems: items.slice((clampedPage - 1) * pageSize, clampedPage * pageSize), page: clampedPage, totalPages }
}

export function PaginationControls({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-end gap-2 mb-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="w-6 h-6 rounded border border-line text-ink-soft hover:border-ink-soft disabled:opacity-40"
        aria-label="Previous page"
      >
        ‹
      </button>
      <span className="text-xs font-mono text-ink-soft">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="w-6 h-6 rounded border border-line text-ink-soft hover:border-ink-soft disabled:opacity-40"
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  )
}

export function StationStatusPill({ status }: { status: 'Not Started' | 'In Progress' | 'Submitted' }) {
  if (status === 'Submitted') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-teal-wash text-teal-deep">
        <span className="w-1.5 h-1.5 rounded-full bg-teal" />
        Submitted
      </span>
    )
  }
  if (status === 'In Progress') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-amber-wash text-amber">
        <span className="w-1.5 h-1.5 rounded-full bg-amber" />
        In Progress
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-[#EFEFEA] text-ink-soft">
      <span className="w-1.5 h-1.5 rounded-full bg-[#9AA39C]" />
      Not started
    </span>
  )
}

export function ketersesuaianDisplay(pct: number | null) {
  return pct === null ? '—' : `${pct}%`
}
