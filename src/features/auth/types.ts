import type { Database } from '../../types/database'

export type Profile = Database['dev']['Tables']['profiles']['Row']

export interface VisibleDental {
  id: string
  name: string
}

export interface VisibleClinic {
  id: string
  name: string
  dentals: VisibleDental[]
}

export type AuthStatus = 'loading' | 'signin' | 'error' | 'ready'

export interface AuthState {
  status: AuthStatus
  errorMessage: string | null
  profile: Profile | null
  visibleClinics: VisibleClinic[]
}
