import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { adminDeactivateUser, adminListUsers, adminReactivateUser, adminUpsertUser, type AdminUserRow } from '../../lib/api'
import { useAuth } from '../auth'
import { Banner } from '../wizard/shared'
import { useAllClinics } from './useAllClinics'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INVITE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invite`

function scopeText(p: AdminUserRow) {
  if (p.all_clinics) return 'All clinics'
  return p.clinic_ids.length ? `${p.clinic_ids.length} clinic(s)` : '—'
}

// Full-viewport backdrop sits above the page content, so nothing behind it
// is clickable — and there's deliberately no onClick here, so clicking the
// backdrop does nothing. Only Cancel, the × button, or Save close this.
function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />
      <div className="relative bg-paper border border-line rounded-[10px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
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

async function sendInviteEmail(email: string, name: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return
  await fetch(INVITE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify({ email, name, siteUrl: window.location.origin, schema: import.meta.env.VITE_DB_SCHEMA }),
  }).catch(() => {
    // Invite email failing shouldn't undo the person having been added —
    // surfaced separately in the editor rather than blocking the save.
  })
}

function PersonEditor({
  person,
  onCancel,
  onSaved,
}: {
  person: AdminUserRow | 'new'
  onCancel: () => void
  onSaved: () => void
}) {
  const { profile } = useAuth()
  const { clinics } = useAllClinics()
  const editing = person !== 'new'
  const [name, setName] = useState(editing ? person.name : '')
  const [email, setEmail] = useState(editing ? person.email : '')
  const [role, setRole] = useState<'Lead' | 'Team'>(editing ? person.role : 'Team')
  const [allClinics, setAllClinics] = useState(editing ? person.all_clinics : false)
  const [clinicIds, setClinicIds] = useState<string[]>(editing ? person.clinic_ids : [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteWarning, setInviteWarning] = useState<string | null>(null)

  function toggleClinic(id: string) {
    setClinicIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  async function save() {
    setError(null)
    setInviteWarning(null)
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.')
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('That doesn’t look like a valid email address.')
      return
    }
    if (!allClinics && clinicIds.length === 0) {
      setError('Pick at least one clinic, or enable All clinics.')
      return
    }
    const selfCheckEmail = editing ? person.email : email.trim()
    if (selfCheckEmail.toLowerCase() === profile?.email.toLowerCase() && role !== 'Lead') {
      setError('You cannot remove your own Lead role.')
      return
    }
    setSaving(true)
    try {
      await adminUpsertUser(editing ? person.email : null, email.trim(), name.trim(), role, allClinics, clinicIds)
      if (!editing) {
        try {
          await sendInviteEmail(email.trim(), name.trim())
        } catch {
          setInviteWarning('Person added, but the invite email could not be sent.')
        }
      }
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onCancel}>
      <h2 className="font-display text-base font-bold mb-3">{editing ? 'Edit access' : 'Add person'}</h2>
      {error && <Banner kind="error">{error}</Banner>}
      {inviteWarning && <Banner kind="warn">{inviteWarning}</Banner>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-ink-soft mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-line px-2.5 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-soft mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-line px-2.5 py-2 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className="block text-xs font-semibold text-ink-soft mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'Lead' | 'Team')}
            className="w-full rounded-md border border-line px-2.5 py-2 text-sm"
          >
            <option value="Team">Team</option>
            <option value="Lead">Lead</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-soft mb-1">Clinic access</label>
          <label className="flex items-center gap-2 text-sm py-2 cursor-pointer">
            <input type="checkbox" checked={allClinics} onChange={(e) => setAllClinics(e.target.checked)} />
            All clinics
          </label>
        </div>
      </div>
      <div className="mt-3">
        <label className="block text-xs font-semibold text-ink-soft mb-1.5">Specific clinics</label>
        <div
          className={
            'border border-line rounded-md p-2.5 max-h-48 overflow-auto grid grid-cols-2 gap-x-3 transition-opacity ' +
            (allClinics ? 'opacity-40 pointer-events-none' : '')
          }
        >
          {clinics.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm py-1 px-1 cursor-pointer">
              <input type="checkbox" checked={clinicIds.includes(c.id)} onChange={() => toggleClinic(c.id)} />
              {c.name}
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink-soft"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2 hover:bg-teal transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Add person'}
        </button>
      </div>
    </Modal>
  )
}

function StatusControl({
  person,
  isSelf,
  busy,
  confirming,
  onRequestConfirm,
  onCancelConfirm,
  onConfirm,
}: {
  person: AdminUserRow
  isSelf: boolean
  busy: boolean
  confirming: boolean
  onRequestConfirm: () => void
  onCancelConfirm: () => void
  onConfirm: () => void
}) {
  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="text-ink-soft">{person.active ? 'Deactivate?' : 'Reactivate?'}</span>
        <button type="button" disabled={busy} onClick={onConfirm} className="text-rust font-semibold hover:underline disabled:opacity-50">
          {busy ? 'Working…' : 'Yes'}
        </button>
        <button type="button" onClick={onCancelConfirm} className="text-ink-soft hover:underline">
          Cancel
        </button>
      </span>
    )
  }
  const disabled = isSelf && person.active
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? "You can't deactivate your own account." : undefined}
      onClick={onRequestConfirm}
      className={
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold transition-opacity ' +
        (person.active ? 'bg-teal-wash text-teal-deep' : 'bg-[#EFEFEA] text-ink-soft') +
        (disabled ? ' cursor-default' : ' cursor-pointer hover:opacity-80')
      }
    >
      <span className={'w-1.5 h-1.5 rounded-full ' + (person.active ? 'bg-teal' : 'bg-[#9AA39C]')} />
      {person.active ? 'Active' : 'Inactive'}
    </button>
  )
}

export function PeopleAccess() {
  const { profile } = useAuth()
  const [people, setPeople] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editorFor, setEditorFor] = useState<AdminUserRow | 'new' | null>(null)
  const [confirmingEmail, setConfirmingEmail] = useState<string | null>(null)
  const [busyEmail, setBusyEmail] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      setPeople(await adminListUsers())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setEditorFor(null)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleToggleStatus(p: AdminUserRow) {
    setBusyEmail(p.email)
    setError(null)
    try {
      if (p.active) await adminDeactivateUser(p.email)
      else await adminReactivateUser(p.email)
      setConfirmingEmail(null)
      await reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyEmail(null)
    }
  }

  return (
    <div className="bg-paper border border-line rounded-[10px] p-6">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div>
          <h2 className="font-display text-base font-bold">People &amp; Access</h2>
          <p className="text-[13px] text-ink-soft">Add people before they sign in. Deactivating is reversible and keeps history.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditorFor('new')}
          className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2.5 hover:bg-teal transition-colors"
        >
          + Add person
        </button>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {loading ? (
        <div className="text-center py-10 text-sm text-ink-soft">Loading…</div>
      ) : (
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-left text-xs text-ink-soft border-b border-line">
              <th className="py-1.5 font-medium">Person</th>
              <th className="py-1.5 font-medium">Role</th>
              <th className="py-1.5 font-medium">Clinic scope</th>
              <th className="py-1.5 font-medium">Status</th>
              <th className="py-1.5 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const isSelf = p.email.toLowerCase() === profile?.email.toLowerCase()
              return (
                <tr key={p.email} className={'border-b border-line/50 ' + (p.active ? '' : 'opacity-50')}>
                  <td className="py-2">
                    <div className="font-semibold">{p.name}</div>
                    <div className="font-mono text-[11px] text-ink-soft">
                      {p.email}
                      {!p.has_signed_in && ' · not signed in yet'}
                    </div>
                  </td>
                  <td className="py-2">{p.role}</td>
                  <td className="py-2">{scopeText(p)}</td>
                  <td className="py-2">
                    <StatusControl
                      person={p}
                      isSelf={isSelf}
                      busy={busyEmail === p.email}
                      confirming={confirmingEmail === p.email}
                      onRequestConfirm={() => setConfirmingEmail(p.email)}
                      onCancelConfirm={() => setConfirmingEmail(null)}
                      onConfirm={() => handleToggleStatus(p)}
                    />
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button type="button" onClick={() => setEditorFor(p)} className="text-xs text-ink-soft hover:text-ink hover:underline">
                      Edit
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {editorFor && <PersonEditor person={editorFor} onCancel={() => setEditorFor(null)} onSaved={reload} />}
    </div>
  )
}
