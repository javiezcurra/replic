import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import {
  createDesign,
  listDesigns,
  listMyDesigns,
  getDesign,
  updateDesign,
  publishDesign,
  forkDesign,
  deleteDesign,
} from '../controllers/designController'

const router = Router()

// Public — no auth required
router.get('/', listDesigns)
router.get('/:id', getDesign)    // drafts return 404 to unauthenticated callers

// Auth required for all mutations and personal views
router.use(requireAuth)

router.get('/me/list', listMyDesigns)   // must come before /:id
router.post('/', createDesign)
router.patch('/:id', updateDesign)
router.post('/:id/publish', publishDesign)
router.post('/:id/fork', forkDesign)
router.delete('/:id', deleteDesign)

export default router
