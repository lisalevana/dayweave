import { describe, expect, it } from "vitest";

import {
  HONG_KONG_DEMO_DELAY_MINUTES,
  applyDiscoveryDecision,
  applyEvidenceConstraints,
  applyLiveEvent,
  buildRecoveryChoices,
  claimCanAffectOptimization,
  createLiveState,
  discoveryPendingReason,
  hongKongDemoInput,
  hongKongPlaces,
  hongKongTravelMatrix,
  isEvidenceFresh,
  minute,
  optimizeDay,
  parseTimingWindow,
  simulateFortyMinuteDelay,
  upperLascarRowSuggestion,
  validateExperienceClaim,
  type ExperienceClaim,
  type OptimizationInput,
} from "../lib/dayweave";

function demoInput(): OptimizationInput {
  return structuredClone(hongKongDemoInput);
}

function completeFirstStop() {
  const input = demoInput();
  const initial = createLiveState(input);
  const first = initial.currentPlan.itinerary[0];
  const completed = applyLiveEvent(initial, {
    type: "complete",
    placeId: first.placeId,
  });
  expect(completed.accepted).toBe(true);
  return { input, initial, first, completed: completed.state };
}

describe("Hong Kong seeded demo", () => {
  it("contains the complete, offline-capable nine-place constraint set", () => {
    expect(hongKongPlaces).toHaveLength(9);
    expect(hongKongPlaces.filter((place) => place.priority === "must")).toHaveLength(
      3,
    );
    expect(
      hongKongPlaces.filter((place) => place.priority === "convenient").length,
    ).toBeGreaterThanOrEqual(2);
    expect(hongKongPlaces.filter((place) => place.fixedBooking)).toHaveLength(1);
    expect(
      hongKongPlaces.find((place) => place.id === "victoria-peak")
        ?.timingConstraints?.[0]?.kind,
    ).toBe("sunset");
    expect(
      hongKongPlaces.find((place) => place.id === "temple-street-market")
        ?.shoppingLast,
    ).toBe(true);
    expect(HONG_KONG_DEMO_DELAY_MINUTES).toBe(40);

    const nodeIds = Object.keys(hongKongTravelMatrix);
    expect(nodeIds).toContain("sheung-wan-start");
    expect(nodeIds).toContain("jordan-hotel-end");
    expect(nodeIds).toContain("upper-lascar-row");
    for (const fromId of nodeIds) {
      for (const toId of nodeIds) {
        expect(hongKongTravelMatrix[fromId][toId]).toBeDefined();
        if (fromId !== toId) {
          expect(
            hongKongTravelMatrix[fromId][toId].map((option) => option.mode),
          ).toEqual(["walk", "transit"]);
        }
      }
    }
  });

  it("protects must-visits, the fixed booking, sunset, walking comfort and shopping-last", () => {
    const input = demoInput();
    const result = optimizeDay(input);
    const ids = result.itinerary.map((stop) => stop.placeId);
    const booking = result.itinerary.find(
      (stop) => stop.placeId === "maks-noodle",
    );
    const sunset = result.itinerary.find(
      (stop) => stop.placeId === "victoria-peak",
    );

    expect(result.feasible).toBe(true);
    expect(result.metrics.selectedCount).toBe(7);
    expect(result.metrics.mustVisitProtectedCount).toBe(3);
    expect(ids).toEqual(
      expect.arrayContaining([
        "man-mo-temple",
        "tai-kwun",
        "victoria-peak",
      ]),
    );
    expect(booking?.startMinute).toBe(minute(12, 30));
    expect(booking?.endMinute).toBe(minute(13, 30));
    expect(sunset?.startMinute).toBeGreaterThanOrEqual(minute(17, 10));
    expect(sunset?.endMinute).toBeLessThanOrEqual(minute(18, 35));
    expect(result.metrics.walkingKm).toBeLessThanOrEqual(
      input.day.maxWalkingKm,
    );
    expect(ids.at(-1)).toBe("temple-street-market");
    expect(result.legs[0].fromId).toBe(input.day.startLocationId);
    expect(result.legs.at(-1)?.toId).toBe(input.day.endLocationId);
  });

  it("respects every opening window and visit duration in the selected route", () => {
    const input = demoInput();
    const result = optimizeDay(input);

    for (const stop of result.itinerary) {
      const place = input.places.find((candidate) => candidate.id === stop.placeId)!;
      expect(stop.endMinute - stop.startMinute).toBeGreaterThanOrEqual(
        place.durationMinutes,
      );
      expect(
        place.openingWindows.some(
          (window) =>
            stop.startMinute >= window.start && stop.endMinute <= window.end,
        ),
      ).toBe(true);
    }
  });
});

describe("deterministic prize-collecting optimizer", () => {
  it("returns byte-for-byte equivalent results for identical input", () => {
    const input = demoInput();
    const first = optimizeDay(input);
    const second = optimizeDay(structuredClone(input));

    expect(second).toEqual(first);
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it("defers optional places with calm, honest reason codes", () => {
    const result = optimizeDay(demoInput());

    expect(result.status).toBe("partial");
    expect(result.deferred.map((place) => place.placeId).sort()).toEqual([
      "mid-levels-escalator",
      "star-ferry-central",
    ]);
    expect(result.deferred.every((place) => place.reasonCode.startsWith("OPTIONAL")))
      .toBe(true);
    expect(result.deferred.every((place) => /saved|waiting/i.test(place.message))).toBe(
      true,
    );
  });

  it("never silently moves or removes a fixed booking", () => {
    const feasible = optimizeDay(demoInput());
    const booking = feasible.itinerary.find(
      (stop) => stop.placeId === "maks-noodle",
    );
    expect(booking).toMatchObject({
      startMinute: minute(12, 30),
      endMinute: minute(13, 30),
      fixedBooking: true,
    });

    const impossible = demoInput();
    impossible.day.startMinute = minute(12, 31);
    const result = optimizeDay(impossible);
    expect(result.status).toBe("infeasible");
    expect(result.itinerary).toEqual([]);
    expect(result.reasons).toContainEqual(
      expect.objectContaining({
        code: "FIXED_BOOKING_INFEASIBLE",
        placeId: "maks-noodle",
      }),
    );
  });

  it("reports an impossible required set instead of pretending it fits", () => {
    const input = demoInput();
    const starFerry = input.places.find(
      (place) => place.id === "star-ferry-central",
    )!;
    starFerry.openingWindows = [{ start: minute(22), end: minute(23) }];
    input.policy = { requiredPlaceIds: [starFerry.id] };

    const result = optimizeDay(input);
    expect(result.feasible).toBe(false);
    expect(result.status).toBe("infeasible");
    expect(result.reasons).toContainEqual(
      expect.objectContaining({
        code: "REQUIRED_PLACE_INFEASIBLE",
        placeId: starFerry.id,
      }),
    );
  });

  it("reports an infeasible must-visit honestly while protecting the feasible ones", () => {
    const input = demoInput();
    const peak = input.places.find((place) => place.id === "victoria-peak")!;
    peak.timingConstraints = [
      {
        id: "impossible-sunset",
        kind: "sunset",
        label: "An impossible test window",
        window: { start: minute(8), end: minute(8, 30) },
      },
    ];

    const result = optimizeDay(input);
    expect(result.feasible).toBe(true);
    expect(result.status).toBe("partial");
    expect(result.deferred).toContainEqual(
      expect.objectContaining({
        placeId: "victoria-peak",
        reasonCode: "MUST_VISIT_INFEASIBLE",
      }),
    );
    expect(result.metrics.mustVisitProtectedCount).toBe(2);
  });
});

describe("remaining-day live repair", () => {
  it("applies the demo delay to only the unfinished day", () => {
    const { completed, first } = completeFirstStop();
    const completedSnapshot = structuredClone(completed.completedStops);
    const delayed = simulateFortyMinuteDelay(completed);

    expect(delayed.accepted).toBe(true);
    expect(delayed.state.currentMinute).toBe(
      completed.currentMinute + HONG_KONG_DEMO_DELAY_MINUTES,
    );
    expect(delayed.state.completedStops).toEqual(completedSnapshot);
    expect(delayed.state.currentPlan.itinerary).not.toContainEqual(
      expect.objectContaining({ placeId: first.placeId }),
    );
    expect(delayed.reasons).toContainEqual(
      expect.objectContaining({ code: "REPLAN_REMAINING_ONLY" }),
    );
    // Stops saved before live mode never reappear without a traveller choice.
    expect(
      delayed.state.currentPlan.itinerary.some((stop) =>
        ["mid-levels-escalator", "star-ferry-central"].includes(stop.placeId),
      ),
    ).toBe(false);
    expect(
      delayed.state.currentPlan.itinerary.find(
        (stop) => stop.placeId === "maks-noodle",
      )?.startMinute,
    ).toBe(minute(12, 30));
  });

  it("offers two different, valid and explicit recovery outcomes", () => {
    const { completed } = completeFirstStop();
    const delayed = applyLiveEvent(completed, { type: "delay", minutes: 40 });
    const choices = buildRecoveryChoices(delayed.state);
    const protect = choices.find((choice) => choice.id === "protect_moments")!;
    const keep = choices.find((choice) => choice.id === "keep_every_stop")!;

    expect(protect.valid).toBe(true);
    expect(keep.valid).toBe(true);
    expect(protect.state.currentPlan.fingerprint).not.toBe(
      keep.state.currentPlan.fingerprint,
    );
    expect(
      protect.state.currentPlan.itinerary.some((stop) => stop.placeId === "pmq"),
    ).toBe(false);
    expect(
      keep.state.currentPlan.itinerary.some((stop) => stop.placeId === "pmq"),
    ).toBe(true);
    expect(keep.state.sourceInput.day.pace).toBe("packed");
    expect(keep.reasons).toContainEqual(
      expect.objectContaining({ code: "RECOVERY_KEEP_EVERY_STOP" }),
    );
    for (const choice of choices) {
      expect(
        choice.state.currentPlan.itinerary.some(
          (stop) => stop.placeId === "victoria-peak",
        ),
      ).toBe(true);
      expect(
        choice.state.currentPlan.itinerary.find(
          (stop) => stop.placeId === "maks-noodle",
        )?.startMinute,
      ).toBe(minute(12, 30));
    }
  });

  it("creates protected rest time without changing completed moments", () => {
    const { completed } = completeFirstStop();
    const snapshot = structuredClone(completed.completedStops);
    const result = applyLiveEvent(completed, {
      type: "break",
      minutes: 30,
      label: "Tea and a quiet bench",
    });

    expect(result.accepted).toBe(true);
    expect(result.state.completedStops).toEqual(snapshot);
    expect(result.state.protectedBreaks).toEqual([
      {
        id: "break-2",
        startMinute: completed.currentMinute,
        endMinute: completed.currentMinute + 30,
        locationId: completed.currentLocationId,
        label: "Tea and a quiet bench",
      },
    ]);
    expect(result.state.currentPlan.feasible).toBe(true);
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "BREAK_PROTECTED" }),
    );
  });

  it("honours staying longer and returns a valid remaining-day replan", () => {
    const { completed, first } = completeFirstStop();
    const originalPlannedEnd = completed.completedStops[0].endMinute;
    const result = applyLiveEvent(completed, {
      type: "stay_longer",
      placeId: first.placeId,
      minutes: 15,
    });

    expect(result.accepted).toBe(true);
    expect(result.state.completedStops[0].endMinute).toBe(originalPlannedEnd);
    expect(result.state.completedStops[0].actualEndMinute).toBe(
      originalPlannedEnd + 15,
    );
    expect(result.state.currentPlan.feasible).toBe(true);
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "STAY_LONGER_HONORED" }),
    );
  });

  it("skips a place only after an explicit event and does not backfill silently", () => {
    const { completed } = completeFirstStop();
    const beforeIds = completed.currentPlan.itinerary.map((stop) => stop.placeId);
    expect(beforeIds).toContain("pmq");

    const result = applyLiveEvent(completed, { type: "skip", placeId: "pmq" });
    const afterIds = result.state.currentPlan.itinerary.map(
      (stop) => stop.placeId,
    );
    expect(result.accepted).toBe(true);
    expect(result.state.skippedPlaceIds).toContain("pmq");
    expect(afterIds).not.toContain("pmq");
    expect(afterIds).not.toContain("mid-levels-escalator");
    expect(afterIds).not.toContain("star-ferry-central");
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "SKIP_CONFIRMED", placeId: "pmq" }),
    );
  });
});

describe("user-led discovery", () => {
  it("keeps a discovery outside the route until explicit approval", () => {
    const state = createLiveState(demoInput());

    expect(
      state.currentPlan.itinerary.some(
        (stop) => stop.placeId === upperLascarRowSuggestion.place.id,
      ),
    ).toBe(false);
    expect(discoveryPendingReason(upperLascarRowSuggestion).code).toBe(
      "DISCOVERY_PENDING_APPROVAL",
    );

    const approved = applyDiscoveryDecision(
      state,
      upperLascarRowSuggestion,
      "add",
    );
    expect(approved.state.approvedDiscoveryIds).toContain(
      upperLascarRowSuggestion.place.id,
    );
    expect(
      approved.state.sourceInput.places.some(
        (place) => place.id === upperLascarRowSuggestion.place.id,
      ),
    ).toBe(true);
    expect(approved.reason.code).toBe("DISCOVERY_APPROVED");
  });

  it("leaves the optimized plan exactly unchanged when rejected", () => {
    const state = createLiveState(demoInput());
    const snapshot = structuredClone(state.currentPlan);
    const result = applyDiscoveryDecision(
      state,
      upperLascarRowSuggestion,
      "reject",
    );

    expect(result.changedPlan).toBe(false);
    expect(result.state.currentPlan).toEqual(snapshot);
    expect(result.state.currentPlan.fingerprint).toBe(snapshot.fingerprint);
    expect(result.state.rejectedDiscoveryIds).toContain("upper-lascar-row");
    expect(
      result.state.sourceInput.places.some(
        (place) => place.id === "upper-lascar-row",
      ),
    ).toBe(false);
  });
});

describe("experience-evidence scheduling guardrails", () => {
  const weakTimingClaim: ExperienceClaim = {
    id: "weak-pmq-timing",
    claim: "One isolated post said to go early.",
    placeOrArea: "PMQ",
    sourceUrl: "https://example.com/user-supplied-note",
    sourceType: "user_supplied",
    observationDate: "2026-06-01",
    lastCheckedDate: "2026-06-02",
    confidence: "low",
    recurrenceLevel: "emerging_recommendation",
    conflictingEvidence: [],
    canInfluenceScheduling: true,
    timingEvidence: {
      verification: "repeated_recent_reports",
      constraintKind: "availability_window",
      constraintValue: "08:00-09:00",
    },
  };

  const strongTimingClaim: ExperienceClaim = {
    id: "verified-pmq-window",
    claim: "A verified timed experience is available in this window.",
    placeOrArea: "PMQ",
    sourceUrl: "https://www.pmq.org.hk/",
    sourceType: "official_venue",
    observationDate: "2026-06-01",
    lastCheckedDate: "2026-06-02",
    confidence: "high",
    recurrenceLevel: "strong_recurring_visitor_favourite",
    conflictingEvidence: [],
    canInfluenceScheduling: true,
    timingEvidence: {
      verification: "official_schedule",
      constraintKind: "availability_window",
      constraintValue: "14:00-16:30",
    },
  };

  it("does not allow weak or conflicting evidence to affect optimization", () => {
    const places = structuredClone(hongKongPlaces);
    const before = structuredClone(
      places.find((place) => place.id === "pmq")?.timingConstraints,
    );
    const applied = applyEvidenceConstraints(
      places,
      [weakTimingClaim],
      "2026-10-17",
    );

    expect(claimCanAffectOptimization(weakTimingClaim, "2026-10-17")).toBe(
      false,
    );
    expect(
      applied.places.find((place) => place.id === "pmq")?.timingConstraints,
    ).toEqual(before);
    expect(applied.reasons).toContainEqual(
      expect.objectContaining({ code: "WEAK_EVIDENCE_IGNORED" }),
    );
  });

  it("applies only strong, fresh and parseable timing evidence", () => {
    expect(parseTimingWindow("14:00-16:30")).toMatchObject({
      start: minute(14),
      end: minute(16, 30),
    });
    expect(isEvidenceFresh(strongTimingClaim, "2026-10-17")).toBe(true);
    expect(claimCanAffectOptimization(strongTimingClaim, "2026-10-17")).toBe(
      true,
    );

    const applied = applyEvidenceConstraints(
      structuredClone(hongKongPlaces),
      [strongTimingClaim],
      "2026-10-17",
    );
    expect(
      applied.places
        .find((place) => place.id === "pmq")
        ?.timingConstraints?.at(-1),
    ).toMatchObject({
      id: `evidence:${strongTimingClaim.id}`,
      kind: "verified_experience",
      evidenceClaimId: strongTimingClaim.id,
      window: { start: minute(14), end: minute(16, 30) },
    });
    expect(applied.reasons).toContainEqual(
      expect.objectContaining({ code: "VERIFIED_EVIDENCE_APPLIED" }),
    );
  });

  it("requires every claim to include confidence and freshness", () => {
    const missingConfidenceAndFreshness = {
      ...strongTimingClaim,
      confidence: undefined,
      observationDate: undefined,
      lastCheckedDate: undefined,
    };
    expect(validateExperienceClaim(strongTimingClaim).success).toBe(true);
    expect(validateExperienceClaim(missingConfidenceAndFreshness).success).toBe(
      false,
    );
  });
});
