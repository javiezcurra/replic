import { Request, Response, NextFunction } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../lib/firebase'
import type { UserProfile, UserSearchResult } from '../types/user'
import { AppError } from '../middleware/errorHandler'

const USERS = 'users'
const REQUESTS = 'collaboration_requests'

function forbidden(message: string): AppError {
  const e: AppError = new Error(message)
  e.statusCode = 403
  return e
}

function badRequest(message: string): AppError {
  const e: AppError = new Error(message)
  e.statusCode = 400
  return e
}

function notFound(message: string): AppError {
  const e: AppError = new Error(message)
  e.statusCode = 404
  return e
}

function toTimestamp(val: unknown): string | null {
  if (!val) return null
  if (typeof val === 'object' && 'toDate' in (val as object)) {
    return (val as { toDate: () => Date }).toDate().toISOString()
  }
  return null
}

// POST /api/users/:uid/collaboration-requests
export async function sendCollaborationRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const fromUid = req.user!.uid
    const toUid = req.params.uid

    if (fromUid === toUid) return next(badRequest('Cannot send a collaboration request to yourself'))

    // Target must exist
    const targetSnap = await adminDb.collection(USERS).doc(toUid).get()
    if (!targetSnap.exists) return next(notFound('User not found'))

    const requestsRef = adminDb.collection(REQUESTS)

    // Already connected?
    const alreadyConnected = await adminDb.collection(USERS).doc(fromUid).collection('collaborators').doc(toUid).get()
    if (alreadyConnected.exists) {
      res.status(200).json({ status: 'ok', data: { status: 'already_connected' } })
      return
    }

    // Existing pending outgoing request?
    const existingOut = await requestsRef
      .where('fromUid', '==', fromUid)
      .where('toUid', '==', toUid)
      .where('status', '==', 'pending')
      .limit(1)
      .get()

    if (!existingOut.empty) {
      const doc = existingOut.docs[0]
      const d = doc.data()
      res.status(200).json({
        status: 'ok',
        data: { id: doc.id, fromUid: d.fromUid, toUid: d.toUid, status: d.status, createdAt: toTimestamp(d.createdAt), updatedAt: toTimestamp(d.updatedAt) },
      })
      return
    }

    // Reverse pending from target to caller → auto-accept
    const existingIn = await requestsRef
      .where('fromUid', '==', toUid)
      .where('toUid', '==', fromUid)
      .where('status', '==', 'pending')
      .limit(1)
      .get()

    if (!existingIn.empty) {
      const reverseDoc = existingIn.docs[0]
      const now = FieldValue.serverTimestamp()
      const batch = adminDb.batch()
      batch.update(reverseDoc.ref, { status: 'accepted', updatedAt: now })
      batch.set(adminDb.collection(USERS).doc(fromUid).collection('collaborators').doc(toUid), { uid: toUid, since: now, requestId: reverseDoc.id })
      batch.set(adminDb.collection(USERS).doc(toUid).collection('collaborators').doc(fromUid), { uid: fromUid, since: now, requestId: reverseDoc.id })
      await batch.commit()
      res.status(200).json({ status: 'ok', data: { status: 'already_connected' } })
      return
    }

    // Create new request
    const now = FieldValue.serverTimestamp()
    const docRef = await requestsRef.add({ fromUid, toUid, status: 'pending', createdAt: now, updatedAt: now })
    const created = await docRef.get()
    const d = created.data()!
    res.status(201).json({
      status: 'ok',
      data: { id: docRef.id, fromUid: d.fromUid, toUid: d.toUid, status: d.status, createdAt: toTimestamp(d.createdAt), updatedAt: toTimestamp(d.updatedAt) },
    })
  } catch (err) {
    next(err)
  }
}

// GET /api/users/me/collaboration-requests
// Returns pending requests where toUid === caller, enriched with sender profile.
export async function getCollaborationRequests(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const toUid = req.user!.uid
    const snap = await adminDb.collection(REQUESTS)
      .where('toUid', '==', toUid)
      .where('status', '==', 'pending')
      .get()

    const requests = await Promise.all(
      snap.docs.map(async (doc) => {
        const d = doc.data()
        const senderSnap = await adminDb.collection(USERS).doc(d.fromUid).get()
        const sender = senderSnap.data() as UserProfile
        const senderResult: UserSearchResult = {
          uid: sender.uid,
          displayName: sender.displayName,
          affiliation: sender.affiliation,
          role: sender.role,
        }
        return {
          id: doc.id,
          fromUid: d.fromUid,
          toUid: d.toUid,
          status: d.status,
          createdAt: toTimestamp(d.createdAt),
          updatedAt: toTimestamp(d.updatedAt),
          sender: senderResult,
        }
      }),
    )

    // Sort by createdAt desc in memory (avoid needing composite index)
    requests.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))

    res.status(200).json({ status: 'ok', data: requests })
  } catch (err) {
    next(err)
  }
}

// POST /api/users/me/collaboration-requests/:requestId/accept
export async function acceptCollaborationRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const callerUid = req.user!.uid
    const { requestId } = req.params

    const docRef = adminDb.collection(REQUESTS).doc(requestId)
    const snap = await docRef.get()
    if (!snap.exists) return next(notFound('Request not found'))

    const d = snap.data()!
    if (d.toUid !== callerUid) return next(forbidden('Not authorized'))
    if (d.status !== 'pending') return next(badRequest(`Request is already ${d.status}`))

    const now = FieldValue.serverTimestamp()
    const batch = adminDb.batch()
    batch.update(docRef, { status: 'accepted', updatedAt: now })
    batch.set(adminDb.collection(USERS).doc(callerUid).collection('collaborators').doc(d.fromUid), { uid: d.fromUid, since: now, requestId })
    batch.set(adminDb.collection(USERS).doc(d.fromUid).collection('collaborators').doc(callerUid), { uid: callerUid, since: now, requestId })
    await batch.commit()

    res.status(200).json({ status: 'ok' })
  } catch (err) {
    next(err)
  }
}

// POST /api/users/me/collaboration-requests/:requestId/decline
export async function declineCollaborationRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const callerUid = req.user!.uid
    const { requestId } = req.params

    const docRef = adminDb.collection(REQUESTS).doc(requestId)
    const snap = await docRef.get()
    if (!snap.exists) return next(notFound('Request not found'))

    const d = snap.data()!
    if (d.toUid !== callerUid) return next(forbidden('Not authorized'))
    if (d.status !== 'pending') return next(badRequest(`Request is already ${d.status}`))

    await docRef.update({ status: 'declined', updatedAt: FieldValue.serverTimestamp() })
    res.status(200).json({ status: 'ok' })
  } catch (err) {
    next(err)
  }
}

// GET /api/users/me/collaborators
export async function listCollaborators(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid
    const snap = await adminDb.collection(USERS).doc(uid).collection('collaborators').get()

    const collaborators = await Promise.all(
      snap.docs.map(async (doc) => {
        const entry = doc.data()
        const profileSnap = await adminDb.collection(USERS).doc(entry.uid).get()
        const profile = profileSnap.data() as UserProfile
        return {
          uid: profile.uid,
          displayName: profile.displayName,
          affiliation: profile.affiliation,
          role: profile.role,
          since: toTimestamp(entry.since),
        }
      }),
    )

    collaborators.sort((a, b) => (b.since ?? '').localeCompare(a.since ?? ''))
    res.status(200).json({ status: 'ok', data: collaborators })
  } catch (err) {
    next(err)
  }
}

// GET /api/users/:uid/relationship
// Returns relationship state between the caller and the target user.
export async function getRelationship(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const callerUid = req.user!.uid
    const targetUid = req.params.uid

    if (callerUid === targetUid) {
      res.status(200).json({ status: 'ok', data: { isCollaborator: false, pendingRequestId: null, pendingDirection: null } })
      return
    }

    // Check if already collaborators
    const colSnap = await adminDb.collection(USERS).doc(callerUid).collection('collaborators').doc(targetUid).get()
    if (colSnap.exists) {
      res.status(200).json({ status: 'ok', data: { isCollaborator: true, pendingRequestId: null, pendingDirection: null } })
      return
    }

    // Check pending outgoing
    const outSnap = await adminDb.collection(REQUESTS)
      .where('fromUid', '==', callerUid)
      .where('toUid', '==', targetUid)
      .where('status', '==', 'pending')
      .limit(1)
      .get()
    if (!outSnap.empty) {
      res.status(200).json({ status: 'ok', data: { isCollaborator: false, pendingRequestId: outSnap.docs[0].id, pendingDirection: 'outgoing' } })
      return
    }

    // Check pending incoming
    const inSnap = await adminDb.collection(REQUESTS)
      .where('fromUid', '==', targetUid)
      .where('toUid', '==', callerUid)
      .where('status', '==', 'pending')
      .limit(1)
      .get()
    if (!inSnap.empty) {
      res.status(200).json({ status: 'ok', data: { isCollaborator: false, pendingRequestId: inSnap.docs[0].id, pendingDirection: 'incoming' } })
      return
    }

    res.status(200).json({ status: 'ok', data: { isCollaborator: false, pendingRequestId: null, pendingDirection: null } })
  } catch (err) {
    next(err)
  }
}
