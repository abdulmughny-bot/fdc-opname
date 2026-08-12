import { useEffect, useState } from 'react'
import { adminAddRecipient, adminRemoveRecipient } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { Banner } from '../wizard/shared'
import { useAllClinics } from './useAllClinics'

interface RecipientRow {
  id: string
  clinic_id: string
  email: string
  label: string | null
}

export function ClinicRecipients() {
  const { clinics, loading: clinicsLoading } = useAllClinics()
  const [recipients, setRecipients] = useState<RecipientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [clinicId, setClinicId] = useState('')
  const [email, setEmail] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function reload() {
    setLoading(true)
    const { data, error: err } = await supabase.from('clinic_recipients').select('*')
    if (err) setError(err.message)
    else setRecipients(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  useEffect(() => {
    if (!clinicId && clinics.length > 0) setClinicId(clinics[0].id)
  }, [clinics, clinicId])

  const forClinic = recipients.filter((r) => r.clinic_id === clinicId)

  async function handleAdd() {
    if (!email.trim()) {
      setError('Enter an email.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await adminAddRecipient(clinicId, email.trim(), label.trim() || null)
      setEmail('')
      setLabel('')
      await reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(recipientEmail: string) {
    setBusy(true)
    setError(null)
    try {
      await adminRemoveRecipient(clinicId, recipientEmail)
      await reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-paper border border-line rounded-[10px] p-6">
      <h2 className="font-display text-base font-bold mb-1.5">Clinic Recipients</h2>
      <p className="text-[13px] text-ink-soft mb-4">
        These pre-fill the recipient list when a report is sent. Still editable at send time.
      </p>

      {error && <Banner kind="error">{error}</Banner>}

      <label className="block text-xs font-semibold text-ink-soft mb-1">Clinic</label>
      <select
        value={clinicId}
        onChange={(e) => setClinicId(e.target.value)}
        className="w-full max-w-xs rounded-md border border-line px-2.5 py-2 text-sm mb-4"
      >
        {clinics.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {clinicsLoading || loading ? (
        <div className="text-center py-8 text-sm text-ink-soft">Loading…</div>
      ) : forClinic.length === 0 ? (
        <Banner kind="warn">No recipients set for this clinic — its reports will have no default recipients.</Banner>
      ) : (
        <table className="w-full text-sm mb-2">
          <thead>
            <tr className="text-left text-xs text-ink-soft border-b border-line">
              <th className="py-1.5 font-medium">Email</th>
              <th className="py-1.5 font-medium">Label</th>
              <th className="py-1.5 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody>
            {forClinic.map((r) => (
              <tr key={r.id} className="border-b border-line/50">
                <td className="py-1.5 font-mono text-xs">{r.email}</td>
                <td className="py-1.5">{r.label ?? '—'}</td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRemove(r.email)}
                    className="text-xs text-rust hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="grid grid-cols-[2fr_1fr_auto] gap-2.5 items-end mt-4">
        <div>
          <label className="block text-xs font-semibold text-ink-soft mb-1">Add email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@fdcdentalclinic.co.id"
            className="w-full rounded-md border border-line px-2.5 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-soft mb-1">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="HOC / PIC"
            className="w-full rounded-md border border-line px-2.5 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={handleAdd}
          className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2 hover:bg-teal transition-colors disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  )
}
