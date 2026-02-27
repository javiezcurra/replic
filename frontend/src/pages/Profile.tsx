import { useEffect, useState } from 'react'
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail,
} from 'firebase/auth'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'

type UserRole =
  | 'citizen_scientist'
  | 'student'
  | 'teacher'
  | 'professional_researcher'
  | 'industry_professional'
  | 'hobbyist'
  | 'other'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'citizen_scientist',       label: 'Citizen Scientist' },
  { value: 'student',                 label: 'Student' },
  { value: 'teacher',                 label: 'Teacher / Educator' },
  { value: 'professional_researcher', label: 'Professional Researcher' },
  { value: 'industry_professional',   label: 'Industry Professional' },
  { value: 'hobbyist',                label: 'Hobbyist' },
  { value: 'other',                   label: 'Other' },
]

interface UserProfile {
  uid: string
  email: string
  displayName: string
  photoURL?: string | null
  bio?: string | null
  affiliation?: string | null
  role?: UserRole | null
  is_admin?: boolean
  discoverable?: boolean
}

interface ApiResponse<T> {
  status: string
  data: T
}

function mapSecurityError(code: string): string {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect current password.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/email-already-in-use':
      return 'This email is already in use by another account.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/requires-recent-login':
      return 'Please sign out and sign back in before making this change.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

// ── Security column sub-components ────────────────────────────────────────────

function GoogleBanner() {
  return (
    <div className="space-y-3">
      <div
        className="flex items-start gap-3 rounded-xl p-4 text-sm"
        style={{
          background: 'color-mix(in srgb, var(--color-accent) 25%, white)',
          border: '1px solid var(--color-accent)',
        }}
      >
        {/* Google mark */}
        <svg className="w-5 h-5 mt-0.5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        <div>
          <p className="font-medium mb-0.5" style={{ color: 'var(--color-dark)' }}>
            Signed in with Google
          </p>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Your email and password are managed by Google. To update them, visit{' '}
            <a
              href="https://myaccount.google.com"
              target="_blank"
              rel="noreferrer"
              className="underline"
              style={{ color: 'var(--color-primary)' }}
            >
              myaccount.google.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}

interface ChangeEmailSectionProps {
  userEmail: string
  firebaseUser: NonNullable<ReturnType<typeof useAuth>['user']>
}

function ChangeEmailSection({ userEmail, firebaseUser }: ChangeEmailSectionProps) {
  const [open, setOpen]           = useState(false)
  const [newEmail, setNewEmail]   = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState<string | null>(null)

  function handleOpen() {
    setOpen(true)
    setError(null)
    setSuccess(null)
    setNewEmail('')
    setPassword('')
  }

  function handleClose() {
    setOpen(false)
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newEmail === userEmail) {
      setError('This is already your current email address.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email!, password)
      await reauthenticateWithCredential(firebaseUser, credential)
      await verifyBeforeUpdateEmail(firebaseUser, newEmail)
      setSuccess(`A verification link has been sent to ${newEmail}. Click it to confirm your new email address.`)
      setOpen(false)
    } catch (err: unknown) {
      setError(mapSecurityError((err as { code?: string }).code ?? ''))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {success ? (
        <div className="rounded-lg px-3 py-2.5 text-sm bg-green-50 text-green-800">
          {success}
        </div>
      ) : !open ? (
        <button
          type="button"
          onClick={handleOpen}
          className="flex items-center gap-2 w-full text-sm font-medium py-1 text-left hover:opacity-80 transition-opacity"
          style={{ color: 'var(--color-text)' }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Change email
          <svg className="w-3.5 h-3.5 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Change email</p>
            <button
              type="button"
              onClick={handleClose}
              className="text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Cancel
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                New email
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                autoComplete="email"
                className="input input-sm w-full"
                placeholder="new@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Current password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="input input-sm w-full"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-xs text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary text-sm w-full justify-center"
            >
              {loading ? 'Sending link…' : 'Send verification link'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

interface ChangePasswordSectionProps {
  firebaseUser: NonNullable<ReturnType<typeof useAuth>['user']>
}

function ChangePasswordSection({ firebaseUser }: ChangePasswordSectionProps) {
  const [open, setOpen]                   = useState(false)
  const [currentPassword, setCurrent]     = useState('')
  const [newPassword, setNew]             = useState('')
  const [confirmPassword, setConfirm]     = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [success, setSuccess]             = useState(false)

  function handleOpen() {
    setOpen(true)
    setError(null)
    setSuccess(false)
    setCurrent('')
    setNew('')
    setConfirm('')
  }

  function handleClose() {
    setOpen(false)
    setError(null)
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email!, currentPassword)
      await reauthenticateWithCredential(firebaseUser, credential)
      await updatePassword(firebaseUser, newPassword)
      setSuccess(true)
      setOpen(false)
    } catch (err: unknown) {
      setError(mapSecurityError((err as { code?: string }).code ?? ''))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {success ? (
        <div className="rounded-lg px-3 py-2.5 text-sm bg-green-50 text-green-800">
          Password updated successfully.
        </div>
      ) : !open ? (
        <button
          type="button"
          onClick={handleOpen}
          className="flex items-center gap-2 w-full text-sm font-medium py-1 text-left hover:opacity-80 transition-opacity"
          style={{ color: 'var(--color-text)' }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Change password
          <svg className="w-3.5 h-3.5 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Change password</p>
            <button
              type="button"
              onClick={handleClose}
              className="text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Cancel
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Current password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrent(e.target.value)}
                required
                autoComplete="current-password"
                className="input input-sm w-full"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNew(e.target.value)}
                required
                autoComplete="new-password"
                minLength={6}
                className="input input-sm w-full"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className="input input-sm w-full"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-xs text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary text-sm w-full justify-center"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Profile() {
  const { user, isAdmin, refreshIsAdmin } = useAuth()

  const isEmailProvider = user?.providerData.some(p => p.providerId === 'password') ?? false

  // Profile form state
  const [profile, setProfile]         = useState<UserProfile | null>(null)
  const [editing, setEditing]         = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio]                 = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [role, setRole]               = useState<UserRole | ''>('')
  const [saving, setSaving]           = useState(false)
  const [saveStatus, setSaveStatus]   = useState<'idle' | 'success' | 'error'>('idle')
  const [saveError, setSaveError]     = useState('')

  // Admin toggle
  const [togglingAdmin, setTogglingAdmin] = useState(false)

  // Discoverability
  const [discoverable, setDiscoverable] = useState(false)
  const [savingDiscoverable, setSavingDiscoverable] = useState(false)

  useEffect(() => {
    api.get<ApiResponse<UserProfile>>('/api/users/me').then((res) => {
      const p = res.data
      setProfile(p)
      setDisplayName(p.displayName ?? '')
      setBio(p.bio ?? '')
      setAffiliation(p.affiliation ?? '')
      setRole((p.role as UserRole) ?? '')
      setDiscoverable(p.discoverable ?? false)
    })
  }, [])

  async function handleDiscoverableToggle() {
    const next = !discoverable
    setDiscoverable(next)
    setSavingDiscoverable(true)
    try {
      await api.patch('/api/users/me', { discoverable: next })
    } catch {
      // Revert on failure
      setDiscoverable(!next)
    } finally {
      setSavingDiscoverable(false)
    }
  }

  function handleCancel() {
    setDisplayName(profile?.displayName ?? '')
    setBio(profile?.bio ?? '')
    setAffiliation(profile?.affiliation ?? '')
    setRole((profile?.role as UserRole) ?? '')
    setSaveStatus('idle')
    setEditing(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveStatus('idle')
    try {
      const res = await api.patch<ApiResponse<UserProfile>>('/api/users/me', {
        displayName,
        bio: bio || null,
        affiliation: affiliation || null,
        role: role || null,
      })
      setProfile(res.data)
      setSaveStatus('success')
      setEditing(false)
    } catch (err) {
      setSaveStatus('error')
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleAdmin() {
    setTogglingAdmin(true)
    try {
      await api.patch<ApiResponse<UserProfile>>('/api/users/me', { is_admin: !isAdmin })
      await refreshIsAdmin()
    } finally {
      setTogglingAdmin(false)
    }
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  const roleLabelMap = Object.fromEntries(ROLE_OPTIONS.map(o => [o.value, o.label]))

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <h1
        className="text-3xl text-ink mb-8"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Your Profile
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        {/* ── Left: profile details ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Avatar + name header */}
          <div className="flex items-center gap-4">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="avatar" className="w-16 h-16 rounded-full" />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                style={{ background: 'var(--color-dark)' }}
              >
                {profile.displayName?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-ink">{profile.displayName}</p>
                {profile.is_admin && (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                    style={{ background: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}
                  >
                    admin
                  </span>
                )}
              </div>
              <p className="text-sm text-muted">{profile.email}</p>
            </div>
          </div>

          {/* Dev admin toggle */}
          <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">
                  Dev tool · remove before prod
                </p>
                <p className="text-sm text-amber-900">
                  Admin access — currently{' '}
                  <span className="font-semibold">{isAdmin ? 'enabled' : 'disabled'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleAdmin}
                disabled={togglingAdmin}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full
                            border-2 transition-colors duration-200 focus:outline-none
                            disabled:opacity-50 ${
                  isAdmin ? 'border-amber-500 bg-amber-500' : 'border-gray-300 bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow
                              transition-transform duration-200 ${isAdmin ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
          </div>

          {/* Profile details card */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-base" style={{ color: 'var(--color-dark)' }}>
                Profile details
              </h2>
              {!editing && (
                <button
                  type="button"
                  onClick={() => { setEditing(true); setSaveStatus('idle') }}
                  className="flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--color-primary)' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              )}
            </div>

            {editing ? (
              <form onSubmit={handleSave} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Display name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="input-sm w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Affiliation</label>
                  <input
                    type="text"
                    value={affiliation}
                    onChange={(e) => setAffiliation(e.target.value)}
                    placeholder="e.g. MIT, Independent researcher"
                    className="input-sm w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole | '')}
                    className="input-sm w-full"
                  >
                    <option value="">Select your role…</option>
                    {ROLE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    placeholder="Tell others about your research interests"
                    className="input-sm w-full resize-y"
                  />
                </div>

                {saveStatus === 'error' && (
                  <p className="text-sm text-red-600">{saveError}</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <dl className="space-y-4">
                {saveStatus === 'success' && (
                  <p className="text-sm text-emerald-600 mb-2">Profile saved.</p>
                )}
                <ProfileField label="Display name" value={profile.displayName} />
                <ProfileField label="Affiliation" value={profile.affiliation} />
                <ProfileField label="Role" value={profile.role ? roleLabelMap[profile.role] : null} />
                <ProfileField label="Bio" value={profile.bio} multiline />

                <div
                  className="rounded-xl border px-4 py-3 text-sm leading-relaxed mt-2"
                  style={{
                    borderColor: 'var(--color-accent)',
                    background: 'color-mix(in srgb, var(--color-accent) 20%, white)',
                  }}
                >
                  <p className="font-semibold mb-0.5" style={{ color: 'var(--color-text)' }}>
                    Your profile is visible to others
                  </p>
                  <p style={{ color: 'var(--color-text-muted)' }}>
                    Your <strong>Display name</strong>, <strong>Affiliation</strong>,{' '}
                    <strong>Role</strong>, and <strong>Bio</strong> are shown to other Replic users
                    when you review experiments or publish your own designs.
                  </p>
                </div>
              </dl>
            )}
          </div>
        </div>

        {/* ── Right: account & security ─────────────────────────────────── */}
        <div className="space-y-4">
          <div className="card p-6">
            <h2 className="font-semibold text-base mb-4" style={{ color: 'var(--color-dark)' }}>
              Account &amp; Security
            </h2>

            {!isEmailProvider ? (
              <GoogleBanner />
            ) : (
              <div className="space-y-3">
                <ChangeEmailSection
                  userEmail={profile.email}
                  firebaseUser={user!}
                />
                <hr className="border-gray-100" />
                <ChangePasswordSection firebaseUser={user!} />
              </div>
            )}

            <hr className="border-gray-100" />

            {/* Discoverability */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    Allow others to find you
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    When enabled, other Replic users can find you by name in the Collaborators search.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDiscoverableToggle}
                  disabled={savingDiscoverable}
                  className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full
                              border-2 transition-colors duration-200 focus:outline-none
                              disabled:opacity-50 mt-0.5 ${
                    discoverable
                      ? 'border-transparent'
                      : 'border-gray-300 bg-gray-200'
                  }`}
                  style={discoverable ? { background: 'var(--color-primary)', borderColor: 'var(--color-primary)' } : {}}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow
                                transition-transform duration-200 ${discoverable ? 'translate-x-4' : 'translate-x-0.5'}`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Helper components ─────────────────────────────────────────────────────────

function ProfileField({
  label,
  value,
  multiline = false,
}: {
  label: string
  value: string | null | undefined
  multiline?: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <dt className="text-sm font-medium col-span-1" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </dt>
      <dd
        className={`text-sm col-span-2 ${multiline ? 'whitespace-pre-wrap' : ''}`}
        style={{ color: value ? 'var(--color-text)' : 'var(--color-text-muted)' }}
      >
        {value || '—'}
      </dd>
    </div>
  )
}
