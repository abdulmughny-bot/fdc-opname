import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AuthProvider, LoginScreen, useAuth, type Profile } from './features/auth'
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

// A single profile-circle menu replaces the separate Admin button + Sign out
// link — its first item flips between "Admin" and "Dashboard" depending on
// where you currently are, so it's always "go to the other place".
function ProfileMenu({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const onAdminPage = location.pathname.startsWith('/admin')

  return (
    <details className="relative">
      <summary className="list-none cursor-pointer flex items-center gap-2.5 select-none">
        <div className="text-right">
          <div className="font-semibold text-ink text-sm">{profile.name}</div>
          <div className="font-mono text-[10px] uppercase text-ink-soft">{profile.role}</div>
        </div>
        <div className="w-7 h-7 rounded-full bg-teal-deep text-white flex items-center justify-center font-display font-bold text-xs">
          {initials(profile.name)}
        </div>
      </summary>
      <div className="absolute right-0 mt-2 bg-paper border border-line rounded-md shadow-lg py-1 min-w-[160px] z-20">
        {profile.role === 'Lead' && (
          <button
            type="button"
            onClick={() => navigate(onAdminPage ? '/' : '/admin')}
            className="w-full text-left px-3 py-2 text-sm hover:bg-bg"
          >
            {onAdminPage ? 'Dashboard' : 'Admin'}
          </button>
        )}
        <button type="button" onClick={onSignOut} className="w-full text-left px-3 py-2 text-sm text-rust hover:bg-bg">
          Sign out
        </button>
      </div>
    </details>
  )
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
          <ProfileMenu profile={profile} onSignOut={signOut} />
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
