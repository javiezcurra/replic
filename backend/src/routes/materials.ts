import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { listMaterials, createMaterial, getMaterial } from '../controllers/materialController'

const router = Router()

// Public
router.get('/', listMaterials)
router.get('/:id', getMaterial)

// Auth required
router.use(requireAuth)
router.post('/', createMaterial)

export default router
