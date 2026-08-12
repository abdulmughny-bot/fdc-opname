import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { SessionWithStations, DerivedStatus } from './types'

function deriveStatus(sessionStatus: string, stations: SessionWithStations['stations']): DerivedStatus {
  if (sessionStatus === 'Finished') return 'Finished'
  const hasProgress = stations.some((s) => s.status !== 'Not Started')
  return hasProgress ? 'In Progress' : 'Active'
}

export function useDashboardData() {
  const [sessions, setSessions] = useState<SessionWithStations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const [{ data: sessionRows, error: e1 }, { data: statusRows, error: e2 }] = await Promise.all([
        supabase.from('sessions').select('*').is('deleted_at', null).order('started_at', { ascending: false }),
        supabase.from('dental_status').select('*').is('deleted_at', null),
      ])
      if (cancelled) return
      const err = e1 || e2
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      const byId = new Map<string, SessionWithStations['stations']>()
      ;(statusRows ?? []).forEach((st) => {
        const list = byId.get(st.session_id) ?? []
        list.push(st)
        byId.set(st.session_id, list)
      })
      const combined = (sessionRows ?? []).map((session) => {
        const stations = byId.get(session.id) ?? []
        return { session, stations, derivedStatus: deriveStatus(session.status, stations) }
      })
      setSessions(combined)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  return { sessions, loading, error, reload: () => setReloadToken((t) => t + 1) }
}
