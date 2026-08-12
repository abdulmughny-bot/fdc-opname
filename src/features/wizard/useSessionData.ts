import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { SessionData } from './types'

export function useSessionData(sessionId: string | null) {
  const [data, setData] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    setError(null)
    const [{ data: session, error: e1 }, { data: statuses, error: e2 }, { data: lines, error: e3 }] =
      await Promise.all([
        supabase.from('sessions').select('*').eq('id', sessionId).single(),
        supabase.from('dental_status').select('*').eq('session_id', sessionId).is('deleted_at', null),
        supabase.from('dental_log_lines').select('*').eq('session_id', sessionId),
      ])
    const err = e1 || e2 || e3
    if (err || !session) {
      setError(err?.message ?? 'Session not found.')
      setLoading(false)
      return
    }
    const dentals = (statuses ?? []).map((st) => ({
      roomId: st.room_id,
      name: st.dental_name,
      status: st.status,
      submittedAt: st.submitted_at,
      ketersesuaian: st.ketersesuaian,
      scorableCount: st.scorable_count,
      matchedCount: st.matched_count,
      amended: st.amended,
      lines: (lines ?? []).filter((l) => l.room_id === st.room_id),
    }))
    setData({ session, dentals })
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, loading, error, reload }
}
