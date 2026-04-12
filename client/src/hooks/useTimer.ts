import { useEffect, useRef, useState } from 'react'

export interface UseTimerResult {
  elapsed: number
  timerRunning: boolean
  formatted: string
  stop: () => void
  reset: () => void
}

export function useTimer(): UseTimerResult {
  const [elapsed, setElapsed] = useState(0)
  const [timerRunning, setTimerRunning] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timerRunning])

  const m = Math.floor(elapsed / 60).toString().padStart(2, '0')
  const s = (elapsed % 60).toString().padStart(2, '0')
  const formatted = `${m}:${s}`

  const stop = () => setTimerRunning(false)

  const reset = () => {
    setElapsed(0)
    setTimerRunning(true)
  }

  return { elapsed, timerRunning, formatted, stop, reset }
}
