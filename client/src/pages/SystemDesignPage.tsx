import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { api } from '../lib/api'
import type { SystemDesignQuestion, SystemDesignTopicWithProgress } from '../lib/api'
import { QuestionCard } from '../components/system-design/QuestionCard'
import { TopicProgressCard } from '../components/system-design/TopicProgressCard'
import { AttemptModal } from '../components/system-design/AttemptModal'

function SkeletonCard() {
  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-2 animate-pulse">
      <div className="h-4 bg-gray-100 rounded w-3/4" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
    </div>
  )
}

export default function SystemDesignPage() {
  const { getToken } = useAuth()
  const [questions, setQuestions] = useState<SystemDesignQuestion[]>([])
  const [topics, setTopics] = useState<SystemDesignTopicWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeQuestion, setActiveQuestion] = useState<SystemDesignQuestion | null>(null)
  const [tab, setTab] = useState<'questions' | 'topics'>('questions')

  async function loadData(token: string) {
    const [qRes, tRes] = await Promise.all([
      api.getSystemDesignQuestions(token),
      api.getSystemDesignTopics(token),
    ])
    if (qRes.error || tRes.error) {
      setError(qRes.error ?? tRes.error ?? 'Failed to load')
    } else {
      setQuestions(qRes.data?.questions ?? [])
      setTopics(tRes.data?.topics ?? [])
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await getToken()
      if (!token) { setLoading(false); return }
      await loadData(token)
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [getToken])

  function handleAttemptSuccess() {
    setActiveQuestion(null)
    ;(async () => {
      const token = await getToken()
      if (token) await loadData(token)
    })()
  }

  useEffect(() => {
    document.title = 'System Design — AIPH'
    return () => { document.title = 'AIPH' }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">System Design</h1>
          <p className="text-sm text-gray-500 mt-1">
            Practice classic design problems with AI evaluation across requirements, components, scalability, and trade-offs.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Mobile tab switcher */}
        <div className="flex md:hidden gap-1 mb-4 bg-gray-100 p-1 rounded-xl">
          {(['questions', 'topics'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'flex-1 text-sm font-medium py-1.5 rounded-lg transition-colors capitalize',
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="md:grid md:grid-cols-[2fr_1fr] md:gap-6">

          {/* ── Questions column ─────────────────────────────── */}
          <div className={tab === 'topics' ? 'hidden md:block' : ''}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Practice Questions
            </h2>
            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
              ) : questions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No questions found.</p>
              ) : (
                questions.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    isActive={activeQuestion?.id === q.id}
                    onSelect={() => setActiveQuestion(q)}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Topics column ────────────────────────────────── */}
          <div className={tab === 'questions' ? 'hidden md:block' : ''}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Topic Progress
            </h2>
            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              ) : topics.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No topics found.</p>
              ) : (
                topics.map((t) => <TopicProgressCard key={t.id} topic={t} />)
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attempt modal */}
      {activeQuestion && (
        <AttemptModal
          question={activeQuestion}
          onClose={handleAttemptSuccess}
        />
      )}
    </div>
  )
}
