import { NotBuiltYet } from './NotBuiltYet'

export function ItemTypeSettings() {
  return (
    <NotBuiltYet
      title="Acceptable item types for upload"
      question='"Item type" could mean two different things here — which one did you mean?'
      options={[
        'A whitelist of units (e.g. PCS, BOX, BOTTLE, SET) — uploads with an unrecognized unit get rejected or flagged.',
        'A product category per SKU (e.g. Consumable, Equipment, Aesthetic) — needs a new column on the item master data.',
      ]}
    />
  )
}
