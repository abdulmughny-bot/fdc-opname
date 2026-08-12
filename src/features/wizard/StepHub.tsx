import { useState } from 'react'
import { addStation, finishSession, softDeleteStation } from '../../lib/api'
import type { VisibleClinic } from '../auth'
import { Banner, ProgressBar, StationStatusPill, StepHeader, TrackBadge, ketersesuaianDisplay } from './shared'
import { lineStats, type SessionData } from './types'

export function StepHub({
  sessionId,
  clinic,
  data,
  onExit,
  onReload,
  onOpenStation,
  onFinished,
}: {
  sessionId: string
  clinic: VisibleClinic
  data: SessionData
  onExit: () => void
  onReload: () => Promise<void>
  onOpenStation: (roomId: string) => void
  onFinished: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [addingRoomId, setAddingRoomId] = useState<string | null>(null)
  const [removingRoomId, setRemovingRoomId] = useState<string | null>(null)
  const [confirmingRoomId, setConfirmingRoomId] = useState<string | null>(null)

  const { session, dentals } = data
  const submittedCount = dentals.filter((d) => d.status === 'Submitted').length
  const notYetAdded = clinic.dentals.filter((d) => !dentals.some((existing) => existing.roomId === d.id))

  async function handleAddStation(roomId: string) {
    setAddingRoomId(roomId)
    setError(null)
    try {
      await addStation(sessionId, roomId)
      await onReload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAddingRoomId(null)
    }
  }

  async function handleRemoveStation(roomId: string) {
    setRemovingRoomId(roomId)
    setConfirmingRoomId(null)
    setError(null)
    try {
      await softDeleteStation(sessionId, roomId)
      await onReload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRemovingRoomId(null)
    }
  }

  async function handleFinish() {
    setFinishing(true)
    setError(null)
    try {
      await finishSession(sessionId)
      onFinished()
    } catch (err) {
      setError((err as Error).message)
      setFinishing(false)
    }
  }

  return (
    <div className="bg-paper border border-line rounded-[10px] p-6">
      <StepHeader onBack={onExit} backLabel="← Dashboard" />
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1.5">
        <div>
          <h2 className="font-display text-base font-bold">{session.clinic_name}</h2>
          <p className="text-[13px] text-ink-soft">
            {session.audit_type} audit · started by {session.started_by}
          </p>
        </div>
        <TrackBadge auditType={session.audit_type} />
      </div>

      <div className="flex justify-between text-xs text-ink-soft mb-1.5 mt-4">
        <span>Clinic progress</span>
        <span>
          {submittedCount} / {dentals.length} dental stations completed
        </span>
      </div>
      <div className="mb-5">
        <ProgressBar pct={dentals.length ? (submittedCount / dentals.length) * 100 : 0} />
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      <div className="space-y-2.5">
        {dentals.map((d) => {
          const stats = lineStats(d.lines)
          return (
            <div
              key={d.roomId}
              className="border border-line rounded-[9px] px-4 py-3.5 flex items-center justify-between gap-3 hover:border-teal transition-colors"
            >
              <button type="button" onClick={() => onOpenStation(d.roomId)} className="text-left flex-1">
                <div className="font-semibold text-sm">{d.name}</div>
                <div className="text-xs text-ink-soft mt-0.5">
                  {stats.scorable}/{stats.total} items filled
                </div>
              </button>
              <div className="flex items-center gap-3">
                {d.status === 'Submitted' ? (
                  <span className="text-xs font-mono text-ink-soft">{ketersesuaianDisplay(d.ketersesuaian)} sesuai</span>
                ) : stats.scorable > 0 ? (
                  <div className="w-24">
                    <ProgressBar pct={stats.pct} />
                  </div>
                ) : null}
                <StationStatusPill status={d.status} />
                {d.status !== 'Submitted' &&
                  (confirmingRoomId === d.roomId ? (
                    <span className="flex items-center gap-2 text-xs">
                      <span className="text-ink-soft">Remove?</span>
                      <button
                        type="button"
                        disabled={removingRoomId === d.roomId}
                        onClick={() => handleRemoveStation(d.roomId)}
                        className="text-rust font-semibold hover:underline disabled:opacity-50"
                      >
                        {removingRoomId === d.roomId ? 'Removing…' : 'Yes'}
                      </button>
                      <button type="button" onClick={() => setConfirmingRoomId(null)} className="text-ink-soft hover:underline">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingRoomId(d.roomId)}
                      className="text-xs text-rust hover:underline"
                    >
                      Remove
                    </button>
                  ))}
              </div>
            </div>
          )
        })}
      </div>

      {notYetAdded.length > 0 && (
        <div className="mt-4">
          <label className="block text-xs font-semibold text-ink-soft mb-1.5">Add another station</label>
          <div className="flex flex-wrap gap-2">
            {notYetAdded.map((d) => (
              <button
                key={d.id}
                type="button"
                disabled={addingRoomId === d.id}
                onClick={() => handleAddStation(d.id)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink-soft disabled:opacity-50"
              >
                {addingRoomId === d.id ? 'Adding…' : `+ ${d.name}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-5">
        <span className="text-[13px] text-ink-soft">
          {submittedCount === 0
            ? 'Submit at least one dental log to finish this clinic audit.'
            : 'You can finish now, or keep auditing more stations.'}
        </span>
        <button
          type="button"
          disabled={submittedCount === 0 || finishing}
          onClick={handleFinish}
          className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2.5 hover:bg-teal transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {finishing ? 'Finishing…' : 'Finish audit & generate report'}
        </button>
      </div>
    </div>
  )
}
