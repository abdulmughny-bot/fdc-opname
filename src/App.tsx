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
      <summary className="list-none cursor-pointer">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-deep to-teal text-white flex items-center justify-center font-display font-bold text-sm hover:shadow-md transition-shadow">
          {initials(profile.name)}
        </div>
      </summary>
      <div className="absolute right-0 mt-2 bg-paper border border-line rounded-lg shadow-lg py-1 min-w-[200px] z-20">
        <div className="px-4 py-3 border-b border-line-soft">
          <p className="text-sm font-semibold text-ink">{profile.name}</p>
          <p className="text-xs text-ink-soft mt-0.5">{profile.role === 'Lead' ? 'Lead Account' : 'Team Member'}</p>
        </div>
        {profile.role === 'Lead' && (
          <>
            <button
              type="button"
              onClick={() => navigate(onAdminPage ? '/' : '/admin')}
              className="w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-teal-wash transition-colors"
            >
              {onAdminPage ? '← Back to Dashboard' : 'Settings & Admin'}
            </button>
            <div className="border-t border-line-soft" />
          </>
        )}
        <button
          type="button"
          onClick={onSignOut}
          className="w-full text-left px-4 py-2.5 text-sm text-rust hover:bg-rust-wash transition-colors"
        >
          Sign out
        </button>
      </div>
    </details>
  )
}

function AppShell() {
  const { status, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const onAdminPage = location.pathname.startsWith('/admin')

  if (status !== 'ready' || !profile) return <LoginScreen />

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Top Header */}
      <header className="bg-paper border-b border-line sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo & Title */}
            <button type="button" onClick={() => navigate('/')} className="flex items-center gap-3 text-left group">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-deep to-teal flex items-center justify-center">
                <span className="text-white font-display font-bold text-lg">FDC</span>
              </div>
              <div className="hidden sm:flex flex-col gap-0.5">
                <h1 className="font-display text-sm font-bold text-ink group-hover:text-teal-deep transition-colors">Stock Opname</h1>
                <span className="text-xs text-ink-soft">Warehouse Control</span>
              </div>
            </button>

            {/* Nav Tabs */}
            <nav className="flex items-center gap-1 flex-1 ml-6">
              <button
                type="button"
                onClick={() => navigate('/')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  !onAdminPage ? 'bg-teal-wash text-teal-deep' : 'text-ink-soft hover:bg-line-soft'
                }`}
              >
                Dashboard
              </button>
              {profile.role === 'Lead' && (
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    onAdminPage ? 'bg-teal-wash text-teal-deep' : 'text-ink-soft hover:bg-line-soft'
                  }`}
                >
                  Settings
                </button>
              )}
            </nav>

            {/* Profile Menu */}
            <ProfileMenu profile={profile} onSignOut={signOut} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<DashboardRoute />} />
            <Route path="/wizard/:sessionId" element={<WizardRoute />} />
            <Route path="/admin/*" element={profile.role === 'Lead' ? <AdminPage /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
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
