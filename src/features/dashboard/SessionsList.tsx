import type { SessionWithStations } from './types'

function TrackBadge({ auditType }: { auditType: string }) {
  const offline = auditType === 'Offline'
  return (
    <span
      className={
        'font-mono text-[10.5px] tracking-wider uppercase px-2.5 py-1 rounded-md border ' +
        (offline ? 'border-[#C3DDD5] text-teal-deep bg-teal-wash' : 'border-[#EAD9B4] text-amber bg-amber-wash')
      }
    >
      {auditType}
    </span>
  )
}

function StatusPill({ status }: { status: SessionWithStations['derivedStatus'] }) {
  if (status === 'Finished') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-teal-wash text-teal-deep">
        <span className="w-1.5 h-1.5 rounded-full bg-teal" />
        Finished
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
      Active
    </span>
  )
}

export function SessionsList({
  items,
  onSelect,
}: {
  items: SessionWithStations[]
  onSelect: (item: SessionWithStations) => void
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-ink-soft">
        <div className="font-display text-[15px] text-ink mb-1">No audit sessions match these filters</div>
        Try widening the period or clearing a filter.
      </div>
    )
  }

  return (
    <div>
      {items.map(({ session, stations, derivedStatus }) => {
        const submitted = stations.filter((s) => s.status === 'Submitted').length
        return (
          <button
            key={session.id}
            type="button"
            onClick={() => onSelect({ session, stations, derivedStatus })}
            className="w-full text-left border border-line rounded-[9px] px-4 py-3.5 mb-2.5 bg-paper flex items-center justify-between gap-3 hover:border-teal transition-colors"
          >
            <div>
              <div className="font-semibold text-sm">{session.clinic_name}</div>
              <div className="text-xs text-ink-soft font-mono mt-0.5">
                {new Date(session.started_at).toLocaleString()} · started by {session.started_by} · {submitted}/
                {stations.length} dental
              </div>
            </div>
            <div className="flex items-center gap-3.5 min-w-[150px] justify-end">
              <TrackBadge auditType={session.audit_type} />
              <StatusPill status={derivedStatus} />
            </div>
          </button>
        )
      })}
    </div>
  )
}
