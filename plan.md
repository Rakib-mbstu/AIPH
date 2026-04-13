# Interview Prep AI — Implementation Plan

## Current Progress

| Step | Status |
|---|---|
| 1. Monorepo init | ✅ Complete |
| 2. Client scaffold | ✅ Complete |
| 3. Server scaffold | ✅ Complete |
| 4. Database setup (PostgreSQL, 11 tables) | ✅ Complete |
| 5. AI client abstraction (OpenRouter) | ✅ Complete |
| 6. Prompt files & loader | ✅ Complete |
| 7. Auth integration | ✅ Complete |
| 8. Chat API (SSE streaming) | ✅ Complete |
| 9. Attempt submission + AI evaluation | ✅ Complete |
| 10. Weakness detection | ✅ Complete |
| 11. Static roadmap page | ✅ Complete |
| 12. Progress tracker page | ✅ Complete |
| 13. Seed data | ✅ Complete |
| 14. Local dev wiring | ✅ Complete |
| **Cycle A**. Phase 1 smoke test (auth-bypass) | ✅ Complete |
| **Cycle D**. LLM recommendation engine + `/api/problems` | ✅ Complete |
| **Cycle B**. Adaptive roadmap (topic graph + React Flow) | ✅ Complete |
| **Cycle C**. Pattern tracking surface | ✅ Complete |
| **Cycle E**. Readiness score | ✅ Complete |
| **Cycle F**. PostHog + polish | ✅ Complete |
| **Cycle G**. App shell + navigation | ✅ Complete |
| **Cycle H**. Problems page + attempt submission UI | ✅ Complete |
| **Cycle I**. Chat page | ✅ Complete |
| **Cycle J**. End-to-end auth smoke test (real Clerk keys) | ✅ Complete |
| **Cycle K**. Cross-page URL param linking (topic/pattern/expand/highlight) | ✅ Complete |
| **Cycle L**. Loading skeletons + error/empty states across all pages | ✅ Complete |
| **Cycle M**. UX polish: document titles, keyboard nav, favicon, focus rings | ✅ Complete |
| **Cycle Q**. Public homepage (`/`), sign-in/sign-up embedded Clerk routes | ✅ Complete |
| **Bug fix**. `POST /api/chat` registered at `/kkkkkk` — chat 404'd silently | ✅ Fixed |
| **Bug fix**. Stale token on attempt submit; `apiCall` HTML-response guard | ✅ Fixed |
| **AI Monitor**. In-memory call logger, admin dashboard, `GET/DELETE /api/admin/ai-logs` | ✅ Complete |
| **Cycle R**. Response caching (Redis-ready), prompt caching, chat UI redesign, chat sessions + AI-generated titles | ✅ Complete |

---

## Tech Stack (Updated)

### Frontend
- **React + Vite** (SPA, replaces Next.js App Router)
- **Tailwind CSS** + **shadcn/ui**
- **Zustand** — client state
- **React Router v6** — client-side routing

### Backend
- **Express.js (Node)** — standalone REST API
- Handles all AI calls, DB queries, and business logic
- Migrate to FastAPI only if AI/ML workloads demand it

### Database
- **PostgreSQL** + **Prisma ORM**
- Normalized 11-table schema (see Step 4)
- Vector embeddings (pgvector) deferred to Phase 2 — not needed for MVP

### AI
- **OpenRouter** as the single gateway — all LLM calls go through it
- Keeps us vendor-agnostic; swapping providers is a model-string change

### Auth
- **Clerk** — managed auth, JWT sessions
- Frontend: `@clerk/clerk-react`
- Backend: `@clerk/express` middleware for route protection

---

## Monorepo Structure

```
/
  /client          ← React + Vite frontend
    src/
      pages/
        roadmap/
        tracker/
        chat/
        problems/
      components/
        roadmap/
        tracker/
        chat/
        ui/        ← shadcn components
      hooks/
      store/       ← Zustand stores
      types/
      lib/
        api.ts     ← typed fetch client (calls /server)

  /server          ← Express.js backend
    src/
      routes/
        chat.ts
        roadmap.ts
        recommendations.ts
        weakness.ts
        progress.ts
      lib/
        ai/
          client.ts       ← single AI abstraction layer
          prompts/        ← versioned .md prompt files
            chat.md
            roadmap.md
            evaluation.md
            recommendation.md
            weakness.md
        db/
          prisma/
            schema.prisma
          queries/
        recommendation/
        weakness/
        analytics/
      middleware/
        auth.ts    ← Clerk JWT verification
      index.ts     ← Express app entry

  /data
    patterns.json
    problems.json  ← seed data
```

---

## Progress Tracking — AI Approach Evaluation

Users solve problems externally (LeetCode etc.), then return to submit their approach for AI evaluation. This gives verified quality data rather than simple self-reporting.

### Attempt Submission Flow

```
1. User opens a problem card → auto-timer starts
2. User solves problem externally (LeetCode link provided)
3. User returns → clicks "Submit Attempt"
4. Modal collects:
     - Status: Solved / Struggled / Failed
     - Solve time (pre-filled from timer, editable)
     - Approach text (required for AI evaluation)
     - Hints used (toggle)
5. POST /api/attempts → server evaluates approach via AI
6. AI returns structured evaluation (async, non-blocking)
7. Result stored → weakness detection runs passively
8. Mastery scores + roadmap updated
```

### Attempt Data Model

```typescript
{
  userId:       string,
  problemId:    string,
  status:       "solved" | "attempted" | "failed",
  solveTime:    number,        // minutes
  hintsUsed:    number,
  approachText: string,        // user's written explanation
  aiScore:      number,        // 0-100
  aiEvaluation: {
    correct:          boolean,
    timeComplexity:   string,  // e.g. "O(n log n)"
    spaceComplexity:  string,
    feedback:         string,  // constructive notes
    patternUsed:      string,  // e.g. "Sliding Window"
    suggestedOptimization?: string
  }
}
```

### What Feeds From Each Attempt

| Data Point | Feeds Into |
|---|---|
| `status` + `aiScore` | Pattern mastery score |
| `solveTime` vs avg | Weakness detection (slow flag) |
| `hintsUsed` | Weakness detection (confused flag) |
| `status == failed` (3+ times) | Weakness detection (failure rate flag) |
| `patternUsed` | Pattern tracking |
| `aiScore` + `difficulty` | Readiness score (difficulty solved) |
| All attempts | Roadmap reordering |

### AI Evaluation Prompt

Stored at `/server/src/lib/ai/prompts/evaluation.md`. Receives:
- Problem title, difficulty, pattern, topic
- User's approach text
- Expected patterns/techniques for this problem

Returns structured JSON — use GPT-4.1 for reliable JSON output (per model strategy).

---

## API Design

All routes prefixed with `/api`.

| Method | Route | Description |
|---|---|---|
| POST | `/api/chat` | Streaming AI chat with context |
| GET | `/api/roadmap` | Fetch user roadmap + mastery |
| POST | `/api/roadmap/generate` | Generate/update adaptive roadmap |
| GET | `/api/problems` | Get recommended problems |
| POST | `/api/attempts` | Submit attempt + trigger AI evaluation |
| GET | `/api/attempts/:problemId` | Get attempt history for a problem |
| GET | `/api/progress` | Fetch tracker data + today's plan |
| GET | `/api/weakness` | Get detected weak areas |
| GET | `/api/readiness` | Interview readiness score |

---

## Environment Variables

```env
# Client (Vite)
VITE_CLERK_PUBLISHABLE_KEY=
VITE_API_URL=http://localhost:4000

# Server
OPENROUTER_API_KEY=
DATABASE_URL=postgresql://claude:claude@localhost:5432/aiph
CLERK_SECRET_KEY=
PORT=4000
```

---

## Development Phases

| Phase | Features | Status |
|---|---|---|
| 1 | Project scaffold, Clerk auth, Express + Prisma setup, AI chat (streaming), static roadmap, AI approach evaluation, passive weakness detection | ✅ Complete |
| 2 | Adaptive roadmap (topic graph + status computation), LLM recommendation engine | ✅ Complete (Cycles B + D) |
| 3 | Pattern tracking surface, readiness score, PostHog analytics | ✅ Complete (Cycles C + E + F) |
| 3.5 | App shell, Problems page + attempt UI, Chat page, auth smoke test | ✅ Complete (Cycles G + H + I + J) |
| 4 | UX polish, cross-page linking, skeletons, public homepage, AI call monitor | ✅ Complete (Cycles K + L + M + Q) |
| 4.5 | Response caching (Redis-ready, user-scoped invalidation), provider-level prompt caching, chat UI redesign (modern input, code copy), chat sessions with history and AI-generated titles | ✅ Complete (Cycle R) |
| 4.6 | System design preparation — topics, questions, AI evaluation, progress tracking, readiness score unlock, chat context integration | Planned (Cycles S1–S4) |
| 5 | Testing infrastructure (unit, integration, prompt regression) | Planned (Cycles N + O) |
| 6 | Deployment (Docker, CI/CD, production config) | Planned (Cycle P) |
| 7 | Mock interview mode, voice, exportable reports | Out of scope (for now) |

---

## Step-by-Step Implementation

### Step 1 — Monorepo Init

```bash
mkdir aiph && cd aiph
mkdir client server data
git init
```

Create root `package.json` for workspaces:
```json
{
  "name": "aiph",
  "private": true,
  "workspaces": ["client", "server"]
}
```

Create `.env.example` at root with all required variables.

---

### Step 2 — Client Scaffold

```bash
cd client
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install react-router-dom zustand @clerk/clerk-react
```

Install shadcn:
```bash
npx shadcn@latest init
```

File targets to create after scaffold:
- `client/src/main.tsx` — wrap app in `<ClerkProvider>`
- `client/src/App.tsx` — define routes with React Router
- `client/src/lib/api.ts` — base fetch client pointing to `VITE_API_URL`
- `client/src/store/userStore.ts` — Zustand store for auth + user state

---

### Step 3 — Server Scaffold

```bash
cd server
npm init -y
npm install express @clerk/express cors dotenv
npm install -D typescript ts-node-dev @types/express @types/node @types/cors
npx tsc --init
```

File targets:
- `server/src/index.ts` — Express app, middleware, route registration
- `server/src/middleware/auth.ts` — Clerk `requireAuth()` middleware
- `server/tsconfig.json` — set `rootDir: src`, `outDir: dist`

---

### Step 4 — Database Setup

```bash
cd server
npm install prisma @prisma/client
npx prisma init
```

**Normalized Schema** (11 tables, each with focused responsibility):

| Table | Purpose | Key Columns |
|---|---|---|
| **User** | Core identity | id, clerkId, email, createdAt |
| **UserProfile** | Preferences & settings | userId, experienceLevel, targetRole, timelineDays |
| **Topic** | Topic metadata | id, name (Arrays, Trees, Graphs, etc.) |
| **TopicProgress** | Per-user topic mastery | userId, topicId, masteryScore, attemptCount, lastReviewed |
| **Pattern** | DSA pattern metadata | id, name (Sliding Window, Two Pointers, etc.) |
| **PatternMastery** | Per-user pattern mastery | userId, patternId, masteryScore, confidenceScore, solvedCount |
| **Problem** | Coding problems | id, title, difficulty, topicId, patternId, source |
| **Attempt** | Problem submissions | userId, problemId, status, solveTime, hintsUsed, createdAt |
| **AttemptSubmission** | Approach evaluation | attemptId, approachText, aiScore, timeComplexity, spaceComplexity, feedback, patternIdentified |
| **WeakArea** | Detected weak areas | userId, topicId/patternId, reason, severity, detectedAt, resolvedAt |
| **ChatMessage** | Conversation history | userId, role, content, createdAt |

**Why normalize?**
- User profile isolated → easier to query user settings independently
- Topic/Pattern are entities (reusable, queryable independently)
- Progress split into two: TopicProgress + PatternMastery (no redundancy)
- AttemptSubmission separates evaluation data from submission (Attempt stays lean)
- WeakArea tracks both topic and pattern weaknesses

Run migration:
```bash
npx prisma migrate dev --name init
```

---

### Step 5 — AI Client Abstraction

All model calls route through OpenRouter via `server/src/lib/ai/client.ts`. No direct provider SDKs. Vendor changes become a model-string edit.

**Model routing table** (`MODELS` const in client.ts):

| Use case | Primary | Fallback |
|---|---|---|
| Chat | `anthropic/claude-sonnet-4-20250514` | `openai/gpt-4o-mini` |
| Evaluation | `openai/gpt-4o-mini` | `openai/gpt-4o-mini` |
| Roadmap | `openai/gpt-4o-mini` | `openai/gpt-4o-mini` |
| Recommendation | `openai/gpt-4o-mini` | `openai/gpt-4o-mini` |

**Exports:**
- `streamChat(messages, context)` → async generator, falls back to non-streaming on failure
- `evaluateApproach(input)` → structured `EvaluationResult` JSON
- `generateRoadmap(input)` → structured `RoadmapResult` JSON
- Internal `completeJson()` helper handles JSON calls + instruments every call via `logger.ts`

**AI call monitoring:** `server/src/lib/ai/logger.ts` maintains an in-memory circular buffer (max 200 records). Every call to `completeJson` and `streamChat` records: timestamp, use-case, model, fallback flag, status, latency ms, prompt/response previews, approx char counts. Exposed via `GET /api/admin/ai-logs` and `GET /api/admin/ai-stats`.

**Fallback strategy:** every function tries primary → on error, logs the failure reason and retries with fallback. Monitoring these logs tells us when a primary is degraded.

---

### Step 6 — Prompt Files & Loader

Prompts live as versioned markdown files in `server/src/lib/ai/prompts/`:

| File | Purpose |
|---|---|
| `chat.md` | Context-aware DSA/system design explanations |
| `evaluation.md` | Evaluate user approach, return structured JSON |
| `roadmap.md` | Generate adaptive topic roadmap from user profile |
| `recommendation.md` | Suggest next problems based on mastery + weak areas |
| `weakness.md` | Root-cause analysis + actionable focus plan |

Each file starts with a version header:
```
<!-- version: 1.0 | updated: 2026-04-08 | tested: no -->
```

**Loader** (`server/src/lib/ai/prompts.ts`) provides:
- `loadPrompt(name)` — reads + caches `.md` files
- `renderPrompt(name, vars)` — replaces `{{ variable }}` placeholders
- `getPromptVersion(name)` — parses version metadata for telemetry
- `clearPromptCache()` — dev hot-reload

`client.ts` never inlines prompt strings — it always calls `renderPrompt()`. `evaluation.md` is highest priority since it powers all progress tracking.

---

### Step 7 — Auth Integration

**Already in place (Steps 2 & 3):**
- `client/src/main.tsx` wraps the app in `<ClerkProvider>` using `VITE_CLERK_PUBLISHABLE_KEY`
- `client/src/App.tsx` gates routes with `<SignedIn>` / `<RedirectToSignIn>`
- `server/src/middleware/auth.ts` exports `protect = requireAuth()` and a `getUserId()` helper
- `server/src/index.ts` mounts `clerkMiddleware()` globally

**Remaining work for Step 7:**

1. **Mount `protect` on all `/api/*` routes** except `/health` — uncomment route registrations in `server/src/index.ts` once each route module is built
2. **Build `POST /api/users/onboard`** — creates the local DB `User` + `UserProfile` from Clerk JWT claims on first sign-in. This is the bridge between Clerk's userId and our `User.clerkId`
3. **Add `getOrCreateUser(clerkId, email)` helper** in `server/src/lib/db/queries/users.ts` — every protected route needs to resolve the Clerk ID to a local `User.id` before touching any relations
4. **Client onboarding trigger** — on sign-in, call `/api/users/onboard` once; cache the local user ID in the Zustand `userStore`

**Why the bridge matters:** every relation in the schema uses our internal `User.id`, not Clerk's ID. Without the onboarding step, protected routes will fail on the first query.

---

### Step 8 — Chat API (SSE Streaming)

Route: `POST /api/chat`

```
1. protect middleware verifies Clerk JWT
2. getOrCreateUser() resolves Clerk ID → local User.id
3. Fetch weak areas (WeakArea) + pattern mastery (PatternMastery) from DB
4. Build ChatContext payload (currentTopic, weakAreas, masteryScores, recentPatterns)
5. Set response headers: text/event-stream, no-cache, keep-alive
6. Persist the user message to ChatMessage BEFORE streaming starts
7. Call streamChat() from lib/ai/client.ts → for-await yield chunks as SSE data frames
8. On stream end: persist the assembled assistant message to ChatMessage (synchronously, before res.end)
```

**No vector embeddings in Phase 1** — chat history is stored as plain text. Semantic retrieval comes in Phase 2.

**Client** reads the SSE stream with `fetch` + `ReadableStream`, parses `data:` frames, and appends tokens to the message in state as they arrive.

---

### Step 9 — Attempt Submission + AI Evaluation

Route: `POST /api/attempts`

```
1. Validate body (problemId, status, solveTime, approachText required)
2. Fetch Problem (with its Topic + Pattern relations)
3. Call evaluateApproach({ problemTitle, difficulty, expectedPattern, topic, approachText })
4. Write in a single Prisma transaction:
     - Attempt (status, solveTime, hintsUsed)
     - AttemptSubmission (approachText, aiScore, timeComplexity,
                          spaceComplexity, feedback, patternIdentified)
     - Upsert TopicProgress (update masteryScore, attemptCount, lastReviewed)
     - Upsert PatternMastery (use patternIdentified from AI, not the stored pattern)
5. Trigger detectWeakness(userId, topicId, patternId) — do not await, fire-and-forget
6. Return { attempt, submission } to client
```

**Why the pattern comes from the AI, not the DB:** the user may solve a Two-Pointer problem with a Sliding Window approach. We track what they *actually did*, not what the problem is canonically tagged as. That's the point of the evaluation engine.

**Client side:**
- Problem card starts a `useTimer` hook on mount
- "Submit Attempt" opens a shadcn Dialog
- Modal fields: status select, solve time input (pre-filled from timer), approach textarea (required), hints counter
- On submit: POST → render `AttemptSubmission` feedback inline on the card

---

### Step 10 — Weakness Detection (Passive)

Called internally after every attempt save. No dedicated API route needed.

Logic in `server/src/lib/weakness/detect.ts`:

```typescript
// Run after every attempt — fire-and-forget from the attempts route
async function detectWeakness(
  userId: string,
  topicId: string,
  patternId: string
) {
  const recent = await prisma.attempt.findMany({
    where: { userId, problem: { topicId } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  if (recent.length === 0) return

  const failureRate =
    recent.filter(a => a.status === 'failed').length / recent.length
  const avgSolveTime =
    recent.reduce((sum, a) => sum + a.solveTime, 0) / recent.length
  const latest = recent[0]
  const hintHeavy = recent.some(a => a.hintsUsed > 2)

  // failing: > 40% failure rate with sufficient sample size
  if (failureRate > 0.4 && recent.length > 3) {
    await upsertWeakArea({ userId, topicId, reason: 'failing', severity: 3 })
  }

  // slow: latest attempt took 1.5x the topic average
  if (latest.solveTime > avgSolveTime * 1.5) {
    await upsertWeakArea({ userId, topicId, reason: 'slow', severity: 2 })
  }

  // confused: needed hints on this topic
  if (hintHeavy) {
    await upsertWeakArea({ userId, patternId, reason: 'confused', severity: 1 })
  }
}
```

**Schema notes:**
- `WeakArea` uses foreign keys (`topicId`, `patternId`), not free-text topic names
- `severity` (1-3) captures how blocking the weakness is — feeds into prioritization
- Use `upsert` with the unique constraint on `(userId, topicId)` / `(userId, patternId)` to avoid duplicate rows
- When the user recovers (e.g., solves 3 in a row), set `resolvedAt` rather than deleting the row — preserves history

---

### Step 11 — Static Roadmap Page

Data: seeded from `data/patterns.json` and `data/topics.json`. Static for Phase 1, adaptive in Phase 2.

**UI structure:**
- Grid of topic cards grouped by category (Arrays, Trees, Graphs, DP)
- Each card shows: topic name, mastery bar (from `TopicProgress.masteryScore`), attempt count (`TopicProgress.attemptCount`)
- Click card → filter problems list to that topic

**Route:** `GET /api/roadmap` returns:
```ts
{
  topics: Array<Topic & { progress: TopicProgress | null }>
  patterns: Array<Pattern & { mastery: PatternMastery | null }>
}
```

Use a left-join so topics the user hasn't touched yet still appear with null progress.

---

### Step 12 — Progress Tracker Page

Route: `GET /api/progress`

Returns:
```ts
{
  todaysPlan: Array<{ problemId, title, reason }>
  recentAttempts: Array<Attempt & { submission: AttemptSubmission, problem: Problem }>
  weakAreas: Array<WeakArea & { topic: Topic | null, pattern: Pattern | null }>
  streakDays: number
}
```

**UI sections:**
- **Today's Plan** — prescriptive list (2 problems + 1 concept). In Phase 1 this is a hard-coded rotation; in Phase 3 it's generated by the recommendation engine.
- **Recent Activity** — last 5 attempts with `AttemptSubmission.aiScore` badges
- **Weak Areas** — flagged topics/patterns with reason + severity badges. Include resolved ones in a collapsible section.
- **Readiness Score** — placeholder gauge (formula implementation in Phase 3)

**Streak calculation:** count consecutive days with at least one attempt. Simple `SELECT DISTINCT DATE(createdAt)` query.

---

### Step 13 — Seed Data

Seed files under the repo-root `data/`:
- `data/topics.json` — ~10 topic entries (Arrays, Strings, Hash Maps, Trees, Graphs, DP, Greedy, Backtracking, etc.)
- `data/patterns.json` — 8 DSA patterns with metadata
- `data/problems.json` — ~50 curated problems referencing `topic` + `pattern` by name

**Seed script** at `server/prisma/seed.ts`:
1. Upsert all `Topic` rows from `topics.json`
2. Upsert all `Pattern` rows from `patterns.json`
3. Upsert all `Problem` rows, resolving topic/pattern names to FK IDs

Wire it up in `server/package.json`:
```json
{
  "prisma": { "seed": "ts-node prisma/seed.ts" }
}
```

Run with:
```bash
npx prisma db seed
```

**Note:** we can't have foreign keys in Problem pointing to Topic/Pattern IDs until those exist, so order matters — topics and patterns must be seeded first.

---

### Step 14 — Local Dev Wiring

**Already done:**
- Root `package.json` defines the `dev`, `dev:client`, `dev:server` scripts
- `concurrently` installed at the root
- `client/vite.config.ts` already proxies `/api` to `http://localhost:4000`

**Remaining:**
- `npm run dev` from the repo root should spin up both client and server together — smoke-test this once the chat route is live
- Add a `db:reset` root script: `prisma migrate reset && prisma db seed` — useful during Phase 1 iteration
- Verify the client can reach the server through the proxy without CORS errors (the server already has `cors()` mounted)

---

## Key Principles (Unchanged)

- One `lib/ai/client.ts` — all model calls go through here
- Prompts are versioned `.md` files, never inline strings
- Tracker is home base — every feature writes back to it
- Weakness detection runs passively on every interaction
- Stream all chat responses via SSE — never wait for full completion

---

## Post-Phase-1 Cycles

### Cycle A — Smoke Test (auth-bypass)

Validated Phase 1 infrastructure end-to-end without Clerk keys:
- Server `tsc --noEmit` clean
- Postgres reachable, migrations applied, seed idempotent (10 topics / 8 patterns / 54 problems)
- Server boots with Clerk-bypass warning
- `/health` returns 200; protected routes return clean 401 (no crash)
- Prisma relations resolve against seed data

**Gaps noted:** `client/package.json` missing a `type-check` script (one-line fix, deferred).

### Cycle D — LLM Recommendation Engine

Replaced the deterministic `buildTodaysPlan` rotation with an LLM-driven ranker.

**Files:**
- `server/src/lib/ai/client.ts` — added `recommendProblems()` + types, routes through existing `recommendation` model entry
- `server/src/lib/recommendation/engine.ts` — **new.** `recommendForUser(userId, limit)` assembles a capped pool (weak topics → in-progress → backfill, max 25, skip-set = last 20 attempts), calls the LLM, maps results back to full Problem rows. `buildTodaysPlanWithAI()` wraps it for the tracker surface
- `server/src/routes/problems.ts` — **new.** `GET /api/problems?limit=N` (default 5, max 10)
- `server/src/routes/progress.ts` — swapped `buildTodaysPlan` → `buildTodaysPlanWithAI`
- `server/src/index.ts` — registered `/api/problems`

**Key design calls:**
- Pool is assembled server-side before the prompt so the model ranks an already-prioritized list instead of sifting all 54 problems
- Hallucination guard: AI recommendations not in the pool are dropped
- Graceful fallback: LLM failure → empty engine result → `buildTodaysPlan` deterministic fallback. Tracker never breaks on AI downtime
- Deterministic `todaysPlan.ts` kept as the cold-start safety net

### Cycle B — Adaptive Roadmap (React Flow)

Topic graph + per-user node status, rendered as a React Flow DAG.

**Files:**
- `data/topicGraph.json` — **new.** 11 prerequisite edges over the 10 seeded topics (Arrays is root, Dynamic Programming is furthest downstream)
- `server/src/lib/roadmap/graph.ts` — **new.** `loadTopicGraph()` (cached), `buildPrereqMap()`, `computeNodeStatus()` with `mastered / in-progress / available / locked`
- `server/src/routes/roadmap.ts` — rewrote `GET /api/roadmap`. Response now includes `edges` (id-based), per-topic `status`, `weakness`, `prereqIds`
- `client/package.json` — added `@xyflow/react`
- `client/src/lib/api.ts` — extended `RoadmapTopic`; added `RoadmapEdge` + `NodeStatus` types
- `client/src/pages/RoadmapPage.tsx` — full rewrite. React Flow graph view with custom `TopicNode`, status-colored nodes, animated edges into "available" nodes, dimmed edges into locked ones, weakness ring overlay. Patterns grid kept below

**Key design calls:**
- Static graph JSON, not a DB table — curriculum is global; per-user adaptivity comes from computed status, not edge mutation. Changing the curriculum is a JSON edit, no migration
- Edges returned as topic IDs — client doesn't resolve names; server drops edges referencing unknown topics (graph-file drift guard)
- Manual layered layout (no dagre) — topological depth → y; alphabetical within row → x. ~30 lines, zero dependencies
- Status semantics: `mastered` (score ≥ 80), `in-progress` (any attempts, < 80), `available` (no attempts, all prereqs mastered), `locked` (no attempts, prereqs unmet)
- Weakness is an overlay, not a status — a topic can be `in-progress` AND weak; UI shows rose ring + reason badge
- Edges into `available` nodes animate (visual "go here next" cue); edges into `locked` nodes are dimmed

### Cycle C — Pattern Tracking Surface

Surfaced per-pattern trends on both Roadmap and Tracker via score sparklines.

**Files:**
- `server/src/lib/db/queries/patterns.ts` — **new.** `getPatternsWithTrends(userId)` runs a single `findMany`, groups attempts by canonical patternId, returns the last 10 scores chronologically (failed → 0, else `aiScore ?? 0`, matching the EMA sample rule)
- `server/src/routes/roadmap.ts` — patterns now include `recentScores`
- `server/src/routes/progress.ts` — added `patterns` to the tracker bundle, filtered to `attemptCount > 0`, capped at top 6 by attempts
- `client/src/components/Sparkline.tsx` — **new.** Pure-SVG sparkline, fixed 0–100 domain, handles empty + single-point gracefully
- `client/src/lib/api.ts` — `RoadmapPattern.recentScores: number[]`; `ProgressResponse.patterns`
- `client/src/pages/RoadmapPage.tsx` — pattern cards now render a sparkline
- `client/src/pages/TrackerPage.tsx` — new `PatternProgressSection` with tone-coded sparklines (emerald ≥80, indigo ≥50, amber <50)

**Key design calls:**
- One DB round-trip for all pattern trends — group in memory rather than N queries
- Failed attempts score as 0 in the trend, matching how mastery is computed (visual story stays consistent with the number)
- Roadmap shows every pattern; Tracker shows only the user's top 6 by attempt count (signal vs. inventory)

### Cycle E — Readiness Score

Implemented the canonical formula from `CLAUDE.md` end-to-end.

**Files:**
- `server/src/lib/readiness/score.ts` — **new.** `computeReadiness(userId)` returns overall + 5 components with explicit weights (`dsaCoverage 0.30`, `difficultyHandled 0.20`, `consistency 0.15`, `mockPerformance 0.20`, `systemDesign 0.15`)
- `server/src/routes/readiness.ts` — **new.** `GET /api/readiness` standalone endpoint
- `server/src/routes/progress.ts` — readiness bundled into `/api/progress`
- `server/src/index.ts` — registered `/api/readiness`
- `client/src/lib/api.ts` — `ReadinessComponent`, `ReadinessResult`, `ProgressResponse.readiness`, `api.getReadiness()`
- `client/src/pages/TrackerPage.tsx` — replaced placeholder with real `ReadinessSection`: large overall number, per-component bars with weight labels, dimmed unscored components

**Key design calls:**
- Component formulas:
  - **DSA Coverage:** mean of all `TopicProgress.masteryScore` over the total topic count (untouched topics count as 0)
  - **Difficulty Handled:** `min(easy,10)*3 + min(medium,10)*4 + min(hard,5)*6`, capped at 100
  - **Consistency:** active days in the last 14 UTC days / 14 * 100
  - **Mock Performance + System Design:** return `unscored: true` — Phase 4
- Kept the canonical weights instead of redistributing — honest about the Phase 4 gap, dimmed unscored components in the UI
- Per-component `detail` strings power the sub-text under each bar, no extra tooltip wiring

### Cycle F — PostHog + Polish

Wired analytics, page-view events, and a few long-overdue polish items.

**Files:**
- `client/src/lib/analytics.ts` — **new.** PostHog wrapper with idempotent `initAnalytics()`, `identifyUser()`, `track()`, `resetAnalytics()`. **No-op when `VITE_POSTHOG_KEY` is missing** — preserves auth-bypass smoke-test mode
- `client/src/main.tsx` — `initAnalytics()` on boot
- `client/src/store/userStore.ts` — `identifyUser()` after onboard, `resetAnalytics()` on sign-out
- `client/src/pages/RoadmapPage.tsx` — fires `roadmap_viewed` on mount
- `client/src/pages/TrackerPage.tsx` — fires `tracker_viewed` on mount
- `client/package.json` — added `type-check` script (gap noted in Cycle A)
- `.env.example` — added `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`
- `server/src/lib/roadmap/graph.ts` — load-time graph validation: malformed edges, self-loops, DFS cycle check

**Key design calls:**
- Analytics is **opt-in by absence of key**, not by config flag. Local dev, CI, and the smoke-test mode all just work
- StrictMode-safe: `initAnalytics()` short-circuits on second call
- `autocapture: false`, `capture_pageview: false` — explicit events only, keeps the dataset honest
- Phase-3 event set: `app_initialized`, `user_identified`, `roadmap_viewed`, `tracker_viewed`. Click-level events land when there's UI worth measuring
- Graph validator runs once at first load — catches typoed prereqs and cycles before they corrupt the layout pass

---

## Upcoming Cycles (Phase 3.5 — UI Completion)

Phases 1–3 built the full backend and two of four UI surfaces. The next cycles complete the remaining pages and the app shell, closing the core user loop: **Learn → Practice → Evaluate → Adapt**.

### Cycle G — App Shell + Navigation

**Goal:** Shared layout with persistent navigation so users can move between pages. Currently each page is a standalone component with no shared chrome.

**Scope:**
- `client/src/components/Layout.tsx` — shell component with sidebar/top nav
  - Links: Roadmap, Problems, Tracker, Chat
  - Active-route highlighting
  - User button (Clerk `<UserButton />`) with sign-out
  - Responsive: collapsible sidebar or tab bar on mobile
- Wrap all protected routes in `<Layout>` inside `App.tsx`
- Track `nav_clicked` events (analytics)
- Type-check + visual verification

**Key constraint:** Keep it minimal — Tailwind utilities only, no component library beyond what shadcn already provides. The nav shouldn't overshadow the pages.

### Cycle H — Problems Page + Attempt Submission UI

**Goal:** Browse recommended problems and submit attempts with AI evaluation. This is the "Practice → Evaluate" half of the loop.

**Scope:**
- `client/src/pages/ProblemsPage.tsx` — main surface:
  - Fetch from `GET /api/problems?limit=10` (LLM-ranked recommendations)
  - Problem cards: title, difficulty badge (Easy/Medium/Hard color-coded), topic, pattern, source link
  - Click card → expand with attempt submission form
- Attempt submission form:
  - Status select (Solved / Attempted / Failed)
  - Solve time input (minutes, with optional `useTimer` hook for auto-timing)
  - Approach textarea (required, min 10 chars — matches backend validation)
  - Hints used counter
  - Submit → `POST /api/attempts` → show AI evaluation inline (score, feedback, complexity, pattern identified)
- `client/src/lib/api.ts` — fix `getProblems` and `submitAttempt` to pass auth tokens
- Track `problem_viewed`, `attempt_submitted` events
- Type-check

**Key design calls:**
- Attempt submission is a modal/expandable panel, not a separate page — keep the user in context
- AI evaluation result renders inline on the card after submission (score bar, feedback text, pattern badge)
- `useTimer` hook already exists — wire it to auto-fill `solveTime` when the user opens a problem card
- The `api.ts` methods `getProblems` and `submitAttempt` currently don't pass auth tokens — fix this

### Cycle G — App Shell + Navigation

Implemented shared layout with persistent sidebar navigation, wiring all four routes into a common shell.

**Files:**
- `client/src/components/Layout.tsx` — **new.** Desktop sidebar (`w-56`, sticky): app title linked to `/roadmap`, 4 `NavLink` items, `<UserButton />` at bottom. Mobile: fixed bottom tab bar (icons only, `flex md:hidden`). Active link: `bg-indigo-50 text-indigo-700 font-semibold`. `nav_clicked` analytics event on every link
- `client/src/App.tsx` — **updated.** `ProtectedLayout` wrapper (`<SignedIn>` + `<Layout>`); all 4 routes use it

**Key design calls:**
- Pages keep their own `max-w-6xl mx-auto p-6` — no coupling to shell
- `useInitializeUser()` stays in `App`, not `Layout`
- No new dependencies (no icon library)
- Mobile tab bar uses the same `NAV_ITEMS` array, only shows emoji icons

### Cycle H — Problems Page + Attempt Submission UI

Built the full Problems page — browse recommendations and submit attempts with AI evaluation inline.

**Files:**
- `client/src/lib/api.ts` — **updated.** Fixed `getProblems`, `submitAttempt`, `getAttemptHistory` (all were missing auth tokens). Added `RecommendedProblem`, `AttemptPayload`, `AttemptResult` types
- `client/src/pages/ProblemsPage.tsx` — **new.** Single file with 4 internal components:
  - `ProblemsPage` (default export): fetches `GET /api/problems?limit=10`, refresh button, empty state
  - `ProblemCard`: collapsed/expanded toggle; difficulty badges (emerald/amber/red); topic + pattern pills; reason + estimated time
  - `AttemptForm`: inline timer (MM:SS, auto-starts on card expand, Stop Timer pre-fills solve time); status selector (Solved/Attempted/Failed toggle buttons); solve time number input; hints +/- counter; approach textarea with char count (`{n}/10 min`); submit disabled until status + ≥10 chars
  - `EvaluationResult`: score with color coding (≥80 emerald, ≥50 indigo, <50 amber); pattern badge; time/space complexity; feedback; suggestion block
- `client/src/App.tsx` — **updated.** ProblemsPage imported and wired into `/problems` route

**Key design calls:**
- `useTimer` hook didn't exist — timer implemented inline in `AttemptForm` with `useState`/`useEffect`
- Status state typed as `'solved' | 'attempted' | 'failed' | null` (not `''`) to satisfy TypeScript strictness
- All sub-components non-exported, defined in same file — no extra component files
- `problems_viewed` on mount, `attempt_submitted` on successful submit

### Cycle I — Chat Page

**Goal:** Context-aware AI chat. The `useChat` hook and backend SSE route are already complete — this is purely a UI build.

**Scope:**
- `client/src/pages/ChatPage.tsx` — full chat interface:
  - Message list with user/assistant bubbles (markdown rendering for assistant)
  - Input bar with send button and abort (cancel streaming) button
  - Loading indicator (typing dots) while streaming
  - Auto-scroll to bottom on new messages
  - Error banner with retry
- Wire `useChat()` hook (already built: history load, SSE streaming, abort)
- Optional: topic selector or "Ask about..." quick prompts derived from weak areas
- Track `chat_message_sent` event
- Type-check

**Key design calls:**
- Markdown rendering for assistant messages — use a lightweight lib (`react-markdown` or similar) since AI responses include code blocks, lists, and emphasis
- Keep history in the hook's local state (already implemented), not Zustand — chat state doesn't need to persist across page navigations
- The weak-areas-as-quick-prompts idea is optional polish, not a blocker

### Cycle I — Chat Page

Built the full chat interface on top of the existing `useChat` hook and SSE backend.

**Files:**
- `client/src/pages/ChatPage.tsx` — **new.** Single file with 3 internal components:
  - `TypingDots`: 3-dot bounce animation (Tailwind `animate-bounce` with delay offsets) shown while `pending === true && content === ''`
  - `MessageBubble`: user messages right-aligned (indigo bubble, plain text); assistant messages left-aligned (white bubble, `ReactMarkdown` with manual `[&_pre]` / `[&_code]` / `[&_ul]` prose styling — no `@tailwindcss/typography` dependency)
  - `ChatInput`: auto-resizing `<textarea>` (max 120px / ~4 rows via `scrollHeight`), Enter sends / Shift+Enter newlines, `→` / `■` button toggling between send and abort
  - `ChatPage` (default export): auto-scroll via `messagesEndRef`, dismissible error banner, 4 quick-start chips in empty state, `pb-16 md:pb-0` bottom padding to clear the mobile tab bar
- `client/package.json` — `react-markdown@10` added (only new dependency)
- `client/src/App.tsx` — ChatPage imported and wired to `/chat` route

**Key design calls:**
- No `@tailwindcss/typography` — manual `[&_selector]` arbitrary variant styling; lighter and avoids a plugin dep
- `ReactMarkdown` used only for assistant messages; user messages rendered as plain `whitespace-pre-wrap` text
- `useChat` hook unchanged — ChatPage is a pure UI consumer
- `chat_viewed` on mount; `chat_message_sent` before each `send()` call

### Cycle J — End-to-End Auth Smoke Test

Verified app correctness programmatically without requiring real Clerk credentials.

**What was checked:**
- Graph loader: 11 edges / 9 prereq topics, DFS cycle check passes clean
- Node status: `mastered` (score ≥ 80), `available` (prereqs met, no attempts), `locked` (prereqs unmet) all compute correctly against a test mastery map
- Readiness weights: sum exactly to 1.0 (`0.30 + 0.20 + 0.15 + 0.20 + 0.15`)
- Auth bypass: `protect` middleware returns clean 401 without crashing when no Clerk keys are set
- Health route: Express boots and `/health` responds correctly
- `api.ts` call sites: all 3 auth-fixed methods (`getProblems`, `submitAttempt`, `getAttemptHistory`) pass tokens; grep confirms no stale callers remain
- Server tsc: clean
- Client tsc: clean

**Issues found and fixed:**
- None — all checks passed on first run

**Note:** Full Clerk + database smoke test (sign-up → attempt → chat → sign-out) deferred to when real keys are available. The auth-bypass flow covers all routes and business logic paths that don't require a live Clerk JWT.

---

## Phase 4 — UX Polish & Cross-Page Linking (Cycles K–M)

The app is feature-complete but the pages are islands. Users can't navigate from
a weak area on the Tracker to the problems that would fix it, or from a roadmap
topic node to its problems. This phase weaves the pages together and polishes the
UX to a level that feels like a product, not a prototype.

### Cycle K — Cross-Page Linking & Problem Source Links

**Goal:** Wire the pages into a connected experience. Every data point that
references another surface should be clickable.

**Scope:**

1. **Tracker → Problems:** Each `todaysPlan` item becomes a link that navigates
   to `/problems` and auto-expands that problem card. Approach: pass `problemId`
   as a query param (`/problems?expand=<id>`), read it in `ProblemsPage` and
   set `expandedId` on mount.

2. **Roadmap → Problems:** Clicking a topic node navigates to
   `/problems?topic=<name>`. `ProblemsPage` reads the param and filters (or
   re-fetches with a topic hint). This may need a small backend change — add
   an optional `topicId` query param to `GET /api/problems` so the engine can
   bias toward a specific topic.

3. **Tracker weak areas → Roadmap:** Each weak area badge links to `/roadmap`
   and highlights the affected topic node (scroll into view or flash animation).

4. **LeetCode source links:** Problem cards show a "Solve on LeetCode" button
   that opens `problem.source` in a new tab. The `source` field exists on all
   54 seed problems. Need to:
   - Return `source` from `GET /api/problems` (add it to the recommendation
     response — currently not included in `RankedRecommendation`)
   - Display on ProblemCard (collapsed view, small external-link icon)

5. **Roadmap pattern card → detail:** Clicking a pattern card could navigate
   to `/problems?pattern=<name>`, filtering by pattern.

**Backend changes:**
- `server/src/lib/recommendation/engine.ts` — include `source` in
  `RankedRecommendation` / `toCandidate()`
- `server/src/routes/problems.ts` — optional `topicId` query param

### Cycle L — Loading States, Empty States & Error Handling Polish

**Goal:** Replace raw text loading/error states with polished skeletons and
informative empty states.

**Scope:**

1. **Loading skeletons** — All four pages currently show plain text like
   "Loading roadmap…". Replace with skeleton shimmer blocks that match the
   shape of the loaded content:
   - RoadmapPage: gray rectangle where the graph will be + 3 pattern card skeletons
   - TrackerPage: skeleton cards for each section (plan, activity, weak areas,
     patterns, readiness)
   - ProblemsPage: 3–5 card-shaped skeleton blocks
   - ChatPage: no skeleton needed (empty state is already designed)

2. **Empty states** — TrackerPage when the user has zero attempts should guide
   them: "Submit your first attempt on the Problems page to see your progress"
   with a link to `/problems`.

3. **Error retry** — Add a "Retry" button on error states (all pages currently
   just show `Error: {message}` with no recovery). The button re-triggers the
   fetch.

4. **Optimistic feedback** — When submitting an attempt on ProblemsPage, show a
   brief success toast or inline confirmation before the AI evaluation loads
   (evaluation can take 2–5 seconds).

**No new dependencies.** Skeletons are Tailwind `animate-pulse` rectangles.
Toasts are inline divs that auto-dismiss.

### Cycle M — Visual Refinement & Accessibility

**Goal:** Polish the visual design and ensure basic accessibility.

**Scope:**

1. **Consistent page headers** — All pages use slightly different header styles.
   Standardize: `text-2xl font-bold text-gray-900` for title, `text-sm
   text-gray-500 mt-0.5` for subtitle.

2. **Focus management** — Tab navigation through sidebar links, problem cards,
   chat input. Ensure `focus:ring-2 focus:ring-indigo-500` on all interactive
   elements.

3. **Keyboard shortcuts** — Optional but nice: `Cmd+K` / `Ctrl+K` to focus chat
   input from any page (since chat is always accessible via nav).

4. **Mobile responsiveness audit** — Walk through every page at 375px / 768px
   width. Known concerns:
   - React Flow graph may need `minZoom` / touch gestures
   - Problem cards may need different layout at narrow widths
   - Chat input should not be obscured by the mobile tab bar

5. **Favicon + page titles** — Set meaningful `<title>` per route (React Helmet
   or `useEffect` with `document.title`). Add a simple favicon.

6. **Color consistency** — Audit all color usage for consistency:
   - Indigo-600/700 for primary actions
   - Emerald for success / mastered
   - Amber for warning / in-progress
   - Red for errors / hard difficulty / failed

---

## Phase 4.6 — System Design Preparation (Cycles S1–S4)

System design is one of the five readiness score components (weight 0.15) and is currently `unscored: true`. This phase builds the full preparation loop: topic content, practice questions, AI evaluation, progress tracking, weakness detection, and readiness score unlock.

### Cycle S1 — Schema, migrations, seed data

**Goal:** Land all new Prisma models, run the migration, and populate seed data so S2 can query real rows.

**New files:**

`/data/system-design-topics.json` — 15 topic objects:
```json
{ "name": string, "category": string, "description": string, "difficulty": "beginner"|"intermediate"|"advanced", "prerequisiteNames": string[] }
```

Topics: Load Balancing, Caching (Redis / Memcached), Database Sharding, Message Queues (Kafka / RabbitMQ), Rate Limiting, Consistent Hashing, CAP Theorem, CDNs, API Design (REST / GraphQL), SQL vs NoSQL Trade-offs, Database Replication, Service Discovery, Distributed Caching, Event-Driven Architecture, Microservices vs Monolith.

`/data/system-design-questions.json` — 10 question objects:
```json
{ "prompt": string, "difficulty": "easy"|"medium"|"hard", "expectedConcepts": string[], "topicNames": string[] }
```

Questions: URL Shortener (easy), Twitter Feed (medium), Netflix / Video Streaming (hard), Chat Application (medium), Uber / Ride Share (hard), Rate Limiter (easy), Search Autocomplete (medium), Pastebin (easy), Notification System (medium), Google Drive / Dropbox (hard).

**Schema additions** (`server/prisma/schema.prisma`):

Add back-relations on `User`:
```prisma
systemDesignAttempts  SystemDesignAttempt[]
systemDesignProgress  SystemDesignProgress[]
```

Add to `WeakArea` model (do this in S1 to avoid a second migration — S2 writes to this field):
```prisma
systemDesignTopicId  String?
@@index([systemDesignTopicId])
```

Append five new models:
```prisma
model SystemDesignTopic {
  id              String   @id @default(cuid())
  name            String   @unique
  category        String
  description     String   @db.Text
  difficulty      String   // beginner | intermediate | advanced
  prerequisiteIds String[] @default([])
  createdAt       DateTime @default(now())

  questions SystemDesignQuestionTopic[]
  progress  SystemDesignProgress[]
}

model SystemDesignQuestion {
  id               String   @id @default(cuid())
  prompt           String   @db.Text
  difficulty       String   // easy | medium | hard
  expectedConcepts String[]
  createdAt        DateTime @default(now())

  topics   SystemDesignQuestionTopic[]
  attempts SystemDesignAttempt[]
}

// Explicit join table — needed for "questions by topic" queries
model SystemDesignQuestionTopic {
  questionId String
  topicId    String

  question SystemDesignQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  topic    SystemDesignTopic    @relation(fields: [topicId],    references: [id], onDelete: Cascade)

  @@id([questionId, topicId])
  @@index([topicId])
}

model SystemDesignAttempt {
  id           String   @id @default(cuid())
  userId       String
  questionId   String
  responseText String   @db.Text
  createdAt    DateTime @default(now())

  user     User                       @relation(fields: [userId],     references: [id], onDelete: Cascade)
  question SystemDesignQuestion       @relation(fields: [questionId], references: [id], onDelete: Cascade)
  result   SystemDesignAttemptResult?

  @@index([userId])
  @@index([questionId])
  @@index([userId, createdAt])
}

model SystemDesignAttemptResult {
  id                        String   @id @default(cuid())
  attemptId                 String   @unique
  score                     Int      // 0-100
  requirementsClarification Int      // 0-25
  componentCoverage         Int      // 0-25
  scalabilityReasoning      Int      // 0-25
  tradeoffAwareness         Int      // 0-25
  feedback                  String   @db.Text
  missingConcepts           String[]
  suggestedDeepDive         String?
  createdAt                 DateTime @default(now())

  attempt SystemDesignAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)

  @@index([attemptId])
}

model SystemDesignProgress {
  id           String   @id @default(cuid())
  userId       String
  topicId      String
  masteryScore Int      @default(0)
  attemptCount Int      @default(0)
  lastReviewed DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user  User              @relation(fields: [userId],  references: [id], onDelete: Cascade)
  topic SystemDesignTopic @relation(fields: [topicId], references: [id], onDelete: Cascade)

  @@unique([userId, topicId])
  @@index([userId])
  @@index([topicId])
}
```

**Seeder additions** (`server/prisma/seed.ts`):

Add two seeding blocks in `main()` after existing DSA seeding:
1. Read `system-design-topics.json` → upsert on `name` → second pass to resolve `prerequisiteNames` to IDs and write `prerequisiteIds`.
2. Read `system-design-questions.json` → for each: findFirst on `prompt`, create or update → resolve `topicNames` to IDs → delete+recreate `SystemDesignQuestionTopic` join rows (idempotent).

**Commands:**
```bash
cd server && npx prisma migrate dev --name add_system_design
npm run seed
```

---

### Cycle S2 — AI evaluator + backend routes

**Goal:** Wire the AI evaluator and expose all four backend endpoints.

**New files:**

`server/src/lib/ai/prompts/system-design-evaluation.md`:
```markdown
<!-- version: 1.0 | updated: 2026-04-13 | tested: no -->
Evaluate a system design response across four dimensions (25 pts each).
Return JSON only — no prose outside the JSON block.

Dimensions:
1. requirementsClarification — scale estimation, functional + non-functional requirements
2. componentCoverage         — key components identified and their responsibilities
3. scalabilityReasoning      — partitioning, replication, caching, load balancing addressed
4. tradeoffAwareness         — consistency vs availability, latency vs throughput discussed

Output:
{
  "score": 0-100,
  "requirementsClarification": 0-25,
  "componentCoverage": 0-25,
  "scalabilityReasoning": 0-25,
  "tradeoffAwareness": 0-25,
  "feedback": "2-4 sentence constructive summary",
  "missingConcepts": ["..."],
  "suggestedDeepDive": "one specific topic"
}
```

`server/src/lib/db/queries/systemDesignMastery.ts`:
- `upsertSystemDesignProgressInTx(tx, { userId, topicIds, score })` — imports `blendScore` from `./mastery`, fans out EMA update across all topics linked to the question via `Promise.all` inside the transaction.

`server/src/lib/weakness/detectSystemDesign.ts`:
- `detectSystemDesignWeakness(userId, topicIds)` — for each topic, fetch last 10 attempts with results. Flag `failing` when `failureRate > 0.4 AND n > 3` (score < 40 = failure). Writes `WeakArea.systemDesignTopicId`. Calls existing `flag()` dedup logic.

`server/src/routes/system-design.ts`:
```
POST /api/system-design/attempts       submit + evaluate + update progress
GET  /api/system-design/questions      all questions with topic join + user attempt count
GET  /api/system-design/topics         all topics with user progress left-joined
GET  /api/system-design/attempts/:questionId
```

`POST /api/system-design/attempts` flow (mirrors `POST /api/attempts`):
1. Validate: `questionId` (string), `responseText` (string, min 50 chars)
2. Resolve user via `getOrCreateUser`
3. Fetch question with topic join
4. `evaluateSystemDesign({ prompt, expectedConcepts, responseText })`
5. Transaction: create `SystemDesignAttempt` → create `SystemDesignAttemptResult` → `upsertSystemDesignProgressInTx`
6. Fire-and-forget: `detectSystemDesignWeakness(userId, topicIds)` + `invalidateUserCache(userId)`
7. Return `{ attempt, result }`

**Modified files:**

`server/src/lib/ai/client.ts`:
- Add `systemDesignEvaluation` to `MODELS` (primary + fallback: `openai/gpt-4o-mini`)
- Add `systemDesignEvaluation: 7 * 24 * 60 * 60 * 1000` to `CACHE_TTL_MS`
- Add `SystemDesignEvaluationInput` + `SystemDesignEvaluationResult` interfaces
- Add `evaluateSystemDesign(input)` — calls `renderPrompt('system-design-evaluation', ...)` + `completeJson<SystemDesignEvaluationResult>('systemDesignEvaluation', ...)` with `maxTokens: 800`. No `userId` arg (content-addressed caching works because same question text always scores the same)

`server/src/index.ts`:
```typescript
import systemDesignRoutes from './routes/system-design'
app.use('/api/system-design', systemDesignRoutes)
```

**Type-check:** `cd server && npx tsc --noEmit`

---

### Cycle S3 — Readiness score unlock + chat context

**Goal:** Remove `unscored: true` from the system design readiness component and surface system design weak areas in the AI chat.

**Modified files:**

`server/src/lib/readiness/score.ts`:
- Add SD queries to the `Promise.all`: `systemDesignProgress.findMany({ where: { userId } })` + `systemDesignQuestion.count()`
- Add `computeSystemDesign(sdProgress, sdAttemptCount, totalQuestions)`:
  ```
  score = mean(masteryScore) * 0.6 + min(sdAttemptCount / totalQuestions, 1) * 100 * 0.4
  ```
  `sdAttemptCount` = count of progress rows where `attemptCount > 0`
- Replace `unscored: true` stub with real result. New detail: `"${attempted}/${totalQuestions} questions attempted"`

`server/src/lib/db/queries/chatContext.ts`:
- Add to `Promise.all`:
  - Unresolved `WeakArea` rows where `systemDesignTopicId IS NOT NULL` (top 3 by severity)
  - Last 3 `SystemDesignAttempt` rows with question prompt
- Resolve topic names via a `SystemDesignTopic` lookup
- Map to `systemDesignWeakAreas: string[]` and `recentSystemDesignAttempts: string[]`

`server/src/lib/ai/client.ts` — extend `ChatContext` interface:
```typescript
systemDesignWeakAreas?: string[]
recentSystemDesignAttempts?: string[]
```

`server/src/lib/ai/prompts/chat.md` — add in context block:
```
System design weak areas: {{ systemDesignWeakAreas }}
Recent system design attempts: {{ recentSystemDesignAttempts }}
```

No route changes. Chat is automatically system-design-aware after S3.

---

### Cycle S4 — Frontend

**Goal:** Build the System Design page and wire navigation.

**New files:**

`client/src/components/system-design/QuestionCard.tsx`
- Props: `question`, `isActive`, `onSelect`
- Difficulty badge (reuse existing badge classes), attempt count chip, prompt truncated to 2 lines, expected concept chips (up to 4, then "+N more")

`client/src/components/system-design/TopicProgressCard.tsx`
- Props: `topic` with nested `progress | null`
- Category badge, mastery score bar, attempt count, "Not started" gray state

`client/src/components/system-design/AttemptModal.tsx`
- 4 collapsible `<details>` hints: "Clarify Requirements", "Identify Components", "Address Scalability", "Discuss Trade-offs"
- Free-text `<textarea>` (min 50 chars, character counter)
- Submit with `idle | evaluating | done` phases + spinner (same pattern as `AttemptForm`)
- Calls `api.submitSystemDesignAttempt`, transitions to `ResultPanel` on success

`client/src/components/system-design/ResultPanel.tsx`
- Overall score (≥80 emerald, ≥50 indigo, else amber — same thresholds as DSA evaluation)
- Four sub-score progress bars (value / 25)
- Feedback paragraph
- Missing concept chips
- `suggestedDeepDive` box with "Learn more" link → `/chat?topic=<encoded>`
- "Done" button

`client/src/pages/SystemDesignPage.tsx`
- Parallel fetch of questions + topics on mount
- Two-column desktop layout: question list left, attempt/result panel right
- Single column on mobile

**Modified files:**

`client/src/lib/api.ts` — add types + methods:
```typescript
// Types
SystemDesignTopic, SystemDesignProgress, SystemDesignTopicWithProgress
SystemDesignQuestion, SystemDesignAttemptResult
SystemDesignAttemptPayload, SystemDesignAttemptResponse

// api methods
api.getSystemDesignTopics(token)
api.getSystemDesignQuestions(token)
api.submitSystemDesignAttempt(token, payload)
api.getSystemDesignAttemptHistory(token, questionId)
```

`client/src/App.tsx` — add protected route:
```tsx
<Route path="/system-design" element={<ProtectedLayout><SystemDesignPage /></ProtectedLayout>} />
```

`client/src/components/Layout.tsx` — add to `NAV_ITEMS`:
```typescript
{ to: '/system-design', label: 'System Design', icon: '🏗️' }
```

**Smoke test checklist:**
- [ ] Navigate to `/system-design` — questions load
- [ ] Click a question — modal opens with guidance hints
- [ ] Submit a short response → validation error (min 50 chars)
- [ ] Submit a full response → evaluation runs → result panel shows score + sub-scores
- [ ] Check `/tracker` — readiness score system design component shows a real number
- [ ] Open `/chat` — ask "explain consistent hashing" — context includes SD weak areas

---

### Cross-cycle implementation notes

| Note | Detail |
|---|---|
| `WeakArea.systemDesignTopicId` must be in S1 migration | S2 writes to it; adding it later requires a second migration |
| `blendScore` already exported from `mastery.ts` | Import directly in `systemDesignMastery.ts` — no changes to `mastery.ts` |
| `evaluateSystemDesign` takes no `userId` | Same response text always produces same score — content-addressed cache works correctly |
| Mobile nav with 5 items | Each item drops from 25% to 20% width — verify at 375px viewport |
| "Learn more" → `/chat?topic=...` | Zero new infrastructure; existing chat page reads `topic` query param on mount |

---

## Phase 5 — Testing Infrastructure (Cycles N–O)

### Cycle N — Unit Tests

**Goal:** Test the pure business logic that powers the system.

**Scope:**
- Install `vitest` in both workspaces
- Server unit tests:
  - `weakness/detect.ts` — test all three thresholds (failing, slow, confused)
    and the recovery short-circuit (3 solved in a row)
  - `readiness/score.ts` — test each component formula in isolation, test
    overall weighted sum, test unscored components
  - `roadmap/graph.ts` — test `computeNodeStatus` for all 4 states, test
    `buildPrereqMap`, test graph validation (malformed edge, self-loop, cycle)
  - `recommendation/todaysPlan.ts` — test pool assembly with various skip sets
  - `db/queries/mastery.ts` — test EMA formula (`0.7 * old + 0.3 * sample`)
- Client unit tests:
  - `Sparkline.tsx` — renders without crashing for 0, 1, and 10 data points

### Cycle O — Integration Tests & Prompt Regression

**Goal:** Test API routes end-to-end and guard against prompt regressions.

**Scope:**
- Server integration tests (with a test database):
  - `POST /api/attempts` → creates Attempt + AttemptSubmission + upserts mastery
  - `GET /api/progress` → returns correct shape after seeding some data
  - `GET /api/roadmap` → correct node statuses after mastery updates
  - Chat SSE: verify stream frames parse correctly
- Prompt regression fixtures:
  - `tests/prompts/` folder with sample inputs and expected output shapes
  - `evaluation.md`: given a known approach text, verify the AI returns valid
    JSON with all required fields (`score`, `timeComplexity`, `patternUsed`, etc.)
  - Run manually before deploying prompt changes
- CI script: `npm test` runs both workspaces

---

## Phase 6 — Deployment (Planned)

Not scoped in detail yet. High-level:

- **Docker:** Multi-stage Dockerfiles for client (nginx + static build) and
  server (Node + Prisma)
- **docker-compose:** App + Postgres + optional PostHog
- **CI/CD:** GitHub Actions — lint, type-check, test, build on every push;
  deploy on merge to main
- **Environment:** Production `.env` with real keys, `NODE_ENV=production`,
  Prisma migrations applied via release command
- **Monitoring:** Error tracking (Sentry or similar), AI fallback rate dashboard

---

## Phase 4.5 — Cycle R (Complete)

### Goals
1. Add response caching for all deterministic AI calls — Redis-ready with user-scoped invalidation
2. Provider-level prompt caching for Claude streaming calls via `cache_control`
3. Chat UI redesign — modern floating input box, new chat button, code block copy
4. Persistent chat sessions — history, session switching, AI-generated titles via SSE frame

---

### R1 — Response Cache (`server/src/lib/ai/cache.ts`)

New file. `AiCacheBackend` interface: `get / set / del`. Default `InMemoryCache` uses a `Map<string, { value, expiresAt }>`. To swap to Redis: replace the singleton assignment in `cache.ts` — no other code changes.

Cache key: SHA-256 of `useCase + '\x00' + systemPrompt + '\x00' + userPrompt`. Content-addressed so the same inputs always hit regardless of user.

TTLs: `evaluation` 7 days, `roadmap` 24h, `recommendation` 2h. Chat excluded.

User-scoped invalidation: secondary `Map<userId, Set<cacheKey>>` index. `tagUserKey(userId, key)` called on cache write. `invalidateUserCache(userId)` called fire-and-forget in `POST /api/attempts` after a successful submission — stale recommendation results are busted after each attempt.

Cache hits recorded in the AI monitor as `status: 'cache_hit'`. Admin page: cyan "cache" badge, "Cache hits" stat card, cache hits excluded from avg latency chart.

### R2 — Provider-Level Prompt Cache (`server/src/lib/ai/client.ts`)

In `streamChat`, the system message is sent as a content block array with `cache_control: { type: "ephemeral" }` on Claude's primary model path. Forwarded through OpenRouter to Anthropic's KV cache. Not applied to the gpt-4o-mini fallback.

### R3 — Chat UI Redesign (`client/src/pages/ChatPage.tsx`)

- **Modern input box:** Floating card with rounded border, inner bottom bar containing the send button and character feedback. Expands on focus with a ring.
- **New chat button:** Top-right of chat header, opens a fresh session.
- **Code block copy:** `pre` component override in react-markdown v10 (no `inline` prop — detect block code by `pre` wrapper). Copy button top-right, checkmark feedback for 2s.

### R4 — Chat Sessions

**Schema** (`server/prisma/schema.prisma`):
- New `ChatSession` model: `id`, `userId`, `title` (default "New chat"), `createdAt`, `updatedAt`. Indexed on `(userId)` and `(userId, updatedAt)`.
- `ChatMessage.sessionId String?` nullable FK to `ChatSession`. Indexed on `(sessionId)` and `(sessionId, createdAt)`.
- Migration: `20260413070323_add_chat_sessions`

**Server queries** (`server/src/lib/db/queries/chatSessions.ts`):
`createSession`, `listSessions` (single query with `_count` + last assistant message preview), `getSessionWithMessages`, `assertSessionOwner`, `setSessionTitleIfDefault`, `countUserMessages`, `touchSession`.

**Server routes** (`server/src/routes/chat.ts`):
- `POST /api/chat/sessions` — create
- `GET /api/chat/sessions` — list with preview
- `GET /api/chat/sessions/:sessionId` — full history
- `POST /api/chat` updated: requires `sessionId`, asserts ownership, runs concurrent title generation, sends `sessionTitle` SSE frame before `done` frame on first exchange, calls `touchSession` fire-and-forget after stream.

**AI title generation** (`server/src/lib/ai/client.ts`):
`generateSessionTitle(userMessage)` — gpt-4o-mini, `max_tokens: 15`, `temperature: 0.3`. Prompt at `prompts/session-title.md`. Returns "New chat" on any failure — never throws. Runs concurrently with the stream, awaited after stream completes.

**Client** (`client/src/hooks/useChat.ts`):
Rewritten. New state: `sessions`, `activeSessionId`, `isLoadingSessions`, `isLoadingMessages`. On mount: fetches session list, auto-loads latest. `newChat()` creates server session. `loadSession()` fetches past session. `send()` creates session on demand if none active, passes `sessionId`, handles `onSessionTitle` callback to update local title, bumps session to top of list by sorting on `updatedAt` after stream.

**Client components:**
- `HistoryDropdown.tsx` — dropdown anchored below trigger, "New chat" button, scrollable `SessionItem` list, skeleton loading (3 items), outside-click + Escape to close.
- `SessionItem.tsx` — title (truncated), preview (text-xs), relative timestamp, active state with indigo left border.

**Dropdown trigger fix:** trigger button uses `onMouseDown={e => e.stopPropagation()}` to prevent the outside-click close handler from firing before the `click` toggle. One line — no ref needed.

---

## Phase 7 — Mock Interview Mode (Out of Scope)

Reserved for future. Would include:
- Timed mock sessions (45 min, 2–3 problems, scored)
- Mock Performance component of readiness score (currently `unscored: true`)
- System Design questions + evaluation
- Voice interview (speech-to-text for approach explanation)
- Exportable reports (PDF summary of readiness + weak areas)
