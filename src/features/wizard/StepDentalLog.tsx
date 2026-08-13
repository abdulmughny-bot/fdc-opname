import { useEffect, useRef, useState } from 'react'
import { reopenDentalLog, saveLineEdit, submitDentalLog, applyUpload } from '../../lib/api'
import { useAppSettings } from '../../lib/useAppSettings'
import { parseClinicTemplateFile, parseSistemFile, type ParsedClinicTemplateFile, type ParsedSistemFile } from './parseUpload'
import { Banner, PaginationControls, ProgressBar, StepHeader, paginate } from './shared'
import { lineStats, type DentalLogLineRow } from './types'

type EditableField = 'qty_sistem' | 'qty_kartu' | 'qty_fisik' | 'remarks'

// Scoring colour for one line, matching the canonical rule (see lineStats):
// a line only counts when BOTH qty_sistem and qty_fisik are present — then it's
// green when they're equal, red on any selisih. qty_kartu never affects this.
function rowTone(l: DentalLogLineRow): 'match' | 'selisih' | 'incomplete' {
  if (l.qty_sistem === null || l.qty_fisik === null) return 'incomplete'
  return Number(l.qty_fisik) === Number(l.qty_sistem) ? 'match' : 'selisih'
}

const ROW_BG: Record<'match' | 'selisih' | 'incomplete', string> = {
  match: 'bg-teal-wash',
  selisih: 'bg-rust-wash',
  incomplete: '',
}

function ClinicTemplateUpload({
  sessionId,
  roomId,
  lines,
  onUploaded,
}: {
  sessionId: string
  roomId: string
  lines: DentalLogLineRow[]
  onUploaded: () => void
}) {
  const [parsed, setParsed] = useState<ParsedClinicTemplateFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [page, setPage] = useState(1)

  async function handleFile(file: File) {
    setParsed(null)
    setError(null)
    setPage(1)
    try {
      setParsed(await parseClinicTemplateFile(file))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const diff = parsed
    ? parsed.valid.map((row) => {
        const existing = lines.find((l) => l.barang_sku === row.sku)
        const changed =
          !existing ||
          String(existing.qty_kartu ?? '') !== String(row.kartu ?? '') ||
          String(existing.qty_fisik ?? '') !== String(row.fisik ?? '')
        return { row, existing, changed }
      })
    : []
  const changedRows = diff.filter((d) => d.changed)
  const { pageItems, totalPages, page: clampedPage } = paginate(changedRows, page, 10)

  async function confirm() {
    if (!parsed) return
    setUploading(true)
    setError(null)
    try {
      await applyUpload(sessionId, roomId, 'ClinicTemplate', parsed.valid)
      setParsed(null)
      onUploaded()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="border border-line rounded-[9px] p-4 mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-semibold text-sm">Upload clinic template</div>
          <div className="text-xs text-ink-soft mt-0.5">Writes only Qty Kartu / Qty Fisik — Qty Sistem is untouched.</div>
        </div>
        <label className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink-soft cursor-pointer">
          Choose file
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      </div>

      {error && (
        <div className="mt-3">
          <Banner kind="error">{error}</Banner>
        </div>
      )}

      {parsed && (
        <div className="mt-3">
          {parsed.rejectedDuplicate.length > 0 && (
            <Banner kind="error">
              {parsed.rejectedDuplicate.length} duplicate Kode Barang rejected: {parsed.rejectedDuplicate.map((d) => d.sku).join(', ')}.
            </Banner>
          )}
          {changedRows.length === 0 ? (
            <Banner kind="warn">No changes — every row already matches what's on file.</Banner>
          ) : (
            <>
              <Banner kind="success">{changedRows.length} row(s) will change out of {parsed.valid.length} parsed.</Banner>
              <table className="w-full text-sm mb-3">
                <thead>
                  <tr className="text-left text-xs text-ink-soft border-b border-line">
                    <th className="py-1.5 font-medium">SKU</th>
                    <th className="py-1.5 font-medium text-right">Kartu (old → new)</th>
                    <th className="py-1.5 font-medium text-right">Fisik (old → new)</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(({ row, existing }) => (
                    <tr key={row.sku} className="border-b border-line/50">
                      <td className="py-1.5 font-mono text-xs">{row.sku}</td>
                      <td className="py-1.5 text-right font-mono text-xs">
                        {existing?.qty_kartu ?? '—'} → {row.kartu ?? '—'}
                      </td>
                      <td className="py-1.5 text-right font-mono text-xs">
                        {existing?.qty_fisik ?? '—'} → {row.fisik ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationControls page={clampedPage} totalPages={totalPages} onPage={setPage} />
            </>
          )}
          <button
            type="button"
            disabled={uploading || changedRows.length === 0}
            onClick={confirm}
            className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2 hover:bg-teal transition-colors disabled:opacity-50"
          >
            {uploading ? 'Applying…' : 'Confirm & apply'}
          </button>
        </div>
      )}
    </div>
  )
}

// Qty Sistem re-upload, available mid-session from inside the station log so a
// system export can be re-imported at any time before submit — not only once
// during initial setup. Writes only qty_sistem (never touches kartu/fisik).
function SistemReupload({
  sessionId,
  roomId,
  lines,
  onUploaded,
}: {
  sessionId: string
  roomId: string
  lines: DentalLogLineRow[]
  onUploaded: () => void
}) {
  const [parsed, setParsed] = useState<ParsedSistemFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [page, setPage] = useState(1)

  async function handleFile(file: File) {
    setParsed(null)
    setError(null)
    setPage(1)
    try {
      setParsed(await parseSistemFile(file))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const diff = parsed
    ? parsed.valid.map((v) => {
        const existing = lines.find((l) => l.barang_sku === v.sku)
        const changed = !existing || existing.qty_sistem === null || Number(existing.qty_sistem) !== v.qty
        return { v, existing, changed }
      })
    : []
  const changedRows = diff.filter((d) => d.changed)
  const { pageItems, totalPages, page: clampedPage } = paginate(changedRows, page, 10)

  async function confirm() {
    if (!parsed) return
    setUploading(true)
    setError(null)
    try {
      await applyUpload(sessionId, roomId, 'Sistem', parsed.valid)
      setParsed(null)
      onUploaded()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="border border-line rounded-[9px] p-4 mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-semibold text-sm">Re-upload Qty Sistem</div>
          <div className="text-xs text-ink-soft mt-0.5">Writes only Qty Sistem — Qty Kartu / Qty Fisik are untouched.</div>
        </div>
        <label className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink-soft cursor-pointer">
          Choose file
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      </div>

      {error && (
        <div className="mt-3">
          <Banner kind="error">{error}</Banner>
        </div>
      )}

      {parsed && (
        <div className="mt-3">
          {parsed.rejectedDuplicate.length > 0 && (
            <Banner kind="error">
              {parsed.rejectedDuplicate.length} duplicate Kode Barang rejected: {parsed.rejectedDuplicate.map((d) => d.sku).join(', ')}.
            </Banner>
          )}
          {changedRows.length === 0 ? (
            <Banner kind="warn">No changes — every parsed SKU already matches what's on file.</Banner>
          ) : (
            <>
              <Banner kind="success">{changedRows.length} of {parsed.valid.length} parsed item(s) will change.</Banner>
              <table className="w-full text-sm mb-3">
                <thead>
                  <tr className="text-left text-xs text-ink-soft border-b border-line">
                    <th className="py-1.5 font-medium">SKU</th>
                    <th className="py-1.5 font-medium text-right">Qty Sistem (old → new)</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(({ v, existing }) => (
                    <tr key={v.sku} className="border-b border-line/50">
                      <td className="py-1.5 font-mono text-xs">{v.sku}</td>
                      <td className="py-1.5 text-right font-mono text-xs">
                        {existing?.qty_sistem ?? '—'} → {v.qty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationControls page={clampedPage} totalPages={totalPages} onPage={setPage} />
            </>
          )}
          <button
            type="button"
            disabled={uploading || changedRows.length === 0}
            onClick={confirm}
            className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2 hover:bg-teal transition-colors disabled:opacity-50"
          >
            {uploading ? 'Applying…' : 'Confirm & apply'}
          </button>
        </div>
      )}
    </div>
  )
}

export function StepDentalLog({
  sessionId,
  roomId,
  clinicName,
  auditType,
  dentalName,
  status,
  submittedAt,
  ketersesuaian,
  lines,
  nameFor,
  onBack,
  onReload,
  onSubmitted,
}: {
  sessionId: string
  roomId: string
  clinicName: string
  auditType: 'Offline' | 'Self'
  dentalName: string
  status: 'Not Started' | 'In Progress' | 'Submitted'
  submittedAt: string | null
  ketersesuaian: number | null
  lines: DentalLogLineRow[]
  nameFor: (sku: string) => string
  onBack: () => void
  onReload: () => Promise<void>
  onSubmitted: () => void
}) {
  const locked = status === 'Submitted'
  const [localLines, setLocalLines] = useState(lines)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [reopening, setReopening] = useState(false)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => setLocalLines(lines), [lines])

  const stats = lineStats(localLines)
  const { submitThreshold } = useAppSettings()
  const canSubmit = stats.pct >= submitThreshold
  // Live match rate over the rows that are actually scorable (both sistem and
  // fisik present). Server recomputes the official value on submit; this is the
  // same formula shown live so the number doesn't jump when you submit.
  const liveKeters = stats.scorable ? Math.round((stats.matched / stats.scorable) * 1000) / 10 : null

  function updateField(sku: string, field: EditableField, value: string) {
    setLocalLines((prev) =>
      prev.map((l) =>
        l.barang_sku === sku
          ? { ...l, [field]: field === 'remarks' ? value : value === '' ? null : (value as unknown as number) }
          : l
      )
    )
    const key = `${sku}:${field}`
    clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(async () => {
      try {
        await saveLineEdit(sessionId, roomId, sku, field, value)
      } catch (err) {
        setFeedback((err as Error).message)
      }
    }, 400)
  }

  async function handleSubmit() {
    setSubmitting(true)
    setFeedback(null)
    try {
      await submitDentalLog(sessionId, roomId)
      await onReload()
      onSubmitted()
    } catch (err) {
      setFeedback((err as Error).message)
      setSubmitting(false)
    }
  }

  async function handleReopen() {
    setReopening(true)
    setFeedback(null)
    try {
      await reopenDentalLog(sessionId, roomId)
      await onReload()
    } catch (err) {
      setFeedback((err as Error).message)
    } finally {
      setReopening(false)
    }
  }

  return (
    <div className="bg-paper border border-line rounded-[10px] p-6">
      <StepHeader onBack={onBack} backLabel="← Stations" />
      <h2 className="font-display text-base font-bold mb-1.5">
        {clinicName} — {dentalName}
      </h2>
      <p className="text-[13px] text-ink-soft mb-4">
        {auditType === 'Offline'
          ? 'Audit team fills Qty Kartu Stok and Qty Fisik on-site.'
          : 'Clinic staff fill Qty Kartu Stok and Qty Fisik.'}{' '}
        Every quantity — including Qty Sistem — can be adjusted per row until the station is submitted.
      </p>

      {locked && (
        <Banner kind="success">
          Submitted {submittedAt ? new Date(submittedAt).toLocaleString() : ''} · Ketersesuaian{' '}
          {ketersesuaian === null ? '—' : `${ketersesuaian}%`}
        </Banner>
      )}
      {feedback && <Banner kind="error">{feedback}</Banner>}

      {locked && (
        <div className="flex justify-end mb-4">
          <button
            type="button"
            disabled={reopening}
            onClick={handleReopen}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink-soft disabled:opacity-50"
          >
            {reopening ? 'Reopening…' : 'Reopen for editing'}
          </button>
        </div>
      )}

      {!locked && (
        <>
          <SistemReupload sessionId={sessionId} roomId={roomId} lines={localLines} onUploaded={onReload} />
          <ClinicTemplateUpload sessionId={sessionId} roomId={roomId} lines={localLines} onUploaded={onReload} />
        </>
      )}

      <div className="flex justify-between text-xs text-ink-soft mb-1.5">
        <span>Line items filled</span>
        <span>
          {stats.scorable} / {stats.total} ({stats.pct}%)
        </span>
      </div>
      <div className="mb-3">
        <ProgressBar pct={stats.pct} />
      </div>
      <div className="flex items-center justify-between text-xs mb-4">
        <span className="text-ink-soft">Ketersesuaian {locked ? '' : '(live)'}</span>
        <span className="font-mono font-semibold text-ink">
          {liveKeters === null ? '—' : `${liveKeters}%`}
          <span className="text-ink-soft font-normal">
            {' '}· {stats.matched}/{stats.scorable} match
          </span>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left text-xs text-ink-soft border-b border-line">
              <th className="py-1.5 font-medium">SKU</th>
              <th className="py-1.5 font-medium">Item</th>
              <th className="py-1.5 font-medium text-right">Qty Sistem</th>
              <th className="py-1.5 font-medium text-right">Qty Kartu</th>
              <th className="py-1.5 font-medium text-right">Qty Fisik</th>
              <th className="py-1.5 font-medium">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {localLines.map((l) => {
              const tone = rowTone(l)
              const cell =
                'w-full text-right font-mono text-xs border border-line rounded px-2 py-1 bg-transparent disabled:text-ink-soft'
              return (
                <tr key={l.barang_sku} className={'border-b border-line/50 ' + ROW_BG[tone]}>
                  <td className="py-1.5 font-mono text-xs">{l.barang_sku}</td>
                  <td className="py-1.5">{nameFor(l.barang_sku)}</td>
                  <td className="py-1.5 text-right">
                    <input
                      type="number"
                      min="0"
                      disabled={locked}
                      value={l.qty_sistem ?? ''}
                      onChange={(e) => updateField(l.barang_sku, 'qty_sistem', e.target.value)}
                      placeholder="—"
                      className={cell}
                    />
                  </td>
                  <td className="py-1.5 text-right">
                    <input
                      type="number"
                      min="0"
                      disabled={locked}
                      value={l.qty_kartu ?? ''}
                      onChange={(e) => updateField(l.barang_sku, 'qty_kartu', e.target.value)}
                      placeholder="—"
                      className={cell}
                    />
                  </td>
                  <td className="py-1.5 text-right">
                    <input
                      type="number"
                      min="0"
                      disabled={locked}
                      value={l.qty_fisik ?? ''}
                      onChange={(e) => updateField(l.barang_sku, 'qty_fisik', e.target.value)}
                      placeholder="—"
                      className={cell}
                    />
                  </td>
                  <td className="py-1.5">
                    <input
                      type="text"
                      disabled={locked}
                      value={l.remarks ?? ''}
                      onChange={(e) => updateField(l.barang_sku, 'remarks', e.target.value)}
                      placeholder="optional"
                      className="w-full text-xs border border-line rounded px-2 py-1 bg-transparent disabled:text-ink-soft"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 bg-paper border-t border-line rounded-b-[10px] flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[13px] text-ink-soft">
          {locked
            ? 'Already submitted.'
            : canSubmit
              ? 'Threshold reached — you can submit this station.'
              : `Fill at least ${submitThreshold}% of items to submit (currently ${stats.pct}%).`}
        </span>
        <button
          type="button"
          disabled={!canSubmit || locked || submitting}
          onClick={handleSubmit}
          className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2.5 hover:bg-teal transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {locked ? 'Already submitted' : submitting ? 'Submitting…' : 'Submit dental log'}
        </button>
      </div>
    </div>
  )
}
