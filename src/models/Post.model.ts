import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IMediaItem {
  url: string;
  publicId: string;
  sizeBytes?: number;
}

export interface IPostDocument extends Document {
  title: string;
  author: mongoose.Types.ObjectId;
  department: string;
  contactNumber: string;
  whatsappNumber?: string;
  area: string;
  addressDetails: string;
  distanceFromCampus?: string;

  rentType: 'fixed' | 'negotiable';
  rentAmount: number;
  serviceChargeIncluded: boolean;

  gender: 'Male' | 'Female';
  availableFromMonth: string;
  seatCount: number;
  roomType: '2 Person Room' | '3 Person Room' | 'Single Room' | 'Sublet' | 'Shared Seat' | 'Master Bed';

  description: string;

  amenities: {
    khalaMaid: boolean;
    fridge: boolean;
    wifi: boolean;
    attachedBath: boolean;
    balcony: boolean;
    generatorIPS: boolean;
    lift: boolean;
    filterWater: boolean;
  };

  location: {
    lat: number;
    lng: number;
    formattedAddress?: string;
  };

  media: {
    images: IMediaItem[];
    video?: IMediaItem;
  };

  status: 'active' | 'booked' | 'archived';
  viewsCount: number;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MediaItemSchema = new Schema<IMediaItem>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    sizeBytes: { type: Number },
  },
  { _id: false }
);

const PostSchema = new Schema<IPostDocument>(
  {
    title: {
      type: String,
      default: 'Bachelor Seat / Room',
      trim: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    department: {
      type: String,
      default: 'General',
    },
    contactNumber: {
      type: String,
      default: 'N/A',
    },
    whatsappNumber: {
      type: String,
      default: '',
    },
    area: {
      type: String,
      default: 'Tejgaon (Near SEU Campus)',
      trim: true,
    },
    addressDetails: {
      type: String,
      default: 'Near Campus Area',
    },
    distanceFromCampus: {
      type: String,
      default: '',
    },
    rentType: {
      type: String,
      enum: ['fixed', 'negotiable'],
      default: 'fixed',
    },
    rentAmount: {
      type: Number,
      min: [0, 'Rent amount cannot be negative'],
      default: 0,
    },
    serviceChargeIncluded: {
      type: Boolean,
      default: false,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female'],
      default: 'Male',
    },
    availableFromMonth: {
      type: String,
      default: 'Immediate',
    },
    seatCount: {
      type: Number,
      min: [1, 'At least 1 seat must be offered'],
      default: 1,
    },
    roomType: {
      type: String,
      enum: [
        '2 Person Room',
        '3 Person Room',
        'Single Room',
        'Sublet',
        'Shared Seat',
        'Master Bed',
      ],
      default: '2 Person Room',
    },
    description: {
      type: String,
      default: '',
    },
    amenities: {
      khalaMaid: { type: Boolean, default: false },
      fridge: { type: Boolean, default: false },
      wifi: { type: Boolean, default: false },
      attachedBath: { type: Boolean, default: false },
      balcony: { type: Boolean, default: false },
      generatorIPS: { type: Boolean, default: false },
      lift: { type: Boolean, default: false },
      filterWater: { type: Boolean, default: false },
    },
    location: {
      lat: { type: Number, default: 23.7639 }, // Default SEU Tejgaon Campus coordinates
      lng: { type: Number, default: 90.3995 },
      formattedAddress: { type: String },
    },
    media: {
      images: {
        type: [MediaItemSchema],
        validate: [
          (val: IMediaItem[]) => val.length <= 5,
          'You can upload a maximum of 5 images',
        ],
        default: [],
      },
      video: {
        type: MediaItemSchema,
      },
    },
    status: {
      type: String,
      enum: ['active', 'booked', 'archived'],
      default: 'active',
    },
    viewsCount: {
      type: Number,
      default: 0,
    },
    featured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast searching, sorting and filtering
PostSchema.index({ status: 1, createdAt: -1 });
PostSchema.index({ status: 1, area: 1 });
PostSchema.index({ author: 1 });
PostSchema.index({ area: 1, gender: 1, rentAmount: 1, createdAt: -1 });
PostSchema.index({ title: 'text', description: 'text', area: 'text' });

export const Post: Model<IPostDocument> = mongoose.model<IPostDocument>(
  'Post',
  PostSchema
);
