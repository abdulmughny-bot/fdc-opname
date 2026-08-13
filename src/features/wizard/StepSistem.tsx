import { useRef, useState } from 'react'
import { applyUpload, getActiveItemSkus } from '../../lib/api'
import { parseSistemFile, type ParsedSistemFile } from './parseUpload'
import { Banner, PaginationControls, StepHeader, paginate } from './shared'
import type { DentalLogLineRow, SessionData } from './types'

function StationUploadRow({
  sessionId,
  roomId,
  name,
  lines,
  onUploaded,
}: {
  sessionId: string
  roomId: string
  name: string
  lines: DentalLogLineRow[]
  onUploaded: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ParsedSistemFile | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [page, setPage] = useState(1)

  async function handleFile(file: File) {
    setParsed(null)
    setParseError(null)
    setUploadError(null)
    setDone(false)
    setPage(1)
    try {
      const knownSkus = await getActiveItemSkus()
      setParsed(await parseSistemFile(file, knownSkus))
    } catch (err) {
      setParseError((err as Error).message)
    }
  }

  // Diff against what's already on file — a re-upload should never be a
  // silent overwrite, matching how the clinic-template upload already works.
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
    setUploadError(null)
    try {
      await applyUpload(sessionId, roomId, 'Sistem', parsed.valid)
      setDone(true)
      // Don't clear parsed — user can upload another file to this station immediately
      onUploaded()
      // Auto-reset success banner after 2s so they can upload again
      setTimeout(() => setDone(false), 2000)
    } catch (err) {
      setUploadError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="border border-line rounded-[9px] p-4 mb-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-semibold text-sm">{name}</div>
          <div className="text-xs text-ink-soft font-mono mt-0.5">{lines.length} SKU(s) currently on file</div>
        </div>
        <label className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink-soft cursor-pointer">
          {lines.length > 0 ? 'Replace Qty Sistem file' : 'Upload Qty Sistem file'}
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      </div>

      {parseError && (
        <div className="mt-3">
          <Banner kind="error">{parseError}</Banner>
        </div>
      )}
      {uploadError && (
        <div className="mt-3">
          <Banner kind="error">{uploadError}</Banner>
        </div>
      )}
      {done && (
        <div className="mt-3">
          <Banner kind="success">Uploaded.</Banner>
        </div>
      )}

      {parsed && (
        <div className="mt-3">
          {parsed.flaggedFractional.length > 0 && (
            <Banner kind="warn">
              {parsed.flaggedFractional.length} item(s) have a fractional Qty Sistem (e.g. {parsed.flaggedFractional[0].sku} ={' '}
              {parsed.flaggedFractional[0].qty}). Imported as-is — worth checking.
            </Banner>
          )}
          {parsed.rejectedDuplicate.length > 0 && (
            <Banner kind="error">
              {parsed.rejectedDuplicate.length} duplicate Kode Barang rejected (only the first kept):{' '}
              {parsed.rejectedDuplicate.map((d) => d.sku).join(', ')}.
            </Banner>
          )}
          {parsed.rejectedUnparseable.length > 0 && (
            <Banner kind="error">
              {parsed.rejectedUnparseable.length} row(s) had a Satuan Besar with no leading number and were skipped:{' '}
              {parsed.rejectedUnparseable
                .slice(0, 5)
                .map((d) => d.sku)
                .join(', ')}
              {parsed.rejectedUnparseable.length > 5 ? '…' : ''}.
            </Banner>
          )}
          {parsed.rejectedUnknownSku.length > 0 && (
            <Banner kind="error">
              {parsed.rejectedUnknownSku.length} item(s) not found in Item Master and skipped:{' '}
              {parsed.rejectedUnknownSku
                .slice(0, 5)
                .map((d) => d.sku)
                .join(', ')}
              {parsed.rejectedUnknownSku.length > 5 ? '…' : ''}. Add them in Settings → Item Master first.
            </Banner>
          )}
          {changedRows.length === 0 ? (
            <Banner kind="warn">No changes — every parsed SKU already matches what's on file.</Banner>
          ) : (
            <>
              <Banner kind="success">
                {changedRows.length} of {parsed.valid.length} parsed item(s) will change.
              </Banner>
              <table className="w-full text-sm mb-2">
                <thead>
                  <tr className="text-left text-xs text-ink-soft border-b border-line">
                    <th className="py-1.5 font-medium">Kode Barang</th>
                    <th className="py-1.5 font-medium">Nama Item</th>
                    <th className="py-1.5 font-medium text-right">Qty Sistem (old → new)</th>
                    <th className="py-1.5 font-medium">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(({ v, existing }) => (
                    <tr key={v.sku} className="border-b border-line/50">
                      <td className="py-1.5 font-mono text-xs">{v.sku}</td>
                      <td className="py-1.5">{v.name}</td>
                      <td className="py-1.5 text-right font-mono text-xs">
                        {existing?.qty_sistem ?? '—'} → {v.qty}
                      </td>
                      <td className="py-1.5">{v.unit}</td>
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
            {uploading ? 'Uploading…' : 'Confirm import'}
          </button>
        </div>
      )}
    </div>
  )
}

export function StepSistem({
  sessionId,
  data,
  onExit,
  onReload,
  onContinue,
}: {
  sessionId: string
  data: SessionData
  onExit: () => void
  onReload: () => void
  onContinue: () => void
}) {
  return (
    <div className="bg-paper border border-line rounded-[10px] p-6">
      <StepHeader onBack={onExit} backLabel="← Dashboard" />
      <h2 className="font-display text-base font-bold mb-1.5">Qty Sistem</h2>
      <p className="text-[13px] text-ink-soft mb-4">
        Upload the system-quantity export for each station. Stations with an existing count from a previous audit
        can be left as-is, or replaced.
      </p>

      {data.dentals.map((d) => (
        <StationUploadRow key={d.roomId} sessionId={sessionId} roomId={d.roomId} name={d.name} lines={d.lines} onUploaded={onReload} />
      ))}

      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-lg bg-teal-deep text-white font-semibold text-sm px-[18px] py-2.5 hover:bg-teal transition-colors"
        >
          Continue to stations
        </button>
      </div>
    </div>
  )
}
