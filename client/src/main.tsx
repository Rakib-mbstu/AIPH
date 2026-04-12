import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'
import { initAnalytics } from './lib/analytics'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!publishableKey) {
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is not set')
}

initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignInUrl="/roadmap"
      afterSignUpUrl="/roadmap"
    >
      <App />
    </ClerkProvider>
  </StrictMode>,
)
