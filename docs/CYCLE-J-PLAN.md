# Cycle J — End-to-End Auth Smoke Test (Detailed Implementation Plan)

> Self-contained plan. This cycle is a **manual verification cycle** with a small
> amount of code fixes. The primary output is a tested, working application — not
> new features.

---

## Goal

Validate the full application with real Clerk keys and a real database, covering
the flows that auth-bypass mode can't test. Find and fix integration bugs.

**Depends on:** Cycles G, H, and I must be complete before this cycle starts.

---

## Prerequisites

Before starting, ensure the following are available:

1. **Clerk project** with publishable + secret keys
   - Sign up at https://dashboard.clerk.com
   - Create a project, get `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
2. **PostgreSQL** running locally with a database created:
   ```bash
   createdb aiph
   ```
3. **OpenRouter API key** (for AI features):
   - Sign up at https://openrouter.ai, get an API key
4. **(Optional) PostHog project** — analytics is a no-op without the key, so this
   is not required for smoke testing

---

## Step 1 — Environment Setup

### Create `server/.env`

```env
DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/aiph
OPENROUTER_API_KEY=sk-or-...
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
PORT=4000
NODE_ENV=development
```

### Create `client/.env`

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:4000
```

### Apply migrations and seed

```bash
cd server && npx prisma migrate dev --name init && cd ..
npm run seed
```

Verify seed output: should report 10 topics, 8 patterns, ~54 problems.

---

## Step 2 — Boot the Application

```bash
npm run dev
```

This starts both client (:5173) and server (:4000) via `concurrently`.

**Verify:**
- [ ] Server logs: no Clerk-bypass warning (keys are set)
- [ ] Server logs: `Listening on port 4000`
- [ ] Client compiles without errors
- [ ] `curl http://localhost:4000/health` returns `{ "status": "ok", ... }`

---

## Step 3 — Authentication Flow

### 3.1 — Sign Up

1. Open `http://localhost:5173` in browser
2. Should redirect to Clerk sign-in/sign-up
3. Create an account (email + password, or OAuth)
4. After sign-in, should redirect to `/roadmap`

**Verify:**
- [ ] Clerk sign-in UI renders
- [ ] Sign-up completes without errors
- [ ] Redirect to `/roadmap` works
- [ ] Console: no 401 errors, no CORS errors

### 3.2 — Onboarding

The first protected API call triggers `getOrCreateUser()`.

**Verify:**
- [ ] `POST /api/users/onboard` succeeds (check Network tab)
- [ ] A `User` + `UserProfile` row exist in the database:
  ```bash
  cd server && npx prisma studio
  ```
  Check the `User` table — should have one row with the Clerk ID.

### 3.3 — Navigation

**Verify:**
- [ ] Sidebar renders with 4 nav links (Roadmap, Problems, Tracker, Chat)
- [ ] Clicking each link navigates without full reload
- [ ] Active link is visually highlighted
- [ ] `<UserButton />` renders at sidebar bottom
- [ ] Clicking UserButton shows Clerk account menu
- [ ] Sign out → redirects to sign-in page

---

## Step 4 — Roadmap Flow

1. Navigate to `/roadmap`

**Verify:**
- [ ] React Flow graph renders with ~10 topic nodes
- [ ] Root nodes (Arrays, etc.) show as "available" (sky blue)
- [ ] Downstream nodes show as "locked" (gray)
- [ ] Edges render between nodes with correct directionality
- [ ] Pattern cards render below the graph (all should show "no data" sparklines
      for a fresh user)
- [ ] No console errors

---

## Step 5 — Problems + Attempt Submission Flow

This is the most important flow — it tests the full Practice -> Evaluate loop.

### 5.1 — Browse Problems

1. Navigate to `/problems`

**Verify:**
- [ ] Recommendations load (may take a few seconds for LLM call)
- [ ] If LLM fails (no API key, timeout), falls back gracefully (empty state
      or deterministic recommendations)
- [ ] Problem cards show: title, difficulty badge, topic, pattern, reason
- [ ] Difficulty badges are color-coded

### 5.2 — Submit an Attempt

1. Click [Start] on any problem card
2. Card expands, timer starts
3. Wait ~30 seconds, click [Stop Timer]
4. Select status: "Solved"
5. Write approach text (>= 10 characters): "I used a two-pointer approach,
   starting from both ends of the sorted array and moving inward based on
   the sum comparison."
6. Click [Submit Attempt]

**Verify:**
- [ ] Timer counts up in MM:SS format
- [ ] [Stop Timer] pre-fills solve time
- [ ] Submit button disabled until status + approach are filled
- [ ] Loading state shows on submit button during API call
- [ ] AI evaluation renders inline:
  - Score (0-100)
  - Pattern identified
  - Time/space complexity
  - Feedback text
  - Suggested optimization (if any)
- [ ] No console errors

### 5.3 — Verify Data Persistence

After submission, check the database:

```bash
cd server && npx prisma studio
```

**Verify in Prisma Studio:**
- [ ] `Attempt` table: one row with correct status, solveTime, hintsUsed
- [ ] `AttemptSubmission` table: one row with aiScore, feedback, patternIdentified
- [ ] `TopicProgress` table: one row with updated masteryScore > 0
- [ ] `PatternMastery` table: one row with updated scores
- [ ] `WeakArea` table: may or may not have entries depending on thresholds

---

## Step 6 — Tracker Flow

1. Navigate to `/tracker`

**Verify:**
- [ ] Today's Plan section shows problem recommendations
- [ ] Recent Activity shows the attempt from Step 5 with AI score badge
- [ ] Weak Areas section renders (may be empty for one attempt)
- [ ] Pattern Progress section shows the pattern from the submitted attempt
      with a sparkline (single dot for one data point)
- [ ] Readiness Score section renders with:
  - Overall score > 0
  - DSA Coverage bar (non-zero after one attempt)
  - Difficulty Handled bar (non-zero)
  - Consistency bar (100% — attempted today)
  - Mock Performance + System Design dimmed (unscored)
- [ ] Streak shows 1 day

---

## Step 7 — Chat Flow

1. Navigate to `/chat`

**Verify:**
- [ ] Empty state with quick-start suggestion chips renders
- [ ] Click "Explain sliding window technique"
- [ ] User message appears on the right
- [ ] Typing indicator (bouncing dots) appears while streaming
- [ ] Assistant response streams in token by token on the left
- [ ] Response includes markdown formatting (likely code blocks, lists)
- [ ] Code blocks render with dark background
- [ ] Conversation persists — refresh the page and history reloads
- [ ] Send a follow-up: "Show me a Python implementation"
- [ ] Context is maintained — assistant references the previous topic
- [ ] [Stop] button appears during streaming; clicking it aborts the response

### Test abort

1. Type a long question and send
2. While streaming, click [Stop]

**Verify:**
- [ ] Streaming stops immediately
- [ ] Partial response is visible (not cleared)
- [ ] Can send another message after aborting

---

## Step 8 — Roadmap After Attempts

Go back to `/roadmap` after submitting at least one attempt.

**Verify:**
- [ ] The topic of the attempted problem now shows as "in-progress" (indigo)
      instead of "available" (sky)
- [ ] If there's a weakness, a rose ring appears around the node
- [ ] Pattern cards now show a sparkline with one data point

---

## Step 9 — Sign Out + Re-sign-in

1. Click the UserButton → Sign out
2. Sign back in with the same account

**Verify:**
- [ ] Sign-out redirects to sign-in page
- [ ] All data persists after re-sign-in (attempts, mastery, chat history)
- [ ] No duplicate User rows in the database
- [ ] `analytics.resetAnalytics()` was called (check PostHog if key is set, or
      confirm no console errors)

---

## Step 10 — Fix Issues Found

During steps 3-9, document all issues in a list. Then fix them.

### Common issues to anticipate

| Issue | Likely cause | Fix |
|---|---|---|
| CORS errors | Vite proxy not matching `/api` | Check `client/vite.config.ts` proxy config |
| 401 on all routes | Clerk middleware misconfigured | Check `CLERK_SECRET_KEY` is correct |
| `clerkClient.users.getUser` fails | `@clerk/express` version mismatch | Check Clerk SDK versions match |
| Chat SSE doesn't stream | Proxy buffering | Already handled: `X-Accel-Buffering: no` header |
| React Flow graph clipped | Layout constrains height | Ensure graph container has explicit height |
| Timer doesn't auto-fill | `useTimer` hook interface mismatch | Check hook API and adapt |
| Markdown code blocks unstyled | Missing `@tailwindcss/typography` | Use manual `[&_pre]` classes |
| `ERR_OSSL_EVP_UNSUPPORTED` | Node.js OpenSSL issue | Set `NODE_OPTIONS=--openssl-legacy-provider` |
| AI evaluation returns null | OpenRouter API key invalid | Check the key, check model availability |

### Fix protocol

For each issue found:

1. Document: what happened, what was expected, console/network errors
2. Identify root cause (read the relevant code)
3. Fix in the relevant file
4. Re-test the specific flow
5. Run type-check after all fixes

---

## Step 11 — Final Type-check

```bash
npm run type-check -w client
cd server && npx tsc --noEmit
```

Both must pass clean.

---

## Files touched

This cycle primarily finds and fixes bugs rather than creating new files.
Expected modifications depend on what breaks, but likely candidates:

| File | Likely fix |
|---|---|
| `client/src/pages/ChatPage.tsx` | Height/scroll adjustments |
| `client/src/pages/ProblemsPage.tsx` | Timer wiring, error handling |
| `client/src/components/Layout.tsx` | Responsive edge cases |
| `client/src/lib/api.ts` | Error handling for edge cases |

**No server files should need modification** unless a real bug is found.

---

## What NOT to do

- Do NOT add new features during this cycle — only fix bugs
- Do NOT refactor working code that you encounter while testing
- Do NOT add tests (that's a separate future cycle)
- Do NOT set up CI/CD or Docker
- Do NOT change the database schema
- Do NOT push to a remote repository unless the user explicitly asks

---

## Deliverable

After this cycle, the application should be **fully functional end-to-end**:

- Sign up → Onboard → Browse roadmap → Open problems → Submit attempt →
  See AI evaluation → Check tracker updates → Chat with AI → Sign out

All four pages work. All API routes are exercised. Data persists across sessions.
The core learning loop is complete.

---

## Final Verification Summary

- [ ] App boots without errors (both client and server)
- [ ] `/health` responds
- [ ] Clerk sign-up/sign-in/sign-out works
- [ ] Roadmap renders topic graph with correct statuses
- [ ] Problems page loads recommendations
- [ ] Attempt submission works end-to-end with AI evaluation
- [ ] Tracker reflects submitted attempts, readiness, patterns
- [ ] Chat streams responses with markdown formatting
- [ ] Chat history persists across page navigations and refreshes
- [ ] Navigation between all 4 pages works
- [ ] No console errors in normal flows
- [ ] Both type-checks pass
