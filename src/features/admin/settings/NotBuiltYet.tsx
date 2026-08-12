export function NotBuiltYet({
  title,
  question,
  options,
}: {
  title: string
  question: string
  options: string[]
}) {
  return (
    <div>
      <h3 className="font-display text-base font-bold mb-1.5">{title}</h3>
      <div className="border-[1.5px] border-dashed border-line rounded-[10px] p-5 mt-4">
        <div className="font-mono text-[10.5px] tracking-wider uppercase text-amber mb-2">Not built yet</div>
        <p className="text-[13px] text-ink mb-3">{question}</p>
        <ul className="text-[13px] text-ink-soft space-y-1 mb-3 list-disc pl-5">
          {options.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
        <p className="text-[13px] text-ink-soft">Tell me which one and I'll build it — no guessing at the rule.</p>
      </div>
    </div>
  )
}
