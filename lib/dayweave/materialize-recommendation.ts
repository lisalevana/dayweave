import type {
  DayRecommendationBundle,
  RecommendationAttribution,
  RecommendationDayThread,
  RecommendedStopBrief,
} from "../schemas/evidence";

import { optimizeDay } from "./optimizer";
import type {
  OptimizationInput,
  OptimizationResult,
  Pace,
  Place,
  TravelMatrix,
  TravelOption,
} from "./types";

const DEFAULT_START_MINUTE = 9 * 60 + 30;
const DEFAULT_END_MINUTE = 20 * 60 + 30;
const DEFAULT_VISIT_MINUTES = 60;
const SEQUENCE_BUFFER_MINUTES = 20;

export type JourneyEstimateBasis =
  | "geographic_estimate"
  | "curated_sequence_estimate";

export interface RecommendationJourneyInsight {
  label: string;
  summary: string;
  worthKnowing: string;
  sourceName: string;
  sourceUrl: string;
}

export interface RecommendationJourneyContext {
  dayNumber: number;
  areaLabel: string;
  estimateBasis: JourneyEstimateBasis;
  warnings: string[];
  insightsByPlaceId: Record<string, RecommendationJourneyInsight>;
}

export interface MaterializedRecommendationDay
  extends RecommendationJourneyContext {
  destination: string;
  routeBasis: RecommendationDayThread["basis"];
  attribution: RecommendationAttribution;
  input: OptimizationInput;
  plan: OptimizationResult;
}

export interface MaterializeRecommendationDayOptions {
  date?: string;
  timezone?: string;
  startMinute?: number;
  endMinute?: number;
  pace?: Pace;
  maxWalkingKm?: number;
}

interface MatrixNode {
  id: string;
  routeIndex: number;
  latitude?: number;
  longitude?: number;
}

/**
 * Turns one sourced recommendation thread into an input the deterministic live
 * engine can replan. It deliberately does not infer opening hours, bookings or
 * timing constraints that are absent from the recommendation source.
 */
export function materializeRecommendationDay(
  bundle: DayRecommendationBundle,
  dayNumber: number,
  options: MaterializeRecommendationDayOptions = {},
): MaterializedRecommendationDay {
  const day = bundle.routePlan.days.find(
    (candidate) => candidate.dayNumber === dayNumber,
  );
  if (!day) {
    throw new Error(`Recommendation day ${dayNumber} is not available.`);
  }

  const briefById = new Map(
    bundle.orderedBriefs.map((brief) => [brief.placeId, brief]),
  );
  const briefs = day.stopIds.map((placeId) => {
    const brief = briefById.get(placeId);
    if (!brief) {
      throw new Error(
        `Recommendation day ${dayNumber} refers to unknown stop ${placeId}.`,
      );
    }
    return brief;
  });
  const savedPlaceIds = new Set(bundle.savedPlaceIds);
  const hasSavedPlace = briefs.some((brief) =>
    savedPlaceIds.has(brief.placeId),
  );
  const places: Place[] = briefs.map((brief, index) => ({
    id: brief.placeId,
    name: brief.placeName,
    area: brief.mapsArea ?? day.areaLabel,
    priority:
      savedPlaceIds.has(brief.placeId) || (!hasSavedPlace && index === 0)
        ? "must"
        : "love",
    durationMinutes: DEFAULT_VISIT_MINUTES,
    openingWindows: [],
    source: savedPlaceIds.has(brief.placeId)
      ? "user"
      : "approved_discovery",
  }));

  const startLocationId = uniqueVirtualLocationId(
    `dayweave-day-${dayNumber}-start`,
    day.stopIds,
  );
  const endLocationId = uniqueVirtualLocationId(
    `dayweave-day-${dayNumber}-end`,
    [...day.stopIds, startLocationId],
  );
  const hasVerifiedCoordinates = briefs.every(hasCoordinates);
  const estimateBasis: JourneyEstimateBasis = hasVerifiedCoordinates
    ? "geographic_estimate"
    : "curated_sequence_estimate";
  const travelMatrix = hasVerifiedCoordinates
    ? buildGeographicMatrix(
        briefs as Array<
          RecommendedStopBrief & { latitude: number; longitude: number }
        >,
        startLocationId,
        endLocationId,
      )
    : buildSequenceMatrix(briefs, startLocationId, endLocationId);

  const input: OptimizationInput = {
    places,
    travelMatrix,
    day: {
      date: options.date ?? "unscheduled",
      timezone: options.timezone ?? "floating",
      startLocationId,
      endLocationId,
      startMinute: options.startMinute ?? DEFAULT_START_MINUTE,
      endMinute: options.endMinute ?? DEFAULT_END_MINUTE,
      pace: options.pace ?? "balanced",
      maxWalkingKm: options.maxWalkingKm ?? 4,
      allowedModes: ["walk", "transit"],
    },
  };
  const firstEvidenceByPlaceId = new Map(
    briefs.map((brief) => [brief.placeId, brief.evidence[0]]),
  );
  const insightsByPlaceId = Object.fromEntries(
    briefs.map((brief) => {
      const evidence = firstEvidenceByPlaceId.get(brief.placeId);
      return [
        brief.placeId,
        {
          label: `Don’t miss here · ${brief.placeName}`,
          summary: brief.dontMiss,
          worthKnowing: brief.worthKnowing,
          sourceName: evidence?.sourceName ?? bundle.attribution.label,
          sourceUrl: evidence?.sourceUrl ?? bundle.attribution.url,
        },
      ];
    }),
  );
  const warnings =
    estimateBasis === "geographic_estimate"
      ? [
          "Travel times are geographic planning estimates, not live routing. Check Maps for current directions, transit and traffic.",
          "The schedule begins at the first stop and ends at the last; Maps handles getting there and onward travel.",
          "No opening hours, bookings or timed-entry constraints were inferred.",
        ]
      : [
          `Travel between stops uses ${SEQUENCE_BUFFER_MINUTES}-minute route-order planning estimates because verified coordinates are incomplete. These are not live ETAs; check Maps for current directions and travel time.`,
          "The schedule begins at the first stop and ends at the last; Maps handles getting there and onward travel.",
          "No opening hours, bookings or timed-entry constraints were inferred.",
        ];

  return {
    destination: bundle.destination,
    dayNumber: day.dayNumber,
    areaLabel: day.areaLabel,
    routeBasis: day.basis,
    attribution: bundle.attribution,
    input,
    plan: optimizeDay(input),
    estimateBasis,
    warnings,
    insightsByPlaceId,
  };
}

function hasCoordinates(
  brief: RecommendedStopBrief,
): brief is RecommendedStopBrief & {
  latitude: number;
  longitude: number;
} {
  return brief.latitude !== undefined && brief.longitude !== undefined;
}

function buildGeographicMatrix(
  briefs: Array<
    RecommendedStopBrief & { latitude: number; longitude: number }
  >,
  startLocationId: string,
  endLocationId: string,
): TravelMatrix {
  const first = briefs[0];
  const last = briefs.at(-1) as (typeof briefs)[number];
  const nodes: MatrixNode[] = [
    {
      id: startLocationId,
      routeIndex: 0,
      latitude: first.latitude,
      longitude: first.longitude,
    },
    ...briefs.map((brief, index) => ({
      id: brief.placeId,
      routeIndex: index + 1,
      latitude: brief.latitude,
      longitude: brief.longitude,
    })),
    {
      id: endLocationId,
      routeIndex: briefs.length + 1,
      latitude: last.latitude,
      longitude: last.longitude,
    },
  ];

  return completeMatrix(nodes, geographicOptions);
}

function buildSequenceMatrix(
  briefs: RecommendedStopBrief[],
  startLocationId: string,
  endLocationId: string,
): TravelMatrix {
  const nodes: MatrixNode[] = [
    { id: startLocationId, routeIndex: 1 },
    ...briefs.map((brief, index) => ({
      id: brief.placeId,
      routeIndex: index + 1,
    })),
    { id: endLocationId, routeIndex: briefs.length },
  ];

  return completeMatrix(nodes, sequenceOptions);
}

function completeMatrix(
  nodes: MatrixNode[],
  optionsFor: (from: MatrixNode, to: MatrixNode) => readonly TravelOption[],
): TravelMatrix {
  return Object.fromEntries(
    nodes.map((from) => [
      from.id,
      Object.fromEntries(
        nodes.map((to) => [to.id, optionsFor(from, to)]),
      ),
    ]),
  );
}

function geographicOptions(
  from: MatrixNode,
  to: MatrixNode,
): readonly TravelOption[] {
  if (from.id === to.id) {
    return [zeroTravelOption("geographic_estimate")];
  }

  const distanceKm = haversineKm(from, to);
  if (distanceKm < 0.01) {
    return [zeroTravelOption("geographic_estimate")];
  }

  const walkingDistanceKm = distanceKm * 1.22;
  const walkingMinutes = Math.max(
    3,
    Math.ceil(walkingDistanceKm / 0.075),
  );
  const transitMinutes = Math.max(8, Math.ceil(distanceKm / 0.28) + 8);
  const transitWalkingKm = Math.min(
    0.65,
    Math.max(0.15, distanceKm * 0.1 + 0.12),
  );

  return [
    {
      mode: "walk",
      minutes: walkingMinutes,
      walkingKm: round(walkingDistanceKm),
      distanceKm: round(walkingDistanceKm),
      source: "geographic_estimate",
    },
    {
      mode: "transit",
      minutes: transitMinutes,
      walkingKm: round(transitWalkingKm),
      distanceKm: round(distanceKm * 1.12),
      source: "geographic_estimate",
    },
  ];
}

function sequenceOptions(
  from: MatrixNode,
  to: MatrixNode,
): readonly TravelOption[] {
  if (from.id === to.id) {
    return [zeroTravelOption("curated_sequence_estimate")];
  }
  const routeHops = Math.abs(from.routeIndex - to.routeIndex);
  if (routeHops === 0) {
    return [zeroTravelOption("curated_sequence_estimate")];
  }
  return [
    {
      mode: "transit",
      minutes: routeHops * SEQUENCE_BUFFER_MINUTES,
      walkingKm: 0,
      distanceKm: 0,
      source: "curated_sequence_estimate",
    },
  ];
}

function zeroTravelOption(
  source: JourneyEstimateBasis,
): TravelOption {
  return {
    mode: "walk",
    minutes: 0,
    walkingKm: 0,
    distanceKm: 0,
    source,
  };
}

function haversineKm(from: MatrixNode, to: MatrixNode): number {
  const earthRadiusKm = 6_371;
  const fromLatitude = degreesToRadians(from.latitude as number);
  const toLatitude = degreesToRadians(to.latitude as number);
  const latitudeDelta = degreesToRadians(
    (to.latitude as number) - (from.latitude as number),
  );
  const longitudeDelta = degreesToRadians(
    (to.longitude as number) - (from.longitude as number),
  );
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number): number {
  return value * (Math.PI / 180);
}

function uniqueVirtualLocationId(
  preferredId: string,
  existingIds: readonly string[],
): string {
  const existing = new Set(existingIds);
  let id = preferredId;
  let suffix = 2;
  while (existing.has(id)) {
    id = `${preferredId}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
