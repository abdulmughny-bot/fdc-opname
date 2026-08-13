import { useEffect, useState } from 'react'
import html2pdf from 'html2pdf.js'
import { supabase } from '../../lib/supabase'
import { Button, Dialog } from '../../components'
import { Banner, StepHeader } from './shared'
import { lineStats, type SessionData } from './types'

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-report`

function buildPdfHtml(data: SessionData, submitted: SessionData['dentals'], overall: number) {
  const startedAtDate = data.session.started_at ? new Date(data.session.started_at).toLocaleString() : 'N/A'
  const finishedAtDate = data.session.finished_at ? new Date(data.session.finished_at).toLocaleString() : 'N/A'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1B231F; }
        .header { margin-bottom: 30px; }
        .header h1 { margin: 0 0 15px 0; font-size: 20px; }
        .header-meta { font-size: 13px; color: #5B655F; line-height: 1.6; }
        .overall-stat { background: #E4F0EC; border: 1px solid #D0E8E3; border-radius: 6px; padding: 15px; margin: 15px 0; }
        .overall-stat .percent { font-family: monospace; font-size: 28px; font-weight: bold; color: #1F6F64; }
        .overall-stat .label { font-size: 12px; color: #5B655F; margin-top: 5px; }
        .station-section { page-break-inside: avoid; margin-bottom: 30px; border: 1px solid #DDDFD8; border-radius: 6px; overflow: hidden; }
        .station-header { background: #F6F6F3; padding: 15px; border-bottom: 1px solid #DDDFD8; }
        .station-name { font-size: 14px; font-weight: bold; color: #1B231F; margin-bottom: 8px; }
        .station-stat { font-family: monospace; font-size: 24px; font-weight: bold; color: #1F6F64; margin: 10px 0; }
        .station-meta { font-size: 12px; color: #5B655F; line-height: 1.5; }
        .amended-badge { display: inline-block; background: #FBE9E2; color: #B3401F; padding: 4px 8px; border-radius: 3px; font-size: 11px; font-weight: bold; margin-left: 10px; }
        .station-body { padding: 15px; }
        .items-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px; }
        .items-table th { background: #F6F6F3; padding: 10px; text-align: left; border-bottom: 1px solid #DDDFD8; font-weight: bold; color: #5B655F; }
        .items-table td { padding: 8px 10px; border-bottom: 1px solid #DDDFD8; }
        .items-table tr:last-child td { border-bottom: none; }
        .sku-col { font-family: monospace; color: #1F6F64; }
        .selisih-col { font-family: monospace; font-weight: bold; }
        .selisih-loss { color: #B3401F; }
        .selisih-gain { color: #5B655F; }
        .badge-kurang { background: #FBE9E2; color: #B3401F; padding: 3px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; }
        .badge-lebih { background: #E4F0EC; color: #1F6F64; padding: 3px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; }
        .subtotal-row { background: #F6F6F3; font-weight: bold; }
        .rp-col { font-family: monospace; text-align: right; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>FDC Stock Opname — Audit Report</h1>
        <div class="header-meta">
          <div><strong>Clinic:</strong> ${data.session.clinic_name}</div>
          <div><strong>Audit type:</strong> ${data.session.audit_type}</div>
          <div><strong>Started:</strong> ${startedAtDate}</div>
          <div><strong>Finished:</strong> ${finishedAtDate}</div>
          ${data.session.started_by ? `<div><strong>Started by:</strong> ${data.session.started_by}</div>` : ''}
        </div>
      </div>

      <div class="overall-stat">
        <div class="percent">${overall}%</div>
        <div class="label">Overall Ketersesuaian</div>
      </div>

      ${submitted.map((dental) => {
        const stats = lineStats(dental.lines)
        const submittedDate = dental.submittedAt ? new Date(dental.submittedAt).toLocaleString() : '—'

        // Note: Rp valuation would require pricing data joined with items
        // For now, we skip it and focus on quantity discrepancies

        return `
          <div class="station-section">
            <div class="station-header">
              <div class="station-name">
                ${dental.name}
                ${dental.amended ? '<span class="amended-badge">✎ Amended</span>' : ''}
              </div>
              <div class="station-stat">${dental.ketersesuaian ?? '—'}%</div>
              <div class="station-meta">
                <div>Match: ${stats.matched} · Items: ${stats.scorable} · Selisih: ${stats.scorable - stats.matched}</div>
                <div>Submitted: ${submittedDate}</div>
              </div>
            </div>
            <div class="station-body">
              <table class="items-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Qty Sistem</th>
                    <th>Qty Fisik</th>
                    <th>Selisih</th>
                    <th>Jenis</th>
                  </tr>
                </thead>
                <tbody>
                  ${dental.lines.map((line) => {
                    const sistem = line.qty_sistem !== null ? Number(line.qty_sistem) : null
                    const fisik = line.qty_fisik !== null ? Number(line.qty_fisik) : null
                    const selisih = sistem !== null && fisik !== null ? fisik - sistem : null
                    const jenis = selisih === null ? '—' : selisih < 0 ? 'Kurang' : selisih > 0 ? 'Lebih' : 'Match'
                    const jenisClass = jenis === 'Kurang' ? 'badge-kurang' : jenis === 'Lebih' ? 'badge-lebih' : ''
                    const selisihDisplay = selisih !== null ? (selisih < 0 ? selisih : `+${selisih}`) : '—'
                    const selisihClass = selisih !== null && selisih < 0 ? 'selisih-loss' : 'selisih-gain'

                    return `
                      <tr>
                        <td class="sku-col">${line.barang_sku}</td>
                        <td>${line.barang_sku}</td>
                        <td>${sistem !== null ? sistem : '—'}</td>
                        <td>${fisik !== null ? fisik : '—'}</td>
                        <td class="selisih-col ${selisihClass}">${selisihDisplay}</td>
                        <td><span class="${jenisClass}">${jenis}</span></td>
                      </tr>
                    `
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `
      }).join('')}
    </body>
    </html>
  `
  return html
}

function buildPdf(data: SessionData, submitted: SessionData['dentals'], overall: number) {
  const html = buildPdfHtml(data, submitted, overall)
  const element = document.createElement('div')
  element.innerHTML = html

  const opt = {
    margin: 10,
    filename: `Opname_${data.session.clinic_name.replace(/\s+/g, '_')}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: 'portrait' as const, unit: 'mm' as const, format: 'a4' as const },
  }

  return html2pdf().set(opt).from(element)
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

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
    buildPdf(data, submitted, overall)
      .save()
      .catch((err) => console.error('PDF download failed:', err))
  }

  function openPreview() {
    buildPdf(data, submitted, overall)
      .outputPdf('dataurlstring')
      .then((pdfUrl) => setPreviewUrl(pdfUrl as string))
      .catch((err) => console.error('PDF preview failed:', err))
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
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

      const pdfUrl = (await buildPdf(data, submitted, overall).outputPdf('dataurlstring')) as string
      const pdfBase64 = pdfUrl.split(',')[1]

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

      <div className="flex justify-end gap-2 mb-5">
        <button
          type="button"
          onClick={openPreview}
          title="Preview report"
          aria-label="Preview report"
          className="rounded-lg border border-line px-2.5 py-1.5 text-ink-soft hover:text-ink hover:border-ink-soft"
        >
          <EyeIcon />
        </button>
        <button
          type="button"
          onClick={downloadPdf}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink-soft"
        >
          Download PDF
        </button>
      </div>

      <Dialog
        isOpen={previewUrl !== null}
        onClose={closePreview}
        title="Report preview"
        size="xl"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={closePreview}>
              Close
            </Button>
            <Button variant="primary" onClick={downloadPdf}>
              Download PDF
            </Button>
          </div>
        }
      >
        {previewUrl && <iframe src={previewUrl} title="Report preview" className="w-full h-[65vh] border border-line rounded-md" />}
      </Dialog>

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
