import { Router } from 'express';
import {
  register,
  login,
  googleLogin,
  getMe,
  updateProfile,
  logout,
} from '../controllers/auth.controller';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  updateProfileSchema,
} from '../validations/auth.validation';
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.post('/google', validateRequest(googleAuthSchema), googleLogin);
router.get('/me', verifyToken, getMe);
router.put(
  '/profile',
  verifyToken,
  validateRequest(updateProfileSchema),
  updateProfile
);
router.post('/logout', logout);

export default router;
