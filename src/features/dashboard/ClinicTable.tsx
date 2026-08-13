export interface ClinicRow {
  name: string
  pct: number
}

export function ClinicTable({ rows }: { rows: ClinicRow[] }) {
  if (rows.length === 0) {
    return <div className="text-center py-10 text-sm text-ink-soft">No finished sessions yet by clinic.</div>
  }

  // Sort by percentage descending and add ranking
  const sorted = [...rows].sort((a, b) => b.pct - a.pct).map((row, idx) => ({
    ...row,
    rank: idx + 1,
  }))

  const maxPct = Math.max(...sorted.map((r) => r.pct), 100)

  return (
    <div className="space-y-2">
      {sorted.map((r) => {
        const isLeader = r.rank === 1
        const isStruggling = r.pct < 80
        const barWidth = (r.pct / maxPct) * 100

        return (
          <div
            key={r.name}
            className={`rounded-lg p-3.5 border transition-all ${
              isLeader ? 'bg-teal-wash/30 border-teal/30' : isStruggling ? 'bg-rust-wash/20 border-rust/20' : 'border-line'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  {/* Rank badge */}
                  <span className="font-mono text-xs font-bold text-ink-soft">#{r.rank}</span>
                  <span className="font-semibold text-sm text-ink truncate">{r.name}</span>
                  {isLeader && (
                    <span className="ml-auto text-lg shrink-0">🏆</span>
                  )}
                </div>
              </div>

              {/* Percentage display */}
              <div className="text-right shrink-0">
                <div className="font-mono font-bold text-2xl text-ink">{r.pct}%</div>
                <div className="text-[10px] text-ink-soft font-medium mt-0.5">
                  {isStruggling ? '⚠️ Needs attention' : isLeader ? '✓ Leading' : '✓ Good'}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-line rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isLeader ? 'bg-teal-deep' : isStruggling ? 'bg-rust' : 'bg-amber'
                }`}
                style={{ width: `${barWidth}%` }}
              />
            </div>

            {/* Gap analysis */}
            {r.pct < 100 && (
              <div className="text-[11px] text-ink-soft mt-2">
                {100 - r.pct}% gap to 100%
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
