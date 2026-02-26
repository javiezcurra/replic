import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth'
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController'

const router = Router()

// Public
router.get('/', listCategories)

// Admin required
router.use(requireAuth)
router.post('/',    requireAdmin, createCategory)
router.patch('/:id',  requireAdmin, updateCategory)
router.delete('/:id', requireAdmin, deleteCategory)

export default router
