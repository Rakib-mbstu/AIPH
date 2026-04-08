# Interview Prep AI

An adaptive AI interview coach for DSA preparation. Unlike static roadmap tools, it personalizes recommendations, difficulty, and pacing based on your actual performance — pattern mastery tracking, weakness detection, and AI-evaluated approach submissions.

> **Phase 1 status:** MVP backend + minimal frontend complete. Chat (SSE), attempt evaluation, weakness detection, roadmap, and tracker pages all wired end-to-end. See [`plan.md`](plan.md) for the implementation log.

## Tech Stack

| Layer    | Choice |
|----------|--------|
| Frontend | React 19 + Vite, Tailwind CSS, Zustand, React Router v6 |
| Backend  | Express.js (Node, TypeScript) |
| Database | PostgreSQL + Prisma ORM |
| Auth     | Clerk (`@clerk/clerk-react` + `@clerk/express`) |
| AI       | OpenRouter (single gateway → Claude Sonnet, GPT-4 Turbo, GPT-4o-mini) |

All model calls go through one abstraction in [`server/src/lib/ai/client.ts`](server/src/lib/ai/client.ts) so swapping providers is a string change.

## Project Structure

```
client/                       React + Vite SPA
  src/
    pages/                    RoadmapPage, TrackerPage, ...
    hooks/useChat.ts          SSE chat hook
    store/userStore.ts        Zustand + Clerk bridge
    lib/api.ts                Typed fetch client
server/                       Express backend
  src/
    routes/                   users, chat, attempts, progress, roadmap, weakness
    lib/
      ai/                     OpenRouter client + versioned prompt files
      db/queries/             Reusable Prisma helpers
      weakness/detect.ts      Passive weakness detection
      recommendation/         Today's plan builder
  prisma/
    schema.prisma             11 normalized tables
    seed.ts                   Idempotent topic/pattern/problem seed
data/                         Human-editable seed JSON
  topics.json                 10 topics
  patterns.json               8 DSA patterns
  problems.json               54 curated problems
plan.md                       Step-by-step implementation log
CLAUDE.md                     Product spec + architecture decisions
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ with a database you can write to
- A [Clerk](https://dashboard.clerk.com) project (for auth)
- An [OpenRouter](https://openrouter.ai) API key (for AI calls)

### 1. Install

```bash
npm install
```

This installs both workspaces (`client` and `server`) via npm workspaces.

### 2. Configure environment

Copy [`.env.example`](.env.example) into both `server/.env` and `client/.env` and fill in the values relevant to each side. The example file documents what goes where.

> Without `CLERK_SECRET_KEY` + `CLERK_PUBLISHABLE_KEY` the server still boots, but every protected route returns `401`. This is intentional for smoke tests.

### 3. Database

```bash
cd server
npx prisma migrate dev --name init
cd ..
npm run seed              # loads 10 topics, 8 patterns, 54 problems
```

To wipe and reseed:

```bash
npm run db:reset
```

### 4. Run

```bash
npm run dev
```

This launches both servers concurrently:

- **Client** — http://localhost:5173 (Vite, proxies `/api/*` to the server)
- **Server** — http://localhost:4000

Sanity check: `curl http://localhost:4000/health` → `{"status":"ok"}`.

## Scripts

| Command              | What it does |
|----------------------|--------------|
| `npm run dev`        | Start client + server concurrently |
| `npm run dev:client` | Vite only |
| `npm run dev:server` | Express only (`ts-node-dev --respawn`) |
| `npm run build`      | Type-check + bundle both workspaces |
| `npm run type-check` | `tsc --noEmit` for both |
| `npm run seed`       | Run the Prisma seed script |
| `npm run db:reset`   | `prisma migrate reset --force && seed` |

## Architecture Notes

- **Single AI client.** Every model call goes through `streamChat` / `evaluateApproach` / `generateRoadmap` in [`server/src/lib/ai/client.ts`](server/src/lib/ai/client.ts), which routes to OpenRouter and falls back automatically per use case.
- **Versioned prompts.** Stored as `.md` files under [`server/src/lib/ai/prompts/`](server/src/lib/ai/prompts/) with frontmatter (`<!-- version: 1.0 | updated: ... -->`). Loaded via a tiny templating helper, never inlined.
- **Tracker is home base.** Every write path (`POST /api/attempts`) updates `TopicProgress` + `PatternMastery` in the same transaction and fires passive weakness detection without blocking the response.
- **Pattern from AI, not DB.** Mastery is updated against the pattern the user *actually used* (per the AI evaluation), not the canonical pattern tagged on the problem.
- **SSE for chat.** All chat responses stream token-by-token; the user message is persisted before streaming starts so history survives mid-stream disconnects.

See [`CLAUDE.md`](CLAUDE.md) for the full product vision and architecture decisions.

## Phase Roadmap

| Phase | Features |
|-------|----------|
| 1 ✅  | Scaffold, Clerk auth, AI chat (SSE), AI approach evaluation, static roadmap, tracker, weakness detection |
| 2     | Adaptive roadmap (topic graph), pgvector chat memory, recommendation engine |
| 3     | Readiness score, PostHog analytics, mock interview mode |
| 4     | Voice interviews, exportable reports |

## License

MIT — see [LICENSE](LICENSE).
