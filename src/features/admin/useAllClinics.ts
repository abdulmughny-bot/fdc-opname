import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { ClinicRow } from './types'

// Leads manage access globally, regardless of their own clinic scope — so
// this reads every clinic directly, not the caller-scoped list from useAuth.
export function useAllClinics() {
  const [clinics, setClinics] = useState<ClinicRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('clinics')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (!cancelled) {
          setClinics(data ?? [])
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { clinics, loading }
}
