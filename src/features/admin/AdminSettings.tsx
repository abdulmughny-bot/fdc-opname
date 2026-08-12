import { useState } from 'react'
import { adminSaveSettings } from '../../lib/api'
import { useAppSettings } from '../../lib/useAppSettings'
import { Banner } from '../wizard/shared'

export function AdminSettings() {
  const { submitThreshold, loading, reload } = useAppSettings()
  const [value, setValue] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayValue = value ?? String(submitThreshold)

  async function handleSave() {
    const num = Number(displayValue)
    if (!Number.isFinite(num) || num <= 0 || num > 100) {
      setError('Threshold must be a number between 0 and 100.')
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await adminSaveSettings(num)
      await reload()
      setSaved(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="bg-paper border border-line rounded-[10px] p-6 text-center text-sm text-ink-soft">Loading…</div>
  }

  return (
    <div className="bg-paper border border-line rounded-[10px] p-6">
      <h2 className="font-display text-base font-bold mb-1.5">Settings</h2>
      <p className="text-[13px] text-ink-soft mb-4">Applies to every clinic and every audit going forward.</p>

      {error && <Banner kind="error">{error}</Banner>}
      {saved && <Banner kind="success">Saved.</Banner>}

      <label className="block text-xs font-semibold text-ink-soft mb-1">Stock opname acceptance threshold</label>
      <p className="text-xs text-ink-soft mb-2">
        A station needs at least this % of its rows to have both Qty Sistem and Qty Fisik present before it can be submitted.
      </p>
      <div className="flex items-center gap-2 mb-5">
        <input
          type="number"
          min="1"
          max="100"
          value={displayValue}
          onChange={(e) => {
            setValue(e.target.value)
            setSaved(false)
          }}
          className="w-24 rounded-md border border-line px-2.5 py-2 text-sm font-mono"
        />
        <span className="text-sm text-ink-soft">%</span>
      </div>

      <div className="border-t border-line pt-4">
        <label className="block text-xs font-semibold text-ink-soft mb-1">Acceptable item types for upload</label>
        <p className="text-xs text-ink-soft">
          Not built yet — this needs a decision on what "item type" should mean here (a whitelist of units like PCS/BOX/BOTTLE,
          or a product category on each SKU?) before it can be implemented without guessing at the rule. Let me know which and
          I'll add it.
        </p>
      </div>

      <div className="flex justify-end mt-5">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2.5 hover:bg-teal transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  )
}
