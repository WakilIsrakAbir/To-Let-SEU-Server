import { Router } from 'express';
import {
  getUploadSignature,
  deleteCloudinaryMedia,
} from '../controllers/media.controller';
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

router.get('/sign-upload', verifyToken, getUploadSignature);
router.post('/delete', verifyToken, deleteCloudinaryMedia);

export default router;
