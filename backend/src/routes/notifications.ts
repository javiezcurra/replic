import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import {
  listNotifications,
  getUnreadCount,
  dismissNotification,
  dismissAll,
} from '../controllers/notificationController'

const router = Router()

// All notification endpoints require auth
router.use(requireAuth)

router.get('/', listNotifications)
router.get('/unread-count', getUnreadCount)
router.patch('/dismiss-all', dismissAll)
router.patch('/:id/dismiss', dismissNotification)

export default router
