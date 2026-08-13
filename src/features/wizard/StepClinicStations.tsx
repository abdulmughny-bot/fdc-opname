import { useState } from 'react'
import type { VisibleClinic } from '../auth'
import { Banner, StepHeader, TrackBadge } from './shared'

export function StepClinicStations({
  clinics,
  auditType,
  onBack,
  onContinue,
}: {
  clinics: VisibleClinic[]
  auditType: 'Offline' | 'Self'
  onBack: () => void
  onContinue: (clinic: VisibleClinic, roomIds: string[]) => void | Promise<void>
}) {
  const [clinicId, setClinicId] = useState(clinics[0]?.id ?? '')
  const clinic = clinics.find((c) => c.id === clinicId) ?? null
  const [roomIds, setRoomIds] = useState<string[]>(clinic?.dentals.map((d) => d.id) ?? [])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function selectClinic(id: string) {
    setClinicId(id)
    setError(null)
    const next = clinics.find((c) => c.id === id)
    setRoomIds(next?.dentals.map((d) => d.id) ?? [])
  }

  function toggleRoom(id: string) {
    setError(null)
    setRoomIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  }

  async function handleContinue() {
    if (!clinic) return
    setSubmitting(true)
    setError(null)
    try {
      await onContinue(clinic, roomIds)
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-paper border border-line rounded-lg p-6 space-y-6">
      <StepHeader onBack={onBack} />

      <div>
        <h2 className="font-display text-2xl font-bold text-ink mb-2">Select clinic & stations</h2>
        <p className="text-sm text-ink-soft">Choose which dental stations to audit in this session. You can audit one or multiple stations.</p>
      </div>

      {clinics.length === 0 ? (
        <Banner kind="warn">You don't have access to any clinics. Ask a Lead to grant you clinic access.</Banner>
      ) : (
        <>
          {/* Clinic Selection */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Clinic</label>
            <select
              value={clinicId}
              onChange={(e) => selectClinic(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm bg-paper-secondary focus:outline-none focus:border-teal-deep transition-colors"
            >
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Station Selection */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Dental Stations</label>
            {clinic && clinic.dentals.length === 0 ? (
              <Banner kind="warn">This clinic has no dental stations registered.</Banner>
            ) : (
              <div className="border border-line rounded-lg p-4 bg-paper-secondary max-h-64 overflow-y-auto space-y-2">
                {clinic?.dentals.map((d) => (
                  <label
                    key={d.id}
                    className="flex items-center gap-3 p-3 rounded-md hover:bg-line-soft cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={roomIds.includes(d.id)}
                      onChange={() => toggleRoom(d.id)}
                      className="w-4 h-4 rounded border-line cursor-pointer"
                    />
                    <span className="text-sm font-medium text-ink flex-1">{d.name}</span>
                    <span className="text-xs text-ink-lighter bg-line-soft px-2 py-1 rounded">Station</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-ink-soft mt-2">
              {roomIds.length} station{roomIds.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        </>
      )}

      {error && <Banner kind="error">{error}</Banner>}

      <div className="flex items-center justify-between pt-4 border-t border-line">
        <TrackBadge auditType={auditType} />
        <button
          type="button"
          disabled={!clinic || roomIds.length === 0 || submitting}
          onClick={handleContinue}
          className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-6 py-2.5 hover:bg-teal transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? 'Starting…' : 'Continue to upload'}
        </button>
      </div>
    </div>
  )
}
