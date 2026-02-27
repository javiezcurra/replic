import { createContext, useContext, useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { api } from '../lib/api'

interface AuthContextValue {
  user: User | null
  isAdmin: boolean
  loading: boolean
  signIn: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  signOut: () => Promise<void>
  /** Re-fetches the user profile and updates isAdmin. Call after toggling admin status. */
  refreshIsAdmin: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        try {
          const res = await api.get<{ status: string; data: { is_admin: boolean } }>(
            '/api/users/me',
          )
          setIsAdmin(res.data.is_admin ?? false)
        } catch {
          setIsAdmin(false)
        }
      } else {
        setIsAdmin(false)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function signIn() {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
    // Upsert Firestore profile via backend
    try {
      await api.post('/api/users/me')
    } catch {
      // Non-fatal — profile upsert will retry on next sign-in
    }
  }

  async function signInWithEmail(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
    try {
      await api.post('/api/users/me')
    } catch {
      // Non-fatal
    }
  }

  async function signUpWithEmail(email: string, password: string, displayName: string) {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(newUser, { displayName })
    // Force token refresh so displayName is included in JWT claims
    await newUser.getIdToken(true)
    try {
      await api.post('/api/users/me')
    } catch {
      // Non-fatal
    }
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email)
  }

  async function refreshIsAdmin() {
    try {
      const res = await api.get<{ status: string; data: { is_admin: boolean } }>('/api/users/me')
      setIsAdmin(res.data.is_admin ?? false)
    } catch {
      // ignore
    }
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, signIn, signInWithEmail, signUpWithEmail, resetPassword, signOut, refreshIsAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
