import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignIn, SignUp } from '@clerk/clerk-react'
import { useInitializeUser } from './store/userStore'
import Layout from './components/Layout'

import HomePage from './pages/HomePage'
import RoadmapPage from './pages/RoadmapPage'
import TrackerPage from './pages/TrackerPage'
import ProblemsPage from './pages/ProblemsPage'
import ChatPage from './pages/ChatPage'
import AdminPage from './pages/AdminPage'
import SystemDesignPage from './pages/SystemDesignPage'

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
        {/* Public — homepage visible to everyone */}
        <Route path="/" element={<HomePage />} />

        {/* Auth — Clerk embedded forms */}
        <Route
          path="/sign-in/*"
          element={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
              <SignIn routing="path" path="/sign-in" />
            </div>
          }
        />
        <Route
          path="/sign-up/*"
          element={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
              <SignUp routing="path" path="/sign-up" />
            </div>
          }
        />

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
        <Route
          path="/system-design"
          element={
            <ProtectedLayout>
              <SystemDesignPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedLayout>
              <AdminPage />
            </ProtectedLayout>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
