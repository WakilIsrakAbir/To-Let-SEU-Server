import { Router } from 'express';
import {
  register,
  login,
  getMe,
  updateProfile,
  logout,
} from '../controllers/auth.controller';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
} from '../validations/auth.validation';
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.get('/me', verifyToken, getMe);
router.put(
  '/profile',
  verifyToken,
  validateRequest(updateProfileSchema),
  updateProfile
);
router.post('/logout', logout);

export default router;
