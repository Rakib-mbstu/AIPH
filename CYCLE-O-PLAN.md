# Cycle O — Integration Tests & Prompt Regression

**Goal:** Test the full request/response cycle for the three highest-risk API
routes using a real (isolated) test database. Guard against prompt regressions
with fixture-based manual tests.

**Estimated touches:** 1 new env file, 1 new Prisma script, ~4 integration test
files, 2 prompt regression fixture files.

---

## 1. Test Database Setup

Integration tests must never touch the development or production database.

### File: `server/.env.test` (NEW)

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aiph_test"
BYPASS_AUTH=true
OPENAI_API_KEY=sk-fake-key-for-tests
ANTHROPIC_API_KEY=fake-key-for-tests
```

`BYPASS_AUTH=true` uses the existing auth bypass mode (already wired from
Cycle A smoke tests). All AI calls are mocked in integration tests (see §4).

### File: `server/package.json`

Add scripts:
```json
"test:integration": "vitest run --config vitest.integration.config.ts",
"db:test:reset": "dotenv -e .env.test -- npx prisma migrate reset --force --skip-seed"
```

Install `dotenv-cli` if not already present:
```json
"dotenv-cli": "^7.0.0"
```

### File: `server/vitest.integration.config.ts` (NEW)

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: './src/test/globalSetup.ts',
    setupFiles: ['./src/test/integrationSetup.ts'],
    testMatch: ['**/*.integration.test.ts'],
    environment: 'node',
    hookTimeout: 30000,
  },
})
```

### File: `server/src/test/globalSetup.ts` (NEW)

Runs once before all integration test files. Resets + migrates the test DB:

```ts
import { execSync } from 'child_process'
import { config } from 'dotenv'

export async function setup() {
  config({ path: '.env.test' })
  // Apply migrations to the test database (creates tables if needed)
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: 'inherit',
  })
}

export async function teardown() {
  // Nothing — leave the DB for inspection after failures
}
```

### File: `server/src/test/integrationSetup.ts` (NEW)

Runs before each test file. Clears all tables in dependency order:

```ts
import { beforeEach, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
})

beforeEach(async () => {
  // Delete in reverse FK order
  await prisma.chatMessage.deleteMany()
  await prisma.attemptSubmission.deleteMany()
  await prisma.attempt.deleteMany()
  await prisma.weakArea.deleteMany()
  await prisma.patternMastery.deleteMany()
  await prisma.topicProgress.deleteMany()
  await prisma.userProfile.deleteMany()
  await prisma.user.deleteMany()
  // Seed data (Topics, Patterns, Problems) is left in place — migrations apply it
})

afterAll(async () => {
  await prisma.$disconnect()
})
```

---

## 2. Test Helpers

### File: `server/src/test/helpers.ts` (NEW)

```ts
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import app from '../app'   // need to split app from index.ts — see §3

export const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
})

/**
 * Create a real User row with a known clerkId.
 * Auth bypass mode maps the test token → this clerkId.
 */
export async function seedUser(clerkId = 'test-user-1') {
  return prisma.user.create({
    data: {
      clerkId,
      email: `${clerkId}@test.com`,
      profile: { create: { experienceLevel: 'junior', targetRole: 'SWE', timelineDays: 90 } },
    },
  })
}

/**
 * Fetch a real Problem from the seeded data (applied in migrations).
 */
export async function getFirstProblem() {
  return prisma.problem.findFirstOrThrow({
    include: { topic: true, pattern: true },
  })
}

/**
 * Make an authenticated request using the bypass token.
 * With BYPASS_AUTH=true, any Bearer token value is accepted; the clerkId is
 * read from a special header (see §3 for how auth middleware works in bypass mode).
 */
export function authedRequest(clerkId = 'test-user-1') {
  return request(app).set('Authorization', `Bearer bypass-${clerkId}`)
}
```

---

## 3. Split `app` from `index.ts`

Currently `server/src/index.ts` calls `app.listen()` at the top level. Supertest
needs to import the Express `app` without starting the server.

### File: `server/src/app.ts` (NEW)

Move all middleware, route mounting, and error handler into `app.ts`. Export
the `app` object:

```ts
import express from 'express'
import cors from 'cors'
// ... all imports ...

const app = express()
// ... all middleware + routes ...

export default app
```

### File: `server/src/index.ts` (UPDATED)

Becomes minimal:
```ts
import app from './app'
import { prisma } from './lib/db/prisma'  // or wherever Prisma is exported

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`Server running on :${PORT}`))

export { prisma }
```

**Why:** Supertest wraps the app directly (`request(app)`) without calling
`.listen()`. This is the standard Express integration testing pattern.

Install `supertest` and its types:
```json
"supertest": "^7.0.0",
"@types/supertest": "^6.0.0"
```

---

## 4. Mock AI Calls

Integration tests should not make real LLM calls — they're slow, cost money,
and produce non-deterministic output. Use `vitest`'s `vi.mock()` to replace the
AI client module.

### Pattern used in each test file:

```ts
import { vi } from 'vitest'

vi.mock('../../lib/ai/client', () => ({
  evaluateApproach: vi.fn().mockResolvedValue({
    score: 85,
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(1)',
    feedback: 'Good sliding window approach.',
    patternUsed: 'Sliding Window',
    suggestedOptimization: null,
    correct: true,
  }),
  recommendProblems: vi.fn().mockResolvedValue({ recommendations: [] }),
  streamChat: vi.fn(),
}))
```

---

## 5. Integration Test: `POST /api/attempts`

### File: `server/src/routes/attempts.integration.test.ts` (NEW)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma, seedUser, getFirstProblem, authedRequest } from '../test/helpers'

vi.mock('../lib/ai/client', () => ({
  evaluateApproach: vi.fn().mockResolvedValue({
    score: 85, timeComplexity: 'O(n)', spaceComplexity: 'O(1)',
    feedback: 'Solid approach.', patternUsed: 'Sliding Window',
    suggestedOptimization: null, correct: true,
  }),
}))

describe('POST /api/attempts', () => {
  let userId: string
  let problemId: string

  beforeEach(async () => {
    const user = await seedUser()
    userId = user.id
    const problem = await getFirstProblem()
    problemId = problem.id
  })

  it('creates Attempt + AttemptSubmission + TopicProgress in one transaction', async () => {
    const res = await authedRequest()
      .post('/api/attempts')
      .send({
        problemId,
        status: 'solved',
        solveTime: 25,
        hintsUsed: 0,
        approachText: 'Used two-pointer technique to scan from both ends.',
      })

    expect(res.status).toBe(200)
    expect(res.body.attempt.status).toBe('solved')
    expect(res.body.submission.aiScore).toBe(85)
    expect(res.body.submission.patternIdentified).toBe('Sliding Window')

    // Verify DB state
    const attempt = await prisma.attempt.findUnique({ where: { id: res.body.attempt.id } })
    expect(attempt).not.toBeNull()
    expect(attempt!.solveTime).toBe(25)

    const submission = await prisma.attemptSubmission.findUnique({
      where: { attemptId: attempt!.id },
    })
    expect(submission!.aiScore).toBe(85)

    const progress = await prisma.topicProgress.findFirst({ where: { userId } })
    expect(progress).not.toBeNull()
    expect(progress!.attemptCount).toBe(1)
  })

  it('returns 400 when approachText is too short', async () => {
    const res = await authedRequest()
      .post('/api/attempts')
      .send({ problemId, status: 'solved', solveTime: 10, approachText: 'short' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/approachText/)
  })

  it('returns 400 for invalid status', async () => {
    const res = await authedRequest()
      .post('/api/attempts')
      .send({
        problemId, status: 'invalid', solveTime: 10,
        approachText: 'My approach was to use brute force first.',
      })
    expect(res.status).toBe(400)
  })

  it('returns 404 for nonexistent problemId', async () => {
    const res = await authedRequest()
      .post('/api/attempts')
      .send({
        problemId: 'nonexistent-id', status: 'solved', solveTime: 10,
        approachText: 'My approach was to use brute force first.',
      })
    expect(res.status).toBe(404)
  })

  it('upserts mastery — second attempt blends with EMA', async () => {
    const body = {
      problemId, status: 'solved', solveTime: 20,
      approachText: 'Used two-pointer technique to scan from both ends.',
    }
    await authedRequest().post('/api/attempts').send(body)
    await authedRequest().post('/api/attempts').send(body)

    const progress = await prisma.topicProgress.findFirst({ where: { userId } })
    expect(progress!.attemptCount).toBe(2)
    // EMA: round(85 * 0.7 + 85 * 0.3) = 85
    expect(progress!.masteryScore).toBe(85)
  })
})
```

---

## 6. Integration Test: `GET /api/progress`

### File: `server/src/routes/progress.integration.test.ts` (NEW)

```ts
import { describe, it, expect, vi } from 'vitest'
import { prisma, seedUser, getFirstProblem, authedRequest } from '../test/helpers'

vi.mock('../lib/ai/client', () => ({
  evaluateApproach: vi.fn().mockResolvedValue({
    score: 70, timeComplexity: 'O(n log n)', spaceComplexity: 'O(n)',
    feedback: 'Good.', patternUsed: null, suggestedOptimization: null, correct: true,
  }),
  buildTodaysPlanWithAI: vi.fn().mockResolvedValue([]),
  recommendForUser: vi.fn().mockResolvedValue([]),
}))

describe('GET /api/progress', () => {
  it('returns correct shape on first call (no activity)', async () => {
    await seedUser()
    const res = await authedRequest().get('/api/progress')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('todaysPlan')
    expect(res.body).toHaveProperty('recentAttempts')
    expect(res.body).toHaveProperty('weakAreas')
    expect(res.body).toHaveProperty('streakDays')
    expect(res.body).toHaveProperty('patterns')
    expect(res.body).toHaveProperty('readiness')
    expect(Array.isArray(res.body.recentAttempts)).toBe(true)
    expect(res.body.streakDays).toBe(0)
  })

  it('reflects a submitted attempt in recentAttempts', async () => {
    await seedUser()
    const problem = await getFirstProblem()
    await authedRequest().post('/api/attempts').send({
      problemId: problem.id, status: 'solved', solveTime: 20,
      approachText: 'Brute force O(n^2), then optimized to sliding window O(n).',
    })

    const res = await authedRequest().get('/api/progress')
    expect(res.body.recentAttempts.length).toBeGreaterThan(0)
    expect(res.body.recentAttempts[0].problem.id).toBe(problem.id)
  })

  it('readiness.overall is a number between 0 and 100', async () => {
    await seedUser()
    const res = await authedRequest().get('/api/progress')
    expect(typeof res.body.readiness.overall).toBe('number')
    expect(res.body.readiness.overall).toBeGreaterThanOrEqual(0)
    expect(res.body.readiness.overall).toBeLessThanOrEqual(100)
  })
})
```

---

## 7. Integration Test: `GET /api/roadmap`

### File: `server/src/routes/roadmap.integration.test.ts` (NEW)

```ts
import { describe, it, expect } from 'vitest'
import { seedUser, authedRequest } from '../test/helpers'

describe('GET /api/roadmap', () => {
  it('returns topics with status + edges + patterns', async () => {
    await seedUser()
    const res = await authedRequest().get('/api/roadmap')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.topics)).toBe(true)
    expect(Array.isArray(res.body.edges)).toBe(true)
    expect(Array.isArray(res.body.patterns)).toBe(true)
    expect(res.body.topics.length).toBeGreaterThan(0)
  })

  it('all topics have a valid status field', async () => {
    await seedUser()
    const res = await authedRequest().get('/api/roadmap')
    const validStatuses = new Set(['mastered', 'in-progress', 'available', 'locked'])
    for (const topic of res.body.topics) {
      expect(validStatuses.has(topic.status)).toBe(true)
    }
  })

  it('root topics (no prereqs) are available for a new user', async () => {
    await seedUser()
    const res = await authedRequest().get('/api/roadmap')
    const rootTopics = res.body.topics.filter((t: any) => t.prereqIds.length === 0)
    for (const t of rootTopics) {
      expect(t.status).toBe('available')
    }
  })
})
```

---

## 8. Prompt Regression Fixtures

Stored in `server/tests/prompts/`. Run manually before deploying prompt
changes — not wired into CI (they're slow + cost money).

### File: `server/tests/prompts/evaluation.fixture.ts` (NEW)

```ts
/**
 * Prompt regression fixture for evaluation.md
 *
 * Run with: npx tsx tests/prompts/evaluation.fixture.ts
 *
 * Expected: all assertions pass. If the AI output shape changes (missing
 * fields, wrong types), this catches it before the change ships.
 */
import { evaluateApproach } from '../../src/lib/ai/client'

async function run() {
  console.log('Running evaluation prompt regression...')

  const result = await evaluateApproach({
    problemTitle: 'Two Sum',
    difficulty: 'easy',
    expectedPattern: 'Hash Map',
    topic: 'Arrays',
    approachText: `
      I used a hash map to store each number and its index as I iterated.
      For each number, I checked if the complement (target - current) was
      already in the map. If yes, return both indices. Time: O(n), Space: O(n).
    `,
  })

  console.log('Result:', JSON.stringify(result, null, 2))

  // Shape assertions
  const required = ['score', 'timeComplexity', 'spaceComplexity', 'feedback', 'patternUsed']
  for (const field of required) {
    if (result[field as keyof typeof result] === undefined) {
      throw new Error(`FAIL: missing field "${field}"`)
    }
  }
  if (typeof result.score !== 'number' || result.score < 0 || result.score > 100) {
    throw new Error(`FAIL: score out of range: ${result.score}`)
  }
  if (!result.timeComplexity?.startsWith('O(')) {
    throw new Error(`FAIL: timeComplexity not Big-O notation: "${result.timeComplexity}"`)
  }

  console.log('✓ All assertions passed')
}

run().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
```

### File: `server/tests/prompts/README.md` (NEW)

```md
# Prompt Regression Fixtures

These are manual tests — run them before deploying prompt changes.

## How to run

\`\`\`bash
cd server
npx tsx tests/prompts/evaluation.fixture.ts
\`\`\`

## When to run

- Before merging any change to `src/lib/ai/prompts/*.md`
- Before bumping a model version in `src/lib/ai/client.ts`
- After a model provider's API update

## What they check

- The AI response includes all required JSON fields
- Field types are correct (score is 0-100 number, timeComplexity is Big-O, etc.)
- The prompt doesn't produce obvious regressions on a known input

## Adding new fixtures

Copy `evaluation.fixture.ts` as a template. Each fixture is a standalone
`npx tsx` script — no test runner needed.
```

---

## 9. CI Script

### File: `package.json` (root — if one exists, else add to each workspace)

```json
"scripts": {
  "test": "npm run test --workspace=client && npm run test --workspace=server",
  "test:integration": "npm run test:integration --workspace=server"
}
```

If the repo uses `npm workspaces`, the root `package.json` already has a
`workspaces` field. Otherwise, run tests from each directory.

---

## What NOT to Do

- Do NOT use a shared in-memory SQLite for integration tests — the production
  DB is Postgres with Prisma features (enums, composite keys) that SQLite
  doesn't support
- Do NOT make real LLM calls in integration tests — always mock `ai/client`
- Do NOT run integration tests in the same vitest config as unit tests — they
  need a separate config (`vitest.integration.config.ts`) to control the
  `globalSetup` and timeout
- Do NOT seed the test DB manually — let the `globalSetup` run migrations;
  the seeder in `prisma/seed.ts` already populates Topics/Patterns/Problems
- Do NOT delete WeakArea rows in `integrationSetup.ts` teardown — deleting
  Users cascades to all user-owned data; that's sufficient
- Do NOT test the LLM recommendation quality — only test shape/schema

---

## Verification Checklist

- [ ] `cd server && npm test` (unit tests) still passes after the app/index split
- [ ] `cd server && npm run test:integration` passes against `aiph_test` DB
- [ ] `POST /api/attempts` test verifies Attempt + AttemptSubmission + TopicProgress in DB
- [ ] `GET /api/progress` test confirms correct shape after seeding
- [ ] `GET /api/roadmap` test verifies all topic statuses are valid enum values
- [ ] `evaluation.fixture.ts` runs without error against a real model
- [ ] No `.env.test` committed to git (add to `.gitignore`)
- [ ] `npm test` at the repo root runs both workspaces
