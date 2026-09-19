import { Router } from 'express';
import {
  getAdminStats,
  getAllUsers,
  updateUserRole,
  toggleVerifyStudent,
  deleteUser,
  deleteAnyPost,
  triggerExpiredPostsCleanup,
} from '../controllers/admin.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/role.middleware';

const router = Router();

// Protect all admin routes with authentication and admin privilege
router.use(verifyToken, requireAdmin);

router.get('/stats', getAdminStats);
router.get('/users', getAllUsers);
router.put('/users/:userId/role', updateUserRole);
router.put('/users/:userId/verify', toggleVerifyStudent);
router.delete('/users/:userId', deleteUser);
router.delete('/posts/:postId', deleteAnyPost);
router.post('/cleanup-expired-posts', triggerExpiredPostsCleanup);

export default router;
