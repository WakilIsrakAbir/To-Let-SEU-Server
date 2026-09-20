import { z } from 'zod';

export const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z
    .string()
    .email('Please provide a valid email address')
    .regex(GMAIL_REGEX, 'Only valid @gmail.com accounts are permitted to register'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(10, 'Please provide a valid contact phone number'),
  department: z.enum([
    'CSE',
    'EEE',
    'BBA',
    'Textile Engineering',
    'English',
    'Law',
    'Pharmacy',
    'Economics',
    'Other',
  ]),
  studentId: z.string().optional(),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email('Please provide a valid email address')
    .regex(GMAIL_REGEX, 'Only valid @gmail.com accounts are permitted'),
  password: z.string().min(1, 'Password is required'),
});

export const googleAuthSchema = z.object({
  email: z
    .string()
    .email('Please provide a valid email address')
    .regex(GMAIL_REGEX, 'Only valid @gmail.com accounts are permitted'),
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
  googleId: z.string().optional(),
  department: z.string().optional(),
  studentId: z.string().optional(),
  phone: z.string().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(10).optional(),
  department: z.string().optional(),
  studentId: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

