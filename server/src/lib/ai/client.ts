import OpenAI from 'openai'
import { renderPrompt } from './prompts'

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
    primary: 'openai/gpt-4-turbo',
    fallback: 'openai/gpt-4o-mini',
  },
  roadmap: {
    primary: 'openai/gpt-4-turbo',
    fallback: 'openai/gpt-4o-mini',
  },
  recommendation: {
    primary: 'openai/gpt-4-turbo',
    fallback: 'openai/gpt-4o-mini',
  },
} as const

// =============================================================================
// Types
// =============================================================================

export interface ChatContext {
  currentTopic?: string
  weakAreas?: string[]
  solvedProblems?: string[]
  masteryScores?: Record<string, number>
  recentPatterns?: string[]
}

export interface EvaluationInput {
  problemTitle: string
  difficulty: string
  expectedPattern: string
  topic: string
  approachText: string
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

type ChatMessage = { role: 'user' | 'assistant'; content: string }

// =============================================================================
// Internal: JSON call with fallback
// =============================================================================

/**
 * Run a structured JSON completion with automatic fallback on error.
 * Logs fallback invocations so we can monitor reliability.
 */
async function completeJson<T>(
  useCase: keyof typeof MODELS,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1000
): Promise<T> {
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

  try {
    return await makeCall(primary)
  } catch (err) {
    console.warn(
      `[ai/client] Primary model ${primary} failed for ${useCase}, falling back to ${fallback}:`,
      err instanceof Error ? err.message : err
    )
    return await makeCall(fallback)
  }
}

// =============================================================================
// Public: Chat streaming
// =============================================================================

/**
 * Stream a chat response token-by-token. The caller is responsible for
 * forwarding chunks to the client (SSE) and persisting the final message.
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
  })

  const { primary, fallback } = MODELS.chat

  try {
    const stream = (await openrouter.chat.completions.create({
      model: primary,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
    })) as unknown as AsyncIterable<any>

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content
      if (delta) yield delta
    }
  } catch (err) {
    console.warn(
      `[ai/client] Streaming failed on ${primary}, falling back to non-streaming ${fallback}:`,
      err instanceof Error ? err.message : err
    )

    // Fallback: single non-streaming call, yield entire response as one chunk
    const response = await openrouter.chat.completions.create({
      model: fallback,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    })
    const content = response.choices[0]?.message?.content || ''
    yield content
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
 */
export async function evaluateApproach(
  input: EvaluationInput
): Promise<EvaluationResult> {
  const systemPrompt = renderPrompt('evaluation', {})
  const userPrompt = `
Problem: ${input.problemTitle}
Difficulty: ${input.difficulty}
Expected Pattern: ${input.expectedPattern}
Topic: ${input.topic}

User's Approach:
${input.approachText}
`.trim()

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
 */
export async function generateRoadmap(
  input: RoadmapInput
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
    2000
  )
}
