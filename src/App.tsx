import { lazy, Suspense } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LogoMark } from './components/icons'
import { Login, SetupNotice } from './components/Login'
import { ToastProvider } from './components/Toast'
import { useSession } from './hooks/useAuth'
import { isConfigured } from './lib/supabase'

// The map stack is the bulk of the bundle; keep it off the login screen's critical path.
const Dashboard = lazy(() => import('./components/Dashboard').then((m) => ({ default: m.Dashboard })))

const Boot = () => (
  <div className="boot" aria-busy="true" aria-label="Loading">
    <LogoMark size={36} />
  </div>
)

function Screen() {
  const session = useSession()

  if (!isConfigured) return <SetupNotice />
  if (session === undefined) return <Boot />
  if (!session) return <Login />
  return (
    <Suspense fallback={<Boot />}>
      <Dashboard session={session} />
    </Suspense>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Screen />
      </ToastProvider>
    </ErrorBoundary>
  )
}
