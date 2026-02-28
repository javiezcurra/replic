import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { listAllUsers, listAdmins, makeAdmin, revokeAdmin, listAllDesigns } from '../controllers/adminController'

const router = Router()

router.use(requireAuth, requireAdmin)

router.get('/users',                     listAllUsers)
router.get('/users/admins',              listAdmins)
router.patch('/users/:uid/make-admin',   makeAdmin)
router.patch('/users/:uid/revoke-admin', revokeAdmin)
router.get('/designs',                   listAllDesigns)

export default router
