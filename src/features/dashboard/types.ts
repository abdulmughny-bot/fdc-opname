import { currentPeriodMonth } from '../../lib/period'
import type { Database } from '../../types/database'

export type SessionRow = Database['dev']['Tables']['sessions']['Row']
export type DentalStatusRow = Database['dev']['Tables']['dental_status']['Row']

export type PeriodType = 'month' | 'quarter'

export type DerivedStatus = 'Active' | 'In Progress' | 'Finished'

export interface SessionWithStations {
  session: SessionRow
  stations: DentalStatusRow[]
  derivedStatus: DerivedStatus
}

export interface DashboardFilters {
  periodType: PeriodType
  period: string // e.g. '2026-08' or '2026-Q3'
  clinicIds: string[] | 'all'
  status: DerivedStatus | 'all'
  auditType: SessionRow['audit_type'] | 'all'
  agent: string | 'all'
}

export function defaultFilters(): DashboardFilters {
  return {
    periodType: 'month',
    period: currentPeriodMonth(),
    clinicIds: 'all',
    status: 'all',
    auditType: 'all',
    agent: 'all',
  }
}
