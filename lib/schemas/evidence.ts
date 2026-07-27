import { z } from "zod";

import { IsoDateSchema } from "./extraction";

export const EvidenceSourceTypeSchema = z.enum([
  "official_venue",
  "official_tourism",
  "user_supplied",
  "licensed_editorial",
  "manually_curated",
  "consented_post_visit",
]);

export const EvidenceConfidenceSchema = z.enum([
  "high",
  "medium",
  "low",
  "unknown",
]);

export const EvidenceRecurrenceSchema = z.enum([
  "destination_defining_local_classic",
  "strong_recurring_visitor_favourite",
  "currently_popular_experience",
  "personalized_preference_match",
  "emerging_recommendation",
  "mixed_or_conflicting",
  "unknown",
]);

export const TimingEvidenceSchema = z
  .object({
    verification: z.enum([
      "official_schedule",
      "repeated_recent_reports",
      "none",
    ]),
    constraintKind: z
      .enum(["sellout_risk", "event_time", "availability_window", "other"])
      .nullable(),
    constraintValue: z.string().nullable(),
  })
  .strict();

const EvidenceUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => value.startsWith("https://") || value.startsWith("http://"),
    "Evidence sources must use an HTTP(S) URL.",
  );

type SchedulingCandidate = {
  sourceType: z.infer<typeof EvidenceSourceTypeSchema>;
  confidence: z.infer<typeof EvidenceConfidenceSchema>;
  recurrenceLevel: z.infer<typeof EvidenceRecurrenceSchema>;
  conflictingEvidence: string[];
  timingEvidence: z.infer<typeof TimingEvidenceSchema>;
};

const SCHEDULING_SOURCE_TYPES = new Set<SchedulingCandidate["sourceType"]>([
  "official_venue",
  "official_tourism",
  "manually_curated",
  "consented_post_visit",
]);

const STRONG_RECURRENCE_LEVELS = new Set<
  SchedulingCandidate["recurrenceLevel"]
>([
  "destination_defining_local_classic",
  "strong_recurring_visitor_favourite",
]);

export type SchedulingEvidenceReason =
  | "eligible"
  | "confidence_not_high"
  | "recurrence_not_strong"
  | "conflicting_evidence"
  | "source_not_verified"
  | "timing_not_verified"
  | "timing_constraint_missing";

export function evaluateSchedulingEvidence(
  claim: SchedulingCandidate,
): { eligible: boolean; reasons: SchedulingEvidenceReason[] } {
  const reasons: SchedulingEvidenceReason[] = [];

  if (claim.confidence !== "high") {
    reasons.push("confidence_not_high");
  }
  if (!STRONG_RECURRENCE_LEVELS.has(claim.recurrenceLevel)) {
    reasons.push("recurrence_not_strong");
  }
  if (claim.conflictingEvidence.length > 0) {
    reasons.push("conflicting_evidence");
  }
  if (!SCHEDULING_SOURCE_TYPES.has(claim.sourceType)) {
    reasons.push("source_not_verified");
  }
  if (claim.timingEvidence.verification === "none") {
    reasons.push("timing_not_verified");
  }
  if (
    claim.timingEvidence.constraintKind === null ||
    claim.timingEvidence.constraintValue === null
  ) {
    reasons.push("timing_constraint_missing");
  }

  return reasons.length === 0
    ? { eligible: true, reasons: ["eligible"] }
    : { eligible: false, reasons };
}

export const ExperienceClaimSchema = z
  .object({
    id: z.string().min(1),
    claim: z.string().min(1),
    placeOrArea: z.string().min(1),
    sourceUrl: EvidenceUrlSchema,
    sourceType: EvidenceSourceTypeSchema,
    observationDate: IsoDateSchema,
    lastCheckedDate: IsoDateSchema,
    confidence: EvidenceConfidenceSchema,
    recurrenceLevel: EvidenceRecurrenceSchema,
    conflictingEvidence: z.array(z.string()),
    canInfluenceScheduling: z.boolean(),
    timingEvidence: TimingEvidenceSchema,
  })
  .strict()
  .superRefine((claim, context) => {
    if (claim.lastCheckedDate < claim.observationDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "lastCheckedDate cannot precede observationDate.",
        path: ["lastCheckedDate"],
      });
    }

    if (!claim.canInfluenceScheduling) {
      return;
    }

    const scheduling = evaluateSchedulingEvidence(claim);
    if (!scheduling.eligible) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unsafe scheduling evidence: ${scheduling.reasons.join(", ")}.`,
        path: ["canInfluenceScheduling"],
      });
    }
  });

export function isClaimEligibleForScheduling(
  claim: z.input<typeof ExperienceClaimSchema>,
): boolean {
  const parsed = ExperienceClaimSchema.safeParse(claim);
  return (
    parsed.success &&
    parsed.data.canInfluenceScheduling &&
    evaluateSchedulingEvidence(parsed.data).eligible
  );
}

export const EvidenceSectionSchema = z
  .object({
    heading: z.enum(["WHY PEOPLE COME", "DON’T MISS", "WORTH KNOWING"]),
    body: z.string().min(1),
    evidenceLabel: z.string().min(1),
    claim: ExperienceClaimSchema,
  })
  .strict();

export const DontMissHereBriefSchema = z
  .object({
    id: z.string().min(1),
    placeId: z.string().min(1),
    placeName: z.string().min(1),
    title: z.literal("Don’t Miss Here"),
    whyPeopleCome: EvidenceSectionSchema,
    dontMiss: EvidenceSectionSchema,
    worthKnowing: EvidenceSectionSchema,
  })
  .strict();

export const SuggestionRouteImpactSchema = z
  .object({
    visitMinutes: z.number().int().positive(),
    detourMinutes: z.number().int().nonnegative().nullable(),
    detourStatus: z.enum(["verified_demo_matrix", "requires_optimizer"]),
    displacementSummary: z.string().nullable(),
  })
  .strict()
  .superRefine((impact, context) => {
    if (
      impact.detourStatus === "requires_optimizer" &&
      impact.detourMinutes !== null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An unverified detour cannot include a minute estimate.",
        path: ["detourMinutes"],
      });
    }
  });

export const WorthWeavingSuggestionSchema = z
  .object({
    id: z.string().min(1),
    placeId: z.string().min(1),
    title: z.string().min(1),
    placeOrArea: z.string().min(1),
    whyRelevant: z.string().min(1),
    classification: z.enum([
      "local_classic",
      "recurring_visitor_favourite",
      "personal_interest_match",
      "emerging_recommendation",
    ]),
    routeImpact: SuggestionRouteImpactSchema,
    evidence: z.array(ExperienceClaimSchema).min(1),
    requiresExplicitApproval: z.literal(true),
  })
  .strict();

export const SuggestionDecisionSchema = z.enum([
  "add_to_my_day",
  "save_for_later",
  "no_thanks",
]);

export const RecommendationRequestSchema = z
  .object({
    destination: z.string().trim().min(1).max(120),
    rawWishlist: z.string().trim().max(20_000),
    savedPlaces: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(160),
            name: z.string().trim().min(1).max(240),
          })
          .strict(),
      )
      .max(30)
      .optional(),
  })
  .strict();

export const ServiceEvidenceSchema = z
  .object({
    id: z.string().min(1),
    claim: z.string().min(1),
    sourceName: z.string().min(1),
    sourceUrl: EvidenceUrlSchema,
    sourceType: EvidenceSourceTypeSchema,
    lastCheckedDate: IsoDateSchema,
    license: z.string().min(1).nullable(),
  })
  .strict();

export const RecommendedStopBriefSchema = z
  .object({
    order: z.number().int().positive(),
    placeId: z.string().min(1),
    placeName: z.string().min(1),
    mapsArea: z.string().trim().min(1).max(120).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    origin: z.enum(["saved", "service_added"]),
    whyPeopleCome: z.string().min(1),
    dontMiss: z.string().min(1),
    worthKnowing: z.string().min(1),
    evidence: z.array(ServiceEvidenceSchema).min(1),
  })
  .strict()
  .superRefine((brief, context) => {
    if (
      (brief.latitude === undefined) !==
      (brief.longitude === undefined)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A route location must include both latitude and longitude.",
        path:
          brief.latitude === undefined ? ["latitude"] : ["longitude"],
      });
    }
  });

export const BranchResolutionSchema = z
  .object({
    intent: z.string().min(1),
    selectedPlaceId: z.string().min(1),
    selectedPlaceName: z.string().min(1),
    matchKind: z.enum([
      "explicit",
      "same_complex",
      "contextual_area",
      "destination_default",
    ]),
    reason: z.string().min(1),
    alternative: z
      .object({
        placeId: z.string().min(1),
        placeName: z.string().min(1),
      })
      .strict()
      .nullable(),
  })
  .strict();

export const RecommendationDayThreadSchema = z
  .object({
    dayNumber: z.number().int().positive(),
    areaLabel: z.string().min(1),
    title: z.string().min(1),
    rationale: z.string().min(1),
    stopIds: z.array(z.string().min(1)).min(1),
    basis: z.enum(["verified_locations", "curated_sequence"]),
  })
  .strict();

export const RecommendationRoutePlanSchema = z
  .object({
    basis: z.enum(["verified_locations", "curated_sequence"]),
    summary: z.string().min(1),
    days: z.array(RecommendationDayThreadSchema).min(1).max(12),
  })
  .strict();

export const RecommendationAttributionSchema = z
  .object({
    label: z.string().min(1),
    url: EvidenceUrlSchema,
    license: z.string().min(1).nullable(),
  })
  .strict();

/**
 * The service-owned experience layer. It deliberately has no `note` field:
 * traveller notes remain on `Place`, while sourced recommendations live here.
 */
export const DayRecommendationBundleSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    destination: z.string().min(1),
    mode: z.enum(["curated_local", "wikivoyage"]),
    headline: z.string().min(1),
    rationale: z.string().min(1),
    savedPlaceIds: z.array(z.string().min(1)),
    serviceAddedPlaceIds: z.array(z.string().min(1)),
    orderedBriefs: z.array(RecommendedStopBriefSchema).min(3).max(12),
    unresolvedWishlistItems: z
      .array(z.string().trim().min(1).max(20_000))
      .max(20_000),
    branchResolutions: z.array(BranchResolutionSchema),
    routePlan: RecommendationRoutePlanSchema,
    attribution: RecommendationAttributionSchema,
  })
  .strict()
  .superRefine((bundle, context) => {
    const briefIds = bundle.orderedBriefs.map((brief) => brief.placeId);
    const uniqueBriefIds = new Set(briefIds);
    if (uniqueBriefIds.size !== briefIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Recommended stop IDs must be unique.",
        path: ["orderedBriefs"],
      });
    }

    bundle.orderedBriefs.forEach((brief, index) => {
      if (brief.order !== index + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Recommended stops must use consecutive one-based ordering.",
          path: ["orderedBriefs", index, "order"],
        });
      }
    });

    const routeStopIds = bundle.routePlan.days.flatMap(
      (day) => day.stopIds,
    );
    bundle.routePlan.days.forEach((day, index) => {
      if (day.dayNumber !== index + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Recommended day threads must use consecutive numbering.",
          path: ["routePlan", "days", index, "dayNumber"],
        });
      }
      if (new Set(day.stopIds).size !== day.stopIds.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A stop cannot repeat within a recommended day.",
          path: ["routePlan", "days", index, "stopIds"],
        });
      }
    });
    if (
      routeStopIds.length !== briefIds.length ||
      routeStopIds.some((id, index) => id !== briefIds[index])
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Flattened day-thread stops must exactly match the recommended stop order.",
        path: ["routePlan", "days"],
      });
    }
    if (new Set(routeStopIds).size !== routeStopIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A recommended stop can belong to only one day thread.",
        path: ["routePlan", "days"],
      });
    }
    if (
      bundle.routePlan.basis === "verified_locations" &&
      bundle.routePlan.days.some(
        (day) => day.basis !== "verified_locations",
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "A location-backed route plan requires verified locations for every day.",
        path: ["routePlan", "basis"],
      });
    }
    bundle.branchResolutions.forEach((resolution, index) => {
      if (!uniqueBriefIds.has(resolution.selectedPlaceId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "A branch resolution must refer to a selected recommendation.",
          path: ["branchResolutions", index, "selectedPlaceId"],
        });
      }
    });

    const normalizedUnresolvedItems = bundle.unresolvedWishlistItems.map(
      (item) => item.toLocaleLowerCase("en").replace(/\s+/g, " ").trim(),
    );
    if (
      new Set(normalizedUnresolvedItems).size !==
      normalizedUnresolvedItems.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unresolved wishlist items must be unique.",
        path: ["unresolvedWishlistItems"],
      });
    }

    const savedIds = new Set(bundle.savedPlaceIds);
    const serviceAddedIds = new Set(bundle.serviceAddedPlaceIds);
    if (savedIds.size !== bundle.savedPlaceIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Saved place IDs must be unique.",
        path: ["savedPlaceIds"],
      });
    }
    if (serviceAddedIds.size !== bundle.serviceAddedPlaceIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Service-added place IDs must be unique.",
        path: ["serviceAddedPlaceIds"],
      });
    }

    for (const id of savedIds) {
      if (serviceAddedIds.has(id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A stop cannot be both saved and service-added.",
          path: ["savedPlaceIds"],
        });
      }
    }

    bundle.orderedBriefs.forEach((brief, index) => {
      const inSaved = savedIds.has(brief.placeId);
      const inServiceAdded = serviceAddedIds.has(brief.placeId);
      if (!inSaved && !inServiceAdded) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Every recommended stop must be classified by origin.",
          path: ["orderedBriefs", index, "placeId"],
        });
      }
      if (
        (brief.origin === "saved" && !inSaved) ||
        (brief.origin === "service_added" && !inServiceAdded)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "The brief origin must match its classified ID list.",
          path: ["orderedBriefs", index, "origin"],
        });
      }
    });

    for (const id of [...savedIds, ...serviceAddedIds]) {
      if (!uniqueBriefIds.has(id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Classified place IDs must refer to a recommended stop.",
          path: ["savedPlaceIds"],
        });
      }
    }

    if (
      bundle.mode === "wikivoyage" &&
      !bundle.attribution.license?.includes("CC BY-SA")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Wikivoyage recommendations require visible CC BY-SA attribution.",
        path: ["attribution", "license"],
      });
    }
  });

export function suggestionCanEnterRoute(
  suggestion: z.input<typeof WorthWeavingSuggestionSchema>,
  decision: z.input<typeof SuggestionDecisionSchema>,
): boolean {
  return (
    WorthWeavingSuggestionSchema.safeParse(suggestion).success &&
    SuggestionDecisionSchema.safeParse(decision).success &&
    decision === "add_to_my_day"
  );
}

export type ExperienceClaim = z.infer<typeof ExperienceClaimSchema>;
export type DontMissHereBrief = z.infer<typeof DontMissHereBriefSchema>;
export type WorthWeavingSuggestion = z.infer<
  typeof WorthWeavingSuggestionSchema
>;
export type SuggestionDecision = z.infer<typeof SuggestionDecisionSchema>;
export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;
export type ServiceEvidence = z.infer<typeof ServiceEvidenceSchema>;
export type RecommendedStopBrief = z.infer<
  typeof RecommendedStopBriefSchema
>;
export type RecommendationAttribution = z.infer<
  typeof RecommendationAttributionSchema
>;
export type BranchResolution = z.infer<typeof BranchResolutionSchema>;
export type RecommendationDayThread = z.infer<
  typeof RecommendationDayThreadSchema
>;
export type RecommendationRoutePlan = z.infer<
  typeof RecommendationRoutePlanSchema
>;
export type DayRecommendationBundle = z.infer<
  typeof DayRecommendationBundleSchema
>;
