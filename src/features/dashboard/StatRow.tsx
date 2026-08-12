function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-paper border border-line rounded-[10px] px-[18px] py-4">
      <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-ink-soft">{label}</div>
      <div className="font-display text-[28px] font-bold mt-1">{value}</div>
      <div className="text-xs text-ink-soft mt-0.5">{sub}</div>
    </div>
  )
}

export function StatRow({
  activeCount,
  finishedCount,
  companyPct,
  totalFilled,
}: {
  activeCount: number
  finishedCount: number
  companyPct: number | null
  totalFilled: number
}) {
  return (
    <div className="grid grid-cols-3 max-[700px]:grid-cols-2 gap-3.5 mb-[18px]">
      <Stat label="Active sessions" value={activeCount} sub="in progress across clinics" />
      <Stat label="Finished sessions" value={finishedCount} sub="reports generated" />
      <Stat
        label="Company Ketersesuaian"
        value={companyPct === null ? '—' : `${companyPct}%`}
        sub={`${totalFilled} lines checked`}
      />
    </div>
  )
}
