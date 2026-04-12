# Cycle Q — Public Homepage

**Goal:** Build a public-facing landing page at `/` that sells the product to
both signed-out visitors and signed-in users. Replaces the current "redirect to
sign-in" behavior for unauthenticated visitors.

**Estimated touches:** 3 files modified, 1 new page, 1 new component.

---

## 1. Route change in App.tsx

### File: `client/src/App.tsx`

Currently the `/` route immediately redirects unauthenticated users to Clerk's
sign-in page:

```tsx
<Route path="/" element={<SignedOut><RedirectToSignIn /></SignedOut>} />
```

Replace with:

```tsx
import HomePage from './pages/HomePage'

<Route path="/" element={<HomePage />} />
```

The `HomePage` itself renders different CTAs based on sign-in state — signed-in
users see "Go to Dashboard", signed-out users see "Get Started".

---

## 2. HomePage component

### File: `client/src/pages/HomePage.tsx` (NEW)

Single file. No external dependencies beyond what's already installed.
Uses `react-router-dom`'s `Link` and Clerk's `SignedIn`/`SignedOut`.

### Layout (top to bottom):

```
┌─────────────────────────────────────────┐
│  Nav: logo + "Sign in" / "Dashboard"    │
├─────────────────────────────────────────┤
│  Hero: headline + sub + CTA button      │
├─────────────────────────────────────────┤
│  Features: 4 cards in 2×2 grid          │
├─────────────────────────────────────────┤
│  How it works: 3-step numbered flow     │
├─────────────────────────────────────────┤
│  Stats strip: 54 problems · 8 patterns  │
├─────────────────────────────────────────┤
│  Final CTA banner                       │
├─────────────────────────────────────────┤
│  Footer: stack credits + GitHub link    │
└─────────────────────────────────────────┘
```

---

## 3. Section specs

### 3a. Navbar

```tsx
<nav className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
  <span className="text-xl font-bold text-indigo-700">AIPH</span>
  <div className="flex items-center gap-3">
    <SignedOut>
      <Link to="/sign-in" className="text-sm text-gray-600 hover:text-gray-900">Sign in</Link>
      <Link to="/sign-up" className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
        Get started free
      </Link>
    </SignedOut>
    <SignedIn>
      <Link to="/roadmap" className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
        Go to Dashboard →
      </Link>
    </SignedIn>
  </div>
</nav>
```

### 3b. Hero

```tsx
<section className="max-w-3xl mx-auto px-6 py-24 text-center">
  <div className="inline-block text-xs font-semibold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full mb-6">
    Adaptive · AI-Powered · Free
  </div>
  <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
    Stop grinding blindly.<br />
    <span className="text-indigo-600">Know exactly what to practice.</span>
  </h1>
  <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10">
    AIPH tracks your DSA mastery pattern by pattern, flags weak areas
    automatically, and gives you an AI coach that knows your history.
    Not a static roadmap — an adaptive one.
  </p>
  <SignedOut>
    <Link to="/sign-up"
      className="inline-block px-8 py-3.5 bg-indigo-600 text-white text-base font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
      Start for free →
    </Link>
  </SignedOut>
  <SignedIn>
    <Link to="/roadmap"
      className="inline-block px-8 py-3.5 bg-indigo-600 text-white text-base font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
      Go to your dashboard →
    </Link>
  </SignedIn>
</section>
```

### 3c. Features grid (4 cards)

```tsx
const FEATURES = [
  {
    icon: '🗺️',
    title: 'Adaptive Roadmap',
    desc: 'Topics unlock as you master prerequisites. The graph reorders itself around your weak spots — not a fixed curriculum.',
  },
  {
    icon: '🤖',
    title: 'AI Approach Evaluation',
    desc: 'Describe your solution in plain English. The AI scores it, identifies the pattern you used, and suggests optimizations.',
  },
  {
    icon: '🎯',
    title: 'Weakness Detection',
    desc: 'Failing rate >40%? Solving too slowly? Taking too many hints? Weak areas are flagged automatically after every attempt.',
  },
  {
    icon: '💬',
    title: 'Context-Aware Coach',
    desc: 'The chat knows your mastery scores and recent weak areas. Ask about any concept and get answers tailored to where you are.',
  },
]
```

Grid layout:
```tsx
<section className="max-w-5xl mx-auto px-6 py-16">
  <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
    Everything your prep is missing
  </h2>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
    {FEATURES.map((f) => (
      <div key={f.title} className="border border-gray-200 rounded-xl p-6 bg-white hover:shadow-md transition-shadow">
        <div className="text-3xl mb-3">{f.icon}</div>
        <h3 className="font-semibold text-gray-900 text-lg mb-2">{f.title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
      </div>
    ))}
  </div>
</section>
```

### 3d. How it works (3-step flow)

```tsx
const STEPS = [
  {
    n: '01',
    title: 'Solve problems at your own pace',
    desc: 'Work on LeetCode or any platform. Come back and describe your approach — no pasting code required.',
  },
  {
    n: '02',
    title: 'AI evaluates and tracks patterns',
    desc: 'Every submission is scored, analyzed for the DSA pattern used, and fed into your mastery scores automatically.',
  },
  {
    n: '03',
    title: 'Your roadmap adapts around you',
    desc: 'Weak areas surface to the top. Strong areas unlock harder topics. Your daily plan updates after every session.',
  },
]
```

Layout — horizontal on desktop, stacked on mobile:
```tsx
<section className="bg-gray-50 py-16">
  <div className="max-w-5xl mx-auto px-6">
    <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">How it works</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {STEPS.map((s) => (
        <div key={s.n} className="text-center">
          <div className="inline-block text-4xl font-black text-indigo-100 mb-4">{s.n}</div>
          <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
          <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
        </div>
      ))}
    </div>
  </div>
</section>
```

### 3e. Stats strip

```tsx
<section className="border-y border-gray-200 bg-white py-10">
  <div className="max-w-3xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
    {[
      { value: '54',      label: 'Curated problems' },
      { value: '8',       label: 'DSA patterns tracked' },
      { value: '10',      label: 'Topic nodes' },
      { value: '5',       label: 'Readiness components' },
    ].map((s) => (
      <div key={s.label}>
        <div className="text-3xl font-black text-indigo-600">{s.value}</div>
        <div className="text-xs text-gray-500 mt-1">{s.label}</div>
      </div>
    ))}
  </div>
</section>
```

### 3f. Final CTA banner

```tsx
<section className="max-w-3xl mx-auto px-6 py-20 text-center">
  <h2 className="text-3xl font-bold text-gray-900 mb-4">
    Ready to prep smarter?
  </h2>
  <p className="text-gray-500 mb-8">
    Free to use. No credit card. Start tracking your DSA mastery in minutes.
  </p>
  <SignedOut>
    <Link to="/sign-up"
      className="inline-block px-8 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
      Create free account →
    </Link>
  </SignedOut>
  <SignedIn>
    <Link to="/roadmap"
      className="inline-block px-8 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
      Back to dashboard →
    </Link>
  </SignedIn>
</section>
```

### 3g. Footer

```tsx
<footer className="border-t border-gray-100 px-6 py-8 text-center text-xs text-gray-400 space-y-1">
  <div>
    Built with React, Express, PostgreSQL, Prisma, and Claude Sonnet via OpenRouter.
  </div>
  <div>
    <a href="https://github.com/Rakib-mbstu/AIPH"
       target="_blank" rel="noopener noreferrer"
       className="hover:text-gray-600 underline">
      View on GitHub
    </a>
  </div>
</footer>
```

---

## 4. Sign-in / Sign-up routes

Clerk provides hosted sign-in/sign-up pages. Wire the routes in App.tsx:

### File: `client/src/App.tsx`

```tsx
import { SignIn, SignUp } from '@clerk/clerk-react'

// Add inside <Routes>:
<Route path="/sign-in/*" element={
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <SignIn routing="path" path="/sign-in" />
  </div>
} />
<Route path="/sign-up/*" element={
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <SignUp routing="path" path="/sign-up" />
  </div>
} />
```

Also update the Clerk dashboard: set "Sign-in URL" to `/sign-in` and
"Sign-up URL" to `/sign-up` under your application's Paths settings. Otherwise
Clerk's hosted pages redirect to the default URLs.

The root `/` route becomes:
```tsx
<Route path="/" element={<HomePage />} />
```

Remove the old `<SignedOut><RedirectToSignIn /></SignedOut>` route.

---

## 5. Post-sign-in redirect

Currently after sign-in, Clerk redirects to the `afterSignInUrl`. Set this in
the `ClerkProvider` in `main.tsx`:

```tsx
<ClerkProvider
  publishableKey={publishableKey}
  afterSignInUrl="/roadmap"
  afterSignUpUrl="/roadmap"
>
```

---

## What NOT to Do

- Do NOT add animations (framer-motion etc.) — Tailwind transitions are enough
- Do NOT add a pricing section — this is a free tool
- Do NOT add testimonials/screenshots — no real user data yet
- Do NOT make the homepage part of the app Layout (sidebar nav) — it's a
  standalone full-width page with its own simple navbar
- Do NOT add a mobile hamburger menu — the navbar only has 2 items, they fit
- Do NOT use `<img>` tags for illustrations — use emoji + Tailwind shapes only
- Do NOT add a blog or docs section

---

## Verification Checklist

- [ ] `/` shows homepage to unauthenticated visitors (no redirect to sign-in)
- [ ] Signed-out: "Get started free" and "Create free account" link to `/sign-up`
- [ ] Signed-in: all CTAs link to `/roadmap`, no sign-in prompts visible
- [ ] `/sign-in` renders Clerk's embedded sign-in form
- [ ] `/sign-up` renders Clerk's embedded sign-up form
- [ ] After sign-in, user is redirected to `/roadmap`
- [ ] `/roadmap` and other app routes still require auth (protected layout unchanged)
- [ ] Page renders correctly at 375px mobile width
- [ ] `document.title` set to `"AIPH — Adaptive Interview Prep"`
- [ ] `npx tsc --noEmit` passes
