import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

const DEFAULT_SUBMIT_THRESHOLD = 80

export function useAppSettings() {
  const [submitThreshold, setSubmitThreshold] = useState(DEFAULT_SUBMIT_THRESHOLD)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single()
    if (data) setSubmitThreshold(Number(data.submit_threshold))
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { submitThreshold, loading, reload }
}
