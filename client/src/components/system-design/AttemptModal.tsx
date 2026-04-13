import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { api } from '../../lib/api'
import type { SystemDesignQuestion, SystemDesignAttemptResult, SystemDesignResource } from '../../lib/api'
import { ResultPanel } from './ResultPanel'

const RESOURCE_ICONS: Record<string, string> = {
  video:   '▶',
  docs:    '📄',
  article: '🔗',
}

const HINTS = [
  {
    title: 'Clarify Requirements',
    body: 'What are the functional requirements? What scale are we designing for (users, requests/sec, data volume)? Any non-functional requirements (latency, availability, consistency)?',
  },
  {
    title: 'Identify Components',
    body: 'What are the main services or layers? What does each component store or compute? How do clients interact with the system?',
  },
  {
    title: 'Address Scalability',
    body: 'Where are the bottlenecks? How does the system scale under 10x or 100x load? Consider sharding, replication, caching, CDNs, and async processing.',
  },
  {
    title: 'Discuss Trade-offs',
    body: 'What did you choose and what did you give up? SQL vs NoSQL, consistency vs availability, normalisation vs denormalisation, cost vs performance?',
  },
]

type Phase = 'writing' | 'evaluating' | 'done'

export function AttemptModal({
  question,
  onClose,
}: {
  question: SystemDesignQuestion
  onClose: () => void
}) {
  const { getToken } = useAuth()
  const [responseText, setResponseText] = useState('')
  const [phase, setPhase] = useState<Phase>('writing')
  const [result, setResult] = useState<SystemDesignAttemptResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const MIN_CHARS = 50
  const remaining = MIN_CHARS - responseText.length

  async function handleSubmit() {
    if (responseText.trim().length < MIN_CHARS) return
    setPhase('evaluating')
    setError(null)

    const token = await getToken()
    if (!token) { setError('Not signed in'); setPhase('writing'); return }

    const res = await api.submitSystemDesignAttempt(token, {
      questionId: question.id,
      responseText: responseText.trim(),
    })

    if (res.error || !res.data) {
      setError(res.error ?? 'Evaluation failed')
      setPhase('writing')
      return
    }

    setResult(res.data.result)
    setPhase('done')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-0.5">
              System Design
            </p>
            <h2 className="text-base font-bold text-gray-900 leading-snug">{question.prompt}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {phase === 'done' && result ? (
            <ResultPanel result={result} onDone={onClose} />
          ) : (
            <>
              {/* Resource links */}
              {question.resources.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Resources
                  </p>
                  <div className="space-y-1.5">
                    {question.resources.map((r: SystemDesignResource) => (
                      <a
                        key={r.url}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                      >
                        <span className="text-xs">{RESOURCE_ICONS[r.type] ?? '🔗'}</span>
                        {r.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Guidance hints */}
              <div className="space-y-2">
                {HINTS.map((hint) => (
                  <details key={hint.title} className="group border border-gray-100 rounded-lg">
                    <summary className="flex items-center justify-between px-3 py-2 cursor-pointer list-none text-sm font-medium text-gray-700 hover:text-gray-900 select-none">
                      <span>{hint.title}</span>
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </summary>
                    <p className="px-3 pb-3 text-xs text-gray-500 leading-relaxed">{hint.body}</p>
                  </details>
                ))}
              </div>

              {/* Response textarea */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                  Your Design
                </label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Describe your system design here. Walk through requirements, components, data model, APIs, and how it scales..."
                  rows={10}
                  disabled={phase === 'evaluating'}
                  className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <div className="flex justify-between items-center mt-1 px-1">
                  {remaining > 0 ? (
                    <p className="text-xs text-gray-400">{remaining} more characters required</p>
                  ) : (
                    <p className="text-xs text-emerald-600">Ready to submit</p>
                  )}
                  <p className="text-xs text-gray-400">{responseText.length} chars</p>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
            </>
          )}
        </div>

        {/* Footer — only shown in writing/evaluating phases */}
        {phase !== 'done' && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={phase === 'evaluating'}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={phase === 'evaluating' || responseText.trim().length < MIN_CHARS}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {phase === 'evaluating' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Evaluating…
                </>
              ) : (
                'Submit for Evaluation'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
