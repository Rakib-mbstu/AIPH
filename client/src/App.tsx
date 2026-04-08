import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import { useInitializeUser } from './store/userStore'

import RoadmapPage from './pages/RoadmapPage'
import TrackerPage from './pages/TrackerPage'
// import ChatPage from './pages/ChatPage'
// import ProblemsPage from './pages/ProblemsPage'

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
            <SignedIn>
              <RoadmapPage />
            </SignedIn>
          }
        />
        <Route
          path="/tracker"
          element={
            <SignedIn>
              <TrackerPage />
            </SignedIn>
          }
        />
        <Route
          path="/chat"
          element={
            <SignedIn>
              <div>Chat Page (WIP)</div>
              {/* <ChatPage /> */}
            </SignedIn>
          }
        />
        <Route
          path="/problems"
          element={
            <SignedIn>
              <div>Problems Page (WIP)</div>
              {/* <ProblemsPage /> */}
            </SignedIn>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/roadmap" replace />} />
      </Routes>
    </Router>
  )
}

export default App
