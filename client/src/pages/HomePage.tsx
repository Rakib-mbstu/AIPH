import { Link } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'

document.title = 'AIPH — Adaptive Interview Prep'

// ─── Data ────────────────────────────────────────────────────────────────────

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

const STATS = [
  { value: '54', label: 'Curated problems' },
  { value: '8',  label: 'DSA patterns tracked' },
  { value: '10', label: 'Topic nodes' },
  { value: '5',  label: 'Readiness components' },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <span className="text-xl font-bold text-indigo-700 tracking-tight">AIPH</span>
        <div className="flex items-center gap-3">
          <SignedOut>
            <Link
              to="/sign-in"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/sign-up"
              className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Get started free
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              to="/roadmap"
              className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Go to Dashboard →
            </Link>
          </SignedIn>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
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
          <Link
            to="/sign-up"
            className="inline-block px-8 py-3.5 bg-indigo-600 text-white text-base font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Start for free →
          </Link>
        </SignedOut>
        <SignedIn>
          <Link
            to="/roadmap"
            className="inline-block px-8 py-3.5 bg-indigo-600 text-white text-base font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Go to your dashboard →
          </Link>
        </SignedIn>
      </section>

      {/* ── Features grid ───────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
          Everything your prep is missing
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="border border-gray-200 rounded-xl p-6 bg-white hover:shadow-md transition-shadow"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="text-5xl font-black text-indigo-100 mb-4 leading-none">
                  {s.n}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats strip ─────────────────────────────────────── */}
      <section className="border-y border-gray-200 bg-white py-10">
        <div className="max-w-3xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-black text-indigo-600">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Ready to prep smarter?
        </h2>
        <p className="text-gray-500 mb-8">
          Free to use. No credit card. Start tracking your DSA mastery in minutes.
        </p>
        <SignedOut>
          <Link
            to="/sign-up"
            className="inline-block px-8 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Create free account →
          </Link>
        </SignedOut>
        <SignedIn>
          <Link
            to="/roadmap"
            className="inline-block px-8 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Back to dashboard →
          </Link>
        </SignedIn>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 px-6 py-8 text-center text-xs text-gray-400 space-y-1">
        <div>
          Built with React, Express, PostgreSQL, Prisma, and Claude Sonnet via OpenRouter.
        </div>
        <div>
          <a
            href="https://github.com/Rakib-mbstu/AIPH"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600 underline"
          >
            View on GitHub
          </a>
        </div>
      </footer>

    </div>
  )
}
