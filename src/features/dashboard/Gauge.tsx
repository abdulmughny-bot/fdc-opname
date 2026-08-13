export function Gauge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <div className="text-sm text-ink-soft py-4 text-center">No finished sessions yet.</div>
  }
  const clamped = Math.max(0, Math.min(100, pct))
  const angle = (clamped / 100) * 180
  const rad = (Math.PI / 180) * (180 - angle)
  const cx = 100
  const cy = 100
  const r = 80
  const x = cx + r * Math.cos(rad)
  const y = cy - r * Math.sin(rad)
  const color = clamped >= 90 ? '#1F6F64' : clamped >= 75 ? '#B8862E' : '#B3401F'

  return (
    <div className="flex justify-center">
      <svg width="220" height="121" viewBox="0 0 200 110">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#E7E8E3" strokeWidth="14" strokeLinecap="round" />
        <path
          d={`M 20 100 A 80 80 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-display font-bold"
          fontSize="30"
          fill="#1B231F"
        >
          {clamped}%
        </text>
      </svg>
    </div>
  )
}
