import { z } from 'zod';

const mediaItemSchema = z.object({
  url: z.string().url('Invalid media URL'),
  publicId: z.string().min(1, 'Media publicId is required'),
  sizeBytes: z.number().optional(),
});

export const createPostSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(150),
  department: z.string().min(2, 'Department is required'),
  contactNumber: z.string().min(10, 'Valid contact number is required'),
  whatsappNumber: z.string().optional(),
  area: z.string().min(2, 'Area is required'),
  addressDetails: z.string().min(5, 'Address details are required'),
  distanceFromCampus: z.string().optional(),

  rentType: z.enum(['fixed', 'negotiable']).default('fixed'),
  rentAmount: z.number().min(0, 'Rent cannot be negative'),
  serviceChargeIncluded: z.boolean().default(false),

  gender: z.enum(['Male', 'Female']),
  availableFromMonth: z.string().min(1, 'Available month is required'),
  seatCount: z.number().min(1, 'Seat count must be at least 1').default(1),
  roomType: z
    .enum(['Single Room', 'Shared Seat', 'Sublet', 'Master Bed'])
    .default('Shared Seat'),

  description: z.string().min(10, 'Description must be at least 10 characters'),

  amenities: z
    .object({
      khalaMaid: z.boolean().default(false),
      fridge: z.boolean().default(false),
      wifi: z.boolean().default(false),
      attachedBath: z.boolean().default(false),
      balcony: z.boolean().default(false),
      generatorIPS: z.boolean().default(false),
      lift: z.boolean().default(false),
      filterWater: z.boolean().default(false),
    })
    .default({}),

  location: z
    .object({
      lat: z.number().default(23.7639),
      lng: z.number().default(90.3995),
      formattedAddress: z.string().optional(),
    })
    .default({ lat: 23.7639, lng: 90.3995 }),

  media: z
    .object({
      images: z
        .array(mediaItemSchema)
        .max(5, 'Maximum of 5 images allowed')
        .default([]),
      video: mediaItemSchema.optional(),
    })
    .refine(
      (m) => {
        // Enforce max 10MB per image (10 * 1024 * 1024 = 10485760 bytes)
        const exceedsImage = m.images.some(
          (img) => img.sizeBytes && img.sizeBytes > 10 * 1024 * 1024
        );
        return !exceedsImage;
      },
      { message: 'One or more images exceed the maximum allowed size of 10MB' }
    )
    .refine(
      (m) => {
        // Enforce max 100MB for video (100 * 1024 * 1024 = 104857600 bytes)
        if (m.video?.sizeBytes && m.video.sizeBytes > 100 * 1024 * 1024) {
          return false;
        }
        return true;
      },
      { message: 'Video exceeds the maximum allowed size of 100MB' }
    ),
});

export const updatePostSchema = createPostSchema.partial();
