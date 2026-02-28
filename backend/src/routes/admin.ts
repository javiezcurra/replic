import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { listAllUsers, listAdmins, makeAdmin, revokeAdmin, listAllDesigns } from '../controllers/adminController'
import { listBundles, createBundle, updateBundle, deleteBundle } from '../controllers/bundleController'

const router = Router()

router.use(requireAuth, requireAdmin)

router.get('/users',                     listAllUsers)
router.get('/users/admins',              listAdmins)
router.patch('/users/:uid/make-admin',   makeAdmin)
router.patch('/users/:uid/revoke-admin', revokeAdmin)
router.get('/designs',                   listAllDesigns)

// Bundles
router.get('/bundles',        listBundles)
router.post('/bundles',       createBundle)
router.patch('/bundles/:id',  updateBundle)
router.delete('/bundles/:id', deleteBundle)

export default router
