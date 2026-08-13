import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../../lib/supabase'
import { adminUpsertClinic, adminDeleteClinic, adminUpsertRoom, adminDeleteRoom } from '../../../lib/api'
import { Banner } from '../../wizard/shared'
import type { ClinicRow } from '../types'
import type { Database } from '../../../types/database'

type RoomRow = Database['dev']['Tables']['rooms']['Row']

// Matches the random 4-char codes already used for every seeded clinic id
// (see supabase/migrations/0001_schema.sql) — an admin creating a new clinic
// only ever types the name, not this internal key.
function randomClinicId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />
      <div className="relative bg-paper border border-line rounded-[10px] shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-ink-soft hover:text-ink hover:bg-bg text-lg leading-none"
        >
          ×
        </button>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function ClinicEditor({
  clinic,
  onCancel,
  onSaved,
}: {
  clinic: ClinicRow | 'new'
  onCancel: () => void
  onSaved: () => void
}) {
  const editing = clinic !== 'new'
  const [name, setName] = useState(editing ? clinic.name : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!name.trim()) {
      setError('Give the clinic a name.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await adminUpsertClinic(editing ? clinic.id : randomClinicId(), name.trim())
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onCancel}>
      <h2 className="font-display text-base font-bold mb-3">{editing ? 'Rename clinic' : 'New clinic'}</h2>
      {error && <Banner kind="error">{error}</Banner>}
      <div>
        <label className="block text-xs font-semibold text-ink-soft mb-1">Clinic name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. FDC Surabaya"
          autoFocus
          className="w-full rounded-md border border-line px-2.5 py-2 text-sm"
        />
      </div>
      <div className="flex items-center justify-end gap-3 mt-4">
        <button type="button" onClick={onCancel} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink-soft">
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2 hover:bg-teal transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : editing ? 'Save' : 'Create clinic'}
        </button>
      </div>
    </Modal>
  )
}

function RoomEditor({
  clinicId,
  room,
  onCancel,
  onSaved,
}: {
  clinicId: string
  room: RoomRow | 'new'
  onCancel: () => void
  onSaved: () => void
}) {
  const editing = room !== 'new'
  const [name, setName] = useState(editing ? room.name : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!name.trim()) {
      setError('Give the station a name.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await adminUpsertRoom(editing ? room.id : null, clinicId, name.trim())
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onCancel}>
      <h2 className="font-display text-base font-bold mb-3">{editing ? 'Rename station' : 'New station'}</h2>
      {error && <Banner kind="error">{error}</Banner>}
      <div>
        <label className="block text-xs font-semibold text-ink-soft mb-1">Station name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Dental 6"
          autoFocus
          className="w-full rounded-md border border-line px-2.5 py-2 text-sm"
        />
      </div>
      <div className="flex items-center justify-end gap-3 mt-4">
        <button type="button" onClick={onCancel} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink-soft">
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2 hover:bg-teal transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : editing ? 'Save' : 'Add station'}
        </button>
      </div>
    </Modal>
  )
}

export function ClinicStations() {
  const [clinics, setClinics] = useState<ClinicRow[]>([])
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [clinicEditor, setClinicEditor] = useState<ClinicRow | 'new' | null>(null)
  const [roomEditor, setRoomEditor] = useState<{ clinicId: string; room: RoomRow | 'new' } | null>(null)
  const [deletingClinicId, setDeletingClinicId] = useState<string | null>(null)
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const [clinicsRes, roomsRes] = await Promise.all([
        supabase.from('clinics').select('*').order('name'),
        supabase.from('rooms').select('*').order('name'),
      ])
      if (clinicsRes.error) throw clinicsRes.error
      if (roomsRes.error) throw roomsRes.error
      setClinics(clinicsRes.data ?? [])
      setRooms(roomsRes.data ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setClinicEditor(null)
      setRoomEditor(null)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  async function handleDeleteClinic(id: string) {
    setBusyId(id)
    setError(null)
    try {
      await adminDeleteClinic(id)
      setDeletingClinicId(null)
      await reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeleteRoom(id: string) {
    setBusyId(id)
    setError(null)
    try {
      await adminDeleteRoom(id)
      setDeletingRoomId(null)
      await reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <div className="text-center py-10 text-sm text-ink-soft">Loading…</div>

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div>
          <h2 className="font-display text-base font-bold">Clinic &amp; Station</h2>
          <p className="text-[13px] text-ink-soft">
            Manage which clinics exist and which dental stations belong to each — this is what the audit wizard's
            clinic and station pickers are built from.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setClinicEditor('new')}
          className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2.5 hover:bg-teal transition-colors whitespace-nowrap"
        >
          + New clinic
        </button>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {clinics.length === 0 ? (
        <div className="text-center py-10 text-sm text-ink-soft">No clinics yet.</div>
      ) : (
        <div className="space-y-3 mt-3">
          {clinics.map((c) => {
            const clinicRooms = rooms.filter((r) => r.clinic_id === c.id)
            return (
              <div key={c.id} className="border border-line rounded-lg">
                <div className="flex items-center justify-between gap-3 px-3.5 py-3 border-b border-line-soft">
                  <div>
                    <div className="font-semibold text-sm">{c.name}</div>
                    <div className="font-mono text-[11px] text-ink-soft">{c.id} · {clinicRooms.length} station(s)</div>
                  </div>
                  {deletingClinicId === c.id ? (
                    <span className="inline-flex items-center gap-2 text-xs">
                      <span className="text-ink-soft">Delete?</span>
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => handleDeleteClinic(c.id)}
                        className="text-rust font-semibold hover:underline disabled:opacity-50"
                      >
                        {busyId === c.id ? 'Working…' : 'Yes'}
                      </button>
                      <button type="button" onClick={() => setDeletingClinicId(null)} className="text-ink-soft hover:underline">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => setClinicEditor(c)} className="text-xs text-ink-soft hover:text-ink hover:underline px-2 py-1">
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingClinicId(c.id)}
                        title="Delete clinic"
                        className="text-rust hover:bg-rust-wash rounded-md p-1.5"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-3.5">
                  {clinicRooms.length === 0 ? (
                    <p className="text-xs text-ink-soft mb-2">No stations yet.</p>
                  ) : (
                    <div className="space-y-1.5 mb-2.5">
                      {clinicRooms.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-3 bg-bg rounded-md px-3 py-2">
                          <span className="text-sm">{r.name}</span>
                          {deletingRoomId === r.id ? (
                            <span className="inline-flex items-center gap-2 text-xs">
                              <span className="text-ink-soft">Delete?</span>
                              <button
                                type="button"
                                disabled={busyId === r.id}
                                onClick={() => handleDeleteRoom(r.id)}
                                className="text-rust font-semibold hover:underline disabled:opacity-50"
                              >
                                {busyId === r.id ? 'Working…' : 'Yes'}
                              </button>
                              <button type="button" onClick={() => setDeletingRoomId(null)} className="text-ink-soft hover:underline">
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setRoomEditor({ clinicId: c.id, room: r })}
                                className="text-xs text-ink-soft hover:text-ink hover:underline px-2 py-1"
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingRoomId(r.id)}
                                title="Delete station"
                                className="text-rust hover:bg-rust-wash rounded-md p-1.5"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setRoomEditor({ clinicId: c.id, room: 'new' })}
                    className="text-xs font-semibold text-teal-deep hover:underline"
                  >
                    + Add station
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {clinicEditor && <ClinicEditor clinic={clinicEditor} onCancel={() => setClinicEditor(null)} onSaved={reload} />}
      {roomEditor && (
        <RoomEditor clinicId={roomEditor.clinicId} room={roomEditor.room} onCancel={() => setRoomEditor(null)} onSaved={reload} />
      )}
    </div>
  )
}
