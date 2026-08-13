import { useAuth } from './useAuth'
import { Button } from '../../components'

export function LoginScreen() {
  const { status, errorMessage, signInWithGoogle, retry } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-paper via-paper-secondary to-teal-wash px-4">
      <div className="w-full max-w-md">
        {/* Logo / Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-deep/10 mb-4">
            <span className="text-2xl font-display font-bold text-teal-deep">FDC</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-ink mb-2">Stock Opname</h1>
          <p className="text-ink-soft text-sm">Central Warehouse Inventory Control</p>
        </div>

        {/* Main Card */}
        <div className="bg-paper border border-line rounded-2xl shadow-xl p-8">
          {status === 'loading' && (
            <div className="text-center py-8">
              <div className="mb-4 inline-block">
                <svg className="w-8 h-8 text-teal-deep animate-spin" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.2" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v0a8 8 0 100 16v0a8 8 0 01-8-8z" opacity="0.8" />
                </svg>
              </div>
              <p className="text-sm text-ink-soft font-medium">Signing you in…</p>
              <div className="mt-4 h-1 rounded-full bg-line-soft overflow-hidden">
                <div className="h-full w-full bg-gradient-to-r from-teal-deep to-teal animate-pulse" />
              </div>
            </div>
          )}

          {status === 'signin' && (
            <div>
              <p className="text-center text-ink-soft text-sm mb-6">Sign in with your FDC Google account to access Stock Opname Control.</p>
              <Button variant="primary" size="lg" onClick={signInWithGoogle} className="w-full">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </Button>
              <p className="text-center text-xs text-ink-lighter mt-4">
                Your security is important. This app uses industry-standard Google authentication.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div className="bg-error-wash border border-red-200 rounded-lg px-4 py-3 text-sm mb-6 text-left">
                <p className="font-semibold text-error mb-1">Unable to sign in</p>
                <p className="text-error-wash text-xs">{errorMessage}</p>
              </div>
              <Button variant="primary" size="lg" onClick={retry} className="w-full">
                Try again
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-ink-lighter mt-6">
          FDC Dental Clinic © 2024 · <a href="#" className="text-teal-deep hover:underline">Contact Support</a>
        </p>
      </div>
    </div>
  )
}
