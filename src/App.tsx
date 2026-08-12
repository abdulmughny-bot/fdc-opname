import { AuthProvider, LoginScreen, useAuth } from './features/auth'

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
}

function AppShell() {
  const { status, profile, signOut } = useAuth()

  if (status !== 'ready' || !profile) return <LoginScreen />

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-[1180px] mx-auto px-5 pb-20">
        <header className="flex items-center justify-between py-5 border-b border-line mb-6 flex-wrap gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
              FDC Dental Clinic · Central Warehouse Audit
            </span>
            <h1 className="font-display text-xl font-bold text-ink">Stock Opname Control</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {profile.role === 'Lead' && (
              <button
                type="button"
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

        <p className="text-ink-soft text-sm">FDC Stock Opname — scaffold ready. Dashboard coming next.</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
