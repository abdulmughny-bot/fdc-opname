// Mirrors period_month()/period_quarter() in supabase/migrations/0001_schema.sql —
// GMT+8, no DST, so Asia/Singapore is used as the fixed-offset reference zone.

const TIME_ZONE = 'Asia/Singapore'

function partsInZone(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  const year = parts.find((p) => p.type === 'year')!.value
  const month = Number(parts.find((p) => p.type === 'month')!.value)
  return { year, month }
}

export function periodMonth(date: Date = new Date()): string {
  const { year, month } = partsInZone(date)
  return `${year}-${String(month).padStart(2, '0')}`
}

export function periodQuarter(date: Date = new Date()): string {
  const { year, month } = partsInZone(date)
  return `${year}-Q${Math.ceil(month / 3)}`
}

export function currentPeriodMonth(): string {
  return periodMonth()
}

export function currentPeriodQuarter(): string {
  return periodQuarter()
}
