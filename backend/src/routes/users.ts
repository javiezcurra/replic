import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { upsertMe, getMe, updateMe, getUser } from '../controllers/userController'

const router = Router()

// All /api/users routes require a valid Firebase ID token
router.use(requireAuth)

// Own profile
router.post('/me', upsertMe)    // create or sync on sign-in
router.get('/me', getMe)        // get full profile
router.patch('/me', updateMe)   // update editable fields

// Public profiles
router.get('/:id', getUser)

export default router
