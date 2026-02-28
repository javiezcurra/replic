import { Request, Response, NextFunction } from 'express'
import { adminDb } from '../lib/firebase'
import { AppError } from '../middleware/errorHandler'
import type { Notification, NotificationResponse } from '../types/notification'

function toResponse(n: Notification): NotificationResponse {
  return {
    ...n,
    created_at: n.created_at.toDate().toISOString(),
  }
}

function notificationsRef(uid: string) {
  return adminDb.collection('users').doc(uid).collection('notifications')
}

// GET /api/users/me/notifications
export async function listNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid
    const snap = await notificationsRef(uid)
      .orderBy('created_at', 'desc')
      .limit(100)
      .get()

    const data = snap.docs.map((d) => toResponse(d.data() as Notification))
    res.status(200).json({ status: 'ok', data, count: data.length })
  } catch (err) {
    next(err)
  }
}

// GET /api/users/me/notifications/unread-count
export async function getUnreadCount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid
    const snap = await notificationsRef(uid)
      .where('read', '==', false)
      .get()

    res.status(200).json({ status: 'ok', data: { count: snap.size } })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/users/me/notifications/:id/dismiss
export async function dismissNotification(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid
    const { id } = req.params

    const ref = notificationsRef(uid).doc(id)
    const snap = await ref.get()

    if (!snap.exists) {
      const err: AppError = new Error('Notification not found')
      err.statusCode = 404
      return next(err)
    }

    await ref.update({ read: true })
    res.status(200).json({ status: 'ok' })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/users/me/notifications/dismiss-all
export async function dismissAll(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid
    const snap = await notificationsRef(uid).where('read', '==', false).get()

    if (!snap.empty) {
      const batch = adminDb.batch()
      for (const doc of snap.docs) {
        batch.update(doc.ref, { read: true })
      }
      await batch.commit()
    }

    res.status(200).json({ status: 'ok', data: { dismissed: snap.size } })
  } catch (err) {
    next(err)
  }
}
