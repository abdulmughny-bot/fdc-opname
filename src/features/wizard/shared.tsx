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

const STEP_ORDER: { step: WizardStep; label: string }[] = [
  { step: 'type', label: 'Audit type' },
  { step: 'clinic', label: 'Station' },
  { step: 'sistem', label: 'System qty' },
  { step: 'hub', label: 'Stations' },
  { step: 'dentallog', label: 'Line log' },
  { step: 'report', label: 'Report' },
]

export function Breadcrumb({ step }: { step: WizardStep }) {
  const order = step === 'report' ? ['type', 'clinic', 'sistem', 'hub', 'report'] : STEP_ORDER.map((s) => s.step)
  return (
    <div className="font-mono text-[11px] tracking-wide uppercase text-ink-soft mb-4 flex flex-wrap gap-1.5">
      {order.map((s, i) => {
        const label = STEP_ORDER.find((o) => o.step === s)?.label ?? s
        return (
          <span key={s} className={s === step ? 'text-teal-deep font-semibold' : ''}>
            {label}
            {i < order.length - 1 ? ' →' : ''}
          </span>
        )
      })}
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
