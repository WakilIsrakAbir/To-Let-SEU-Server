import { Router } from 'express';
import {
  createPost,
  getPosts,
  getPostById,
  getMyPosts,
  updatePost,
  deletePost,
} from '../controllers/post.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  createPostSchema,
  updatePostSchema,
} from '../validations/post.validation';

const router = Router();

// Public routes
router.get('/', getPosts);
router.get('/detail/:id', getPostById);

// Protected routes
router.get('/my-posts', verifyToken, getMyPosts);
router.post('/', verifyToken, validateRequest(createPostSchema), createPost);
router.put('/:id', verifyToken, validateRequest(updatePostSchema), updatePost);
router.delete('/:id', verifyToken, deletePost);

export default router;
