import { useState } from 'react'
import { adminSaveSettings } from '../../../lib/api'
import { useAppSettings } from '../../../lib/useAppSettings'
import { Banner } from '../../wizard/shared'

export function ThresholdSettings() {
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

  if (loading) return <div className="text-center py-10 text-sm text-ink-soft">Loading…</div>

  return (
    <div>
      <h3 className="font-display text-base font-bold mb-1.5">Stock opname acceptance threshold</h3>
      <p className="text-[13px] text-ink-soft mb-5">
        A station needs at least this % of its rows to have both Qty Sistem and Qty Fisik present before it can be
        submitted. Applies to every clinic and every audit going forward.
      </p>

      {error && <Banner kind="error">{error}</Banner>}
      {saved && <Banner kind="success">Saved.</Banner>}

      <div className="flex items-center gap-3 mb-6">
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

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2.5 hover:bg-teal transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
