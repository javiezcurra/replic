import { useEffect, useState } from 'react'
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
}

interface ApiResponse<T> {
  status: string
  data: T
}

export default function Profile() {
  const { user, isAdmin, refreshIsAdmin } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [saving, setSaving] = useState(false)
  const [togglingAdmin, setTogglingAdmin] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    api.get<ApiResponse<UserProfile>>('/api/users/me').then((res) => {
      const p = res.data
      setProfile(p)
      setDisplayName(p.displayName ?? '')
      setBio(p.bio ?? '')
      setAffiliation(p.affiliation ?? '')
      setRole((p.role as UserRole) ?? '')
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setStatus('idle')
    try {
      const res = await api.patch<ApiResponse<UserProfile>>('/api/users/me', {
        displayName,
        bio: bio || null,
        affiliation: affiliation || null,
        role: role || null,
      })
      setProfile(res.data)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save')
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
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
             style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <h1
        className="text-3xl text-ink mb-6"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Your Profile
      </h1>

      {/* Avatar + read-only info */}
      <div className="flex items-center gap-4 mb-8">
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

      {/* ── Dev-only: self-promote to admin ── */}
      <div className="mb-8 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4">
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

      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
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

        {/* Visibility notice */}
        <div
          className="rounded-xl border px-4 py-3 text-sm leading-relaxed"
          style={{
            borderColor: 'var(--color-accent)',
            background: 'color-mix(in srgb, var(--color-accent) 20%, white)',
            color: 'var(--color-text)',
          }}
        >
          <p className="font-semibold mb-1" style={{ fontFamily: 'var(--font-body)' }}>
            Your profile is visible to others
          </p>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Your <strong>Display name</strong>, <strong>Affiliation</strong>,{' '}
            <strong>Role</strong>, and <strong>Bio</strong> are shown to other Replic users
            when you review experiments or publish your own designs.
          </p>
        </div>

        {status === 'success' && (
          <p className="text-sm text-emerald-600">Profile saved.</p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-600">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
