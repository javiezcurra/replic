import { Request, Response, NextFunction } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../lib/firebase'
import {
  UserProfile,
  UserProfileResponse,
  PublicUserProfileResponse,
  UpdateUserBody,
  USER_ROLES,
} from '../types/user'
import { AppError } from '../middleware/errorHandler'

const USERS = 'users'

function toResponse(profile: UserProfile): UserProfileResponse {
  return {
    ...profile,
    createdAt: profile.createdAt.toDate().toISOString(),
    updatedAt: profile.updatedAt.toDate().toISOString(),
  }
}

function toPublicResponse(profile: UserProfile): PublicUserProfileResponse {
  const { email: _email, ...rest } = toResponse(profile)
  return rest
}

// POST /api/users/me
// Upsert profile — call this on every sign-in to sync Firebase Auth → Firestore
export async function upsertMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { uid, email, name, picture } = req.user!
    const ref = adminDb.collection(USERS).doc(uid)
    const snap = await ref.get()

    if (!snap.exists) {
      const now = FieldValue.serverTimestamp()
      const newProfile = {
        uid,
        displayName: name ?? email ?? uid,
        email: email ?? '',
        photoURL: picture ?? null,
        bio: null,
        affiliation: null,
        role: null,
        is_admin: false,
        scores: { designer: 0, experimenter: 0, reviewer: 0 },
        createdAt: now,
        updatedAt: now,
      }
      await ref.set(newProfile)
      const created = await ref.get()
      res.status(201).json({ status: 'ok', data: toResponse(created.data() as UserProfile) })
    } else {
      // Sync display fields from auth token; backfill new fields for existing accounts
      const existing = snap.data()!
      const updatePayload: Record<string, unknown> = {
        displayName: name ?? existing.displayName,
        email: email ?? existing.email,
        photoURL: picture ?? existing.photoURL,
        updatedAt: FieldValue.serverTimestamp(),
      }
      if (existing.is_admin === undefined) updatePayload.is_admin = false
      if (existing.role === undefined) updatePayload.role = null
      await ref.update(updatePayload)
      const updated = await ref.get()
      res.status(200).json({ status: 'ok', data: toResponse(updated.data() as UserProfile) })
    }
  } catch (err) {
    next(err)
  }
}

// GET /api/users/me
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const snap = await adminDb.collection(USERS).doc(req.user!.uid).get()
    if (!snap.exists) {
      const error: AppError = new Error('Profile not found — call POST /api/users/me first')
      error.statusCode = 404
      return next(error)
    }
    res.status(200).json({ status: 'ok', data: toResponse(snap.data() as UserProfile) })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/users/me
export async function updateMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ref = adminDb.collection(USERS).doc(req.user!.uid)
    const snap = await ref.get()
    if (!snap.exists) {
      const error: AppError = new Error('Profile not found — call POST /api/users/me first')
      error.statusCode = 404
      return next(error)
    }

    const { displayName, photoURL, bio, affiliation, role, is_admin }: UpdateUserBody = req.body
    const validRoles = USER_ROLES.map(r => r.value) as string[]
    if (role !== undefined && role !== null && !validRoles.includes(role)) {
      const error: AppError = new Error(`role must be one of: ${validRoles.join(', ')}`)
      error.statusCode = 400
      return next(error)
    }
    const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
    if (displayName !== undefined) patch.displayName = displayName
    if (photoURL !== undefined) patch.photoURL = photoURL
    if (bio !== undefined) patch.bio = bio
    if (affiliation !== undefined) patch.affiliation = affiliation
    if (role !== undefined) patch.role = role
    if (is_admin !== undefined) patch.is_admin = is_admin

    await ref.update(patch)
    const updated = await ref.get()
    res.status(200).json({ status: 'ok', data: toResponse(updated.data() as UserProfile) })
  } catch (err) {
    next(err)
  }
}

// GET /api/users/:id
export async function getUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const snap = await adminDb.collection(USERS).doc(req.params.id).get()
    if (!snap.exists) {
      const error: AppError = new Error('User not found')
      error.statusCode = 404
      return next(error)
    }
    const data = toPublicResponse(snap.data() as UserProfile)
    res.status(200).json({ status: 'ok', data })
  } catch (err) {
    next(err)
  }
}
