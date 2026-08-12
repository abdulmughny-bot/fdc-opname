import { createContext } from 'react'
import type { AuthState } from './types'

export interface AuthContextValue extends AuthState {
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  retry: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
