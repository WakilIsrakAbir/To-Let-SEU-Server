import { z } from 'zod';

const mediaItemSchema = z
  .object({
    url: z.string().optional(),
    publicId: z.string().optional(),
    sizeBytes: z.number().optional(),
  })
  .nullable()
  .optional();

const basePostFields = {
  title: z.string().optional().default('Bachelor Seat / Room'),
  department: z.string().optional().default('General'),
  contactNumber: z.string().optional().default('N/A'),
  whatsappNumber: z.string().optional().default(''),
  area: z.string().optional().default('Tejgaon (Near SEU Campus)'),
  addressDetails: z.string().optional().default('Near Campus Area'),
  distanceFromCampus: z.string().optional().default(''),

  rentType: z.enum(['fixed', 'negotiable']).optional().default('fixed'),
  rentAmount: z.number().optional().default(0),
  serviceChargeIncluded: z.boolean().optional().default(false),

  gender: z.enum(['Male', 'Female']).optional().default('Male'),
  availableFromMonth: z.string().optional().default('Immediate'),
  seatCount: z.number().optional().default(1),
  roomType: z
    .enum([
      '2 Person Room',
      '3 Person Room',
      'Single Room',
      'Sublet',
      'Shared Seat',
      'Master Bed',
    ])
    .optional()
    .default('2 Person Room'),

  description: z.string().optional().default(''),

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
    .optional()
    .default({}),

  location: z
    .object({
      lat: z.number().default(23.7639),
      lng: z.number().default(90.3995),
      formattedAddress: z.string().optional(),
    })
    .optional()
    .default({ lat: 23.7639, lng: 90.3995 }),

  media: z
    .object({
      images: z
        .array(mediaItemSchema)
        .max(5, 'Maximum of 5 images allowed')
        .optional()
        .default([]),
      video: mediaItemSchema.nullable().optional(),
    })
    .nullable()
    .optional()
    .default({ images: [] }),
};

export const createPostSchema = z.object(basePostFields).refine(
  (m) => {
    if (!m?.media?.images) return true;
    const exceedsImage = m.media.images.some(
      (img) => img?.sizeBytes && img.sizeBytes > 10 * 1024 * 1024
    );
    return !exceedsImage;
  },
  { message: 'One or more images exceed the maximum allowed size of 10MB' }
).refine(
  (m) => {
    if (!m?.media?.video) return true;
    if (m.media.video.sizeBytes && m.media.video.sizeBytes > 100 * 1024 * 1024) {
      return false;
    }
    return true;
  },
  { message: 'Video exceeds the maximum allowed size of 100MB' }
);

export const updatePostSchema = z
  .object({
    ...basePostFields,
    status: z.enum(['active', 'booked', 'archived']).optional(),
  })
  .partial();
