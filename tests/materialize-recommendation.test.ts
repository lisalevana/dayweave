import { describe, expect, it } from "vitest";

import { materializeRecommendationDay } from "../lib/dayweave/materialize-recommendation";
import { getTravelOptions } from "../lib/dayweave/optimizer";
import {
  applyLiveEvent,
  createLiveState,
} from "../lib/dayweave/replan";
import { DayRecommendationBundleSchema } from "../lib/schemas/evidence";
import type { OptimizationInput, TravelOption } from "../lib/dayweave/types";

const FIXED_OPTIONS = {
  date: "2026-10-17",
  timezone: "Asia/Singapore",
  startMinute: 9 * 60,
  endMinute: 18 * 60,
} as const;

function evidence(id: string) {
  return {
    id: `evidence-${id}`,
    claim: `${id} is supported by a destination source.`,
    sourceName: "Official destination guide",
    sourceUrl: `https://example.com/${id}`,
    sourceType: "official_tourism" as const,
    lastCheckedDate: "2026-07-24",
    license: null,
  };
}

function singleDayBundle({
  withCoordinates,
  routeBasis = withCoordinates
    ? "verified_locations"
    : "curated_sequence",
}: {
  withCoordinates: boolean;
  routeBasis?: "verified_locations" | "curated_sequence";
}) {
  return DayRecommendationBundleSchema.parse({
    schemaVersion: "1.0",
    destination: "Singapore",
    mode: "curated_local",
    headline: "A clear Singapore day",
    rationale: "History, the waterfront and the coast belong in one calm day.",
    savedPlaceIds: ["fort-canning-park", "east-coast-park"],
    serviceAddedPlaceIds: ["marina-bay-waterfront"],
    orderedBriefs: [
      {
        order: 1,
        placeId: "fort-canning-park",
        placeName: "Fort Canning Park",
        mapsArea: "Singapore",
        ...(withCoordinates
          ? { latitude: 1.2944, longitude: 103.8464 }
          : {}),
        origin: "saved",
        whyPeopleCome: "A historic green hill in the city.",
        dontMiss: "Visit the heritage gallery and Spice Garden.",
        worthKnowing: "Choose the accessible Cox Terrace approach if needed.",
        evidence: [evidence("fort-canning")],
      },
      {
        order: 2,
        placeId: "marina-bay-waterfront",
        placeName: "Marina Bay waterfront",
        mapsArea: "Singapore",
        ...(withCoordinates
          ? { latitude: 1.2834, longitude: 103.8607 }
          : {}),
        origin: "service_added",
        whyPeopleCome: "The defining waterfront skyline.",
        dontMiss: "Walk the sightline rather than stopping at one building.",
        worthKnowing: "Choose the station that serves the side you need.",
        evidence: [evidence("marina-bay")],
      },
      {
        order: 3,
        placeId: "east-coast-park",
        placeName: "East Coast Park",
        mapsArea: "Singapore",
        ...(withCoordinates
          ? { latitude: 1.3008, longitude: 103.9122 }
          : {}),
        origin: "saved",
        whyPeopleCome: "A long coastal park used by locals.",
        dontMiss: "Pair the waterfront path with the lagoon food village.",
        worthKnowing: "Choose a specific meeting point because the park is long.",
        evidence: [evidence("east-coast")],
      },
    ],
    unresolvedWishlistItems: [],
    branchResolutions: [],
    routePlan: {
      basis: routeBasis,
      summary: "One Singapore day in sourced order.",
      days: [
        {
          dayNumber: 1,
          areaLabel: "Singapore",
          title: "Singapore day",
          rationale: "Move from the historic centre to the bay and coast.",
          stopIds: [
            "fort-canning-park",
            "marina-bay-waterfront",
            "east-coast-park",
          ],
          basis: routeBasis,
        },
      ],
    },
    attribution: {
      label: "Official destination guide",
      url: "https://example.com/singapore",
      license: null,
    },
  });
}

function multiDayBundle() {
  return DayRecommendationBundleSchema.parse({
    schemaVersion: "1.0",
    destination: "Seoul",
    mode: "curated_local",
    headline: "Suwon and Seoul without backtracking",
    rationale: "Keep the Suwon wishes together before a separate Seoul day.",
    savedPlaceIds: [
      "samsung-innovation-museum-suwon",
      "starfield-library-suwon",
      "jamsil-hangang-ramyeon",
    ],
    serviceAddedPlaceIds: [],
    orderedBriefs: [
      {
        order: 1,
        placeId: "samsung-innovation-museum-suwon",
        placeName: "Samsung Innovation Museum · Suwon",
        mapsArea: "Suwon",
        origin: "saved",
        whyPeopleCome: "A technology museum inside Samsung Digital City.",
        dontMiss: "Reserve before travelling to Suwon.",
        worthKnowing: "This stop is outside Seoul.",
        evidence: [evidence("samsung")],
      },
      {
        order: 2,
        placeId: "starfield-library-suwon",
        placeName: "Starfield Library · Suwon",
        mapsArea: "Suwon",
        origin: "saved",
        whyPeopleCome: "A large public library inside Starfield Suwon.",
        dontMiss: "Look up through the multi-storey book walls.",
        worthKnowing: "Use the Suwon branch, not COEX.",
        evidence: [evidence("starfield")],
      },
      {
        order: 3,
        placeId: "jamsil-hangang-ramyeon",
        placeName: "Jamsil Hangang Park ramyeon picnic",
        mapsArea: "Seoul",
        origin: "saved",
        whyPeopleCome: "A relaxed riverside ritual.",
        dontMiss: "Use the self-service ramyeon cooking machine.",
        worthKnowing: "Weather can change the experience.",
        evidence: [evidence("hangang")],
      },
    ],
    unresolvedWishlistItems: [],
    branchResolutions: [],
    routePlan: {
      basis: "verified_locations",
      summary: "Two area-based days prevent Suwon–Seoul–Suwon backtracking.",
      days: [
        {
          dayNumber: 1,
          areaLabel: "Suwon",
          title: "Suwon day",
          rationale: "Keep both Suwon wishes in one day.",
          stopIds: [
            "samsung-innovation-museum-suwon",
            "starfield-library-suwon",
          ],
          basis: "verified_locations",
        },
        {
          dayNumber: 2,
          areaLabel: "Seoul",
          title: "Seoul day",
          rationale: "Keep the Hangang stop in Seoul.",
          stopIds: ["jamsil-hangang-ramyeon"],
          basis: "verified_locations",
        },
      ],
    },
    attribution: {
      label: "Official destination guides",
      url: "https://example.com/seoul",
      license: null,
    },
  });
}

function matrixOptions(input: OptimizationInput): TravelOption[] {
  const ids = [
    input.day.startLocationId,
    ...input.places.map((place) => place.id),
    input.day.endLocationId,
  ];
  const options: TravelOption[] = [];

  for (const fromId of ids) {
    for (const toId of ids) {
      if (fromId === toId) continue;
      const candidates = getTravelOptions(input, fromId, toId);
      expect(
        candidates.length,
        `expected a travel estimate from ${fromId} to ${toId}`,
      ).toBeGreaterThan(0);
      options.push(...candidates);
    }
  }

  return options;
}

describe("recommendation-day materialization", () => {
  it("builds a feasible coordinate-backed day with a complete deterministic matrix", () => {
    const bundle = singleDayBundle({ withCoordinates: true });
    const first = materializeRecommendationDay(bundle, 1, FIXED_OPTIONS);
    const repeated = materializeRecommendationDay(bundle, 1, FIXED_OPTIONS);

    expect(repeated).toEqual(first);
    expect(repeated.plan.fingerprint).toBe(first.plan.fingerprint);
    expect(first).toMatchObject({
      dayNumber: 1,
      areaLabel: "Singapore",
      estimateBasis: "geographic_estimate",
      plan: {
        feasible: true,
        metrics: { selectedCount: 3 },
      },
    });
    expect(first.input.places.map((place) => place.id)).toEqual([
      "fort-canning-park",
      "marina-bay-waterfront",
      "east-coast-park",
    ]);
    expect(first.plan.itinerary.map((stop) => stop.placeId)).toEqual([
      "fort-canning-park",
      "marina-bay-waterfront",
      "east-coast-park",
    ]);
    expect(first.input.day.startLocationId).not.toBe("sheung-wan-start");
    expect(first.input.day.endLocationId).not.toBe("jordan-hotel-end");
    expect(new Set(matrixOptions(first.input).map((option) => option.source))).toEqual(
      new Set(["geographic_estimate"]),
    );
  });

  it("uses truthful sequence estimates when coordinates are unavailable", () => {
    const bundle = singleDayBundle({ withCoordinates: false });
    const materialized = materializeRecommendationDay(
      bundle,
      1,
      FIXED_OPTIONS,
    );

    expect(materialized.estimateBasis).toBe("curated_sequence_estimate");
    expect(materialized.plan.feasible).toBe(true);
    expect(
      new Set(matrixOptions(materialized.input).map((option) => option.source)),
    ).toEqual(new Set(["curated_sequence_estimate"]));
    expect(
      materialized.warnings.join(" "),
    ).toMatch(/planning estimate|estimated/i);
    expect(materialized.warnings.join(" ")).toMatch(/Maps/i);
  });

  it("keeps saved wishes protected while service additions remain optional", () => {
    const materialized = materializeRecommendationDay(
      singleDayBundle({ withCoordinates: false }),
      1,
      FIXED_OPTIONS,
    );
    const priorities = Object.fromEntries(
      materialized.input.places.map((place) => [place.id, place.priority]),
    );

    expect(priorities).toEqual({
      "fort-canning-park": "must",
      "marina-bay-waterfront": "love",
      "east-coast-park": "must",
    });
    expect(materialized.input.places.every(
      (place) => place.openingWindows.length === 0,
    )).toBe(true);
    expect(materialized.plan.metrics.mustVisitProtectedCount).toBe(2);
  });

  it("materializes each multi-day thread without leaking stops across areas", () => {
    const bundle = multiDayBundle();
    const suwon = materializeRecommendationDay(bundle, 1, {
      ...FIXED_OPTIONS,
      timezone: "Asia/Seoul",
    });
    const seoul = materializeRecommendationDay(bundle, 2, {
      ...FIXED_OPTIONS,
      timezone: "Asia/Seoul",
    });

    expect(suwon.areaLabel).toBe("Suwon");
    expect(suwon.input.places.map((place) => place.id)).toEqual([
      "samsung-innovation-museum-suwon",
      "starfield-library-suwon",
    ]);
    expect(suwon.plan.itinerary).toHaveLength(2);
    expect(suwon.plan.itinerary).not.toContainEqual(
      expect.objectContaining({ placeId: "jamsil-hangang-ramyeon" }),
    );

    expect(seoul.areaLabel).toBe("Seoul");
    expect(seoul.input.places.map((place) => place.id)).toEqual([
      "jamsil-hangang-ramyeon",
    ]);
    expect(seoul.plan.itinerary.map((stop) => stop.placeId)).toEqual([
      "jamsil-hangang-ramyeon",
    ]);
    expect(seoul.input.places).not.toContainEqual(
      expect.objectContaining({ id: "starfield-library-suwon" }),
    );
  });

  it("preserves a completed generic stop through a delay and remaining-day replan", () => {
    const materialized = materializeRecommendationDay(
      singleDayBundle({ withCoordinates: false }),
      1,
      FIXED_OPTIONS,
    );
    const firstStop = materialized.plan.itinerary[0];
    const initial = createLiveState(materialized.input, materialized.plan);
    const completed = applyLiveEvent(initial, {
      type: "complete",
      placeId: firstStop.placeId,
    });

    expect(completed.accepted).toBe(true);
    const completedSnapshot = structuredClone(completed.state.completedStops);
    const delayed = applyLiveEvent(completed.state, {
      type: "delay",
      minutes: 40,
    });

    expect(delayed.accepted).toBe(true);
    expect(delayed.state.completedStops).toEqual(completedSnapshot);
    expect(delayed.state.currentMinute).toBe(
      completed.state.currentMinute + 40,
    );
    expect(delayed.state.currentPlan.itinerary).not.toContainEqual(
      expect.objectContaining({ placeId: firstStop.placeId }),
    );
    expect(delayed.reasons).toContainEqual(
      expect.objectContaining({ code: "DELAY_APPLIED" }),
    );
    expect(delayed.reasons).toContainEqual(
      expect.objectContaining({ code: "REPLAN_REMAINING_ONLY" }),
    );
  });
});
