import { Router } from 'express'
import { search } from '../controllers/searchController'

const router = Router()

// Public — no requireAuth
router.get('/', search)

export default router
