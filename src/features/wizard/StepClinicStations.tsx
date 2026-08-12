import { useState } from 'react'
import type { VisibleClinic } from '../auth'
import { Banner, BackButton, TrackBadge } from './shared'

export function StepClinicStations({
  clinics,
  auditType,
  onBack,
  onContinue,
}: {
  clinics: VisibleClinic[]
  auditType: 'Offline' | 'Self'
  onBack: () => void
  onContinue: (clinic: VisibleClinic, roomIds: string[]) => void
}) {
  const [clinicId, setClinicId] = useState(clinics[0]?.id ?? '')
  const clinic = clinics.find((c) => c.id === clinicId) ?? null
  const [roomIds, setRoomIds] = useState<string[]>(clinic?.dentals.map((d) => d.id) ?? [])

  function selectClinic(id: string) {
    setClinicId(id)
    const next = clinics.find((c) => c.id === id)
    setRoomIds(next?.dentals.map((d) => d.id) ?? [])
  }

  function toggleRoom(id: string) {
    setRoomIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  }

  return (
    <div className="bg-paper border border-line rounded-[10px] p-6">
      <h2 className="font-display text-base font-bold mb-1.5">Select the clinic and stations</h2>
      <p className="text-[13px] text-ink-soft mb-4">
        Choose which dental stations to audit this session. One upload = one station.
      </p>

      {clinics.length === 0 ? (
        <Banner kind="warn">You don't have access to any clinics. Ask a Lead to grant you clinic access.</Banner>
      ) : (
        <>
          <label className="block text-xs font-semibold text-ink-soft mb-1">Clinic</label>
          <select
            value={clinicId}
            onChange={(e) => selectClinic(e.target.value)}
            className="w-full rounded-md border border-line px-2.5 py-2 text-sm mb-4"
          >
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <label className="block text-xs font-semibold text-ink-soft mb-1.5">Dental stations</label>
          {clinic && clinic.dentals.length === 0 ? (
            <Banner kind="warn">This clinic has no dental stations registered.</Banner>
          ) : (
            <div className="border border-line rounded-md p-2.5 mb-4 max-h-56 overflow-auto">
              {clinic?.dentals.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm py-1.5 px-1 cursor-pointer">
                  <input type="checkbox" checked={roomIds.includes(d.id)} onChange={() => toggleRoom(d.id)} />
                  {d.name}
                </label>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex items-center justify-between mt-5">
        <BackButton onClick={onBack} />
        <div className="flex items-center gap-3">
          <TrackBadge auditType={auditType} />
          <button
            type="button"
            disabled={!clinic || roomIds.length === 0}
            onClick={() => clinic && onContinue(clinic, roomIds)}
            className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2.5 hover:bg-teal transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
