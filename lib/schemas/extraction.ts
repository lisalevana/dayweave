import { z } from "zod";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpe?g|webp|gif);base64,/i;

export const IsoDateSchema = z
  .string()
  .regex(ISO_DATE_PATTERN, "Use an ISO calendar date (YYYY-MM-DD).")
  .refine(
    (value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)),
    "Date must exist on the calendar.",
  );

export const ClockTimeSchema = z
  .string()
  .regex(CLOCK_TIME_PATTERN, "Use a 24-hour time (HH:mm).")
  .nullable();

export const ExtractionConfidenceSchema = z.enum([
  "high",
  "medium",
  "low",
  "unknown",
]);

export const PriorityIntentSchema = z.enum([
  "must_visit",
  "would_love",
  "only_if_convenient",
  "unconfirmed",
]);

export const ExtractedPlaceSchema = z
  .object({
    sourceIndex: z.number().int().nonnegative(),
    sourceText: z.string(),
    normalizedName: z.string(),
    aliases: z.array(z.string()),
    priorityIntent: PriorityIntentSchema,
    appearsNonNegotiable: z.boolean(),
    hasFixedBooking: z.boolean(),
    note: z.string().nullable(),
    confidence: ExtractionConfidenceSchema,
    requiresConfirmation: z.boolean(),
  })
  .strict();

export const ExtractedBookingSchema = z
  .object({
    placeName: z.string(),
    date: IsoDateSchema.nullable(),
    startTime: ClockTimeSchema,
    endTime: ClockTimeSchema,
    confirmationCode: z.string().nullable(),
    sourceText: z.string(),
    confidence: ExtractionConfidenceSchema,
    requiresConfirmation: z.boolean(),
  })
  .strict();

export const SemanticConstraintSchema = z
  .object({
    kind: z.enum([
      "near_sunset",
      "before",
      "after",
      "first",
      "last",
      "time_window",
      "avoid_carrying",
      "other",
    ]),
    placeName: z.string().nullable(),
    value: z.string().nullable(),
    sourceText: z.string(),
    confidence: ExtractionConfidenceSchema,
    requiresConfirmation: z.boolean(),
  })
  .strict();

export const WishlistExtractionSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    city: z.string().nullable(),
    citySupport: z.enum(["hong_kong", "outside_mvp", "unknown"]),
    travelDate: IsoDateSchema.nullable(),
    places: z.array(ExtractedPlaceSchema).max(20),
    bookings: z.array(ExtractedBookingSchema).max(10),
    startLocation: z.string().nullable(),
    endLocation: z.string().nullable(),
    walkingComfort: z.enum([
      "minimal",
      "moderate",
      "comfortable_with_more",
      "unknown",
    ]),
    pace: z.enum(["relaxed", "balanced", "packed", "unknown"]),
    semanticConstraints: z.array(SemanticConstraintSchema).max(20),
    unresolvedItems: z.array(z.string()).max(20),
    confirmationPrompts: z.array(z.string()).max(20),
  })
  .strict()
  .superRefine((value, context) => {
    const indexes = new Set<number>();

    value.places.forEach((place, index) => {
      if (indexes.has(place.sourceIndex)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each extracted place needs a unique sourceIndex.",
          path: ["places", index, "sourceIndex"],
        });
      }
      indexes.add(place.sourceIndex);

      if (place.appearsNonNegotiable && place.priorityIntent !== "must_visit") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "A place described as non-negotiable must use the must_visit intent.",
          path: ["places", index, "priorityIntent"],
        });
      }
    });
  });

export const ExtractionRequestSchema = z
  .object({
    text: z.string().trim().max(20_000).nullable(),
    imageDataUrl: z
      .string()
      .max(12_000_000, "Screenshot is too large for this demo endpoint.")
      .regex(
        IMAGE_DATA_URL_PATTERN,
        "Screenshot must be a PNG, JPEG, WebP, or GIF data URL.",
      )
      .nullable(),
    sourceKind: z.enum([
      "plain_text",
      "notes",
      "maps_links",
      "booking",
      "screenshot",
      "mixed",
    ]),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.text && !value.imageDataUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add wishlist text or a screenshot to extract.",
        path: ["text"],
      });
    }
  });

export const ExtractionEnvelopeSchema = z
  .object({
    mode: z.enum(["live_ai", "local_rules", "seeded_demo"]),
    isLiveAnalysis: z.boolean(),
    model: z.string().nullable(),
    extraction: WishlistExtractionSchema,
  })
  .strict();

export type ExtractionRequest = z.infer<typeof ExtractionRequestSchema>;
export type WishlistExtraction = z.infer<typeof WishlistExtractionSchema>;
export type ExtractionEnvelope = z.infer<typeof ExtractionEnvelopeSchema>;
