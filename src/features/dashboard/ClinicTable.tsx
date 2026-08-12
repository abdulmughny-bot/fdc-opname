export interface ClinicRow {
  name: string
  pct: number
}

export function ClinicTable({ rows }: { rows: ClinicRow[] }) {
  if (rows.length === 0) {
    return <div className="text-center py-10 text-sm text-ink-soft">No finished sessions yet by clinic.</div>
  }
  return (
    <table className="w-full border-collapse text-[13.5px]">
      <thead>
        <tr>
          <th className="text-left font-mono text-[10.5px] tracking-wider uppercase text-ink-soft font-medium px-2.5 py-2.5 border-b border-line">
            Clinic
          </th>
          <th className="text-right font-mono text-[10.5px] tracking-wider uppercase text-ink-soft font-medium px-2.5 py-2.5 border-b border-line">
            Ketersesuaian
          </th>
          <th className="text-left font-mono text-[10.5px] tracking-wider uppercase text-ink-soft font-medium px-2.5 py-2.5 border-b border-line">
            Status
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const flag = r.pct < 90
          return (
            <tr key={r.name}>
              <td className="px-2.5 py-2.5 border-b border-line">{r.name}</td>
              <td className="px-2.5 py-2.5 border-b border-line text-right font-mono">{r.pct}%</td>
              <td className="px-2.5 py-2.5 border-b border-line">
                {flag ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-rust-wash text-rust">
                    <span className="w-1.5 h-1.5 rounded-full bg-rust" />
                    Below 90
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-teal-wash text-teal-deep">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                    On track
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
