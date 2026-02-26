import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { listMaterials, createMaterial, getMaterial, updateMaterial, bulkUpsertMaterials } from '../controllers/materialController'

const router = Router()

// Public
router.get('/', listMaterials)
router.get('/:id', getMaterial)

// Auth required
router.use(requireAuth)
router.post('/', createMaterial)

// Admin required
router.post('/bulk-upsert', requireAdmin, bulkUpsertMaterials)
router.patch('/:id', requireAdmin, updateMaterial)

export default router
