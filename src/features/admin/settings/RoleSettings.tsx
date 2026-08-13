import { useEffect, useState, type ReactNode } from 'react'
import {
  adminDeleteCustomRole,
  adminListCustomRoles,
  adminUpsertCustomRole,
  type CustomRoleRow,
} from '../../../lib/api'
import { Banner } from '../../wizard/shared'

const PERMISSIONS: { key: keyof Pick<CustomRoleRow, 'can_view_pricing' | 'can_edit_item_master' | 'can_manage_users' | 'can_access_admin'>; label: string; hint: string }[] = [
  { key: 'can_view_pricing', label: 'View pricing', hint: 'See cost, selling price, and margin in Item Master.' },
  { key: 'can_edit_item_master', label: 'Edit item master', hint: 'Add and edit items, SKUs, and standard quantities.' },
  { key: 'can_manage_users', label: 'Manage users', hint: 'Add, edit, deactivate, and delete people and access.' },
  { key: 'can_access_admin', label: 'Access admin area', hint: 'Open Settings & Admin at all.' },
]

// Same backdrop convention as PeopleAccess's Modal: no onClick on the
// backdrop, so only Cancel/×/Save close it.
function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />
      <div className="relative bg-paper border border-line rounded-[10px] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
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

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function RoleEditor({
  role,
  onCancel,
  onSaved,
}: {
  role: CustomRoleRow | 'new'
  onCancel: () => void
  onSaved: () => void
}) {
  const editing = role !== 'new'
  const [name, setName] = useState(editing ? role.name : '')
  const [perms, setPerms] = useState({
    can_view_pricing: editing ? role.can_view_pricing : false,
    can_edit_item_master: editing ? role.can_edit_item_master : false,
    can_manage_users: editing ? role.can_manage_users : false,
    can_access_admin: editing ? role.can_access_admin : false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    if (!name.trim()) {
      setError('Give the role a name.')
      return
    }
    setSaving(true)
    try {
      await adminUpsertCustomRole(
        editing ? role.id : null,
        name.trim(),
        perms.can_view_pricing,
        perms.can_edit_item_master,
        perms.can_manage_users,
        perms.can_access_admin
      )
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onCancel}>
      <h2 className="font-display text-base font-bold mb-3">{editing ? 'Edit role' : 'New role'}</h2>
      {error && <Banner kind="error">{error}</Banner>}
      <div>
        <label className="block text-xs font-semibold text-ink-soft mb-1">Role name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Auditor"
          className="w-full rounded-md border border-line px-2.5 py-2 text-sm"
        />
      </div>
      <div className="mt-4 space-y-2.5">
        <label className="block text-xs font-semibold text-ink-soft">Permissions</label>
        {PERMISSIONS.map((p) => (
          <label key={p.key} className="flex items-start gap-2.5 rounded-md border border-line px-3 py-2.5 cursor-pointer hover:bg-bg">
            <input
              type="checkbox"
              checked={perms[p.key]}
              onChange={(e) => setPerms((prev) => ({ ...prev, [p.key]: e.target.checked }))}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium text-ink">{p.label}</span>
              <span className="block text-xs text-ink-soft">{p.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3 mt-5">
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
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Create role'}
        </button>
      </div>
    </Modal>
  )
}

function permsSummary(r: CustomRoleRow) {
  const active = PERMISSIONS.filter((p) => r[p.key]).map((p) => p.label)
  return active.length ? active.join(' · ') : 'No permissions granted'
}

export function RoleSettings() {
  const [roles, setRoles] = useState<CustomRoleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editorFor, setEditorFor] = useState<CustomRoleRow | 'new' | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      setRoles(await adminListCustomRoles())
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

  async function handleDelete(id: string) {
    setBusyId(id)
    setError(null)
    try {
      await adminDeleteCustomRole(id)
      setConfirmingId(null)
      await reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div>
          <h2 className="font-display text-base font-bold">Role settings</h2>
          <p className="text-[13px] text-ink-soft">
            Lead and Team stay fixed. Create named permission bundles for finer-grained access, then assign them to
            Team members in People &amp; Access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditorFor('new')}
          className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2.5 hover:bg-teal transition-colors whitespace-nowrap"
        >
          + New role
        </button>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {loading ? (
        <div className="text-center py-10 text-sm text-ink-soft">Loading…</div>
      ) : roles.length === 0 ? (
        <div className="text-center py-10 text-sm text-ink-soft">No custom roles yet.</div>
      ) : (
        <div className="space-y-2 mt-3">
          {roles.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 border border-line rounded-md px-3.5 py-3">
              <div className="min-w-0">
                <div className="font-semibold text-sm">{r.name}</div>
                <div className="text-xs text-ink-soft truncate">{permsSummary(r)}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {confirmingId === r.id ? (
                  <span className="inline-flex items-center gap-2 text-xs">
                    <span className="text-ink-soft">Delete?</span>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => handleDelete(r.id)}
                      className="text-rust font-semibold hover:underline disabled:opacity-50"
                    >
                      {busyId === r.id ? 'Working…' : 'Yes'}
                    </button>
                    <button type="button" onClick={() => setConfirmingId(null)} className="text-ink-soft hover:underline">
                      Cancel
                    </button>
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditorFor(r)}
                      className="text-xs text-ink-soft hover:text-ink hover:underline px-2 py-1"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(r.id)}
                      title="Delete role"
                      className="text-rust hover:bg-rust-wash rounded-md p-1.5"
                    >
                      <TrashIcon />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editorFor && <RoleEditor role={editorFor} onCancel={() => setEditorFor(null)} onSaved={reload} />}
    </div>
  )
}
