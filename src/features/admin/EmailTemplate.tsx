import { useEffect, useState } from 'react'
import { adminSaveEmailTemplate } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { Banner } from '../wizard/shared'

const PREVIEW_SAMPLE: Record<string, string> = {
  clinic: 'FDC Bali',
  audit_type: 'Offline',
  period: 'August 2026',
  ketersesuaian: '92.5',
}

function fillPlaceholders(s: string) {
  return s.replace(/\{(\w+)\}/g, (_, k) => (PREVIEW_SAMPLE[k] !== undefined ? PREVIEW_SAMPLE[k] : '{' + k + '}'))
}

export function EmailTemplate() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('email_settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else if (data) {
          setSubject(data.subject_template)
          setBody(data.body_template)
        }
        setLoading(false)
      })
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await adminSaveEmailTemplate(subject, body)
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
      <h2 className="font-display text-base font-bold mb-1.5">Email Template</h2>
      <p className="text-[13px] text-ink-soft mb-4">
        Placeholders: <span className="font-mono">{'{clinic}'}</span> <span className="font-mono">{'{audit_type}'}</span>{' '}
        <span className="font-mono">{'{period}'}</span> <span className="font-mono">{'{ketersesuaian}'}</span> — filled in per
        report at send time.
      </p>

      {error && <Banner kind="error">{error}</Banner>}
      {saved && <Banner kind="success">Template saved.</Banner>}

      <label className="block text-xs font-semibold text-ink-soft mb-1">Subject</label>
      <input
        type="text"
        value={subject}
        onChange={(e) => {
          setSubject(e.target.value)
          setSaved(false)
        }}
        className="w-full rounded-md border border-line px-2.5 py-2 text-sm mb-3"
      />

      <label className="block text-xs font-semibold text-ink-soft mb-1">Body</label>
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          setSaved(false)
        }}
        rows={5}
        className="w-full rounded-md border border-line px-2.5 py-2 text-sm font-mono resize-y"
      />

      <h3 className="font-display text-base font-bold mt-5 mb-1.5">Preview</h3>
      <div className="bg-bg border border-line rounded-lg p-4">
        <div className="font-semibold text-sm mb-1.5">{fillPlaceholders(subject)}</div>
        <div className="text-[13px] whitespace-pre-wrap">{fillPlaceholders(body)}</div>
      </div>

      <div className="flex justify-end mt-4">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2.5 hover:bg-teal transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save template'}
        </button>
      </div>
    </div>
  )
}
