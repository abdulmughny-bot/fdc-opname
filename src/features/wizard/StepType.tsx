import { StepHeader } from './shared'
import { Card } from '../../components'

export function StepType({
  onChoose,
  onExit,
}: {
  onChoose: (auditType: 'Offline' | 'Self') => void
  onExit: () => void
}) {
  return (
    <Card>
      <StepHeader onBack={onExit} backLabel="← Dashboard" />
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold text-ink mb-2">Choose audit type</h2>
        <p className="text-sm text-ink-soft">Select how this audit will be conducted. This determines who fills inventory counts during the visit.</p>
      </div>

      <div className="grid grid-cols-2 max-[700px]:grid-cols-1 gap-4">
        <button
          type="button"
          onClick={() => onChoose('Offline')}
          className="text-left bg-paper-secondary border-2 border-line rounded-lg p-5 hover:border-teal-deep hover:bg-teal-wash hover:shadow-md transition-all group"
        >
          <div className="flex items-start justify-between mb-3">
            <span className="font-mono text-[10px] tracking-wider uppercase font-semibold text-teal-deep bg-teal-wash px-2 py-1 rounded">
              Offline
            </span>
            <span className="text-2xl group-hover:scale-110 transition-transform">🏢</span>
          </div>
          <h3 className="font-display text-lg font-bold text-ink mb-2">Central Audit</h3>
          <p className="text-sm text-ink-soft leading-relaxed">
            Audit team visits the clinic and fills all inventory counts (Qty Kartu & Qty Fisik) during the on-site visit.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChoose('Self')}
          className="text-left bg-paper-secondary border-2 border-line rounded-lg p-5 hover:border-rust-deep hover:bg-rust-wash hover:shadow-md transition-all group"
        >
          <div className="flex items-start justify-between mb-3">
            <span className="font-mono text-[10px] tracking-wider uppercase font-semibold text-rust bg-rust-wash px-2 py-1 rounded">
              Self
            </span>
            <span className="text-2xl group-hover:scale-110 transition-transform">🏥</span>
          </div>
          <h3 className="font-display text-lg font-bold text-ink mb-2">Clinic Self-Opname</h3>
          <p className="text-sm text-ink-soft leading-relaxed">
            Clinic staff complete the inventory template themselves. Audit team reviews and uploads system quantities.
          </p>
        </button>
      </div>
    </Card>
  )
}
