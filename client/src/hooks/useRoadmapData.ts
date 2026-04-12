import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { api, type RoadmapResponse } from '../lib/api'

export interface UseRoadmapDataResult {
  data: RoadmapResponse | null
  loading: boolean
  error: string | null
  /** The topic ID to visually highlight (from ?highlight= URL param) */
  highlightId: string | null
}

export function useRoadmapData(): UseRoadmapDataResult {
  const { getToken } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData]         = useState<RoadmapResponse | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  // Read and clear the ?highlight= param on mount
  useEffect(() => {
    const h = searchParams.get('highlight')
    if (h) {
      setHighlightId(h)
      const cleaned = new URLSearchParams(searchParams)
      cleaned.delete('highlight')
      setSearchParams(cleaned, { replace: true })
    }
  }, [])

  // Fetch roadmap data
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await getToken()
      if (!token) {
        setError('Not signed in')
        setLoading(false)
        return
      }
      const res = await api.getRoadmap(token)
      if (cancelled) return
      if (res.error) setError(res.error)
      else setData(res.data ?? null)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [getToken])

  return { data, loading, error, highlightId }
}
