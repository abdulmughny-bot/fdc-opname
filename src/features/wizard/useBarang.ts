import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { BarangRow } from './types'

// Item master data (SKU -> name/unit) is looked up here rather than joined
// server-side (no FK embedding is configured — see types/database.ts).
export function useBarang() {
  const [byName, setByName] = useState<Map<string, BarangRow>>(new Map())

  const reload = useCallback(async () => {
    const { data } = await supabase.from('barang').select('*')
    setByName(new Map((data ?? []).map((b) => [b.sku, b])))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { nameFor: (sku: string) => byName.get(sku)?.name ?? sku, reload }
}
