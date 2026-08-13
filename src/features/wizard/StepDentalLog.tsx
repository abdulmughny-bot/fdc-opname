import { useEffect, useRef, useState } from 'react'
import {
  reopenDentalLog,
  saveLineEdit,
  submitDentalLog,
  applyUpload,
  getActiveItemSkus,
  addManualLineItem,
  removeLineItem,
  getActiveItemsForPicker,
  type ItemPickerOption,
} from '../../lib/api'
import { useAppSettings } from '../../lib/useAppSettings'
import { Button, Dialog } from '../../components'
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

function SistemReuploadBody({
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
      const knownSkus = await getActiveItemSkus()
      setParsed(await parseSistemFile(file, knownSkus))
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
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <p className="text-xs text-ink-soft">Writes only Qty Sistem — Qty Kartu / Qty Fisik are untouched.</p>
        <label className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink-soft cursor-pointer whitespace-nowrap">
          Choose file
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {parsed && (
        <div className="mt-3">
          {parsed.rejectedDuplicate.length > 0 && (
            <Banner kind="error">
              {parsed.rejectedDuplicate.length} duplicate Kode Barang rejected: {parsed.rejectedDuplicate.map((d) => d.sku).join(', ')}.
            </Banner>
          )}
          {parsed.rejectedUnknownSku.length > 0 && (
            <Banner kind="error">
              {parsed.rejectedUnknownSku.length} item(s) not found in Item Master and skipped:{' '}
              {parsed.rejectedUnknownSku.map((d) => d.sku).join(', ')}.
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

function ClinicTemplateUploadBody({
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
      const knownSkus = await getActiveItemSkus()
      setParsed(await parseClinicTemplateFile(file, knownSkus))
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
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <p className="text-xs text-ink-soft">Writes only Qty Kartu / Qty Fisik — Qty Sistem is untouched.</p>
        <label className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink-soft cursor-pointer whitespace-nowrap">
          Choose file
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {parsed && (
        <div className="mt-3">
          {parsed.rejectedDuplicate.length > 0 && (
            <Banner kind="error">
              {parsed.rejectedDuplicate.length} duplicate Kode Barang rejected: {parsed.rejectedDuplicate.map((d) => d.sku).join(', ')}.
            </Banner>
          )}
          {parsed.rejectedUnknownSku.length > 0 && (
            <Banner kind="error">
              {parsed.rejectedUnknownSku.length} item(s) not found in Item Master and skipped:{' '}
              {parsed.rejectedUnknownSku.map((d) => d.sku).join(', ')}.
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

type UploadKind = 'sistem' | 'clinic'

const UPLOAD_TABS: { key: UploadKind; label: string }[] = [
  { key: 'sistem', label: 'Qty Sistem' },
  { key: 'clinic', label: 'Qty Kartu Stok / Fisik' },
]

// Single entry point for both mid-session upload types. Collapsed by default
// so it doesn't compete with the log table; a segmented switcher (not two
// stacked cards) picks which file format is being uploaded. Self-audits are
// filled in by clinic staff (Kartu/Fisik) so that tab is the default there;
// Offline audits default to Qty Sistem since the audit team drives that upload.
function UploadPanel({
  sessionId,
  roomId,
  lines,
  auditType,
  onUploaded,
}: {
  sessionId: string
  roomId: string
  lines: DentalLogLineRow[]
  auditType: 'Offline' | 'Self'
  onUploaded: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [kind, setKind] = useState<UploadKind>(auditType === 'Self' ? 'clinic' : 'sistem')

  return (
    <div className="border border-line rounded-[9px] mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-paper-secondary transition-colors"
      >
        <div>
          <div className="font-semibold text-sm">Upload data</div>
          <div className="text-xs text-ink-soft mt-0.5">Re-upload Qty Sistem or the clinic's filled template</div>
        </div>
        <span className="text-ink-soft text-xs shrink-0">{expanded ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {expanded && (
        <div className="border-t border-line p-4">
          <div className="inline-flex rounded-lg border border-line p-0.5 mb-4">
            {UPLOAD_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setKind(tab.key)}
                className={
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ' +
                  (kind === tab.key ? 'bg-teal-deep text-white' : 'text-ink-soft hover:text-ink')
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {kind === 'sistem' ? (
            <SistemReuploadBody sessionId={sessionId} roomId={roomId} lines={lines} onUploaded={onUploaded} />
          ) : (
            <ClinicTemplateUploadBody sessionId={sessionId} roomId={roomId} lines={lines} onUploaded={onUploaded} />
          )}
        </div>
      )}
    </div>
  )
}

// Lets a user add a SKU to the log by hand, for items that never came through
// a file upload — available for both Offline and Self audits. Shows only a
// button up front; picking an item and the reject/confirm feedback all
// happen inside the popup so it never competes with the log table's own
// search bar for attention. The datalist value packs SKU + name together so
// the browser's native filtering matches on either; the SKU is parsed back
// out of whichever suggestion gets picked.
function AddLineItemControl({
  sessionId,
  roomId,
  existingSkus,
  onAdded,
}: {
  sessionId: string
  roomId: string
  existingSkus: Set<string>
  onAdded: (line: DentalLogLineRow) => void
}) {
  const [items, setItems] = useState<ItemPickerOption[]>([])
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [selected, setSelected] = useState<ItemPickerOption | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getActiveItemsForPicker()
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

  const options = items.filter((i) => !existingSkus.has(i.sku))
  const bySku = new Map(items.map((i) => [i.sku, i]))
  const allAlreadyAdded = items.length > 0 && options.length === 0

  function openPicker() {
    setValue('')
    setSelected(null)
    setError(null)
    setOpen(true)
  }

  function closeDialog() {
    setOpen(false)
    setSelected(null)
    setValue('')
    setError(null)
  }

  function handleNext() {
    setError(null)
    const sku = value.split(' — ')[0].trim().toUpperCase()
    if (existingSkus.has(sku)) {
      setError('This item is already in the log — edit its quantities directly in the table instead.')
      return
    }
    const item = bySku.get(sku)
    if (!item) {
      setError('Pick an item from the list.')
      return
    }
    setSelected(item)
  }

  async function handleConfirmAdd() {
    if (!selected) return
    setAdding(true)
    setError(null)
    try {
      const line = await addManualLineItem(sessionId, roomId, selected.sku)
      onAdded(line)
      closeDialog()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={openPicker}
        disabled={allAlreadyAdded}
        title={allAlreadyAdded ? 'Every Item Master item is already in this log.' : undefined}
        className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink-soft disabled:opacity-50"
      >
        + Add item
      </button>

      <Dialog
        isOpen={open}
        onClose={closeDialog}
        title={selected ? 'Confirm add item' : 'Add item to log'}
        size="sm"
        actions={
          selected ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Back
              </Button>
              <Button variant="primary" onClick={handleConfirmAdd} disabled={adding}>
                {adding ? 'Adding…' : 'Confirm & add'}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={closeDialog}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleNext} disabled={!value.trim()}>
                Next
              </Button>
            </div>
          )
        }
      >
        {selected ? (
          <p className="text-sm text-ink">
            Add <span className="font-semibold">{selected.name}</span>{' '}
            <span className="font-mono text-xs text-ink-soft">({selected.sku})</span> to this log?
          </p>
        ) : (
          <>
            <input
              list="add-line-item-options"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Search item by SKU or name…"
              autoFocus
              className="w-full border border-line rounded-lg px-2.5 py-1.5 text-sm"
            />
            <datalist id="add-line-item-options">
              {options.map((o) => (
                <option key={o.sku} value={`${o.sku} — ${o.name}`} />
              ))}
            </datalist>
          </>
        )}
        {error && <p className="text-xs text-rust mt-2">{error}</p>}
      </Dialog>
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
  const [tableSearch, setTableSearch] = useState('')
  const [removingSku, setRemovingSku] = useState<string | null>(null)
  const [removeBusySku, setRemoveBusySku] = useState<string | null>(null)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => setLocalLines(lines), [lines])

  const stats = lineStats(localLines)
  const { submitThreshold } = useAppSettings()
  const canSubmit = stats.pct >= submitThreshold
  // Live match rate over the rows that are actually scorable (both sistem and
  // fisik present). Server recomputes the official value on submit; this is the
  // same formula shown live so the number doesn't jump when you submit.
  const liveKeters = stats.scorable ? Math.round((stats.matched / stats.scorable) * 1000) / 10 : null

  // Filters which rows are visible, not what counts toward the stats above —
  // searching for one item shouldn't make it look like the rest went missing.
  const visibleLines = localLines.filter((l) => {
    if (!tableSearch.trim()) return true
    const q = tableSearch.trim().toLowerCase()
    return l.barang_sku.toLowerCase().includes(q) || nameFor(l.barang_sku).toLowerCase().includes(q)
  })

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

  async function handleRemoveLine(sku: string) {
    setRemoveBusySku(sku)
    setFeedback(null)
    try {
      await removeLineItem(sessionId, roomId, sku)
      setLocalLines((prev) => prev.filter((l) => l.barang_sku !== sku))
      setRemovingSku(null)
    } catch (err) {
      setFeedback((err as Error).message)
    } finally {
      setRemoveBusySku(null)
    }
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
          <UploadPanel sessionId={sessionId} roomId={roomId} lines={localLines} auditType={auditType} onUploaded={onReload} />
          <AddLineItemControl
            sessionId={sessionId}
            roomId={roomId}
            existingSkus={new Set(localLines.map((l) => l.barang_sku))}
            onAdded={(line) => setLocalLines((prev) => [...prev, line])}
          />
        </>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-paper border border-line rounded-lg p-3">
          <div className="text-xs text-ink-soft font-medium mb-1.5">Items filled</div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-2xl font-bold text-ink">{stats.scorable}</span>
            <span className="text-xs text-ink-soft">/ {stats.total} ({stats.pct}%)</span>
          </div>
          <ProgressBar pct={stats.pct} />
        </div>
        <div className="bg-paper border border-line rounded-lg p-3">
          <div className="text-xs text-ink-soft font-medium mb-1.5">Ketersesuaian {locked ? '' : '(live)'}</div>
          <div className="text-2xl font-bold text-ink font-mono">{liveKeters === null ? '—' : `${liveKeters}%`}</div>
          <div className="text-xs text-ink-soft mt-1">{stats.matched}/{stats.scorable} match</div>
        </div>
      </div>

      <div className="mb-3">
        <input
          type="text"
          value={tableSearch}
          onChange={(e) => setTableSearch(e.target.value)}
          placeholder="Search this log by SKU or item name…"
          className="w-full border border-line rounded-lg px-3 py-2 text-sm"
        />
        {tableSearch.trim() && (
          <p className="text-xs text-ink-soft mt-1">
            Showing {visibleLines.length} of {localLines.length} item(s).
          </p>
        )}
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
              {!locked && <th className="py-1.5 font-medium text-right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {visibleLines.length === 0 && (
              <tr>
                <td colSpan={locked ? 6 : 7} className="py-6 text-center text-sm text-ink-soft">
                  No items match "{tableSearch}".
                </td>
              </tr>
            )}
            {visibleLines.map((l) => {
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
                  {!locked && (
                    <td className="py-1.5 text-right">
                      {removingSku === l.barang_sku ? (
                        <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
                          <span className="text-ink-soft">Remove?</span>
                          <button
                            type="button"
                            disabled={removeBusySku === l.barang_sku}
                            onClick={() => handleRemoveLine(l.barang_sku)}
                            className="text-rust font-semibold hover:underline disabled:opacity-50"
                          >
                            {removeBusySku === l.barang_sku ? 'Removing…' : 'Yes'}
                          </button>
                          <button type="button" onClick={() => setRemovingSku(null)} className="text-ink-soft hover:underline">
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRemovingSku(l.barang_sku)}
                          title="Remove item from log"
                          className="text-rust hover:bg-rust-wash rounded-md p-1.5 transition-colors"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </td>
                  )}
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
