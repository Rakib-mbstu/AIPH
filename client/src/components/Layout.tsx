import { NavLink } from 'react-router-dom'
import { UserButton } from '@clerk/clerk-react'
import { track } from '../lib/analytics'

const NAV_ITEMS = [
  { to: '/roadmap',  label: 'Roadmap',  icon: '🗺️' },
  { to: '/problems', label: 'Problems', icon: '📋' },
  { to: '/tracker',  label: 'Tracker',  icon: '📊' },
  { to: '/chat',     label: 'Chat',     icon: '💬' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500',
      isActive
        ? 'bg-indigo-50 text-indigo-700 font-semibold'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
    ].join(' ')

  return (
    <div className="flex min-h-screen">
      {/* ── Desktop Sidebar ───────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 sticky top-0 h-screen shrink-0">
        {/* App title */}
        <NavLink
          to="/roadmap"
          className="px-4 py-5 text-xl font-bold text-indigo-700 tracking-tight hover:text-indigo-800 transition-colors"
          onClick={() => track('nav_clicked', { target: '/roadmap' })}
        >
          AIPH
        </NavLink>

        {/* Nav links */}
        <nav className="flex flex-col gap-1 px-2 mt-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={linkClass}
              onClick={() => track('nav_clicked', { target: item.to })}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Spacer + UserButton */}
        <div className="mt-auto px-4 py-4 border-t border-gray-100">
          <UserButton afterSignOutUrl="/" />
        </div>
      </aside>

      {/* ── Content area ──────────────────────────────────── */}
      <main className="flex-1 min-h-screen bg-gray-50 overflow-y-auto pb-16 md:pb-0">
        {children}
      </main>

      {/* ── Mobile Bottom Tab Bar ─────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 flex md:hidden bg-white border-t border-gray-200 z-50">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'flex-1 flex flex-col items-center justify-center py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500',
                isActive
                  ? 'text-indigo-700 font-semibold'
                  : 'text-gray-500 hover:text-gray-700',
              ].join(' ')
            }
            onClick={() => track('nav_clicked', { target: item.to })}
          >
            <span className="text-xl">{item.icon}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
