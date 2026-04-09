import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import { useInitializeUser } from './store/userStore'
import Layout from './components/Layout'

import RoadmapPage from './pages/RoadmapPage'
import TrackerPage from './pages/TrackerPage'
import ProblemsPage from './pages/ProblemsPage'
import ChatPage from './pages/ChatPage'

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <SignedIn>
      <Layout>{children}</Layout>
    </SignedIn>
  )
}

function App() {
  useInitializeUser()

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<SignedOut><RedirectToSignIn /></SignedOut>} />

        {/* Protected routes */}
        <Route
          path="/roadmap"
          element={
            <ProtectedLayout>
              <RoadmapPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/tracker"
          element={
            <ProtectedLayout>
              <TrackerPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedLayout>
              <ChatPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/problems"
          element={
            <ProtectedLayout>
              <ProblemsPage />
            </ProtectedLayout>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/roadmap" replace />} />
      </Routes>
    </Router>
  )
}

export default App
