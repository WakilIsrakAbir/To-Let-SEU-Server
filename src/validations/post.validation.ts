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
  title: z.string().optional(),
  department: z.string({ required_error: 'SEU Department is required' }).min(1, 'SEU Department is required'),
  contactNumber: z.string({ required_error: 'Contact phone is required' }).min(1, 'Contact phone is required'),
  whatsappNumber: z.string({ required_error: 'WhatsApp number is required' }).min(1, 'WhatsApp number is required'),
  area: z.string({ required_error: 'Area is required' }).min(1, 'Area is required'),
  addressDetails: z.string().optional().default('Near Campus Area'),
  distanceFromCampus: z.string().optional().default(''),

  rentType: z.enum(['fixed', 'negotiable']).optional().default('fixed'),
  rentAmount: z.coerce.number({ required_error: 'Rent amount is required' }).min(1, 'Rent amount must be greater than 0'),
  serviceChargeIncluded: z.boolean().optional().default(false),

  gender: z.enum(['Male', 'Female'], { required_error: 'Gender is required' }),
  availableFromMonth: z.string({ required_error: 'Available from month is required' }).min(1, 'Available month is required'),
  seatCount: z.coerce.number({ required_error: 'Seat count is required' }).min(1, 'At least 1 seat must be offered'),
  roomType: z
    .enum([
      'Single Room',
      '2 Person Room',
      '3 Person Room',
      'Sublet',
      'Shared Seat',
      'Master Bed',
    ], { required_error: 'Room type is required' }),

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
);

export const updatePostSchema = z
  .object({
    ...basePostFields,
    status: z.enum(['active', 'booked', 'archived']).optional(),
  })
  .partial();
