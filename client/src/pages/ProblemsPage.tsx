import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { api, type RecommendedProblem } from '../lib/api'
import { track } from '../lib/analytics'
import { Skeleton } from '../components/Skeleton'
import { SidebarCard } from '../components/problems/SidebarCard'
import { ActiveProblemPanel } from '../components/problems/ActiveProblemPanel'

export default function ProblemsPage() {
  const { getToken } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [problems, setProblems]         = useState<RecommendedProblem[]>([])
  const [activeProblem, setActiveProblem] = useState<RecommendedProblem | null>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)

  const fetchProblems = async (topicFilter?: string, patternFilter?: string) => {
    setLoading(true)
    setError(null)
    const t = await getToken()
    if (!t) { setError('Not signed in'); setLoading(false); return }
    const res = await api.getProblems(t, 10, topicFilter, patternFilter)
    if (res.error || !res.data) {
      setError(res.error ?? 'Failed to load problems')
    } else {
      setProblems(res.data.recommendations)
    }
    setLoading(false)
  }

  useEffect(() => {
    document.title = 'Problems | AIPH'
    track('problems_viewed')

    const expandParam  = searchParams.get('expand')
    const topicParam   = searchParams.get('topic')   ?? undefined
    const patternParam = searchParams.get('pattern') ?? undefined

    // Clean URL params so bookmarks don't re-trigger
    const cleaned = new URLSearchParams(searchParams)
    cleaned.delete('expand'); cleaned.delete('topic'); cleaned.delete('pattern')
    if ([...cleaned].length !== [...searchParams].length) {
      setSearchParams(cleaned, { replace: true })
    }

    fetchProblems(topicParam, patternParam).then(() => {
      if (expandParam) {
        setActiveProblem((prev) =>
          prev ?? problems.find((p) => p.problemId === expandParam) ?? null
        )
      }
    })
  }, [])

  // Auto-select when problems arrive and an expand param was in the URL
  useEffect(() => {
    const expandParam = searchParams.get('expand')
    if (expandParam && problems.length > 0 && !activeProblem) {
      const match = problems.find((p) => p.problemId === expandParam)
      if (match) setActiveProblem(match)
    }
  }, [problems])

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Left: active problem + editor ─────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto bg-gray-50">
        {activeProblem ? (
          <ActiveProblemPanel
            key={activeProblem.problemId}
            problem={activeProblem}
            getToken={getToken}
            onSubmitSuccess={() => { setActiveProblem(null); fetchProblems() }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
            <span className="text-6xl select-none">📋</span>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500">No problem selected</p>
              <p className="text-xs mt-1">Pick one from the list →</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Divider ───────────────────────────────────────────── */}
      <div className="w-px bg-gray-200 shrink-0" />

      {/* ── Right: recommendations sidebar ────────────────────── */}
      <div className="w-80 shrink-0 flex flex-col bg-white overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Recommended</h2>
            <p className="text-xs text-gray-500 mt-0.5">Based on your progress</p>
          </div>
          <button
            onClick={() => fetchProblems()}
            className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Refresh
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <SidebarSkeleton />
          ) : error ? (
            <SidebarError message={error} onRetry={fetchProblems} />
          ) : problems.length === 0 ? (
            <p className="text-xs text-gray-500 p-3">
              No recommendations yet — submit your first attempt to get personalized suggestions.
            </p>
          ) : (
            problems.map((problem) => (
              <SidebarCard
                key={problem.problemId}
                problem={problem}
                isActive={activeProblem?.problemId === problem.problemId}
                onSelect={() => setActiveProblem(problem)}
              />
            ))
          )}
        </div>
      </div>

    </div>
  )
}

// ─── Sidebar sub-components ───────────────────────────────────────────────────

function SidebarSkeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-3 rounded-lg border border-gray-200 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </>
  )
}

function SidebarError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-4 text-center space-y-2">
      <p className="text-xs text-red-600">{message}</p>
      <button
        onClick={onRetry}
        className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
      >
        Retry
      </button>
    </div>
  )
}
