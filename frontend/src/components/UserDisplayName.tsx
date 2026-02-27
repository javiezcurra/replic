import { useEffect, useState } from 'react'
import { fetchUserProfile } from '../lib/userProfileCache'
import type { UserPublicProfile } from '../types/user'
import UserProfileModal from './UserProfileModal'

interface Props {
  uid: string
  className?: string
}

type LoadState = 'loading' | 'loaded' | 'error'

/**
 * Renders a user's display name as a clickable button that opens a profile modal.
 * Returns null while loading or when the profile cannot be fetched (e.g. unauthenticated).
 */
export default function UserDisplayName({ uid, className }: Props) {
  const [profile, setProfile] = useState<UserPublicProfile | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    setLoadState('loading')
    fetchUserProfile(uid).then((p) => {
      if (p) {
        setProfile(p)
        setLoadState('loaded')
      } else {
        setLoadState('error')
      }
    })
  }, [uid])

  if (loadState !== 'loaded' || !profile) return null

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setShowModal(true)
        }}
        className={`text-primary hover:underline font-medium leading-none ${className ?? ''}`}
      >
        {profile.displayName}
      </button>

      {showModal && (
        <UserProfileModal profile={profile} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
