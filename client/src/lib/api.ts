const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export interface ChatMessageRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface TopicProgress {
  id: string;
  masteryScore: number;
  attemptCount: number;
  successCount: number;
  averageSolveTime: number | null;
  lastReviewed: string;
}

export interface PatternMastery {
  id: string;
  masteryScore: number;
  confidenceScore: number;
  attemptCount: number;
  solvedCount: number;
}

export type NodeStatus = 'mastered' | 'in-progress' | 'available' | 'locked';

export interface TopicWeakness {
  reason: string;
  severity: number;
}

export interface RoadmapTopic {
  id: string;
  name: string;
  description: string | null;
  progress: TopicProgress | null;
  status: NodeStatus;
  weakness: TopicWeakness | null;
  prereqIds: string[];
}

export interface RoadmapEdge {
  from: string; // topic id
  to: string;   // topic id
}

export interface RoadmapPattern {
  id: string;
  name: string;
  description: string | null;
  mastery: PatternMastery | null;
  recentScores: number[]; // chronological, 0-100, up to 10
}

export interface RoadmapResponse {
  topics: RoadmapTopic[];
  edges: RoadmapEdge[];
  patterns: RoadmapPattern[];
}

export interface PlanItem {
  problemId: string;
  title: string;
  reason: string;
}

export interface AttemptRecord {
  id: string;
  status: string;
  solveTime: number;
  hintsUsed: number;
  createdAt: string;
  submission: {
    aiScore: number | null;
    timeComplexity: string | null;
    spaceComplexity: string | null;
    feedback: string | null;
    patternIdentified: string | null;
  } | null;
  problem: {
    id: string;
    title: string;
    difficulty: string;
    topic: { name: string };
    pattern: { name: string };
  };
}

export interface WeakAreaRecord {
  id: string;
  reason: string;
  severity: number;
  detectedAt: string;
  resolvedAt: string | null;
  topic: { id: string; name: string } | null;
  pattern: { id: string; name: string } | null;
}

export interface ReadinessComponent {
  score: number;
  weight: number;
  unscored?: boolean;
  detail?: string;
}

export interface ReadinessResult {
  overall: number;
  components: {
    dsaCoverage: ReadinessComponent;
    difficultyHandled: ReadinessComponent;
    consistency: ReadinessComponent;
    mockPerformance: ReadinessComponent;
    systemDesign: ReadinessComponent;
  };
}

export interface ProgressResponse {
  todaysPlan: PlanItem[];
  recentAttempts: AttemptRecord[];
  weakAreas: WeakAreaRecord[];
  streakDays: number;
  patterns: RoadmapPattern[];
  readiness: ReadinessResult;
}

export interface RecommendedProblem {
  problemId: string;
  title: string;
  difficulty: string;  // 'easy' | 'medium' | 'hard'
  topic: string;
  pattern: string;
  reason: string;
  priority: number;
  estimatedMinutes: number;
}

export interface AttemptPayload {
  problemId: string;
  status: 'solved' | 'attempted' | 'failed';
  solveTime: number;       // minutes
  hintsUsed?: number;
  approachText: string;    // min 10 chars
}

export interface AttemptResult {
  attempt: {
    id: string;
    status: string;
    solveTime: number;
    hintsUsed: number;
    createdAt: string;
  };
  submission: {
    aiScore: number;
    timeComplexity: string | null;
    spaceComplexity: string | null;
    feedback: string | null;
    patternIdentified: string | null;
    suggestedOptimization: string | null;
  };
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

/**
 * Stream a chat completion from the server. Yields token deltas as they
 * arrive over SSE. Caller is responsible for accumulating into UI state and
 * handling AbortController for cancellation.
 */
export async function* streamChat(opts: {
  token: string;
  message: string;
  history?: ChatTurn[];
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.token}`,
    },
    body: JSON.stringify({ message: opts.message, history: opts.history ?? [] }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`Chat request failed (${res.status}): ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE frames are separated by blank lines
    let sep: number;
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const dataLine = frame
        .split('\n')
        .find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload) continue;
      try {
        const obj = JSON.parse(payload);
        if (obj.delta) yield obj.delta as string;
        if (obj.done) return;
        if (obj.error) throw new Error(obj.message || obj.error);
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('Chat')) throw err;
        // Ignore JSON parse errors for keep-alive frames etc.
      }
    }
  }
}

export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit & { token?: string | null }
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_URL}/api${endpoint}`;
    const { token, ...rest } = options ?? {};
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...rest.headers,
      },
      ...rest,
    });

    const data = await response.json();

    return {
      data: response.ok ? data : undefined,
      error: response.ok ? undefined : data.error || 'Request failed',
      status: response.status,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 0,
    };
  }
}

export const api = {
  // Users
  onboard: (
    token: string,
    profile?: { experienceLevel?: string; targetRole?: string; timelineDays?: number }
  ) =>
    apiCall<{ user: any }>('/users/onboard', {
      method: 'POST',
      body: JSON.stringify(profile ?? {}),
      token,
    }),
  me: (token: string) => apiCall<{ user: any }>('/users/me', { token }),

  // Chat history
  chatHistory: (token: string, limit = 50) =>
    apiCall<{ messages: ChatMessageRecord[] }>(`/chat/history?limit=${limit}`, { token }),

  // Roadmap
  getRoadmap: (token: string) =>
    apiCall<RoadmapResponse>('/roadmap', { token }),
  generateRoadmap: (token: string) =>
    apiCall('/roadmap/generate', { method: 'POST', token }),

  // Problems
  getProblems: (token: string, limit = 10) =>
    apiCall<{ recommendations: RecommendedProblem[] }>(
      `/problems?limit=${limit}`,
      { token }
    ),

  // Attempts
  submitAttempt: (token: string, attemptData: AttemptPayload) =>
    apiCall<AttemptResult>('/attempts', {
      method: 'POST',
      body: JSON.stringify(attemptData),
      token,
    }),
  getAttemptHistory: (token: string, problemId: string) =>
    apiCall<{ attempts: any[] }>(`/attempts/${problemId}`, { token }),

  // Progress
  getProgress: (token: string) =>
    apiCall<ProgressResponse>('/progress', { token }),

  // Weakness
  getWeakAreas: (token: string) =>
    apiCall<{ weakAreas: WeakAreaRecord[] }>('/weakness', { token }),

  // Readiness
  getReadiness: (token: string) =>
    apiCall<ReadinessResult>('/readiness', { token }),
};
