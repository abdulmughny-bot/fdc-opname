import { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import { supabase } from '../../lib/supabase'
import { Banner, StepHeader } from './shared'
import { lineStats, type SessionData } from './types'

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-report`

function buildPdf(data: SessionData, submitted: SessionData['dentals'], overall: number, totalMatched: number, totalFilled: number) {
  const doc = new jsPDF()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('FDC Stock Opname — Audit Report', 14, 18)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Clinic: ${data.session.clinic_name}`, 14, 27)
  doc.text(`Audit type: ${data.session.audit_type}`, 14, 33)
  doc.text(`Finished: ${data.session.finished_at ? new Date(data.session.finished_at).toLocaleString() : ''}`, 14, 39)
  doc.text(`Overall Ketersesuaian: ${overall}% (${totalMatched}/${totalFilled} lines matched)`, 14, 45)
  let y = 56
  doc.setFont('helvetica', 'bold')
  doc.text('Dental', 14, y)
  doc.text('Filled', 110, y)
  doc.text('Ketersesuaian', 150, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  submitted.forEach((d) => {
    const stats = lineStats(d.lines)
    doc.text(d.name, 14, y)
    doc.text(`${stats.scorable}/${stats.total}`, 110, y)
    doc.text(d.ketersesuaian === null ? '—' : `${d.ketersesuaian}%`, 150, y)
    y += 6
  })
  return doc
}

export function StepReport({
  data,
  onBackToDashboard,
}: {
  data: SessionData
  onBackToDashboard: () => void
}) {
  const [recipients, setRecipients] = useState<string[]>([])
  const [chipInput, setChipInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('clinic_recipients')
      .select('email')
      .eq('clinic_id', data.session.clinic_id)
      .then(({ data: rows }) => {
        if (!cancelled) setRecipients((rows ?? []).map((r) => r.email))
      })
    return () => {
      cancelled = true
    }
  }, [data.session.clinic_id])

  const submitted = data.dentals.filter((d) => d.status === 'Submitted')
  let totalFilled = 0
  let totalMatched = 0
  submitted.forEach((d) => {
    totalFilled += d.scorableCount
    totalMatched += d.matchedCount
  })
  const overall = totalFilled ? Math.round((totalMatched / totalFilled) * 1000) / 10 : 0

  function addRecipient() {
    const val = chipInput.trim()
    if (val && !recipients.includes(val)) setRecipients((r) => [...r, val])
    setChipInput('')
  }

  function downloadPdf() {
    const doc = buildPdf(data, submitted, overall, totalMatched, totalFilled)
    doc.save(`Opname_${data.session.clinic_name.replace(/\s+/g, '_')}.pdf`)
  }

  async function sendReport() {
    if (recipients.length === 0) {
      setError('Add at least one recipient first.')
      return
    }
    setSending(true)
    setError(null)
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession()
      if (!authSession) throw new Error('Not signed in.')
      const doc = buildPdf(data, submitted, overall, totalMatched, totalFilled)
      const pdfBase64 = doc.output('datauristring').split(',')[1]
      const resp = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authSession.access_token },
        body: JSON.stringify({
          sessionId: data.session.id,
          clinicName: data.session.clinic_name,
          recipients,
          pdfBase64,
          schema: import.meta.env.VITE_DB_SCHEMA,
        }),
      })
      const result = await resp.json()
      if (!resp.ok) throw new Error(result.error || 'Send failed.')
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-paper border border-line rounded-[10px] p-6">
      <StepHeader onBack={onBackToDashboard} backLabel="← Dashboard" />
      <h2 className="font-display text-base font-bold mb-1.5">Audit report — {data.session.clinic_name}</h2>
      <p className="text-[13px] text-ink-soft mb-4">
        {data.session.audit_type} audit · finished{' '}
        {data.session.finished_at ? new Date(data.session.finished_at).toLocaleString() : ''}
      </p>

      {error && <Banner kind="error">{error}</Banner>}
      {sent && <Banner kind="success">Sent to {recipients.join(', ')}.</Banner>}

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="border border-line rounded-lg p-4">
          <div className="text-xs text-ink-soft uppercase font-mono tracking-wide">Overall Ketersesuaian</div>
          <div className="font-display text-2xl font-bold mt-1">{overall}%</div>
          <div className="text-xs text-ink-soft mt-0.5">
            {totalMatched}/{totalFilled} lines matched
          </div>
        </div>
        <div className="border border-line rounded-lg p-4">
          <div className="text-xs text-ink-soft uppercase font-mono tracking-wide">Stations audited</div>
          <div className="font-display text-2xl font-bold mt-1">
            {submitted.length} / {data.dentals.length}
          </div>
          <div className="text-xs text-ink-soft mt-0.5">dentals submitted</div>
        </div>
      </div>

      <table className="w-full text-sm mb-5">
        <thead>
          <tr className="text-left text-xs text-ink-soft border-b border-line">
            <th className="py-1.5 font-medium">Dental</th>
            <th className="py-1.5 font-medium text-right">Items filled</th>
            <th className="py-1.5 font-medium text-right">Ketersesuaian</th>
          </tr>
        </thead>
        <tbody>
          {submitted.map((d) => {
            const stats = lineStats(d.lines)
            return (
              <tr key={d.roomId} className="border-b border-line/50">
                <td className="py-1.5">{d.name}</td>
                <td className="py-1.5 text-right font-mono text-xs">
                  {stats.scorable}/{stats.total}
                </td>
                <td className="py-1.5 text-right font-mono text-xs">
                  {d.ketersesuaian === null ? '—' : `${d.ketersesuaian}%`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex justify-end mb-5">
        <button
          type="button"
          onClick={downloadPdf}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink-soft"
        >
          Download PDF
        </button>
      </div>

      <h3 className="font-display text-base font-bold mt-1 mb-1.5">Send to</h3>
      <p className="text-[13px] text-ink-soft mb-3">
        Editable — add or remove recipients before sending. This sends a real email with a PDF attached.
      </p>
      <div className="flex flex-wrap items-center gap-2 border border-line rounded-md p-2 mb-4">
        {recipients.map((e) => (
          <span key={e} className="inline-flex items-center gap-1.5 bg-teal-wash text-teal-deep text-xs rounded-full px-2.5 py-1">
            {e}
            <button
              type="button"
              onClick={() => setRecipients((r) => r.filter((x) => x !== e))}
              className="hover:text-rust"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={chipInput}
          onChange={(e) => setChipInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
          placeholder="add email and press Enter"
          className="flex-1 min-w-[160px] text-sm px-1 py-1 outline-none"
        />
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          disabled={sending || sent}
          onClick={sendReport}
          className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2.5 hover:bg-teal transition-colors disabled:opacity-50"
        >
          {sent ? 'Sent' : sending ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </div>
  )
}
