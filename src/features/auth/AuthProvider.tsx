import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { provisionSelf } from '../../lib/api'
import { AuthContext, type AuthContextValue } from './context'
import { NO_PERMISSIONS, type AuthState, type Permissions, type Profile, type VisibleClinic } from './types'

const GOOGLE_HOSTED_DOMAIN = 'fdcdentalclinic.co.id'
const PROFILE_LOAD_MAX_ATTEMPTS = 3

type ProfileLookupResult =
  | { kind: 'ok'; profile: Profile }
  | { kind: 'unprovisioned'; message: string }
  | { kind: 'error'; message: string }

// Distinguishes "not on the allow-list" (real, stop) from a transient query
// error (network/RLS/timeout) — retries the latter silently a few times.
async function loadProfileWithRetry(userId: string, email: string, attempt = 1): Promise<ProfileLookupResult> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

  if (error) {
    if (attempt < PROFILE_LOAD_MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 600 * attempt))
      return loadProfileWithRetry(userId, email, attempt + 1)
    }
    return { kind: 'error', message: 'Could not verify your account right now (network or server). ' + error.message }
  }
  if (!data) {
    return {
      kind: 'unprovisioned',
      message: `Your account (${email}) is not provisioned for Stock Opname. Ask a Lead to add you, then sign in again.`,
    }
  }
  return { kind: 'ok', profile: data }
}

// Leads always have full permissions; Team members get whatever bundle their
// assigned custom_roles row grants (none, if unassigned).
async function loadPermissions(profile: Profile): Promise<Permissions> {
  if (profile.role === 'Lead') {
    return { canViewPricing: true, canEditItemMaster: true, canManageUsers: true, canAccessAdmin: true }
  }
  if (!profile.custom_role_id) return NO_PERMISSIONS
  const { data, error } = await supabase.from('custom_roles').select('*').eq('id', profile.custom_role_id).maybeSingle()
  if (error || !data) return NO_PERMISSIONS
  return {
    canViewPricing: data.can_view_pricing,
    canEditItemMaster: data.can_edit_item_master,
    canManageUsers: data.can_manage_users,
    canAccessAdmin: data.can_access_admin,
  }
}

async function loadVisibleClinics(profile: Profile): Promise<VisibleClinic[]> {
  const [{ data: clinics, error: e1 }, { data: rooms, error: e2 }, { data: access, error: e3 }] = await Promise.all([
    supabase.from('clinics').select('*'),
    supabase.from('rooms').select('*'),
    supabase.from('user_clinic_access').select('clinic_id').eq('user_id', profile.id),
  ])
  const err = e1 || e2 || e3
  if (err) throw err

  const scopedIds = new Set((access ?? []).map((a) => a.clinic_id))
  const visible = profile.all_clinics ? (clinics ?? []) : (clinics ?? []).filter((c) => scopedIds.has(c.id))

  return visible.map((c) => ({
    id: c.id,
    name: c.name,
    dentals: (rooms ?? []).filter((r) => r.clinic_id === c.id).map((r) => ({ id: r.id, name: r.name })),
  }))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    errorMessage: null,
    profile: null,
    visibleClinics: [],
    permissions: NO_PERMISSIONS,
  })

  // Guards against the boot/listener race — onAuthStateChange can fire more
  // than once (INITIAL_SESSION, then TOKEN_REFRESHED, etc.) while boot is
  // already running for an earlier event.
  const bootInFlight = useRef(false)
  const appReady = useRef(false)
  const lastSession = useRef<{ id: string; email: string } | null>(null)

  async function boot(session: { user: { id: string; email?: string } } | null) {
    if (bootInFlight.current || appReady.current) return
    bootInFlight.current = true
    try {
      if (!session) {
        setState({ status: 'signin', errorMessage: null, profile: null, visibleClinics: [], permissions: NO_PERMISSIONS })
        return
      }
      const email = session.user.email ?? ''
      lastSession.current = { id: session.user.id, email }
      setState((s) => ({ ...s, status: 'loading', errorMessage: null }))

      try {
        await provisionSelf()
      } catch (err) {
        setState({
          status: 'error',
          errorMessage: 'Could not verify your account right now (network or server). ' + (err as Error).message,
          profile: null,
          visibleClinics: [],
          permissions: NO_PERMISSIONS,
        })
        return
      }

      const res = await loadProfileWithRetry(session.user.id, email)
      if (res.kind === 'unprovisioned') {
        await supabase.auth.signOut()
        setState({ status: 'error', errorMessage: res.message, profile: null, visibleClinics: [], permissions: NO_PERMISSIONS })
        return
      }
      if (res.kind === 'error') {
        // keep the session (don't sign out on a transient error) — offer retry
        setState((s) => ({ ...s, status: 'error', errorMessage: res.message }))
        return
      }

      try {
        const [visibleClinics, permissions] = await Promise.all([
          loadVisibleClinics(res.profile),
          loadPermissions(res.profile),
        ])
        appReady.current = true
        setState({ status: 'ready', errorMessage: null, profile: res.profile, visibleClinics, permissions })
      } catch (err) {
        setState((s) => ({
          ...s,
          status: 'error',
          errorMessage: 'Signed in, but could not load data: ' + (err as Error).message,
        }))
      }
    } finally {
      bootInFlight.current = false
    }
  }

  useEffect(() => {
    // onAuthStateChange is the single source of truth. We never eagerly call
    // getSession() on load — that can race the client parsing the returning
    // OAuth tokens out of the URL, which is what causes the classic
    // "bounced back to login" bug. INITIAL_SESSION / SIGNED_IN drive everything.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        appReady.current = false
        setState({ status: 'signin', errorMessage: null, profile: null, visibleClinics: [], permissions: NO_PERMISSIONS })
        return
      }
      if (session) {
        boot(session)
      } else if (event === 'INITIAL_SESSION') {
        setState({ status: 'signin', errorMessage: null, profile: null, visibleClinics: [], permissions: NO_PERMISSIONS })
      }
    })

    // Safety net: if no auth event arrives within a few seconds (e.g. the SDK
    // failed to init), don't sit on "loading" forever.
    const safety = setTimeout(() => {
      if (!appReady.current) {
        setState((s) => (s.status === 'loading' ? { ...s, status: 'signin' } : s))
      }
    }, 5000)

    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(safety)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signInWithGoogle() {
    setState((s) => ({ ...s, status: 'loading', errorMessage: null }))
    // origin alone (no pathname) — this SPA has no client-side routing, and
    // Supabase's Redirect URLs allow-list entries are stored without a
    // trailing slash, so appending pathname (always '/') caused every
    // redirect_to to silently mismatch and fall back to the Site URL instead.
    const cleanUrl = window.location.origin
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: cleanUrl, queryParams: { hd: GOOGLE_HOSTED_DOMAIN, prompt: 'select_account' } },
    })
    if (error) {
      setState((s) => ({ ...s, status: 'error', errorMessage: 'Could not start Google sign-in: ' + error.message }))
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = window.location.origin + window.location.pathname
  }

  function retry() {
    setState((s) => ({ ...s, status: 'signin', errorMessage: null }))
  }

  const value: AuthContextValue = { ...state, signInWithGoogle, signOut, retry }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
