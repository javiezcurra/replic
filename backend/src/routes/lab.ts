import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { getLab, addToLab, removeFromLab, getLabMatches } from '../controllers/labController'

const router = Router()

router.use(requireAuth)

router.get('/', getLab)
router.get('/matches', getLabMatches)   // must be before /:materialId
router.post('/:materialId', addToLab)
router.delete('/:materialId', removeFromLab)

export default router
