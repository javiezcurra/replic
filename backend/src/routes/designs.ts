import { Router } from 'express'
import { requireAuth, optionalAuth } from '../middleware/auth'
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
router.get('/:id', optionalAuth, getDesign)  // optionalAuth sets req.user so authors can view their drafts

// Auth required for all mutations and personal views
router.use(requireAuth)

router.get('/me/list', listMyDesigns)   // must come before /:id
router.post('/', createDesign)
router.patch('/:id', updateDesign)
router.post('/:id/publish', publishDesign)
router.post('/:id/fork', forkDesign)
router.delete('/:id', deleteDesign)

export default router
