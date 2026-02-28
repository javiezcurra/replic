import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import {
  getExecution,
  updateExecution,
  cancelExecution,
} from '../controllers/executionController'

const router = Router()

router.use(requireAuth)

router.get('/:id',    getExecution)
router.patch('/:id',  updateExecution)
router.delete('/:id', cancelExecution)

export default router
