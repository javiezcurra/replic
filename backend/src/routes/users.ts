import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { upsertMe, getMe, updateMe, getUser, searchUsers } from '../controllers/userController'
import {
  sendCollaborationRequest,
  getCollaborationRequests,
  acceptCollaborationRequest,
  declineCollaborationRequest,
  listCollaborators,
  removeCollaborator,
  getRelationship,
} from '../controllers/collaboratorController'

const router = Router()

router.use(requireAuth)

// Own profile
router.post('/me', upsertMe)
router.get('/me', getMe)
router.patch('/me', updateMe)

// Own collaboration requests & collaborator list
// (registered before /:id to avoid route shadowing)
router.get('/me/collaboration-requests', getCollaborationRequests)
router.post('/me/collaboration-requests/:requestId/accept', acceptCollaborationRequest)
router.post('/me/collaboration-requests/:requestId/decline', declineCollaborationRequest)
router.get('/me/collaborators', listCollaborators)
router.delete('/me/collaborators/:uid', removeCollaborator)

// User search — must be before /:id
router.get('/search', searchUsers)

// Other users
router.get('/:uid/relationship', getRelationship)
router.post('/:uid/collaboration-requests', sendCollaborationRequest)
router.get('/:id', getUser)

export default router
