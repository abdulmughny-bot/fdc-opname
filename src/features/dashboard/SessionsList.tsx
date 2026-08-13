import { useState } from 'react'
import { softDeleteSession } from '../../lib/api'
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

// Straight (unweighted) average of each submitted station's own ketersesuaian
// — matches the same convention used for the company-wide gauge and by-clinic
// table on the dashboard, so the number reads the same everywhere it appears.
function sessionKetersesuaian(stations: SessionWithStations['stations']) {
  const pcts = stations.filter((s) => s.status === 'Submitted' && s.ketersesuaian !== null).map((s) => s.ketersesuaian as number)
  if (pcts.length === 0) return null
  return Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="11.5" />
      <circle cx="12" cy="8" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SessionsList({
  items,
  onSelect,
  onDeleted,
}: {
  items: SessionWithStations[]
  onSelect: (sessionId: string) => void
  onDeleted: () => void
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [infoId, setInfoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRemove(sessionId: string) {
    setRemovingId(sessionId)
    setConfirmingId(null)
    setError(null)
    try {
      await softDeleteSession(sessionId)
      onDeleted()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRemovingId(null)
    }
  }

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
      {error && <div className="bg-rust-wash text-rust border border-[#EEC2AC] rounded-lg px-3.5 py-3 text-sm mb-2.5">{error}</div>}
      {items.map(({ session, stations, derivedStatus }) => {
        const submitted = stations.filter((s) => s.status === 'Submitted').length
        const pct = sessionKetersesuaian(stations)
        return (
          <div
            key={session.id}
            className="relative w-full border border-line rounded-[9px] px-4 py-3.5 mb-2.5 bg-paper flex items-center justify-between gap-3 hover:border-teal transition-colors"
          >
            <button type="button" onClick={() => onSelect(session.id)} className="text-left flex-1 flex items-center gap-2">
              <div>
                <div className="font-semibold text-sm">{session.clinic_name}</div>
                <div className="text-xs text-ink-soft font-mono mt-0.5">
                  {submitted}/{stations.length} dental
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setInfoId(infoId === session.id ? null : session.id)
              }}
              className="text-ink-soft hover:text-ink transition-colors shrink-0"
              aria-label="Session details"
            >
              <InfoIcon />
            </button>
            {infoId === session.id && (
              <div
                className="absolute left-4 top-full mt-1 z-10 bg-ink text-white text-xs font-mono rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
                onClick={(e) => e.stopPropagation()}
              >
                {new Date(session.started_at).toLocaleString()} · started by {session.started_by}
              </div>
            )}
            <div className="flex items-center gap-3.5 min-w-[150px] justify-end">
              {pct !== null && <span className="font-mono text-xs text-ink-soft">{pct}% avg</span>}
              <TrackBadge auditType={session.audit_type} />
              <StatusPill status={derivedStatus} />
              {confirmingId === session.id ? (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-ink-soft">Remove?</span>
                  <button
                    type="button"
                    disabled={removingId === session.id}
                    onClick={() => handleRemove(session.id)}
                    className="text-rust font-semibold hover:underline disabled:opacity-50"
                  >
                    {removingId === session.id ? 'Removing…' : 'Yes'}
                  </button>
                  <button type="button" onClick={() => setConfirmingId(null)} className="text-ink-soft hover:underline">
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(session.id)}
                  className="text-rust hover:bg-rust-wash rounded-md p-1.5 transition-colors"
                  aria-label="Remove session"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
