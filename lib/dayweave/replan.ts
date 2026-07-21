import { optimizeDay } from "./optimizer";
import type {
  DiscoveryDecision,
  DiscoveryDecisionResult,
  DiscoverySuggestion,
  LiveDayState,
  LiveEvent,
  LiveReplanResult,
  OptimizationInput,
  OptimizationResult,
  Pace,
  PlaceId,
  PlanChange,
  PlanReason,
  ReasonCode,
  RecoveryChoice,
} from "./types";

const MAX_RECOVERY_EXTENSION_MINUTES = 240;
const RECOVERY_EXTENSION_STEP_MINUTES = 30;

export function createLiveState(
  input: OptimizationInput,
  plan: OptimizationResult = optimizeDay(input),
): LiveDayState {
  return {
    sourceInput: cloneInput(input),
    currentPlan: clonePlan(plan),
    completedStops: [],
    protectedBreaks: [],
    skippedPlaceIds: [],
    approvedDiscoveryIds: [],
    savedDiscoveryIds: [],
    rejectedDiscoveryIds: [],
    originallyPlannedPlaceIds: plan.itinerary.map((stop) => stop.placeId),
    currentMinute: input.day.startMinute,
    currentLocationId: input.day.startLocationId,
    revision: 0,
  };
}

export function applyLiveEvent(
  sourceState: LiveDayState,
  event: LiveEvent,
): LiveReplanResult {
  const state = cloneLiveState(sourceState);
  const previousPlan = clonePlan(sourceState.currentPlan);
  const eventReasons: PlanReason[] = [];
  let restChange: PlanChange | null = null;
  let stayedStopWasCompleted = false;

  switch (event.type) {
    case "complete": {
      const stop = state.currentPlan.itinerary.find(
        (candidate) => candidate.placeId === event.placeId,
      );
      if (!stop || state.currentPlan.itinerary[0]?.placeId !== event.placeId) {
        return rejectedEvent(sourceState, event, "Only the current next stop can be completed.");
      }
      const actualEndMinute = Math.max(
        stop.endMinute,
        event.actualEndMinute ?? stop.endMinute,
      );
      state.completedStops.push({ ...stop, actualEndMinute });
      state.currentMinute = actualEndMinute;
      state.currentLocationId = stop.placeId;
      eventReasons.push({
        code: "COMPLETED_STOP_PRESERVED",
        placeId: stop.placeId,
        message: `${stop.name} is complete and will not be changed by later replans.`,
      });
      break;
    }

    case "delay": {
      if (!Number.isFinite(event.minutes) || event.minutes <= 0) {
        return rejectedEvent(sourceState, event, "A delay must be longer than zero minutes.");
      }
      state.currentMinute += Math.round(event.minutes);
      eventReasons.push({
        code: "DELAY_APPLIED",
        message: `The remaining day was moved ${Math.round(event.minutes)} minutes later.`,
        details: { minutes: Math.round(event.minutes) },
      });
      break;
    }

    case "break": {
      if (!Number.isFinite(event.minutes) || event.minutes <= 0) {
        return rejectedEvent(sourceState, event, "A break must be longer than zero minutes.");
      }
      const duration = Math.round(event.minutes);
      const protectedBreak = {
        id: `break-${state.revision + 1}`,
        startMinute: state.currentMinute,
        endMinute: state.currentMinute + duration,
        locationId: state.currentLocationId,
        label: event.label?.trim() || "A guilt-free pause",
      };
      state.protectedBreaks.push(protectedBreak);
      state.currentMinute = protectedBreak.endMinute;
      eventReasons.push({
        code: "BREAK_PROTECTED",
        message: `${duration} minutes of rest are protected before the next decision.`,
        details: { minutes: duration },
      });
      restChange = {
        type: "rest_added",
        reasonCode: "BREAK_PROTECTED",
        message: `${duration} minutes of protected rest were added.`,
      };
      break;
    }

    case "stay_longer": {
      let completedIndex = state.completedStops.findIndex(
        (stop) => stop.placeId === event.placeId,
      );
      if (completedIndex < 0) {
        const currentStop = state.currentPlan.itinerary[0];
        if (currentStop?.placeId === event.placeId) {
          state.completedStops.push({
            ...currentStop,
            actualEndMinute: currentStop.endMinute,
          });
          completedIndex = state.completedStops.length - 1;
          state.currentLocationId = event.placeId;
          state.currentMinute = currentStop.endMinute;
          stayedStopWasCompleted = true;
        }
      }
      if (
        completedIndex < 0 ||
        state.currentLocationId !== event.placeId ||
        completedIndex !== state.completedStops.length - 1
      ) {
        return rejectedEvent(
          sourceState,
          event,
          "Stay longer is available at the place currently being enjoyed.",
        );
      }
      const completed = state.completedStops[completedIndex];
      completed.actualEndMinute += event.minutes;
      state.currentMinute += event.minutes;
      eventReasons.push({
        code: "STAY_LONGER_HONORED",
        placeId: event.placeId,
        message:
          "This is what the trip is for. The rest of the day has been reshaped around the extra time.",
        details: { minutes: event.minutes },
      });
      break;
    }

    case "skip": {
      if (state.completedStops.some((stop) => stop.placeId === event.placeId)) {
        return rejectedEvent(sourceState, event, "A completed stop cannot be skipped.");
      }
      if (!state.sourceInput.places.some((place) => place.id === event.placeId)) {
        return rejectedEvent(sourceState, event, "That destination is not part of this day.");
      }
      state.skippedPlaceIds = unique([...state.skippedPlaceIds, event.placeId]);
      const place = state.sourceInput.places.find(
        (candidate) => candidate.id === event.placeId,
      );
      eventReasons.push({
        code: place?.fixedBooking
          ? "FIXED_BOOKING_SKIP_CONFIRMED"
          : "SKIP_CONFIRMED",
        placeId: event.placeId,
        message: place?.fixedBooking
          ? `${place.name}'s booking was removed only because the traveller explicitly chose to skip it.`
          : `${place?.name ?? "The destination"} is saved for another day by choice.`,
      });
      break;
    }
  }

  const nextPlan = optimizeRemaining(state);
  state.currentPlan = nextPlan;
  state.revision += 1;
  const primaryReason = primaryReasonForEvent(event);
  const changes = comparePlans(previousPlan, nextPlan, primaryReason);
  if (event.type === "complete") {
    changes.unshift({
      placeId: event.placeId,
      type: "preserved",
      reasonCode: "COMPLETED_STOP_PRESERVED",
      message: "This completed moment is preserved exactly as it happened.",
    });
  }
  if (event.type === "stay_longer" && stayedStopWasCompleted) {
    changes.unshift({
      placeId: event.placeId,
      type: "preserved",
      reasonCode: "STAY_LONGER_HONORED",
      message: "The place being enjoyed is preserved with the extra time.",
    });
  }
  if (restChange) changes.unshift(restChange);

  const replanReason: PlanReason = {
    code: "REPLAN_REMAINING_ONLY",
    message: "Only destinations still ahead were recalculated.",
    details: { completedStopsPreserved: state.completedStops.length },
  };

  return {
    state,
    event,
    accepted: true,
    changes,
    reasons: [...eventReasons, replanReason, ...nextPlan.reasons],
  };
}

export function simulateFortyMinuteDelay(
  state: LiveDayState,
): LiveReplanResult {
  return applyLiveEvent(state, { type: "delay", minutes: 40 });
}

export function buildRecoveryChoices(state: LiveDayState): RecoveryChoice[] {
  const protectedState = cloneLiveState(state);
  const protectReason: PlanReason = {
    code: "RECOVERY_PROTECT_MOMENTS",
    message:
      "Keep must-visits, fixed bookings and verified timing windows; save lower-priority stops for another day when needed.",
  };
  const protectChoice: RecoveryChoice = {
    id: "protect_moments",
    title: "Protect the moments",
    description:
      "Keep the reservation and sunset safe, with a calm finish near the original time.",
    valid: protectedState.currentPlan.feasible,
    state: protectedState,
    changes: [],
    reasons: [protectReason, ...protectedState.currentPlan.reasons],
  };

  const completedIds = new Set(state.completedStops.map((stop) => stop.placeId));
  const skippedIds = new Set(state.skippedPlaceIds);
  const requiredRemaining = state.originallyPlannedPlaceIds.filter(
    (placeId) => !completedIds.has(placeId) && !skippedIds.has(placeId),
  );
  let keepPlan: OptimizationResult | null = null;
  let chosenEndMinute = state.sourceInput.day.endMinute;

  for (
    let extension = 0;
    extension <= MAX_RECOVERY_EXTENSION_MINUTES;
    extension += RECOVERY_EXTENSION_STEP_MINUTES
  ) {
    const candidateEnd = state.sourceInput.day.endMinute + extension;
    const input = remainingInput(state, {
      requiredPlaceIds: requiredRemaining,
      endMinute: candidateEnd,
      pace: "packed",
    });
    const candidate = optimizeDay(input);
    if (
      candidate.feasible &&
      requiredRemaining.every((placeId) =>
        candidate.itinerary.some((stop) => stop.placeId === placeId),
      )
    ) {
      keepPlan = candidate;
      chosenEndMinute = candidateEnd;
      break;
    }
  }

  const keepState = cloneLiveState(state);
  if (keepPlan) {
    keepState.currentPlan = keepPlan;
    keepState.sourceInput.day.endMinute = chosenEndMinute;
    keepState.sourceInput.day.pace = "packed";
    keepState.revision += 1;
  }
  const extensionMinutes = chosenEndMinute - state.sourceInput.day.endMinute;
  const keepReasons: PlanReason[] = [
    {
      code: "RECOVERY_KEEP_EVERY_STOP",
      message: keepPlan
        ? "Every previously chosen remaining stop is retained by using tighter transition buffers."
        : "Keeping every stop is not feasible without breaking a confirmed window.",
      details: keepPlan ? { pace: "packed" } : undefined,
    },
  ];
  if (keepPlan && extensionMinutes > 0) {
    keepReasons.push({
      code: "DAY_END_EXTENDED",
      message: `The day finishes about ${extensionMinutes} minutes later.`,
      details: { minutes: extensionMinutes },
    });
  }
  if (keepPlan) keepReasons.push(...keepPlan.reasons);

  const keepChoice: RecoveryChoice = {
    id: "keep_every_stop",
    title: "Keep every chosen stop",
    description: keepPlan
      ? extensionMinutes > 0
        ? `Use tighter transitions, keep the route and finish about ${extensionMinutes} minutes later.`
        : "Use tighter transition buffers to keep the full chosen route without extending the day."
      : "This path would break a confirmed time window, so it remains unavailable.",
    valid: Boolean(keepPlan),
    state: keepState,
    changes: keepPlan
      ? comparePlans(
          state.currentPlan,
          keepPlan,
          "RECOVERY_KEEP_EVERY_STOP",
        )
      : [],
    reasons: keepReasons,
  };

  return [protectChoice, keepChoice];
}

export function applyDiscoveryDecision(
  sourceState: LiveDayState,
  suggestion: DiscoverySuggestion,
  decision: DiscoveryDecision,
): DiscoveryDecisionResult {
  if (decision === "reject" || decision === "save") {
    const state = cloneLiveState(sourceState);
    if (decision === "reject") {
      state.rejectedDiscoveryIds = unique([
        ...state.rejectedDiscoveryIds,
        suggestion.place.id,
      ]);
    } else {
      state.savedDiscoveryIds = unique([
        ...state.savedDiscoveryIds,
        suggestion.place.id,
      ]);
    }
    state.revision += 1;
    return {
      state,
      decision,
      changedPlan: false,
      reason: {
        code:
          decision === "reject"
            ? "DISCOVERY_REJECTED"
            : "DISCOVERY_SAVED_FOR_LATER",
        placeId: suggestion.place.id,
        message:
          decision === "reject"
            ? "No problem. The suggestion will not enter the route."
            : "The suggestion is saved for later and today’s route is unchanged.",
      },
    };
  }

  const state = cloneLiveState(sourceState);
  if (!state.sourceInput.places.some((place) => place.id === suggestion.place.id)) {
    state.sourceInput.places.push({
      ...suggestion.place,
      source: "approved_discovery",
    });
  }
  state.approvedDiscoveryIds = unique([
    ...state.approvedDiscoveryIds,
    suggestion.place.id,
  ]);
  state.currentPlan = optimizeRemaining(state);
  state.revision += 1;

  return {
    state,
    decision,
    changedPlan:
      sourceState.currentPlan.fingerprint !== state.currentPlan.fingerprint,
    reason: {
      code: "DISCOVERY_APPROVED",
      placeId: suggestion.place.id,
      message:
        "The discovery was considered only after approval; the optimizer still decides whether it truthfully fits.",
    },
  };
}

export function discoveryPendingReason(
  suggestion: DiscoverySuggestion,
): PlanReason {
  return {
    code: "DISCOVERY_PENDING_APPROVAL",
    placeId: suggestion.place.id,
    message: `${suggestion.place.name} remains outside the route until the traveller approves it.`,
  };
}

function optimizeRemaining(state: LiveDayState): OptimizationResult {
  return optimizeDay(remainingInput(state));
}

function remainingInput(
  state: LiveDayState,
  overrides: {
    requiredPlaceIds?: PlaceId[];
    endMinute?: number;
    pace?: Pace;
  } = {},
): OptimizationInput {
  const completedIds = state.completedStops.map((stop) => stop.placeId);
  const excludedPlaceIds = unique([
    ...(state.sourceInput.policy?.excludedPlaceIds ?? []),
    ...state.skippedPlaceIds,
    ...completedIds,
    ...state.sourceInput.places
      .filter(
        (place) =>
          !state.originallyPlannedPlaceIds.includes(place.id) &&
          !state.approvedDiscoveryIds.includes(place.id),
      )
      .map((place) => place.id),
  ]);
  const requiredPlaceIds = overrides.requiredPlaceIds ??
    state.sourceInput.policy?.requiredPlaceIds?.filter(
      (placeId) => !excludedPlaceIds.includes(placeId),
    );

  return {
    ...cloneInput(state.sourceInput),
    day: {
      ...state.sourceInput.day,
      startLocationId: state.currentLocationId,
      startMinute: state.currentMinute,
      endMinute: overrides.endMinute ?? state.sourceInput.day.endMinute,
      pace: overrides.pace ?? state.sourceInput.day.pace,
    },
    policy: {
      ...state.sourceInput.policy,
      excludedPlaceIds,
      requiredPlaceIds,
    },
  };
}

function comparePlans(
  previous: OptimizationResult,
  next: OptimizationResult,
  eventReason: ReasonCode,
): PlanChange[] {
  const changes: PlanChange[] = [];
  const previousById = new Map(
    previous.itinerary.map((stop) => [stop.placeId, stop]),
  );
  const nextById = new Map(next.itinerary.map((stop) => [stop.placeId, stop]));

  for (const stop of previous.itinerary) {
    const nextStop = nextById.get(stop.placeId);
    if (!nextStop) {
      const deferred = next.deferred.find(
        (place) => place.placeId === stop.placeId,
      );
      changes.push({
        placeId: stop.placeId,
        type: "deferred",
        reasonCode: deferred?.reasonCode ?? eventReason,
        message:
          deferred?.message ??
          `${stop.name} is now saved for another day after the day changed.`,
      });
    } else if (nextStop.startMinute !== stop.startMinute) {
      changes.push({
        placeId: stop.placeId,
        type: "time_changed",
        reasonCode: eventReason,
        message: `${stop.name} moved within its confirmed window.`,
        previousStartMinute: stop.startMinute,
        nextStartMinute: nextStop.startMinute,
      });
    }
  }

  for (const stop of next.itinerary) {
    if (!previousById.has(stop.placeId)) {
      changes.push({
        placeId: stop.placeId,
        type: "added",
        reasonCode: eventReason,
        message: `${stop.name} now fits in the remaining day.`,
        nextStartMinute: stop.startMinute,
      });
    }
  }

  return changes;
}

function primaryReasonForEvent(event: LiveEvent): ReasonCode {
  switch (event.type) {
    case "complete":
      return "COMPLETED_STOP_PRESERVED";
    case "delay":
      return "DELAY_APPLIED";
    case "break":
      return "BREAK_PROTECTED";
    case "stay_longer":
      return "STAY_LONGER_HONORED";
    case "skip":
      return "SKIP_CONFIRMED";
  }
}

function rejectedEvent(
  state: LiveDayState,
  event: LiveEvent,
  message: string,
): LiveReplanResult {
  return {
    state,
    event,
    accepted: false,
    changes: [],
    reasons: [{ code: "REPLAN_REMAINING_ONLY", message }],
  };
}

function cloneLiveState(state: LiveDayState): LiveDayState {
  return {
    ...state,
    sourceInput: cloneInput(state.sourceInput),
    currentPlan: clonePlan(state.currentPlan),
    completedStops: state.completedStops.map((stop) => ({ ...stop })),
    protectedBreaks: state.protectedBreaks.map((item) => ({ ...item })),
    skippedPlaceIds: [...state.skippedPlaceIds],
    approvedDiscoveryIds: [...state.approvedDiscoveryIds],
    savedDiscoveryIds: [...state.savedDiscoveryIds],
    rejectedDiscoveryIds: [...state.rejectedDiscoveryIds],
    originallyPlannedPlaceIds: [...state.originallyPlannedPlaceIds],
  };
}

function cloneInput(input: OptimizationInput): OptimizationInput {
  return {
    ...input,
    places: input.places.map((place) => ({
      ...place,
      openingWindows: place.openingWindows.map((window) => ({ ...window })),
      fixedBooking: place.fixedBooking ? { ...place.fixedBooking } : undefined,
      timingConstraints: place.timingConstraints?.map((constraint) => ({
        ...constraint,
        window: { ...constraint.window },
      })),
    })),
    travelMatrix: input.travelMatrix,
    day: {
      ...input.day,
      allowedModes: [...input.day.allowedModes],
    },
    policy: input.policy
      ? {
          requiredPlaceIds: input.policy.requiredPlaceIds
            ? [...input.policy.requiredPlaceIds]
            : undefined,
          excludedPlaceIds: input.policy.excludedPlaceIds
            ? [...input.policy.excludedPlaceIds]
            : undefined,
        }
      : undefined,
  };
}

function clonePlan(plan: OptimizationResult): OptimizationResult {
  return {
    ...plan,
    itinerary: plan.itinerary.map((stop) => ({
      ...stop,
      reasonCodes: [...stop.reasonCodes],
    })),
    legs: plan.legs.map((leg) => ({ ...leg })),
    deferred: plan.deferred.map((place) => ({ ...place })),
    reasons: plan.reasons.map((reason) => ({
      ...reason,
      details: reason.details ? { ...reason.details } : undefined,
    })),
    metrics: { ...plan.metrics },
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
