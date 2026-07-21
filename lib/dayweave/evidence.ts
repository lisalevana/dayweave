import {
  ExperienceClaimSchema,
  isClaimEligibleForScheduling,
  type ExperienceClaim,
} from "../schemas/evidence";
import { parseTime } from "./time";
import type { Place, PlanReason, TimeWindow } from "./types";

const MAX_SCHEDULING_EVIDENCE_AGE_DAYS = 365;

export function validateExperienceClaim(value: unknown) {
  return ExperienceClaimSchema.safeParse(value);
}

export function isEvidenceFresh(
  claim: Pick<ExperienceClaim, "lastCheckedDate">,
  asOfDate: string,
  maximumAgeDays = MAX_SCHEDULING_EVIDENCE_AGE_DAYS,
): boolean {
  const checked = isoDateToEpoch(claim.lastCheckedDate);
  const asOf = isoDateToEpoch(asOfDate);
  if (checked === null || asOf === null || checked > asOf) return false;
  return (asOf - checked) / 86_400_000 <= maximumAgeDays;
}

export function claimCanAffectOptimization(
  claim: ExperienceClaim,
  asOfDate: string,
): boolean {
  return (
    isClaimEligibleForScheduling(claim) &&
    isEvidenceFresh(claim, asOfDate) &&
    parseTimingWindow(claim.timingEvidence.constraintValue) !== null
  );
}

export function applyEvidenceConstraints(
  places: Place[],
  claims: ExperienceClaim[],
  asOfDate: string,
): { places: Place[]; reasons: PlanReason[] } {
  const nextPlaces = places.map((place) => ({
    ...place,
    openingWindows: place.openingWindows.map((window) => ({ ...window })),
    timingConstraints: place.timingConstraints?.map((constraint) => ({
      ...constraint,
      window: { ...constraint.window },
    })),
  }));
  const reasons: PlanReason[] = [];

  for (const claim of claims) {
    const place = nextPlaces.find((candidate) => claimMatchesPlace(claim, candidate));
    const window = parseTimingWindow(claim.timingEvidence.constraintValue);
    if (!place || !window || !claimCanAffectOptimization(claim, asOfDate)) {
      reasons.push({
        code: "WEAK_EVIDENCE_IGNORED",
        placeId: place?.id,
        message:
          "This experience note stays visible, but its evidence is not strong and fresh enough to move the route.",
        details: { evidenceClaimId: claim.id },
      });
      continue;
    }

    const constraintId = `evidence:${claim.id}`;
    if (
      !place.timingConstraints?.some(
        (constraint) => constraint.id === constraintId,
      )
    ) {
      place.timingConstraints = [
        ...(place.timingConstraints ?? []),
        {
          id: constraintId,
          kind: "verified_experience",
          window,
          label: claim.claim,
          evidenceClaimId: claim.id,
        },
      ];
    }
    reasons.push({
      code: "VERIFIED_EVIDENCE_APPLIED",
      placeId: place.id,
      message: `Verified timing evidence was applied to ${place.name}.`,
      details: { evidenceClaimId: claim.id },
    });
  }

  return { places: nextPlaces, reasons };
}

export function parseTimingWindow(value: string | null): TimeWindow | null {
  if (!value) return null;
  const match = /^(\d{1,2}:\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2})$/i.exec(
    value.trim(),
  );
  if (!match) return null;

  try {
    const start = parseTime(match[1]);
    const end = parseTime(match[2]);
    return start < end ? { start, end, label: "Verified evidence window" } : null;
  } catch {
    return null;
  }
}

function claimMatchesPlace(claim: ExperienceClaim, place: Place): boolean {
  const claimTarget = normalize(claim.placeOrArea);
  return claimTarget === normalize(place.id) || claimTarget === normalize(place.name);
}

function normalize(value: string): string {
  return value.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "");
}

function isoDateToEpoch(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const epoch = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(epoch) ? null : epoch;
}
