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
