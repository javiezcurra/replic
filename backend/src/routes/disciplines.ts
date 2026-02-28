import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth'
import {
  listDisciplines,
  createDiscipline,
  updateDiscipline,
  deleteDiscipline,
} from '../controllers/disciplineController'

const router = Router()

// Public
router.get('/', listDisciplines)

// Admin required
router.use(requireAuth)
router.post('/',     requireAdmin, createDiscipline)
router.patch('/:id', requireAdmin, updateDiscipline)
router.delete('/:id', requireAdmin, deleteDiscipline)

export default router
