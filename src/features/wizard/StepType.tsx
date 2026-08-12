export function StepType({ onChoose }: { onChoose: (auditType: 'Offline' | 'Self') => void }) {
  return (
    <div className="bg-paper border border-line rounded-[10px] p-6">
      <h2 className="font-display text-base font-bold mb-1.5">What kind of audit is this?</h2>
      <p className="text-[13px] text-ink-soft mb-4">This decides who fills Qty Kartu and Qty Fisik during the visit.</p>
      <div className="grid grid-cols-2 max-[700px]:grid-cols-1 gap-4">
        <button
          type="button"
          onClick={() => onChoose('Offline')}
          className="text-left border-[1.5px] border-line rounded-[10px] p-4 hover:border-teal transition-colors"
        >
          <span className="font-mono text-[10.5px] tracking-wider uppercase text-teal-deep">Offline audit</span>
          <h3 className="font-display text-base font-bold mt-1.5 mb-1">Central / internal audit</h3>
          <p className="text-[13px] text-ink-soft">
            Audit team visits the clinic and fills Qty Kartu Stok and Qty Fisik themselves during the visit.
          </p>
        </button>
        <button
          type="button"
          onClick={() => onChoose('Self')}
          className="text-left border-[1.5px] border-line rounded-[10px] p-4 hover:border-teal transition-colors"
        >
          <span className="font-mono text-[10.5px] tracking-wider uppercase text-teal-deep">Self audit</span>
          <h3 className="font-display text-base font-bold mt-1.5 mb-1">Clinic self-opname</h3>
          <p className="text-[13px] text-ink-soft">
            Clinic staff fill Qty Kartu Stok and Qty Fisik using the template. Qty Sistem is still supplied by audit.
          </p>
        </button>
      </div>
    </div>
  )
}
