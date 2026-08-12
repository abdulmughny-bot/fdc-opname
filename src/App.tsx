import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { AuthProvider, LoginScreen, useAuth } from './features/auth'
import { Dashboard } from './features/dashboard'
import { Wizard } from './features/wizard'
import { AdminPage } from './features/admin'

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
}

function DashboardRoute() {
  const navigate = useNavigate()
  return (
    <Dashboard
      onNewAuditLog={() => navigate('/wizard/new')}
      onSelectSession={(sessionId) => navigate(`/wizard/${sessionId}`)}
    />
  )
}

function WizardRoute() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  return <Wizard key={sessionId} sessionId={sessionId === 'new' ? null : (sessionId ?? null)} onExit={() => navigate('/')} />
}

function AppShell() {
  const { status, profile, signOut } = useAuth()
  const navigate = useNavigate()

  if (status !== 'ready' || !profile) return <LoginScreen />

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-[1180px] mx-auto px-5 pb-20">
        <header className="flex items-center justify-between py-5 border-b border-line mb-6 flex-wrap gap-3">
          <button type="button" onClick={() => navigate('/')} className="flex flex-col gap-0.5 text-left">
            <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
              FDC Dental Clinic · Central Warehouse Audit
            </span>
            <h1 className="font-display text-xl font-bold text-ink">Stock Opname Control</h1>
          </button>
          <div className="flex items-center gap-2 text-sm">
            {profile.role === 'Lead' && (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink-soft mr-1"
              >
                Admin
              </button>
            )}
            <div className="text-right">
              <div className="font-semibold text-ink">{profile.name}</div>
              <div className="font-mono text-[10px] uppercase text-ink-soft">{profile.role}</div>
            </div>
            <div className="w-7 h-7 rounded-full bg-teal-deep text-white flex items-center justify-center font-display font-bold text-xs">
              {initials(profile.name)}
            </div>
            <button
              type="button"
              onClick={signOut}
              className="ml-1.5 text-teal-deep underline text-xs bg-transparent border-none cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<DashboardRoute />} />
          <Route path="/wizard/:sessionId" element={<WizardRoute />} />
          <Route path="/admin/*" element={profile.role === 'Lead' ? <AdminPage /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
