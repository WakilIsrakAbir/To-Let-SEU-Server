import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'user' | 'moderator' | 'admin';

export interface IUserDocument extends Document {
  name: string;
  email: string;
  password?: string;
  phone: string;
  department: string;
  studentId?: string;
  avatarUrl: string;
  role: UserRole;
  isVerifiedStudent: boolean;
  authProvider: 'local' | 'google';
  googleId?: string;
  status: 'active' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
  comparePassword(enteredPassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@gmail\.com$/i,
        'Only valid @gmail.com accounts are permitted',
      ],
    },
    password: {
      type: String,
      required: function (this: IUserDocument) {
        return this.authProvider === 'local';
      },
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'SEU Department is required'],
      enum: [
        'CSE',
        'EEE',
        'BBA',
        'Textile Engineering',
        'English',
        'Law',
        'Pharmacy',
        'Economics',
        'Other',
      ],
      default: 'CSE',
    },
    studentId: {
      type: String,
      trim: true,
    },
    avatarUrl: {
      type: String,
      default:
        'https://res.cloudinary.com/demo/image/upload/v1689246197/cld-sample.jpg',
    },
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user',
    },
    isVerifiedStudent: {
      type: Boolean,
      default: false,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    googleId: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (
  enteredPassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

export const User: Model<IUserDocument> = mongoose.model<IUserDocument>(
  'User',
  UserSchema
);
