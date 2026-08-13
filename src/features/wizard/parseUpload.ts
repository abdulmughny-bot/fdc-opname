import * as XLSX from 'xlsx'
import type { SistemUploadItem } from '../../lib/api'

// Normalizes the messy unit spellings found in the real export
// (BOTOL/Botol, SYIRINGE/SYRINGE, etc.) to one canonical form.
const UNIT_ALIASES: Record<string, string> = { BOTOL: 'BOTTLE', SYIRINGE: 'SYRINGE' }

function normalizeUnit(raw: unknown): string {
  if (!raw) return ''
  const u = String(raw).trim().toUpperCase()
  return UNIT_ALIASES[u] ?? u
}

// Parses "70 SET" -> { qty: 70, unit: 'SET' }. Returns null if there's no leading number.
function parseSatuanBesar(val: unknown): { qty: number; unit: string } | null {
  const s = String(val ?? '').trim()
  const m = s.match(/^([0-9]+(?:\.[0-9]+)?)\s+(.*)$/)
  if (!m) return null
  return { qty: parseFloat(m[1]), unit: normalizeUnit(m[2]) }
}

export interface ParsedSistemFile {
  valid: SistemUploadItem[]
  flaggedFractional: SistemUploadItem[]
  rejectedDuplicate: { sku: string; name: string }[]
  rejectedUnparseable: { sku: string; satuan: string }[]
  rejectedUnknownSku: { sku: string; name: string }[]
}

function findHeaderRow(rows: unknown[][], columnName: string) {
  return rows.findIndex((r) => r.some((c) => String(c).trim().toLowerCase() === columnName))
}

// Ports the reference prototype's Qty Sistem parser exactly: reads only the
// first sheet, auto-detects the header row by locating "Kode Barang" (not
// assumed to be row 0), requires "Satuan Besar", treats "Nama Item" as
// optional. See docs/ARCHITECTURE.md for the full rule list.
export async function parseSistemFile(file: File, knownSkus?: Set<string>): Promise<ParsedSistemFile> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })

  const headerIdx = findHeaderRow(rows, 'kode barang')
  if (headerIdx === -1) {
    throw new Error('Could not find a "Kode Barang" column — is this the right export file?')
  }
  const header = rows[headerIdx].map((c) => String(c).trim().toLowerCase())
  const iKode = header.indexOf('kode barang')
  const iNama = header.indexOf('nama item')
  const iSatuan = header.indexOf('satuan besar')
  if (iSatuan === -1) throw new Error('Could not find a "Satuan Besar" column.')

  const seen = new Set<string>()
  const valid: SistemUploadItem[] = []
  const flaggedFractional: SistemUploadItem[] = []
  const rejectedDuplicate: { sku: string; name: string }[] = []
  const rejectedUnparseable: { sku: string; satuan: string }[] = []
  const rejectedUnknownSku: { sku: string; name: string }[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    const sku = String(r[iKode] ?? '').trim().toUpperCase()
    if (!sku) continue
    const name = iNama > -1 ? String(r[iNama] ?? '').trim() : sku
    const parsed = parseSatuanBesar(r[iSatuan])
    if (!parsed) {
      rejectedUnparseable.push({ sku, satuan: String(r[iSatuan] ?? '') })
      continue
    }
    if (seen.has(sku)) {
      rejectedDuplicate.push({ sku, name })
      continue
    }
    seen.add(sku)
    if (knownSkus && !knownSkus.has(sku)) {
      rejectedUnknownSku.push({ sku, name })
      continue
    }
    const item: SistemUploadItem = { sku, name, qty: parsed.qty, unit: parsed.unit }
    valid.push(item)
    if (parsed.qty !== Math.floor(parsed.qty)) flaggedFractional.push(item)
  }

  if (valid.length === 0) throw new Error('No valid item rows found under the header.')

  return { valid, flaggedFractional, rejectedDuplicate, rejectedUnparseable, rejectedUnknownSku }
}

export interface ClinicTemplateUploadRow {
  sku: string
  kartu: string | number | null
  fisik: string | number | null
}

export interface ParsedClinicTemplateFile {
  valid: ClinicTemplateUploadRow[]
  rejectedDuplicate: { sku: string }[]
  rejectedUnknownSku: { sku: string }[]
}

// The reference prototype never implements the clinic-template (Self-audit)
// upload — CLAUDE.md requires it, but no source file defines its column
// names. We infer the most literal possible header names from the DB field
// names themselves (Qty Kartu / Qty Fisik) since no other source of truth
// exists; verify these match the clinic's real template before relying on it.
export async function parseClinicTemplateFile(file: File, knownSkus?: Set<string>): Promise<ParsedClinicTemplateFile> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })

  const headerIdx = findHeaderRow(rows, 'kode barang')
  if (headerIdx === -1) {
    throw new Error('Could not find a "Kode Barang" column — is this the right template file?')
  }
  const header = rows[headerIdx].map((c) => String(c).trim().toLowerCase())
  const iKode = header.indexOf('kode barang')
  const iKartu = header.indexOf('qty kartu')
  const iFisik = header.indexOf('qty fisik')
  if (iKartu === -1 && iFisik === -1) {
    throw new Error('Could not find a "Qty Kartu" or "Qty Fisik" column.')
  }

  const seen = new Set<string>()
  const valid: ClinicTemplateUploadRow[] = []
  const rejectedDuplicate: { sku: string }[] = []
  const rejectedUnknownSku: { sku: string }[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    const sku = String(r[iKode] ?? '').trim().toUpperCase()
    if (!sku) continue
    if (seen.has(sku)) {
      rejectedDuplicate.push({ sku })
      continue
    }
    seen.add(sku)
    if (knownSkus && !knownSkus.has(sku)) {
      rejectedUnknownSku.push({ sku })
      continue
    }
    const kartuRaw = iKartu > -1 ? String(r[iKartu] ?? '').trim() : ''
    const fisikRaw = iFisik > -1 ? String(r[iFisik] ?? '').trim() : ''
    valid.push({ sku, kartu: kartuRaw === '' ? null : kartuRaw, fisik: fisikRaw === '' ? null : fisikRaw })
  }

  if (valid.length === 0) throw new Error('No valid item rows found under the header.')

  return { valid, rejectedDuplicate, rejectedUnknownSku }
}
