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
| **Cycle G**. App shell + navigation | ⬜ Next |
| **Cycle H**. Problems page + attempt submission UI | ⬜ |
| **Cycle I**. Chat page | ⬜ |
| **Cycle J**. End-to-end auth smoke test (real Clerk keys) | ⬜ |

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
| 3.5 | App shell, Problems page + attempt UI, Chat page, auth smoke test | Next (Cycles G + H + I + J) |
| 4 | Mock interview mode | Out of scope (for now) |

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
| Evaluation | `openai/gpt-4-turbo` | `openai/gpt-4o-mini` |
| Roadmap | `openai/gpt-4-turbo` | `openai/gpt-4o-mini` |
| Recommendation | `openai/gpt-4-turbo` | `openai/gpt-4o-mini` |

**Exports:**
- `streamChat(messages, context)` → async generator, falls back to non-streaming on failure
- `evaluateApproach(input)` → structured `EvaluationResult` JSON
- `generateRoadmap(input)` → structured `RoadmapResult` JSON
- Internal `completeJson()` helper handles JSON calls + logs every fallback

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

### Cycle J — End-to-End Auth Smoke Test

**Goal:** Validate the full app with real Clerk keys and a real database, covering the flow that auth-bypass mode can't test.

**Scope:**
- Sign up → onboard → browse roadmap → open a problem → submit attempt → see AI evaluation → check tracker updates → chat with AI about a weak area
- Verify Clerk `<UserButton />` sign-out flow + analytics `resetAnalytics()`
- Verify token refresh doesn't break SSE streaming mid-chat
- Document any issues found, fix critical ones inline

**Depends on:** Cycles G, H, I complete.
