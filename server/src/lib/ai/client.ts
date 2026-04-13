import OpenAI from 'openai'
import { createHash } from 'crypto'
import { renderPrompt } from './prompts'
import { recordAiCall, recordCacheHit } from './logger'
import { aiCache, tagUserKey } from './cache'

// =============================================================================
// Configuration
// =============================================================================

/**
 * All LLM calls go through OpenRouter. This keeps us vendor-agnostic —
 * swapping providers is a string change, not a dependency swap.
 */
const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://aiph.app',
    'X-Title': 'Interview Prep AI',
  },
})

/**
 * Model routing — each use case has a primary and a fallback.
 * Keep these in sync with CLAUDE.md's model strategy table.
 */
const MODELS = {
  chat: {
    primary: 'anthropic/claude-sonnet-4-20250514',
    fallback: 'openai/gpt-4o-mini',
  },
  evaluation: {
    primary: 'openai/gpt-4o-mini',
    fallback: 'openai/gpt-4o-mini',
  },
  roadmap: {
    primary: 'openai/gpt-4o-mini',
    fallback: 'openai/gpt-4o-mini',
  },
  recommendation: {
    primary: 'openai/gpt-4o-mini',
    fallback: 'openai/gpt-4o-mini',
  },
  systemDesignEvaluation: {
    primary: 'openai/gpt-4o-mini',
    fallback: 'openai/gpt-4o-mini',
  },
} as const

/**
 * TTLs for application-level response caching.
 * Only deterministic use cases (temperature: 0) are cached.
 * `chat` is excluded — it streams and is never called via completeJson.
 */
const CACHE_TTL_MS: Partial<Record<keyof typeof MODELS, number>> = {
  evaluation:               7 * 24 * 60 * 60 * 1000,  // 7 days  — same code/approach → same score
  roadmap:                  24 * 60 * 60 * 1000,       // 24 hours — mastery changes slowly
  recommendation:           2 * 60 * 60 * 1000,        // 2 hours  — shifts within a session
  systemDesignEvaluation:   7 * 24 * 60 * 60 * 1000,  // 7 days  — same response text → same score
}

// =============================================================================
// Types
// =============================================================================

export interface ChatContext {
  currentTopic?: string
  weakAreas?: string[]
  solvedProblems?: string[]
  masteryScores?: Record<string, number>
  recentPatterns?: string[]
  systemDesignWeakAreas?: string[]
  recentSystemDesignAttempts?: string[]
}

export interface EvaluationInput {
  problemTitle: string
  difficulty: string
  expectedPattern: string
  topic: string
  approachText: string
  language?: string       // e.g. "python", "javascript"
  codeSubmission?: string // actual code the user wrote
}

export interface EvaluationResult {
  correct: boolean
  timeComplexity: string
  spaceComplexity: string
  feedback: string
  patternUsed: string
  suggestedOptimization?: string
  score: number
}

export interface RecommendationCandidate {
  problemId: string
  title: string
  difficulty: string
  topic: string
  pattern: string
}

export interface RecommendationInput {
  currentTopic?: string
  weakAreas: string[]
  patternMastery: Record<string, number>
  recentProblems: string[] // titles, for the model's benefit
  problemPool: RecommendationCandidate[]
}

export interface Recommendation {
  problemId: string
  reason: string
  difficulty: string
  estimatedMinutes: number
  priority: number
}

export interface RecommendationResult {
  recommendations: Recommendation[]
}

export interface RoadmapInput {
  experienceLevel: string
  targetRole: string
  timelineDays: number
  masteryScores: Record<string, number>
  weakAreas: string[]
  solvedPatterns: string[]
}

export interface RoadmapNode {
  topic: string
  priority: number
  estimatedHours: number
  prerequisites: string[]
  recommendedPatterns: string[]
  reason: string
}

export interface RoadmapResult {
  nodes: RoadmapNode[]
  focusPlan: {
    week1: string[]
    week2?: string[]
    dailyProblemTarget: number
  }
}

export interface SystemDesignEvaluationInput {
  prompt: string
  expectedConcepts: string[]
  responseText: string
}

export interface SystemDesignEvaluationResult {
  score: number
  requirementsClarification: number
  componentCoverage: number
  scalabilityReasoning: number
  tradeoffAwareness: number
  feedback: string
  missingConcepts: string[]
  suggestedDeepDive: string | null
}

type ChatMessage = { role: 'user' | 'assistant'; content: string }

// =============================================================================
// Internal: cache helpers
// =============================================================================

function makeCacheKey(useCase: string, systemPrompt: string, userPrompt: string): string {
  return createHash('sha256')
    .update(useCase + '\x00' + systemPrompt + '\x00' + userPrompt)
    .digest('hex')
}

// =============================================================================
// Internal: JSON call with caching and fallback
// =============================================================================

/**
 * Run a structured JSON completion with application-level response caching
 * and automatic fallback on error.
 *
 * Cache behaviour:
 *  - Key: SHA-256(useCase + systemPrompt + userPrompt) — content-addressed
 *  - TTL per use case (see CACHE_TTL_MS above)
 *  - userId is registered in the secondary user→keys index so that
 *    invalidateUserCache(userId) can bust stale entries on demand
 *    (e.g. after a new attempt is submitted)
 *
 * Logs fallback and cache hit invocations so the monitor shows them.
 */
async function completeJson<T>(
  useCase: keyof typeof MODELS,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1000,
  userId?: string
): Promise<T> {
  const ttl = CACHE_TTL_MS[useCase]
  const cacheKey = ttl !== undefined
    ? makeCacheKey(useCase, systemPrompt, userPrompt)
    : null

  // ── Cache read ────────────────────────────────────────────────────────────
  if (cacheKey !== null) {
    const cached = await aiCache.get(cacheKey)
    if (cached !== null) {
      recordCacheHit({
        useCase,
        promptPreview: userPrompt.slice(0, 300),
        approxPromptChars: systemPrompt.length + userPrompt.length,
      })
      return JSON.parse(cached) as T
    }
  }

  // ── Live call ─────────────────────────────────────────────────────────────
  const { primary, fallback } = MODELS[useCase]

  const makeCall = async (model: string): Promise<T> => {
    const response = await openrouter.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error(`Empty response from ${model}`)

    return JSON.parse(content) as T
  }

  // ── Cache write helper ────────────────────────────────────────────────────
  const writeCache = async (result: T): Promise<void> => {
    if (cacheKey === null || ttl === undefined) return
    await aiCache.set(cacheKey, JSON.stringify(result), ttl)
    if (userId) tagUserKey(userId, cacheKey)
  }

  const t0 = Date.now()
  try {
    const result = await makeCall(primary)
    recordAiCall({
      useCase,
      model: primary,
      wasFallback: false,
      status: 'success',
      latencyMs: Date.now() - t0,
      promptPreview: userPrompt.slice(0, 300),
      responsePreview: JSON.stringify(result).slice(0, 300),
      approxPromptChars: systemPrompt.length + userPrompt.length,
      approxResponseChars: JSON.stringify(result).length,
    })
    await writeCache(result)
    return result
  } catch (err) {
    console.warn(
      `[ai/client] Primary model ${primary} failed for ${useCase}, falling back to ${fallback}:`,
      err instanceof Error ? err.message : err
    )
    const t1 = Date.now()
    try {
      const result = await makeCall(fallback)
      recordAiCall({
        useCase,
        model: fallback,
        wasFallback: true,
        status: 'fallback_success',
        latencyMs: Date.now() - t1,
        promptPreview: userPrompt.slice(0, 300),
        responsePreview: JSON.stringify(result).slice(0, 300),
        approxPromptChars: systemPrompt.length + userPrompt.length,
        approxResponseChars: JSON.stringify(result).length,
      })
      await writeCache(result)
      return result
    } catch (fallbackErr) {
      recordAiCall({
        useCase,
        model: fallback,
        wasFallback: true,
        status: 'fallback_error',
        latencyMs: Date.now() - t1,
        promptPreview: userPrompt.slice(0, 300),
        responsePreview: fallbackErr instanceof Error ? fallbackErr.message : 'unknown',
        approxPromptChars: systemPrompt.length + userPrompt.length,
        approxResponseChars: 0,
      })
      throw fallbackErr
    }
  }
}

// =============================================================================
// Public: Chat streaming
// =============================================================================

/**
 * Stream a chat response token-by-token. The caller is responsible for
 * forwarding chunks to the client (SSE) and persisting the final message.
 *
 * Provider-level prompt caching:
 *   The system prompt is marked with cache_control: { type: "ephemeral" } so
 *   Anthropic caches the KV state on their side. Saves ~90% of system-prompt
 *   token cost on repeated requests with the same rendered prompt.
 *   Only applied to the primary Claude model — the fallback (GPT-4o-mini) does
 *   not support Anthropic's cache_control extension.
 *
 * Falls back to a non-streaming call with the fallback model on failure.
 */
export async function* streamChat(
  messages: ChatMessage[],
  context: ChatContext
): AsyncGenerator<string> {
  const systemPrompt = renderPrompt('chat', {
    currentTopic: context.currentTopic,
    weakAreas: context.weakAreas?.join(', '),
    recentPatterns: context.recentPatterns?.join(', '),
    masteryScores: JSON.stringify(context.masteryScores || {}),
    systemDesignWeakAreas: context.systemDesignWeakAreas?.join(', '),
    recentSystemDesignAttempts: context.recentSystemDesignAttempts?.join(', '),
  })

  const { primary, fallback } = MODELS.chat
  const userPrompt = messages[messages.length - 1]?.content ?? ''
  const t0 = Date.now()

  try {
    // System prompt as a content block so OpenRouter passes cache_control
    // through to Anthropic's caching layer.
    const cachedSystemMessage = {
      role: 'system' as const,
      content: [
        { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
      ] as any, // OpenAI SDK types don't model Anthropic extensions
    }

    const stream = (await openrouter.chat.completions.create({
      model: primary,
      max_tokens: 2000,
      messages: [cachedSystemMessage, ...messages],
      stream: true,
    })) as unknown as AsyncIterable<any>

    let assembled = ''
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content
      if (delta) {
        assembled += delta
        yield delta
      }
    }
    recordAiCall({
      useCase: 'chat',
      model: primary,
      wasFallback: false,
      status: 'success',
      latencyMs: Date.now() - t0,
      promptPreview: userPrompt.slice(0, 300),
      responsePreview: assembled.slice(0, 300),
      approxPromptChars: systemPrompt.length + userPrompt.length,
      approxResponseChars: assembled.length,
    })
  } catch (err) {
    console.warn(
      `[ai/client] Streaming failed on ${primary}, falling back to non-streaming ${fallback}:`,
      err instanceof Error ? err.message : err
    )

    // Fallback: single non-streaming call, yield entire response as one chunk.
    // Plain string content — GPT-4o-mini doesn't use Anthropic cache_control.
    const t1 = Date.now()
    const response = await openrouter.chat.completions.create({
      model: fallback,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    })
    const content = response.choices[0]?.message?.content || ''
    recordAiCall({
      useCase: 'chat',
      model: fallback,
      wasFallback: true,
      status: 'fallback_success',
      latencyMs: Date.now() - t1,
      promptPreview: userPrompt.slice(0, 300),
      responsePreview: content.slice(0, 300),
      approxPromptChars: systemPrompt.length + userPrompt.length,
      approxResponseChars: content.length,
    })
    yield content
  }
}

// =============================================================================
// Public: Session title generation
// =============================================================================

/**
 * Generate a short 4–6 word title for a new chat session from the user's
 * opening message. Non-critical — returns "New chat" silently on any error.
 * Fired concurrently with streaming so it adds zero perceived latency.
 */
export async function generateSessionTitle(userMessage: string): Promise<string> {
  const prompt = renderPrompt('session-title', {
    userMessage: userMessage.slice(0, 300),
  })
  try {
    const response = await openrouter.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 15,
    })
    const title = response.choices[0]?.message?.content?.trim() ?? ''
    return title || 'New chat'
  } catch {
    return 'New chat'
  }
}

// =============================================================================
// Public: Approach evaluation
// =============================================================================

/**
 * Evaluate a user's written approach to a problem. Returns structured
 * scoring, complexity analysis, and pattern identification.
 *
 * This is the cornerstone of progress tracking — every attempt runs through here.
 * Cached for 7 days: same code + approach always produces the same evaluation.
 */
export async function evaluateApproach(
  input: EvaluationInput
): Promise<EvaluationResult> {
  const systemPrompt = renderPrompt('evaluation', {})
  const userPrompt = input.codeSubmission
    ? `
Problem: ${input.problemTitle}
Difficulty: ${input.difficulty}
Expected Pattern: ${input.expectedPattern}
Topic: ${input.topic}
Language: ${input.language ?? 'unknown'}

User's Code Submission:
\`\`\`${input.language ?? ''}
${input.codeSubmission}
\`\`\`

Written Approach Notes:
${input.approachText || '(none provided)'}
`.trim()
    : `
Problem: ${input.problemTitle}
Difficulty: ${input.difficulty}
Expected Pattern: ${input.expectedPattern}
Topic: ${input.topic}

User's Approach:
${input.approachText}
`.trim()

  // No userId — evaluation is content-addressed (same problem + code = same
  // result regardless of who submitted it), so no user-scoped invalidation needed.
  return completeJson<EvaluationResult>(
    'evaluation',
    systemPrompt,
    userPrompt,
    600
  )
}

// =============================================================================
// Public: Roadmap generation
// =============================================================================

/**
 * Generate an adaptive roadmap from the user's profile and mastery data.
 * Called on initial onboarding and when weak areas shift significantly.
 * Cached for 24 hours per unique input set.
 */
export async function generateRoadmap(
  input: RoadmapInput,
  userId?: string
): Promise<RoadmapResult> {
  const systemPrompt = renderPrompt('roadmap', {
    experienceLevel: input.experienceLevel,
    targetRole: input.targetRole,
    timelineDays: input.timelineDays,
    masteryScores: JSON.stringify(input.masteryScores),
    weakAreas: input.weakAreas.join(', '),
    solvedPatterns: input.solvedPatterns.join(', '),
  })

  return completeJson<RoadmapResult>(
    'roadmap',
    systemPrompt,
    'Generate the roadmap now based on the context above.',
    2000,
    userId
  )
}

// =============================================================================
// Public: Problem recommendation
// =============================================================================

/**
 * Rank the next problems for a user using their mastery + weak areas + a
 * candidate pool. Returns a structured list with priorities and reasons.
 *
 * The pool is assembled by the caller (engine.ts) — keep it ≤ ~25 candidates
 * so the model isn't drowning in context. Recently-attempted problems should
 * already be filtered out before they hit this function.
 *
 * Cached for 2 hours. userId is registered in the user→keys index so
 * invalidateUserCache(userId) can bust this entry when a new attempt is submitted.
 */
export async function recommendProblems(
  input: RecommendationInput,
  userId?: string
): Promise<RecommendationResult> {
  const systemPrompt = renderPrompt('recommendation', {
    currentTopic: input.currentTopic ?? 'none',
    weakAreas: input.weakAreas.join(', ') || 'none',
    patternMastery: JSON.stringify(input.patternMastery),
    recentProblems: input.recentProblems.join(', ') || 'none',
    problemPool: JSON.stringify(input.problemPool),
  })

  return completeJson<RecommendationResult>(
    'recommendation',
    systemPrompt,
    'Pick the best 3-5 problems from the pool and return JSON.',
    1200,
    userId
  )
}

// =============================================================================
// Public: System design evaluation
// =============================================================================

/**
 * Evaluate a user's free-text system design response against the question prompt
 * and expected concepts. Returns a structured score across four rubric dimensions.
 *
 * Content-addressed caching (7 days): the same question + response text always
 * produces the same evaluation, regardless of which user submitted it.
 * No userId arg needed — no user-scoped cache invalidation required here.
 */
export async function evaluateSystemDesign(
  input: SystemDesignEvaluationInput
): Promise<SystemDesignEvaluationResult> {
  const systemPrompt = renderPrompt('system-design-evaluation', {})
  const userPrompt = `
Question: ${input.prompt}

Expected Concepts:
${input.expectedConcepts.map((c) => `- ${c}`).join('\n')}

Candidate Response:
${input.responseText}
`.trim()

  return completeJson<SystemDesignEvaluationResult>(
    'systemDesignEvaluation',
    systemPrompt,
    userPrompt,
    800
  )
}
