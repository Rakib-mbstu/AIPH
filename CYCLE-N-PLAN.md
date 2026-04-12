# Cycle N — Unit Tests

**Goal:** Test the pure business logic that powers the system without touching
the database. Unit tests run in milliseconds and catch regressions in formulas,
thresholds, and state machines.

**Estimated touches:** 2 package.json files, ~7 test files created.

---

## 1. Install vitest

### File: `server/package.json`

Add to `devDependencies`:
```json
"vitest": "^1.6.0"
```

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

### File: `client/package.json`

Add to `devDependencies`:
```json
"vitest": "^1.6.0",
"@testing-library/react": "^16.0.0",
"@testing-library/jest-dom": "^6.0.0",
"@vitejs/plugin-react": "already present — used for tests too",
"jsdom": "^24.0.0"
```

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Add a `vitest.config.ts` at `client/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

Create `client/src/test/setup.ts`:
```ts
import '@testing-library/jest-dom'
```

---

## 2. Server: `blendScore` (mastery EMA formula)

### File: `server/src/lib/db/queries/mastery.test.ts` (NEW)

`blendScore` is already exported and pure — no mocking needed.

```ts
import { describe, it, expect } from 'vitest'
import { blendScore } from './mastery'

describe('blendScore', () => {
  it('blends 70/30 correctly', () => {
    expect(blendScore(100, 0)).toBe(70)   // 100*0.7 + 0*0.3 = 70
    expect(blendScore(0, 100)).toBe(30)   // 0*0.7 + 100*0.3 = 30
    expect(blendScore(50, 50)).toBe(50)   // exactly 50
  })

  it('rounds to nearest integer', () => {
    // 60*0.7 + 10*0.3 = 42 + 3 = 45.0 — exact
    expect(blendScore(60, 10)).toBe(45)
    // 33*0.7 + 77*0.3 = 23.1 + 23.1 = 46.2 → rounds to 46
    expect(blendScore(33, 77)).toBe(46)
  })

  it('clamps to expected range for valid inputs', () => {
    const r = blendScore(100, 100)
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(100)
  })

  it('failed attempt (sample=0) drags score toward 0', () => {
    const after = blendScore(80, 0)
    expect(after).toBeLessThan(80)
    expect(after).toBe(56) // 80*0.7 + 0*0.3 = 56
  })
})
```

---

## 3. Server: `computeNodeStatus` and `buildPrereqMap`

### File: `server/src/lib/roadmap/graph.test.ts` (NEW)

Both functions are already exported and pure. `validateGraph` is internal but
can be tested indirectly through the `validateGraph` re-export pattern below.

**3a. Export `validateGraph` for testing**

### File: `server/src/lib/roadmap/graph.ts` (small change)

Add `export` to the `validateGraph` function declaration:
```ts
export function validateGraph(graph: GraphFile): void {
```

Also export the `GraphFile` type:
```ts
export interface GraphFile {
  edges: GraphEdge[]
}
```

**3b. Tests**

```ts
import { describe, it, expect } from 'vitest'
import { computeNodeStatus, buildPrereqMap, validateGraph } from './graph'

// ── buildPrereqMap ────────────────────────────────────────────────────────────

describe('buildPrereqMap', () => {
  it('returns empty map for no edges', () => {
    expect(buildPrereqMap([])).toEqual(new Map())
  })

  it('builds prereq list correctly (edge direction is from→to)', () => {
    // "Arrays" must be mastered before "Sliding Window" unlocks
    const map = buildPrereqMap([{ from: 'Arrays', to: 'Sliding Window' }])
    expect(map.get('Sliding Window')).toEqual(['Arrays'])
  })

  it('handles multiple prereqs for one topic', () => {
    const map = buildPrereqMap([
      { from: 'Arrays', to: 'Two Pointers' },
      { from: 'HashMaps', to: 'Two Pointers' },
    ])
    expect(map.get('Two Pointers')).toEqual(['Arrays', 'HashMaps'])
  })

  it('topics with no prereqs do not appear in the map', () => {
    const map = buildPrereqMap([{ from: 'Arrays', to: 'Sliding Window' }])
    expect(map.has('Arrays')).toBe(false)
  })
})

// ── computeNodeStatus ─────────────────────────────────────────────────────────

describe('computeNodeStatus', () => {
  const mastery = new Map([['Arrays', 100]])

  it('returns mastered when masteryScore >= 80', () => {
    expect(computeNodeStatus({
      topicName: 'Arrays', masteryScore: 80, hasAttempts: true,
      prereqNames: [], masteryByTopic: new Map(),
    })).toBe('mastered')
    expect(computeNodeStatus({
      topicName: 'Arrays', masteryScore: 100, hasAttempts: true,
      prereqNames: [], masteryByTopic: new Map(),
    })).toBe('mastered')
  })

  it('returns in-progress when has attempts and mastery < 80', () => {
    expect(computeNodeStatus({
      topicName: 'Trees', masteryScore: 50, hasAttempts: true,
      prereqNames: [], masteryByTopic: new Map(),
    })).toBe('in-progress')
  })

  it('returns available when no attempts and all prereqs mastered', () => {
    expect(computeNodeStatus({
      topicName: 'Sliding Window', masteryScore: 0, hasAttempts: false,
      prereqNames: ['Arrays'], masteryByTopic: mastery,
    })).toBe('available')
  })

  it('returns available for root nodes (no prereqs)', () => {
    expect(computeNodeStatus({
      topicName: 'Arrays', masteryScore: 0, hasAttempts: false,
      prereqNames: [], masteryByTopic: new Map(),
    })).toBe('available')
  })

  it('returns locked when prereq not mastered (score < 80)', () => {
    const partialMastery = new Map([['Arrays', 60]])
    expect(computeNodeStatus({
      topicName: 'Sliding Window', masteryScore: 0, hasAttempts: false,
      prereqNames: ['Arrays'], masteryByTopic: partialMastery,
    })).toBe('locked')
  })

  it('returns locked when prereq missing entirely', () => {
    expect(computeNodeStatus({
      topicName: 'Sliding Window', masteryScore: 0, hasAttempts: false,
      prereqNames: ['Arrays'], masteryByTopic: new Map(),
    })).toBe('locked')
  })
})

// ── validateGraph ─────────────────────────────────────────────────────────────

describe('validateGraph', () => {
  it('accepts a valid DAG', () => {
    expect(() => validateGraph({
      edges: [
        { from: 'Arrays', to: 'Sliding Window' },
        { from: 'Sliding Window', to: 'Two Pointers' },
      ],
    })).not.toThrow()
  })

  it('throws on non-array edges', () => {
    expect(() => validateGraph({ edges: null as any })).toThrow(/"edges" must be an array/)
  })

  it('throws on malformed edge (missing fields)', () => {
    expect(() => validateGraph({ edges: [{ from: 'A' } as any] })).toThrow(/malformed edge/)
  })

  it('throws on self-loop', () => {
    expect(() => validateGraph({ edges: [{ from: 'A', to: 'A' }] })).toThrow(/self-loop/)
  })

  it('throws on cycle', () => {
    expect(() => validateGraph({
      edges: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' },
      ],
    })).toThrow(/cycle detected/)
  })
})
```

---

## 4. Server: weakness detection thresholds

The `evaluate()` function in `detect.ts` is internal. To unit test it without
mocking Prisma, extract the pure threshold logic into a separate exported
function.

### File: `server/src/lib/weakness/detect.ts` (small refactor)

Extract the threshold check into a pure, exported function:

```ts
export interface WeaknessSignal {
  type: 'failing' | 'slow' | 'confused' | 'recovering' | 'none'
  severity: number
}

export function classifyWeakness(
  recent: Array<{ status: string; solveTime: number; hintsUsed: number }>
): WeaknessSignal {
  if (recent.length === 0) return { type: 'none', severity: 0 }

  // Recovery: last 3 solved in a row
  if (
    recent.length >= 3 &&
    recent.slice(0, 3).every((a) => a.status === 'solved')
  ) {
    return { type: 'recovering', severity: 0 }
  }

  const failureRate = recent.filter((a) => a.status === 'failed').length / recent.length
  const avgSolve = recent.reduce((s, a) => s + a.solveTime, 0) / recent.length
  const latest = recent[0]
  const hintHeavy = recent.some((a) => a.hintsUsed > 2)

  if (failureRate > 0.4 && recent.length > 3) return { type: 'failing', severity: 3 }
  if (avgSolve > 0 && latest.solveTime > avgSolve * 1.5) return { type: 'slow', severity: 2 }
  if (hintHeavy) return { type: 'confused', severity: 1 }

  return { type: 'none', severity: 0 }
}
```

Then update `evaluate()` in the same file to call `classifyWeakness()` instead
of duplicating the logic. The existing behavior is unchanged — this is a pure
extract, not a rewrite.

### File: `server/src/lib/weakness/detect.test.ts` (NEW)

```ts
import { describe, it, expect } from 'vitest'
import { classifyWeakness } from './detect'

const solved = (t = 20) => ({ status: 'solved', solveTime: t, hintsUsed: 0 })
const failed = (t = 20) => ({ status: 'failed', solveTime: t, hintsUsed: 0 })
const slow   = (t = 60) => ({ status: 'solved', solveTime: t, hintsUsed: 0 })
const hinted = (t = 20) => ({ status: 'attempted', solveTime: t, hintsUsed: 3 })

describe('classifyWeakness', () => {
  it('returns none for empty history', () => {
    expect(classifyWeakness([])).toMatchObject({ type: 'none' })
  })

  it('detects failing: >40% failure rate with >3 samples', () => {
    // 5 attempts, 3 failed = 60% failure rate
    const recent = [failed(), failed(), failed(), solved(), solved()]
    expect(classifyWeakness(recent)).toMatchObject({ type: 'failing', severity: 3 })
  })

  it('does NOT flag failing with <=3 samples even at 100%', () => {
    // 3 samples is not enough — sample size guard
    const recent = [failed(), failed(), failed()]
    expect(classifyWeakness(recent).type).not.toBe('failing')
  })

  it('does NOT flag failing when rate is exactly 40%', () => {
    // 4 attempts, 2 failed = 50%... wait, let me recalculate
    // threshold is > 0.4, so 40% is not >40%
    const recent = [failed(), failed(), solved(), solved(), solved()]
    // 2/5 = 40% — boundary
    expect(classifyWeakness(recent).type).not.toBe('failing')
  })

  it('detects slow: latest attempt > 1.5x rolling average', () => {
    // avg = 20, latest = 40 → 40 > 20*1.5 = 30 → slow
    const recent = [
      { status: 'solved', solveTime: 40, hintsUsed: 0 }, // latest (index 0)
      solved(20),
      solved(20),
      solved(20),
    ]
    expect(classifyWeakness(recent)).toMatchObject({ type: 'slow', severity: 2 })
  })

  it('does NOT flag slow when latest is exactly 1.5x', () => {
    // avg = 20, latest = 30 → 30 is NOT > 30
    const recent = [
      { status: 'solved', solveTime: 30, hintsUsed: 0 },
      solved(20), solved(20), solved(20),
    ]
    expect(classifyWeakness(recent).type).not.toBe('slow')
  })

  it('detects confused: any attempt with >2 hints', () => {
    const recent = [solved(), hinted(), solved()]
    expect(classifyWeakness(recent)).toMatchObject({ type: 'confused', severity: 1 })
  })

  it('recovery: last 3 solved in a row clears flags', () => {
    // Even with prior hints, recovery wins
    const recent = [solved(), solved(), solved(), hinted(), failed()]
    expect(classifyWeakness(recent)).toMatchObject({ type: 'recovering' })
  })

  it('recovery requires exactly the LAST 3 (index 0,1,2) to be solved', () => {
    // Index 0 = newest. If index 2 is not solved, no recovery.
    const recent = [solved(), solved(), failed(), solved()]
    expect(classifyWeakness(recent).type).not.toBe('recovering')
  })

  it('failing takes priority over slow when both conditions met', () => {
    // >40% failure AND latest is slow — failing has higher severity, check order
    const recent = [
      { status: 'failed', solveTime: 60, hintsUsed: 0 },
      failed(), failed(), solved(), solved(),
    ] // 3/5 = 60%, and latest=60 > avg*1.5
    expect(classifyWeakness(recent)).toMatchObject({ type: 'failing' })
  })
})
```

---

## 5. Server: readiness score sub-functions

Export the three pure sub-functions from `score.ts` for direct testing.

### File: `server/src/lib/readiness/score.ts` (small change)

Change:
```ts
function computeDsaCoverage(...) {
function computeDifficultyHandled(...) {
function computeConsistency(...) {
```

To:
```ts
export function computeDsaCoverage(...) {
export function computeDifficultyHandled(...) {
export function computeConsistency(...) {
```

### File: `server/src/lib/readiness/score.test.ts` (NEW)

```ts
import { describe, it, expect } from 'vitest'
import { computeDsaCoverage, computeDifficultyHandled, computeConsistency } from './score'

// ── DSA Coverage ──────────────────────────────────────────────────────────────

describe('computeDsaCoverage', () => {
  it('returns 0 when no topics exist', () => {
    const r = computeDsaCoverage(0, [])
    expect(r.score).toBe(0)
  })

  it('returns 0 when topics exist but none touched', () => {
    const r = computeDsaCoverage(5, [])
    expect(r.score).toBe(0)
  })

  it('averages mastery across ALL topics (untouched = 0)', () => {
    // 2 topics total, 1 touched at 100 → avg = 50
    const r = computeDsaCoverage(2, [{ masteryScore: 100 }])
    expect(r.score).toBe(50)
  })

  it('returns 100 when all topics fully mastered', () => {
    const r = computeDsaCoverage(3, [
      { masteryScore: 100 },
      { masteryScore: 100 },
      { masteryScore: 100 },
    ])
    expect(r.score).toBe(100)
  })

  it('reports touched/total in detail string', () => {
    const r = computeDsaCoverage(5, [{ masteryScore: 60 }])
    expect(r.detail).toMatch(/1\/5/)
  })
})

// ── Difficulty Handled ────────────────────────────────────────────────────────

describe('computeDifficultyHandled', () => {
  const mkAttempts = (diffs: string[]) =>
    diffs.map((d) => ({ status: 'solved', problem: { difficulty: d } }))

  it('returns 0 with no attempts', () => {
    expect(computeDifficultyHandled([]).score).toBe(0)
  })

  it('counts only solved attempts', () => {
    const r = computeDifficultyHandled([
      { status: 'failed', problem: { difficulty: 'easy' } },
    ])
    expect(r.score).toBe(0)
  })

  it('scores easy: min(solved,10)*3', () => {
    // 5 easy solved → 15 pts
    const r = computeDifficultyHandled(mkAttempts(['easy', 'easy', 'easy', 'easy', 'easy']))
    expect(r.score).toBe(15)
  })

  it('caps easy at 10 (30 pts max)', () => {
    const r = computeDifficultyHandled(mkAttempts(Array(15).fill('easy')))
    expect(r.score).toBe(30)
  })

  it('full score: 10 easy + 10 medium + 5 hard = 30+40+30 = 100', () => {
    const attempts = [
      ...mkAttempts(Array(10).fill('easy')),
      ...mkAttempts(Array(10).fill('medium')),
      ...mkAttempts(Array(5).fill('hard')),
    ]
    expect(computeDifficultyHandled(attempts).score).toBe(100)
  })

  it('does not exceed 100', () => {
    const attempts = mkAttempts([
      ...Array(20).fill('easy'),
      ...Array(20).fill('medium'),
      ...Array(20).fill('hard'),
    ])
    expect(computeDifficultyHandled(attempts).score).toBe(100)
  })
})

// ── Consistency ───────────────────────────────────────────────────────────────

describe('computeConsistency', () => {
  const daysAgo = (n: number) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - n)
    d.setUTCHours(12, 0, 0, 0)
    return d
  }

  it('returns 0 with no attempts', () => {
    expect(computeConsistency([]).score).toBe(0)
  })

  it('counts unique active days (not total attempts)', () => {
    // 3 attempts on the same day = only 1 active day
    const r = computeConsistency([
      { createdAt: daysAgo(0) },
      { createdAt: daysAgo(0) },
      { createdAt: daysAgo(0) },
    ])
    // 1/14 days ≈ 7
    expect(r.score).toBe(Math.round((1 / 14) * 100))
  })

  it('returns 100 for 14 consecutive active days', () => {
    const attempts = Array.from({ length: 14 }, (_, i) => ({ createdAt: daysAgo(i) }))
    expect(computeConsistency(attempts).score).toBe(100)
  })

  it('ignores attempts older than 14 days', () => {
    const r = computeConsistency([{ createdAt: daysAgo(15) }])
    expect(r.score).toBe(0)
  })
})
```

---

## 6. Client: Sparkline component

### File: `client/src/components/Sparkline.test.tsx` (NEW)

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sparkline } from './Sparkline'

describe('Sparkline', () => {
  it('renders "no data" placeholder for empty array', () => {
    render(<Sparkline values={[]} />)
    expect(screen.getByText('no data')).toBeInTheDocument()
  })

  it('renders an SVG for a single data point (padded to 2)', () => {
    const { container } = render(<Sparkline values={[50]} />)
    expect(container.querySelector('svg')).toBeTruthy()
    expect(container.querySelector('path')).toBeTruthy()
  })

  it('renders an SVG for 10 data points', () => {
    const { container } = render(
      <Sparkline values={[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]} />
    )
    expect(container.querySelector('svg')).toBeTruthy()
    const paths = container.querySelectorAll('path')
    // area path + line path
    expect(paths.length).toBe(2)
  })

  it('respects custom width and height props', () => {
    const { container } = render(<Sparkline values={[50, 60]} width={200} height={50} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('200')
    expect(svg?.getAttribute('height')).toBe('50')
  })

  it('renders the terminal dot (circle)', () => {
    const { container } = render(<Sparkline values={[30, 70]} />)
    expect(container.querySelector('circle')).toBeTruthy()
  })
})
```

---

## What NOT to Do

- Do NOT mock Prisma in these unit tests — the refactors above extract the pure
  logic so Prisma is never touched in unit tests
- Do NOT add `jest` — the stack uses `vitest` throughout
- Do NOT test `buildTodaysPlan` as a unit test (it's Prisma-heavy) — that goes
  in Cycle O integration tests
- Do NOT test `recommendForUser` here — same reason
- Do NOT add `@testing-library/user-event` — the Sparkline tests don't need it
- Do NOT test the React component rendering in `server/` — server tests are
  Node.js only

---

## Verification Checklist

- [ ] `cd server && npm test` passes with no failures
- [ ] `cd client && npm test` passes with no failures
- [ ] All 3 `computeNodeStatus` status variants have at least one test
- [ ] `classifyWeakness` has tests for all 3 threshold triggers + recovery + edge cases
- [ ] `blendScore` has tests for typical case, rounding, and failed-attempt drag
- [ ] `computeConsistency` handles same-day deduplication
- [ ] `Sparkline` tests cover 0, 1, and 10 data points
- [ ] No imports from `../../index` (Prisma) in any test file
