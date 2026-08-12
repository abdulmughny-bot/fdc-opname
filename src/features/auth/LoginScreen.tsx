import { useAuth } from './useAuth'

export function LoginScreen() {
  const { status, errorMessage, signInWithGoogle, retry } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm bg-paper border border-line rounded-[10px] shadow p-6 text-center">
        <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-soft">FDC Dental Clinic</span>
        <h1 className="font-display text-lg font-bold text-ink mt-1.5 mb-4">Stock Opname Control</h1>

        {status === 'loading' && (
          <div>
            <p className="text-sm text-ink-soft mb-3">Signing you in…</p>
            <div className="h-2 rounded-full bg-line overflow-hidden">
              <div className="h-full w-full bg-teal animate-pulse" />
            </div>
          </div>
        )}

        {status === 'signin' && (
          <div>
            <p className="text-sm text-ink-soft mb-4">Sign in with your FDC Google account to continue.</p>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full rounded-lg bg-teal-deep text-white font-semibold text-sm py-2.5 hover:bg-teal transition-colors"
            >
              Sign in with Google
            </button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="bg-rust-wash text-rust border border-[#EEC2AC] rounded-lg px-3.5 py-3 text-sm mb-4 text-left">
              {errorMessage}
            </div>
            <button
              type="button"
              onClick={retry}
              className="w-full rounded-lg bg-teal-deep text-white font-semibold text-sm py-2.5 hover:bg-teal transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
