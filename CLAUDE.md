# Interview Prep AI — CLAUDE.md

## Product Vision

An **adaptive AI interview coach** that personalizes DSA and System Design preparation using performance analytics, weakness detection, and dynamic learning paths.

Unlike static roadmap tools, this platform continuously adapts recommendations, difficulty, and pacing based on real user behavior.

---

## Core Learning Loop

```
Learn → Practice → Evaluate → Adapt → Repeat
```

Every feature must feed data back into this loop.

---

## Differentiation Pillars

1. Adaptive roadmap (topic graph, not static phases)
2. Pattern-based DSA mastery tracking
3. Weakness detection engine
4. Interview readiness score
5. AI evaluation of user approaches

---

## Core Features

### 1. Adaptive Roadmap

Topic graph structure instead of linear phases:

```
Arrays → Sliding Window → Two Pointers
Trees → DFS → Backtracking
Graphs → BFS → Dijkstra
```

Each topic node:

```json
{
  "mastery": 0-100,
  "attempts": number,
  "avgSolveTime": number,
  "lastReviewed": date
}
```

Roadmap updates dynamically based on solve rate, difficulty handled, time taken, and repeated mistakes.

---

### 2. Pattern-Based DSA Tracking

Track mastery by pattern, not just topic:

- Sliding Window
- Two Pointers
- Binary Search
- DFS / BFS
- Backtracking
- Dynamic Programming
- Union Find
- Monotonic Stack

Each pattern exposes: `masteryScore`, `confidenceScore`, `recommendedNextProblems`.

---

### 3. Weakness Detection Engine

Trigger weak area flag when:

```
failureRate > 40% AND attempts > 3  → mark weak
solveTime > avgSolveTime * 1.5      → mark slow
hintsRequested > 2 on same topic    → mark confused
```

Output feeds into: roadmap reordering, focus plan generation, and problem suggestions.

---

### 4. Interview Readiness Score

```
Readiness =
  (DSA Coverage      * 0.30) +
  (Difficulty Solved * 0.20) +
  (Consistency       * 0.15) +
  (Mock Performance  * 0.20) +
  (System Design     * 0.15)
```

Displayed prominently on the dashboard. Updated after every session.

---

### 5. AI Topic Chat (Context-Aware)

Always send structured context with every chat request:

```json
{
  "currentTopic": "...",
  "weakAreas": [...],
  "solvedProblems": [...],
  "masteryScores": {...},
  "recentQuestions": [...]
}
```

Capabilities: concept explanation, approach evaluation, complexity analysis, follow-up generation.

---

### 6. Smart Recommendation Engine

Single engine powering problem suggestions, reading materials, and revision plans.

Input signals: roadmap position, weak areas, pattern mastery, difficulty progression.

---

### 7. Progress Tracker (Prescriptive)

Tracker prescribes next steps, not just shows history:

```
Today's Plan:
- Solve 2 graph problems (BFS - Medium)
- Review binary search template
- 1 system design concept: Load Balancing
```

---

## MVP Scope

**Include:**
- Adaptive roadmap
- AI chat
- Problem recommendations
- Weakness detection
- Progress tracker

**Exclude:**
- Voice interviews
- Competitive mode
- Spaced repetition notifications
- Exportable reports

---

## Tech Stack

### Frontend
- **React + Vite** (SPA)
- **Tailwind CSS** + **shadcn/ui**
- **Zustand** — lightweight client state
- **React Router v6** — client-side routing

### Backend
- **Express.js (Node)** — standalone REST API
- Migrate to FastAPI only if AI/ML workloads demand it

### Database
- **PostgreSQL** + **Prisma ORM**
- **pgvector** for embeddings (keep it in one DB, avoid early infra overhead)

### Auth
- **Clerk** — managed auth, JWT sessions
- Frontend: `@clerk/clerk-react`
- Backend: `@clerk/express` middleware for route protection

### Analytics & Telemetry *(suggested)*
- **PostHog** (open source, self-hostable) — track feature usage, drop-off points, session replays
- Helps validate which features users actually use vs. ignore

---

## AI Architecture

### Model Strategy (Mixed)

| Task | Model | Reason |
|---|---|---|
| Chat explanations | Claude Sonnet (latest) | Best reasoning, nuanced explanations |
| Structured evaluation | GPT-4.1 / GPT-4o | Reliable JSON output, code eval |
| Long context history | Gemini 1.5 Pro | Large context window |
| Embeddings | `text-embedding-3-small` or `bge-small-en` | Cost-efficient, strong semantic search |

> **Important:** Abstract all model calls behind a single `lib/ai/client.ts` so you can swap models without touching feature code.

### Fallback Strategy *(suggested)*
Always define a fallback:
```
Primary: Claude Sonnet
Fallback: GPT-4o-mini (cheaper, faster)
```
If the primary model errors or times out, silently retry with fallback. Log all fallbacks for monitoring.

### Cost Management *(suggested)*
- Set `max_tokens` per use case — chat doesn't need the same budget as roadmap generation
- Cache roadmap generation responses (they're deterministic per user profile)
- Use streaming for all chat responses to improve perceived performance

---

## Prompt Architecture

Store prompts as versioned markdown files:

```
/lib/ai/prompts/
  chat.md
  roadmap.md
  evaluation.md
  recommendation.md
  weakness.md
```

Each prompt file should include:
- Role definition
- Context block (filled at runtime)
- Output format instruction
- 1–2 few-shot examples

**Never hardcode prompts inline in route handlers.**

### Prompt Versioning *(suggested)*
Add a version comment at the top of each prompt file:
```
<!-- version: 1.2 | updated: 2025-04-01 | tested: yes -->
```
When you update a prompt, bump the version. This helps debug regressions.

---

## Chat API Flow

```
1. User sends message
2. Fetch user progress + weak areas from DB
3. Retrieve relevant past chat memory (vector search via pgvector)
4. Build structured context payload
5. Call LLM (streaming)
6. Stream response to client
7. Store message embedding async (don't block the response)
```

---

## Progress Tracking — AI Approach Evaluation

Users solve problems externally (LeetCode etc.), then submit their written approach for AI evaluation. No empty self-reporting — approach text is required.

```
1. User opens problem card → auto-timer starts
2. User solves externally
3. Returns → clicks "Submit Attempt"
4. Submits: status, solve time, approach text, hints used
5. POST /api/attempts → AI evaluates approach (GPT-4.1 for structured JSON)
6. Result stored → weakness detection runs passively
7. Pattern mastery + roadmap updated
```

AI extracts `patternUsed` from the approach automatically — no manual tagging needed.

---

## Database Schema (Normalized)

| Table | Purpose | Key Fields |
|---|---|---|
| **User** | Core identity | id, clerkId, email |
| **UserProfile** | Settings | experienceLevel, targetRole, timelineDays |
| **Topic** | Topic metadata | name (Arrays, Trees, Graphs, etc.) |
| **TopicProgress** | Per-user topic mastery | userId, topicId, masteryScore, attemptCount |
| **Pattern** | DSA pattern metadata | name (Sliding Window, Two Pointers, etc.) |
| **PatternMastery** | Per-user pattern mastery | userId, patternId, masteryScore, confidenceScore |
| **Problem** | Coding problems | title, difficulty, topicId, patternId, source |
| **Attempt** | Problem submissions | userId, problemId, status, solveTime, hintsUsed |
| **AttemptSubmission** | Approach evaluation | attemptId, approachText, aiScore, timeComplexity, feedback, patternIdentified |
| **WeakArea** | Detected weak spots | userId, topicId/patternId, reason, severity, detectedAt |
| **ChatMessage** | Conversation history | userId, role, content |

**Design rationale:**
- Separate entities for Topic & Pattern (reusable, independently queryable)
- Progress split into TopicProgress + PatternMastery (no data duplication)
- AttemptSubmission holds evaluation data (keeps Attempt lean, ~5 columns)
- WeakArea tracks both topic and pattern levels

---

## Environment Variables

```env
# AI
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=

# DB
DATABASE_URL=

# Auth
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
```

---

## File Structure

```
/client                  ← React + Vite frontend
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
      ui/                ← shadcn components
    hooks/
    store/               ← Zustand stores
    types/
    lib/
      api.ts             ← typed fetch client

/server                  ← Express.js backend
  src/
    routes/
      chat.ts
      roadmap.ts
      recommendations.ts
      weakness.ts
      progress.ts
      attempts.ts
    lib/
      ai/
        client.ts        ← single AI abstraction layer
        prompts/         ← versioned prompt files
      db/
        prisma/
          schema.prisma
        queries/
      recommendation/
      weakness/
      analytics/
    middleware/
      auth.ts            ← Clerk JWT verification
    index.ts

/data
  patterns.json
  problems.json          ← seed data
```

---

## Development Phases

| Phase | Features |
|---|---|
| 1 | Project scaffold, Clerk auth, Express + Prisma setup, AI chat (streaming), static roadmap, AI approach evaluation |
| 2 | Adaptive roadmap (topic graph), weakness detection engine, pattern tracking |
| 3 | Readiness score, smart recommendation engine, PostHog analytics |
| 4 | Mock interview mode |

---

## Testing Strategy *(suggested)*

- **Unit:** Test weakness detection logic and readiness score formula independently
- **Integration:** Test the full chat API flow with a mock LLM response
- **Prompt regression:** Keep a `tests/prompts/` folder with sample inputs and expected output shapes — run manually before deploying prompt changes

---

## Similar Open Source Projects

| Project | What to borrow |
|---|---|
| [system-design-primer](https://github.com/donnemartin/system-design-primer) | Content structure, topic graph ideas |
| [NeetCode.io](https://neetcode.io) | Pattern-based problem organization |
| [LeetCode Tracker](https://github.com/twos-complement/leetcode-tracker) | Progress tracking schema |
| [algo.monster](https://algo.monster) | Pattern detection UX patterns |

---

## Key Principles

- One `lib/ai/client.ts` — all model calls go through here
- Prompts are files, not strings in code
- Tracker is the home base — every feature writes back to it
- Weak area detection runs passively on every interaction, not on demand
- Stream all chat responses — never wait for full completion
