import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { getLab, addToLab, removeFromLab } from '../controllers/labController'

const router = Router()

router.use(requireAuth)

router.get('/', getLab)
router.post('/:materialId', addToLab)
router.delete('/:materialId', removeFromLab)

export default router
