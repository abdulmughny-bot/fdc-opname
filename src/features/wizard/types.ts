import type { Database } from '../../types/database'
import type { VisibleClinic } from '../auth'

export type SessionRow = Database['dev']['Tables']['sessions']['Row']
export type DentalStatusRow = Database['dev']['Tables']['dental_status']['Row']
export type DentalLogLineRow = Database['dev']['Tables']['dental_log_lines']['Row']
export type BarangRow = Database['dev']['Tables']['barang']['Row']

export interface DentalData {
  roomId: string
  name: string
  status: DentalStatusRow['status']
  submittedAt: string | null
  ketersesuaian: number | null
  scorableCount: number
  matchedCount: number
  amended: boolean
  lines: DentalLogLineRow[]
}

export interface SessionData {
  session: SessionRow
  dentals: DentalData[]
}

// A line is "scorable" (counts toward Ketersesuaian) only when both
// qty_sistem and qty_fisik are present — qty_kartu never affects this. This
// is the one canonical rule (mirrors recompute_station/submit_dental_log
// server-side); the reference HTML used three different, disagreeing
// variants of this rule across its screens, which we deliberately don't port.
export function lineStats(lines: DentalLogLineRow[]) {
  const total = lines.length
  const scorable = lines.filter((l) => l.qty_sistem !== null && l.qty_fisik !== null).length
  const matched = lines.filter(
    (l) => l.qty_sistem !== null && l.qty_fisik !== null && Number(l.qty_fisik) === Number(l.qty_sistem)
  ).length
  const pct = total ? Math.round((scorable / total) * 100) : 0
  return { total, scorable, matched, pct }
}

export const SUBMIT_THRESHOLD = 80

export type WizardStep = 'type' | 'clinic' | 'sistem' | 'hub' | 'dentallog' | 'report'

export interface WizardState {
  step: WizardStep
  auditType: 'Offline' | 'Self' | null
  clinic: VisibleClinic | null
  roomIds: string[]
  sessionId: string | null
  currentRoomId: string | null
}

export function initialWizardState(): WizardState {
  return { step: 'type', auditType: null, clinic: null, roomIds: [], sessionId: null, currentRoomId: null }
}
