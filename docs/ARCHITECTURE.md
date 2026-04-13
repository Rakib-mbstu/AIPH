# Interview Prep AI — Technical Documentation

> Engineering reference for the AIPH codebase. Pairs with [`CLAUDE.md`](../CLAUDE.md) (product vision) and [`plan.md`](../plan.md) (implementation log). This document describes the system **as it is built today** (Phase 4.5 complete — Cycles A through M + Q + R shipped).

---

## 1. System Overview

AIPH is a two-process monorepo:

```
┌─────────────────────┐    HTTP/SSE    ┌──────────────────────┐    HTTPS    ┌────────────────┐
│  React SPA (Vite)   │ ─────────────► │  Express API (Node)  │ ──────────► │  OpenRouter    │
│  client/ :5173      │ ◄───────────── │  server/ :4000       │ ◄────────── │  (LLM gateway) │
└─────────────────────┘                └──────────┬───────────┘             └────────────────┘
        │                                          │
        │ Clerk SDK                                │ Prisma
        ▼                                          ▼
┌─────────────────────┐                ┌──────────────────────┐
│  Clerk (auth)       │                │  PostgreSQL          │
└─────────────────────┘                └──────────────────────┘
```

- **Client** is a React 19 + Vite SPA. State is local (Zustand) and routing is client-side (React Router v6). Vite proxies `/api/*` to the server in dev so no CORS dance is needed.
- **Server** is a stateless Express app. Every protected route resolves a Clerk JWT to a local `User` row before touching relations. All LLM traffic goes through one abstraction in [`server/src/lib/ai/client.ts`](../server/src/lib/ai/client.ts).
- **Database** is normalized into 11 tables (see §4). No vector store yet — pgvector is a Phase 2 concern.

The **core invariant**: every meaningful user action (`POST /api/attempts`, `POST /api/chat`) writes back into the tracker tables. The tracker is the home base; nothing is fire-and-forget except weakness detection.

---

## 2. Repository Layout

```
/
├── client/                       React + Vite SPA
│   ├── src/
│   │   ├── pages/                HomePage.tsx (public landing), RoadmapPage.tsx, TrackerPage.tsx,
│   │   │                         ProblemsPage.tsx, ChatPage.tsx, AdminPage.tsx (AI call monitor)
│   │   ├── components/           Layout.tsx (sidebar + mobile nav), Skeleton.tsx, Sparkline.tsx
│   │   │   └── chat/             HistoryDropdown.tsx (session picker), SessionItem.tsx
│   │   ├── store/                Zustand stores (userStore.ts bridges Clerk → local user)
│   │   ├── hooks/                useChat.ts (SSE + session management), useTimer.ts
│   │   ├── lib/
│   │   │   ├── api.ts            Typed fetch client; reads VITE_API_URL
│   │   │   └── analytics.ts     PostHog wrapper (no-op without key)
│   │   ├── App.tsx               React Router config + Clerk gating
│   │   └── main.tsx              ClerkProvider mount + initAnalytics()
│   └── vite.config.ts            /api proxy to localhost:4000
│
├── server/                       Express backend (TypeScript)
│   ├── src/
│   │   ├── index.ts              App entry: middleware, route registration, prisma export
│   │   ├── middleware/auth.ts    Clerk-aware route guard
│   │   ├── routes/
│   │   │   ├── users.ts          POST /api/users/onboard, GET /me
│   │   │   ├── chat.ts           POST /api/chat (SSE), POST/GET /sessions, GET /history (shim)
│   │   │   ├── attempts.ts       POST /api/attempts, GET /:problemId
│   │   │   ├── progress.ts       GET /api/progress (tracker bundle)
│   │   │   ├── roadmap.ts        GET /api/roadmap, POST /generate (501)
│   │   │   ├── problems.ts       GET /api/problems (LLM-ranked)
│   │   │   ├── readiness.ts      GET /api/readiness
│   │   │   ├── weakness.ts       GET /api/weakness, /history
│   │   │   └── admin.ts          GET /api/admin/ai-logs, GET /api/admin/ai-stats, DELETE /api/admin/ai-logs
│   │   └── lib/
│   │       ├── ai/
│   │       │   ├── client.ts     OpenRouter abstraction + fallback + call instrumentation + response cache
│   │       │   ├── cache.ts      Redis-ready response cache (InMemoryCache default, AiCacheBackend interface)
│   │       │   ├── logger.ts     In-memory circular buffer (200 records) for AI call monitoring + cache hits
│   │       │   ├── prompts.ts    Markdown prompt loader + templating
│   │       │   └── prompts/      chat.md, evaluation.md, roadmap.md, recommendation.md, weakness.md, session-title.md
│   │       ├── db/queries/       chatContext.ts, chatSessions.ts, mastery.ts, streak.ts, users.ts, patterns.ts
│   │       ├── roadmap/          graph.ts (topic graph loader + validator + status)
│   │       ├── readiness/        score.ts (composite formula)
│   │       ├── recommendation/   engine.ts (LLM ranker), todaysPlan.ts (deterministic fallback)
│   │       └── weakness/         detect.ts (passive)
│   └── prisma/
│       ├── schema.prisma         13 normalized tables (added ChatSession, updated ChatMessage)
│       └── seed.ts               Idempotent topic/pattern/problem seeder
│
├── data/                         Human-editable seed JSON (topics, patterns, problems, topicGraph)
├── plan.md                       Step-by-step implementation log
├── CLAUDE.md                     Product spec + architecture decisions
└── README.md                     Getting started
```

---

## 3. Request Lifecycle

A protected request travels this path:

```
1. Client calls /api/<resource>  (Clerk session token attached automatically)
2. Express clerkMiddleware()     populates req.auth.userId  (Clerk ID, not local ID)
3. protect (auth.ts)             401 if no userId; otherwise next()
4. Route handler:
   a. const clerkId = getUserId(req)
   b. const user = await getOrCreateUser(clerkId, email)   // local User row
   c. business logic, all relations keyed by user.id
5. Prisma transaction (when writes touch >1 table)
6. Fire-and-forget side effects (weakness detection)
7. JSON response  (or SSE for chat)
```

**Why getOrCreateUser exists.** Clerk owns identity. We mirror it into a local `User` row so foreign keys point at our IDs, not external ones. The first call to any protected route lazily onboards the user — `getOrCreateUser` is idempotent.

**Auth bypass for smoke tests.** When `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` are unset, `clerkMiddleware()` is skipped entirely and `protect` returns a clean 401 instead of crashing the request. `/health` is mounted before the middleware so it always responds, which makes `curl` smoke tests trivial.

---

## 4. Data Model

13 tables, normalized so every entity has one home. Source of truth: [`server/prisma/schema.prisma`](../server/prisma/schema.prisma).

```
User ──┬── UserProfile (1:1)
       ├── TopicProgress (1:N) ─── Topic
       ├── PatternMastery (1:N) ── Pattern
       ├── Attempt (1:N) ───────── Problem ── Topic, Pattern
       │      └── AttemptSubmission (1:1)
       ├── WeakArea (1:N) ──────── Topic? / Pattern?
       ├── ChatSession (1:N)
       │      └── ChatMessage (1:N)
       └── ChatMessage (1:N, legacy — sessionId nullable)
```

### Table responsibilities

| Table | Holds | Notes |
|---|---|---|
| `User` | Identity bridge | `clerkId` is the unique link to Clerk; all internal FKs use `id` |
| `UserProfile` | Settings | `experienceLevel`, `targetRole`, `timelineDays` — feeds roadmap generator |
| `Topic` | Topic metadata | Static reference; seeded from `data/topics.json` |
| `TopicProgress` | Per-user topic mastery | `(userId, topicId)` unique. EMA-blended mastery score |
| `Pattern` | DSA pattern metadata | Static reference; seeded from `data/patterns.json` |
| `PatternMastery` | Per-user pattern mastery | Tracks `confidenceScore` separately from `masteryScore` |
| `Problem` | Coding problems | FKs to canonical topic + pattern; user may solve it with a different pattern |
| `Attempt` | One submission | Lean — 6 columns; AI evaluation lives in `AttemptSubmission` |
| `AttemptSubmission` | Approach + AI result | `patternIdentified` = what the user *actually* used per the LLM |
| `WeakArea` | Detected flags | `topicId` OR `patternId`, never both. `resolvedAt` preserves history |
| `ChatSession` | Session container | `title` defaults to "New chat"; AI-generated title written after first exchange. Indexed on `(userId, updatedAt)` for fast sorted history |
| `ChatMessage` | One message turn | `sessionId` is nullable (legacy rows without a session remain valid). Indexed on `(sessionId, createdAt)` for history fetch |

### Mastery scoring

`server/src/lib/db/queries/mastery.ts` runs an exponential moving average:

```ts
newScore = round(old * 0.7 + sample * 0.3)
sample   = status === 'failed' ? 0 : aiScore
```

This means a single bad day can't crater a topic and a single great day can't make us cocky. `solved` is also tracked separately as `confidenceScore` on PatternMastery so the UI can distinguish "I scored well on the writeup" from "I actually solved it."

`upsertMasteryInTx` runs inside the same Prisma transaction that creates `Attempt` + `AttemptSubmission`, so mastery and submission can never disagree.

### Weak-area scoping

`WeakArea` rows are scoped to **either** a topic or a pattern, not both. The detector evaluates them on separate passes (see §6). Severity 1 = confused, 2 = slow, 3 = failing. The unique-ish constraint is enforced in code: `flag()` looks up an existing unresolved row before inserting, and bumps severity in place rather than churning.

Recovery: 3 solved-in-a-row on a topic/pattern sets `resolvedAt` instead of deleting the row.

---

## 5. AI Layer

### Single client, vendor-agnostic

[`server/src/lib/ai/client.ts`](../server/src/lib/ai/client.ts) is the only file that talks to a model provider. It uses the OpenAI SDK pointed at OpenRouter's base URL — swapping providers is a string change in the `MODELS` table, not a dependency swap.

**Model routing table:**

| Use case | Primary | Fallback |
|---|---|---|
| `chat` | `anthropic/claude-sonnet-4-20250514` | `openai/gpt-4o-mini` |
| `evaluation` | `openai/gpt-4o-mini` | `openai/gpt-4o-mini` |
| `roadmap` | `openai/gpt-4o-mini` | `openai/gpt-4o-mini` |
| `recommendation` | `openai/gpt-4o-mini` | `openai/gpt-4o-mini` |
| `sessionTitle` | `openai/gpt-4o-mini` | returns "New chat" on any failure |

### Public surface

| Function | Purpose | Failure mode |
|---|---|---|
| `streamChat(messages, context)` | Async generator yielding chat tokens | Falls back to a non-streaming call with the fallback model and yields the entire response as one chunk |
| `evaluateApproach(input)` | Returns structured `EvaluationResult` JSON | `completeJson` retries once with the fallback model, logs the failure |
| `generateRoadmap(input)` | Returns structured `RoadmapResult` JSON | Same fallback behavior |
| `recommendProblems(input, userId?)` | Returns ranked `{problemId, reason}[]` | Same fallback behavior; caller also has a deterministic fallback. `userId` used for cache tagging |
| `generateSessionTitle(userMessage)` | Returns 4–6 word title string (gpt-4o-mini, max_tokens 15) | Returns `"New chat"` on any error — never throws |

`completeJson<T>()` is the internal helper for structured calls. Forces `response_format: json_object`, `temperature: 0`, and parses the response into `T`. Before every call, `completeJson` checks the response cache by SHA-256 key. Every call (success, fallback, error, cache hit) is recorded into the in-memory logger in `logger.ts`.

### Response caching

[`server/src/lib/ai/cache.ts`](../server/src/lib/ai/cache.ts) provides content-addressed caching for deterministic JSON calls (`evaluateApproach`, `generateRoadmap`, `recommendProblems`). Chat is never cached — it must be live.

**Cache key:** SHA-256 of `useCase + '\x00' + systemPrompt + '\x00' + userPrompt`. Same inputs always map to the same key regardless of which user sent them.

**TTL per use case:**

| Use case | TTL |
|---|---|
| `evaluation` | 7 days |
| `roadmap` | 24 hours |
| `recommendation` | 2 hours |

**Backend abstraction:** `AiCacheBackend` interface with `get / set / del`. Default implementation is `InMemoryCache` (a `Map` with TTL timestamps). To swap to Redis: replace `new InMemoryCache()` with `new RedisCache(redisClient)` — no other code changes.

**User-scoped invalidation:** A secondary `Map<userId, Set<cacheKey>>` index tracks which cache keys belong to a user. `invalidateUserCache(userId)` is called fire-and-forget in `POST /api/attempts` so stale recommendation results are never served after an attempt changes the user's profile.

**Monitor visibility:** Cache hits are recorded in the AI call logger with `status: 'cache_hit'`, excluded from average latency calculations, and shown as a cyan "cache" badge in the Admin monitor.

**Prompt caching (provider-level):** The system message in `streamChat` carries `cache_control: { type: "ephemeral" }` on Claude primary path calls (not the fallback). This is the Anthropic prompt cache hint forwarded through OpenRouter — the provider caches the compiled KV context so repeat system prompts are cheaper. This is separate from the application-level response cache above.

### AI call monitoring

[`server/src/lib/ai/logger.ts`](../server/src/lib/ai/logger.ts) maintains a circular buffer of the last 200 AI calls. Each record captures: id, ISO timestamp, use-case, model, fallback flag, status (`success` | `fallback_success` | `error` | `fallback_error` | `cache_hit`), latency ms, prompt/response previews (300 chars), and approximate char counts. Cache hits are counted separately in `getAiStats()` and excluded from the average latency figure.

Exposed read-only via [`server/src/routes/admin.ts`](../server/src/routes/admin.ts):

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/admin/ai-logs?limit=N` | Recent calls (max 200), newest first |
| GET | `/api/admin/ai-stats` | Aggregated: total, fallbacks, errors, avg latency, by use-case + model |
| DELETE | `/api/admin/ai-logs` | Wipe the buffer |

Protected by an optional `ADMIN_KEY` env var checked as `x-admin-key` header. When unset, routes are open (dev convenience). The `AdminPage` at `/admin` in the frontend visualises this data with a latency bar chart, per-use-case table, and a model breakdown bar chart.

### Prompts as files, never strings

Prompts live in [`server/src/lib/ai/prompts/`](../server/src/lib/ai/prompts/) as markdown files with a version header:

```markdown
<!-- version: 1.0 | updated: 2026-04-08 | tested: no -->
```

[`prompts.ts`](../server/src/lib/ai/prompts.ts) provides:

- `loadPrompt(name)` — reads + caches `.md` files
- `renderPrompt(name, vars)` — replaces `{{ variable }}` placeholders
- `getPromptVersion(name)` — pulls the version comment for telemetry
- `clearPromptCache()` — for hot-reload during dev

**Rule:** `client.ts` never inlines prompt strings. It always calls `renderPrompt()`. When a prompt regresses, bump the version header and add a row to whatever prompt-test fixtures exist.

---

## 6. Key Business Logic

### 6.1 Attempt submission (`POST /api/attempts`)

The single most important write path in the system. Source: [`server/src/routes/attempts.ts`](../server/src/routes/attempts.ts).

```
1. Validate body                  problemId, status ∈ {solved,attempted,failed},
                                  solveTime ≥ 0, approachText length ≥ 10
2. Resolve user                   Clerk ID → email → getOrCreateUser
3. Fetch problem                  with topic + pattern relations
4. evaluateApproach()             AI returns score, complexity, feedback,
                                  patternUsed, suggestedOptimization
5. Resolve pattern for mastery    Look up evaluation.patternUsed in Pattern table.
                                  If not found, fall back to problem.pattern.
                                  (Raw string still stored on AttemptSubmission.)
6. Atomic transaction:
     create Attempt
     create AttemptSubmission
     upsertMasteryInTx (TopicProgress + PatternMastery)
7. Fire-and-forget detectWeakness — never block the response
8. Return { attempt, submission }
```

**The pattern-from-AI rule.** A user may solve a "Two Pointers"-tagged problem using sliding window. Pattern mastery should reflect what they *actually did*. The DB pattern is the canonical fallback when the AI can't identify a known pattern.

### 6.2 Chat (`POST /api/chat` — SSE)

Source: [`server/src/routes/chat.ts`](../server/src/routes/chat.ts).

```
1. Validate body: message + sessionId required
2. Resolve user. Assert session ownership (assertSessionOwner).
3. countUserMessages(sessionId) — detect first exchange
4. If first message: start generateSessionTitle(message) Promise concurrently
5. Persist user message BEFORE streaming  (survives mid-stream disconnects)
6. Set SSE headers: text/event-stream, no-cache, keep-alive, X-Accel-Buffering: no
7. Build [trimmed history (last 20)] + new user turn, buildChatContext
8. for await (chunk of streamChat(...)) → write `data: {"delta":"..."}\n\n`
9. If response had any content, persist assembled assistant message
10. If first message: await title Promise → setSessionTitleIfDefault(title)
    → write `data: {"sessionTitle":"..."}\n\n` frame BEFORE done frame
11. Write `data: {"done":true}\n\n`
12. touchSession(sessionId) fire-and-forget (bumps updatedAt for history sort)
13. res.end()
```

**Session routes** (also in `chat.ts`):

- `POST /api/chat/sessions` — create a new session (title: "New chat")
- `GET /api/chat/sessions` — list all user sessions, newest-first, with `messageCount` and 80-char `preview` of the last assistant message. Single Prisma query — no N+1.
- `GET /api/chat/sessions/:sessionId` — full message history for one session

**Why persist user message first.** If the stream dies mid-token, history still reflects what the user asked. The assistant message is only persisted when there's content to persist — partial empty assistants are not stored.

**Why title before `done` frame.** The `streamChat` client generator returns as soon as it sees `done: true`. Sending `sessionTitle` first guarantees `onSessionTitle` fires before the generator exits, so the title lands in local state in the same tick.

**Concurrent title generation.** `generateSessionTitle` is started before the stream begins. It runs in parallel with token delivery — only awaited after the stream completes. This means title generation adds zero latency to stream start.

`buildChatContext` ([`db/queries/chatContext.ts`](../server/src/lib/db/queries/chatContext.ts)) keeps the LLM context compact on purpose: top 5 unresolved weak areas, top 10 pattern mastery scores, last 5 successful patterns. Context bloat hurts model attention more than it helps.

### 6.3 Weakness detection (passive)

Source: [`server/src/lib/weakness/detect.ts`](../server/src/lib/weakness/detect.ts).

Called fire-and-forget after every attempt save with `(userId, topicId, patternId)`. Pulls the last 10 attempts in two parallel slices (one filtered by topic, one by pattern), then runs `evaluate()` on each.

**Thresholds (mirror `CLAUDE.md`):**

| Reason | Trigger | Severity |
|---|---|---|
| `failing` | `failureRate > 0.4` AND `n > 3` | 3 |
| `slow` | `latest.solveTime > avgSolve * 1.5` | 2 |
| `confused` | any of last 10 attempts had `hintsUsed > 2` | 1 |

**Recovery short-circuit.** If the last 3 attempts on a topic/pattern were all `solved`, all unresolved `WeakArea` rows on that scope are marked `resolvedAt = now()` and we return early — no new flag is created.

**Idempotency.** `flag()` always looks up an existing unresolved row before inserting. If one exists with lower severity, it's bumped in place. This is what keeps the table clean during a bad run.

**Errors are swallowed.** Detection lives downstream of a write path that already succeeded. If detection fails, we log and move on — never let analytics take down the user's submission.

### 6.4 Recommendation engine (LLM-ranked, Cycle D)

Source: [`server/src/lib/recommendation/engine.ts`](../server/src/lib/recommendation/engine.ts).

```
1. Build candidate pool, server-side, pre-prioritized:
     a. Problems on weak topics (highest severity first)
     b. Problems on in-progress topics (mastery 1–79, ascending)
     c. Backfill from untouched problems
   Cap pool at 25. Skip-set = last 20 attempts.
2. Render recommendation.md prompt with the pool + user context
3. completeJson<RecommendationResult>() → ranked list of {problemId, reason}
4. Hallucination guard: drop any problemId not in the pool
5. Map back to full Problem rows for the response
```

`buildTodaysPlanWithAI()` wraps the engine for the tracker surface. On any AI failure (timeout, parse error, empty result) it silently falls back to [`todaysPlan.ts`](../server/src/lib/recommendation/todaysPlan.ts) — the original deterministic Phase-1 picker — so the tracker never breaks on AI downtime.

`GET /api/problems?limit=N` (default 5, max 10) exposes the engine directly to the client.

### 6.5 Adaptive roadmap (Cycle B)

Source: [`server/src/lib/roadmap/graph.ts`](../server/src/lib/roadmap/graph.ts) + [`data/topicGraph.json`](../data/topicGraph.json).

The topic graph is a static JSON file at the repo root: 11 prerequisite edges over 10 topics. It's global — every user sees the same edges. Per-user adaptivity comes from **node status**, not edge mutation:

| Status | Trigger |
|---|---|
| `mastered` | `masteryScore ≥ 80` |
| `in-progress` | Any attempts AND `masteryScore < 80` |
| `available` | No attempts AND all prereqs mastered (or none) |
| `locked` | No attempts AND at least one prereq unmet |

**Why static JSON, not a DB table.** Curriculum changes are an edit to one file, no migration. The graph fits in memory; per-user state is computed at request time.

`loadTopicGraph()` is cached after first read. **Validation runs on first load**: malformed edges, self-loops, and DFS cycle checks. A bad graph file fails loud at boot rather than producing confusing UI states.

Weakness is layered as an overlay, not a status — a topic can be `in-progress` AND weak. The UI renders a rose ring + reason badge.

### 6.6 Pattern trends (Cycle C)

Source: [`server/src/lib/db/queries/patterns.ts`](../server/src/lib/db/queries/patterns.ts).

`getPatternsWithTrends(userId)` runs **one** `findMany`, then groups attempts by canonical patternId in memory and returns the last 10 scores chronologically. Failed attempts contribute `0`; otherwise the trend uses `aiScore ?? 0` — matching the EMA sample rule so the visual story stays consistent with `masteryScore`.

The Roadmap surface shows every pattern; the Tracker surface filters to `attemptCount > 0`, sorts by attempts, and caps at 6. Roadmap is inventory; Tracker is signal.

### 6.7 Readiness score (Cycle E)

Source: [`server/src/lib/readiness/score.ts`](../server/src/lib/readiness/score.ts).

`computeReadiness(userId)` returns `{ overall, components }` using the canonical formula from `CLAUDE.md`:

```
Readiness =
  (DSA Coverage      * 0.30) +
  (Difficulty Solved * 0.20) +
  (Consistency       * 0.15) +
  (Mock Performance  * 0.20) +
  (System Design     * 0.15)
```

| Component | Formula |
|---|---|
| `dsaCoverage` | Mean of `TopicProgress.masteryScore` over the total topic count (untouched topics count as 0) |
| `difficultyHandled` | `min(easy,10)*3 + min(medium,10)*4 + min(hard,5)*6`, capped at 100 |
| `consistency` | Active days in the last 14 UTC days / 14 * 100 |
| `mockPerformance` | `unscored: true` — Phase 4 |
| `systemDesign` | `unscored: true` — Phase 4 |

**The unscored decision.** We kept the canonical weights instead of redistributing across the three implemented components. The UI dims unscored rows and labels the gap explicitly — a 70 today is a real 70, not an inflated 100 over partial weights.

### 6.8 Analytics (Cycle F)

Source: [`client/src/lib/analytics.ts`](../client/src/lib/analytics.ts).

Thin wrapper around `posthog-js`. **The whole module is a no-op when `VITE_POSTHOG_KEY` is missing** — local dev, CI, and the auth-bypass smoke-test mode all keep working without PostHog credentials.

```ts
initAnalytics()                 // main.tsx, idempotent (StrictMode-safe)
identifyUser(id, props)         // userStore, after onboard
resetAnalytics()                // userStore, on sign-out
track(event, props)             // page mount points
```

**Phase-3 event set:** `app_initialized`, `user_identified`, `roadmap_viewed`, `tracker_viewed`. PostHog is configured with `autocapture: false`, `capture_pageview: false`, `persistence: 'localStorage'` — explicit events only, dataset stays clean.

---

## 7. API Reference

All routes are JSON unless noted. All `/api/*` routes require a Clerk session except where stated. Errors are `{ error: string }` with an appropriate status code.

### Users

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/users/onboard` | ✓ | Idempotent first-sign-in. Creates `User` + `UserProfile`. Body may include `experienceLevel`, `targetRole`, `timelineDays`. |
| GET | `/api/users/me` | ✓ | Current user with profile included. |

### Chat

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/chat/sessions` | ✓ | Create a new session. Returns `{ session: { id, title, createdAt, updatedAt } }`. |
| GET | `/api/chat/sessions` | ✓ | List all sessions for the user, newest-first. Returns `{ sessions: SessionSummary[] }` where each entry includes `id`, `title`, `createdAt`, `updatedAt`, `messageCount`, `preview` (80-char last assistant snippet). |
| GET | `/api/chat/sessions/:sessionId` | ✓ | Full session with all messages in ascending order. Returns `{ session, messages }`. |
| POST | `/api/chat` | ✓ | **SSE stream.** Body: `{ message: string, sessionId: string, history?: ChatTurn[] }`. Response frames: `data: {"delta":"..."}`, optionally `data: {"sessionTitle":"..."}` (first exchange only), then `data: {"done":true}`. |
| GET | `/api/chat/history?limit=N` | ✓ | **Deprecated shim.** Returns last N messages from the most recent session. Kept for backward compatibility. |

### Attempts

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/attempts` | ✓ | Submit attempt. Body: `{ problemId, status, solveTime, hintsUsed?, approachText }`. Returns `{ attempt, submission }`. |
| GET | `/api/attempts/:problemId` | ✓ | Attempt history with submissions for one problem. |

### Progress / Tracker

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/progress` | ✓ | Tracker bundle: `{ todaysPlan, recentAttempts, weakAreas, streakDays, patterns, readiness }`. One round-trip. |

### Roadmap

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/roadmap` | ✓ | `{ topics, edges, patterns }`. Topics include `status`, `weakness`, `prereqIds`. Patterns include `recentScores`. |
| POST | `/api/roadmap/generate` | ✓ | Phase 2 placeholder. Returns 501. |

### Problems

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/problems?limit=N` | ✓ | LLM-ranked problem recommendations (default 5, max 10). Pool pre-prioritized server-side. |

### Readiness

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/readiness` | ✓ | `{ overall, components }`. Standalone surface; also bundled into `/api/progress`. |

### Weakness

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/weakness` | ✓ | Currently unresolved weak areas, severity-sorted. |
| GET | `/api/weakness/history` | ✓ | Up to 100 weak areas including resolved ones, newest first. |

### Admin (AI monitor)

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/admin/ai-logs?limit=N` | `x-admin-key` (optional) | Last N AI calls (max 200), newest first |
| GET | `/api/admin/ai-stats` | `x-admin-key` (optional) | Aggregated stats: total, fallbacks, errors, avg latency, by use-case + model |
| DELETE | `/api/admin/ai-logs` | `x-admin-key` (optional) | Wipe in-memory buffer |

### Health

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | — | `{ status: 'ok', timestamp }`. Mounted before Clerk so it works without auth. |

---

## 8. Frontend Architecture

### Routing

[`client/src/App.tsx`](../client/src/App.tsx) defines these routes:

**Public:**
- `/` — `HomePage` (landing page, visible to everyone; signed-in users see "Go to Dashboard" CTA)
- `/sign-in/*` — Clerk embedded sign-in form
- `/sign-up/*` — Clerk embedded sign-up form

**Protected (require Clerk session):**
- `/roadmap` — `RoadmapPage` (React Flow topic graph + pattern cards; click node → `/problems?topic=…`)
- `/tracker` — `TrackerPage` (plan, recent attempts, weak areas, pattern trends, readiness score)
- `/problems` — `ProblemsPage` (LLM-ranked cards + inline attempt form with AI evaluation)
- `/chat` — `ChatPage` (SSE streaming chat with context)
- `/admin` — `AdminPage` (AI call monitor dashboard; no Clerk enforcement beyond session)

Unknown routes fall back to `/`.

After sign-in/sign-up, Clerk redirects to `/roadmap` (`afterSignInUrl` / `afterSignUpUrl` in `ClerkProvider`).

### State

- **Clerk** owns identity. Components use `useUser()` / `useAuth()` directly.
- **Zustand** ([`store/userStore.ts`](../client/src/store/userStore.ts)) bridges Clerk → local user. `useInitializeUser()` is called once at app mount, triggers `POST /api/users/onboard` on first sign-in, caches the resulting local user, and calls `identifyUser()` for analytics. Sign-out triggers `resetAnalytics()`.
- **API calls** go through [`lib/api.ts`](../client/src/lib/api.ts), which reads `VITE_API_URL` and attaches the Clerk session token automatically.

### Analytics

[`client/src/lib/analytics.ts`](../client/src/lib/analytics.ts) is a thin PostHog wrapper. **It is opt-in by absence of key**, not by config flag — when `VITE_POSTHOG_KEY` is unset, every function is a no-op. Local dev, CI, and the auth-bypass smoke-test mode all just work. `initAnalytics()` is StrictMode-safe (idempotent). Page-mount events fire on RoadmapPage and TrackerPage.

### Chat streaming on the client

`useChat` ([`hooks/useChat.ts`](../client/src/hooks/useChat.ts)) manages both sessions and streaming:

- **On mount:** fetches the session list and auto-loads the most recent session's messages.
- **`newChat()`:** creates a server session, adds it to local state, clears messages.
- **`loadSession(sessionId)`:** fetches full message history for a past session; no-op if already active.
- **`send(text)`:** creates a session on demand if none exists (e.g. from quick-start chips), then calls `POST /api/chat` with `fetch`. Reads the response as a `ReadableStream`, splits on `\n\n`, parses each `data:` frame. `delta` tokens append to the in-progress message; a `sessionTitle` frame updates the local session title; `done: true` ends the generator. After the stream, bumps the active session to the top of the local list by sorting on `updatedAt`.

**History UI.** `HistoryDropdown` ([`components/chat/HistoryDropdown.tsx`](../client/src/components/chat/HistoryDropdown.tsx)) renders a dropdown anchored below the "History" button. It shows a "New chat" action at the top followed by a scrollable `SessionItem` list. Outside-click (`mousedown`) and Escape close it. The trigger button uses `onMouseDown={e => e.stopPropagation()}` to prevent the close handler from firing before the toggle click — no ref needed.

**Code block copy.** `ChatPage` overrides the `pre` component in `react-markdown` (v10). Block code is detected by the `pre` wrapper (no `inline` prop in v10). A copy button with checkmark feedback is rendered at the top-right of each pre block.

---

## 9. Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- A Clerk project (publishable + secret key)
- An OpenRouter API key

### First-time setup

```bash
npm install                           # installs both workspaces
cp .env.example server/.env           # fill in DATABASE_URL, CLERK_*, OPENROUTER_API_KEY
cp .env.example client/.env           # fill in VITE_CLERK_PUBLISHABLE_KEY, VITE_API_URL
cd server && npx prisma migrate dev --name init && cd ..
npm run seed                          # 10 topics, 8 patterns, 54 problems
npm run dev                           # client :5173 + server :4000
```

### Smoke test (auth disabled)

You can boot the server without Clerk keys to validate routes, DB, and seeds in isolation. Protected routes will return 401 by design — `/health` still responds, and you can poke the seed data via Prisma Studio:

```bash
cd server && npx prisma studio
```

### Useful scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Both servers, concurrent |
| `npm run dev:client` / `dev:server` | One at a time |
| `npm run build` | Type-check + bundle both |
| `npm run type-check` | `tsc --noEmit` both |
| `npm run seed` | Run the Prisma seed |
| `npm run db:reset` | `prisma migrate reset --force && seed` |

### Environment variables

```env
# server/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/aiph
OPENROUTER_API_KEY=sk-or-...
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
PORT=4000
ADMIN_KEY=                           # optional — protects /api/admin/* routes via x-admin-key header

# client/.env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:4000
VITE_POSTHOG_KEY=                    # optional — analytics is a no-op without it
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

---

## 10. Architectural Decisions

These are the choices that shape the rest of the codebase. Read them before proposing structural changes.

| Decision | Rationale |
|---|---|
| **Express over FastAPI** | Phase 1 has no ML workloads. Node keeps the language boundary thin between client and server. Migrate only if AI/ML needs justify it. |
| **OpenRouter as the only LLM gateway** | Vendor-agnostic by construction. Swapping models is a string change in `MODELS`, not a dependency swap. |
| **Prompts as versioned `.md` files** | Plain text diffs in PRs; no rebuild to tweak; version headers make regressions traceable. |
| **Single AI client abstraction** | Every feature route imports from one place. Logging, fallback, and cost limits live in exactly one file. |
| **11-table normalization** | Prevents duplication between Topic/Pattern progress, keeps `Attempt` lean, and lets `WeakArea` scope to either dimension cleanly. |
| **Tracker as the home base** | Every write path updates `TopicProgress` + `PatternMastery` in the same transaction. There's no out-of-band reconciliation. |
| **Pattern from AI, not DB** | A user solving a Two Pointers problem with Sliding Window should move Sliding Window mastery, not Two Pointers. |
| **Passive weakness detection** | Runs fire-and-forget after every attempt. No "compute analytics" job, no UI refresh delay. |
| **No pgvector in Phase 1** | Plain-text chat history is enough for MVP. Embeddings come when semantic retrieval is actually needed. |
| **EMA mastery scoring (0.7/0.3)** | Smooths single-day variance without making the score unresponsive. |
| **Auth-bypass smoke mode** | Server boots without Clerk keys for CI / infra testing. `protect` returns a clean 401 instead of crashing. |
| **Lazy onboarding** | `getOrCreateUser()` runs on every protected route. No "you must complete onboarding" gate. |
| **Static topic graph** (Cycle B) | Curriculum is global; per-user adaptivity comes from computed status, not edge mutation. JSON edit, no migration. Validated at first load (malformed edges, self-loops, cycles). |
| **LLM-ranked recommendations** (Cycle D) | Pool pre-assembled server-side so the model ranks a prioritized shortlist rather than sifting all 54 problems. Hallucination guard drops unknown IDs. Deterministic fallback on any AI failure. |
| **Readiness: honest about Phase 4 gaps** (Cycle E) | Kept canonical weights, returned `unscored: true` for Mock + System Design. A 70 today is a real 70, not inflated over partial weights. |
| **PostHog opt-in by key absence** (Cycle F) | No config flag, no conditional import. Module functions check `enabled` internally. Zero dev-mode noise. |
| **Cross-page navigation via URL params** (Cycle K) | Tracker plan items link to `/problems?expand=<id>`, weak areas to `/roadmap?highlight=<id>`, roadmap nodes to `/problems?topic=<name>`. Params are read on mount then cleaned from the URL so bookmarks don't re-trigger filters. |
| **Token freshness at submit time** | `AttemptForm` calls `getToken()` at the moment of submission, not at page load. Clerk automatically refreshes the session if needed. The cached token from page load is never used for writes. |
| **`apiCall` non-JSON guard** | Before calling `response.json()`, `apiCall` checks `Content-Type`. Non-JSON responses (auth redirects, proxy errors, HTML error pages) surface as `"Server error (N) — unexpected response format"` instead of a raw `SyntaxError`. |
| **In-memory AI call log** | `logger.ts` uses a fixed-size circular array (max 200). No DB write, no external service. Resets on server restart by design — this is an operational debugging tool, not audit storage. |
| **Application-level response cache** (Cycle R) | SHA-256 content-addressed cache for deterministic JSON calls. `AiCacheBackend` interface lets you swap `InMemoryCache` for `RedisCache` in one line. Chat is explicitly excluded — it must be live. |
| **Provider-level prompt cache** (Cycle R) | `cache_control: { type: "ephemeral" }` on the Claude system message in `streamChat`. Sent through OpenRouter to Anthropic's KV cache. Applies only to the primary model path — fallback (gpt-4o-mini) doesn't support this header and would ignore it. |
| **User-scoped cache invalidation** (Cycle R) | A secondary `Map<userId, Set<cacheKey>>` index tracks owned keys. `invalidateUserCache()` called fire-and-forget on every attempt so recommendation results can't go stale after a mastery update. |
| **Chat sessions with AI-generated titles** (Cycle R) | Session is created before the first send, not on demand mid-stream. Title generation runs concurrently with the stream using gpt-4o-mini (max_tokens 15). Title delivered as an SSE frame before `done` so the client receives it in the same stream — no extra round-trip. |
| **`stopPropagation` on dropdown trigger** (Cycle R) | Closes a race: if the dropdown is open and the trigger is clicked, `mousedown` would fire the outside-click handler (close) before `click` fires the toggle (re-open), causing a flicker. `e.stopPropagation()` on `mousedown` prevents the outside-click handler from seeing the event — one line, no ref needed. |

---

## 11. Phase Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffold, Clerk auth, Express + Prisma, AI chat (SSE), AI approach evaluation, static roadmap, tracker, passive weakness detection | ✅ Complete |
| 2 | Adaptive roadmap (topic graph + React Flow), LLM recommendation engine (`/api/problems`) | ✅ Complete (Cycles B + D) |
| 3 | Pattern tracking surface, readiness score, PostHog analytics | ✅ Complete (Cycles C + E + F) |
| 3.5 | App shell + nav, Problems page + attempt UI, Chat page, auth smoke test | ✅ Complete (Cycles G + H + I + J) |
| 4 | UX polish (skeletons, cross-page links, titles), public homepage, AI call monitor, bug fixes | ✅ Complete (Cycles K + L + M + Q) |
| 4.5 | Response caching (Redis-ready, user-scoped invalidation, monitor visibility), provider-level prompt caching, chat UI redesign (modern input, code copy), chat sessions with persistent history and AI-generated titles | ✅ Complete (Cycle R) |
| 5 | Testing infrastructure (unit, integration, prompt regression) | Planned (Cycles N + O) |
| 6 | Deployment (Docker, CI/CD, production config) | Planned (Cycle P) |
| 7 | Mock interview mode, voice interviews, exportable reports | Out of scope (for now) |

See [`plan.md`](../plan.md) for the per-cycle implementation log.
