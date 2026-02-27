import { api } from './api'
import type { UserPublicProfile } from '../types/user'

// Module-level promise cache — one fetch per uid, shared across all components.
const cache = new Map<string, Promise<UserPublicProfile | null>>()

export function fetchUserProfile(uid: string): Promise<UserPublicProfile | null> {
  if (!cache.has(uid)) {
    const promise = api
      .get<{ status: string; data: UserPublicProfile }>(`/api/users/${uid}`)
      .then((res) => res.data)
      .catch(() => null)
    cache.set(uid, promise)
  }
  return cache.get(uid)!
}
