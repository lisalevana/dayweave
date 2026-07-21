import type {
  DeferredPlace,
  OptimizationInput,
  OptimizationResult,
  Place,
  PlannedLeg,
  PlannedStop,
  PlanMetrics,
  PlanReason,
  TimeWindow,
  TravelOption,
} from "./types";

const MAX_PLACES = 10;

const PRIORITY_VALUE = {
  must: 1_000,
  love: 120,
  convenient: 35,
} as const;

const PACE_BUFFER = {
  relaxed: 12,
  balanced: 6,
  packed: 2,
} as const;

const MODE_ORDER = {
  walk: 0,
  transit: 1,
  taxi: 2,
} as const;

interface SearchState {
  mask: number;
  lastId: string;
  readyMinute: number;
  stops: PlannedStop[];
  legs: PlannedLeg[];
  walkingKm: number;
  travelMinutes: number;
  visitMinutes: number;
  waitMinutes: number;
  fareHkd: number;
  priorityValue: number;
  mustCount: number;
  routeKey: string;
}

interface Candidate extends SearchState {
  returnLeg: PlannedLeg;
  finishMinute: number;
  objectiveValue: number;
}

interface DominanceLabel {
  readyMinute: number;
  walkingKm: number;
  travelMinutes: number;
  fareHkd: number;
  routeKey: string;
}

interface ScheduledVisit {
  startMinute: number;
  endMinute: number;
}

export function paceBufferMinutes(input: OptimizationInput): number {
  return PACE_BUFFER[input.day.pace];
}

export function optimizeDay(input: OptimizationInput): OptimizationResult {
  validateInput(input);

  const excluded = new Set(input.policy?.excludedPlaceIds ?? []);
  const places = input.places.filter((place) => !excluded.has(place.id));
  const placeIndex = new Map(places.map((place, index) => [place.id, index]));
  const requiredIds = new Set(input.policy?.requiredPlaceIds ?? []);
  const fixedIds = new Set(
    places.filter((place) => place.fixedBooking).map((place) => place.id),
  );
  const hardRequiredIds = new Set([...requiredIds, ...fixedIds]);

  const missingRequired = [...hardRequiredIds].filter(
    (placeId) => !placeIndex.has(placeId),
  );
  if (missingRequired.length > 0) {
    return infeasibleResult(
      input,
      places,
      missingRequired.map((placeId) => ({
        code: "REQUIRED_PLACE_INFEASIBLE" as const,
        message: `Required destination ${placeId} is not available to the solver.`,
        placeId,
      })),
    );
  }

  const hardRequiredMask = [...hardRequiredIds].reduce(
    (mask, id) => mask | (1 << (placeIndex.get(id) as number)),
    0,
  );
  const totalMust = places.filter((place) => place.priority === "must").length;
  const allowedModes = new Set(input.day.allowedModes);
  const labels = new Map<string, DominanceLabel[]>();
  let best: Candidate | null = null;

  const initial: SearchState = {
    mask: 0,
    lastId: input.day.startLocationId,
    readyMinute: input.day.startMinute,
    stops: [],
    legs: [],
    walkingKm: 0,
    travelMinutes: 0,
    visitMinutes: 0,
    waitMinutes: 0,
    fareHkd: 0,
    priorityValue: 0,
    mustCount: 0,
    routeKey: "",
  };

  function search(state: SearchState): void {
    if (isDominated(labels, state)) return;

    if ((state.mask & hardRequiredMask) === hardRequiredMask) {
      const candidate = closeRoute(input, state, allowedModes);
      if (candidate && (!best || compareCandidates(candidate, best) > 0)) {
        best = candidate;
      }
    }

    const possibleMustCount =
      state.mustCount +
      places.reduce(
        (count, place, index) =>
          count +
          (place.priority === "must" && (state.mask & (1 << index)) === 0
            ? 1
            : 0),
        0,
      );
    if (best && possibleMustCount < best.mustCount) return;

    for (let index = 0; index < places.length; index += 1) {
      const bit = 1 << index;
      if ((state.mask & bit) !== 0) continue;

      const place = places[index];
      if (
        state.stops.some(
          (stop) => places[placeIndex.get(stop.placeId) as number]?.shoppingLast,
        ) &&
        !place.shoppingLast
      ) {
        continue;
      }

      const options = getTravelOptions(input, state.lastId, place.id).filter(
        (option) => allowedModes.has(option.mode),
      );

      for (const option of options) {
        const walkingKm = state.walkingKm + option.walkingKm;
        if (walkingKm > input.day.maxWalkingKm + Number.EPSILON) continue;

        const arrivalMinute = state.readyMinute + option.minutes;
        const visit = scheduleVisit(place, arrivalMinute, input.day.endMinute);
        if (!visit) continue;

        const waitMinutes = visit.startMinute - arrivalMinute;
        const stopReasons: PlannedStop["reasonCodes"] = [
          "OPENING_WINDOW_RESPECTED",
        ];
        if (place.priority === "must") stopReasons.push("MUST_VISIT_PROTECTED");
        if (place.fixedBooking) stopReasons.push("FIXED_BOOKING_PROTECTED");
        if (place.timingConstraints?.length) {
          stopReasons.push("TIME_WINDOW_PROTECTED");
        }
        if (place.shoppingLast) stopReasons.push("SHOPPING_LAST_RESPECTED");

        const leg: PlannedLeg = {
          fromId: state.lastId,
          toId: place.id,
          mode: option.mode,
          departMinute: state.readyMinute,
          arriveMinute: arrivalMinute,
          minutes: option.minutes,
          walkingKm: option.walkingKm,
          distanceKm: option.distanceKm,
          fareHkd: option.fareHkd ?? 0,
        };
        const stop: PlannedStop = {
          placeId: place.id,
          name: place.name,
          arrivalMinute,
          startMinute: visit.startMinute,
          endMinute: visit.endMinute,
          waitMinutes,
          fixedBooking: Boolean(place.fixedBooking),
          protected:
            place.priority === "must" ||
            Boolean(place.fixedBooking) ||
            Boolean(place.timingConstraints?.length),
          reasonCodes: stopReasons,
        };
        const routeKey = state.routeKey
          ? `${state.routeKey}>${place.id}:${option.mode}`
          : `${place.id}:${option.mode}`;

        search({
          mask: state.mask | bit,
          lastId: place.id,
          readyMinute: visit.endMinute + PACE_BUFFER[input.day.pace],
          stops: [...state.stops, stop],
          legs: [...state.legs, leg],
          walkingKm,
          travelMinutes: state.travelMinutes + option.minutes,
          visitMinutes:
            state.visitMinutes + (visit.endMinute - visit.startMinute),
          waitMinutes: state.waitMinutes + waitMinutes,
          fareHkd: state.fareHkd + (option.fareHkd ?? 0),
          priorityValue: state.priorityValue + PRIORITY_VALUE[place.priority],
          mustCount:
            state.mustCount + (place.priority === "must" ? 1 : 0),
          routeKey,
        });
      }
    }
  }

  search(initial);

  if (!best) {
    const reasons: PlanReason[] = places
      .filter((place) => hardRequiredIds.has(place.id))
      .map((place) => ({
        code: place.fixedBooking
          ? ("FIXED_BOOKING_INFEASIBLE" as const)
          : ("REQUIRED_PLACE_INFEASIBLE" as const),
        placeId: place.id,
        message: place.fixedBooking
          ? `${place.name}'s booking cannot be reached without breaking a confirmed constraint.`
          : `${place.name} cannot fit without breaking a confirmed constraint.`,
      }));

    if (reasons.length === 0) {
      reasons.push({
        code: "NO_ROUTE_AVAILABLE",
        message: "No valid route connects the start and end within this day.",
      });
    }

    return infeasibleResult(input, places, reasons);
  }

  return buildResult(input, places, best, totalMust, requiredIds);
}

function scheduleVisit(
  place: Place,
  arrivalMinute: number,
  dayEndMinute: number,
): ScheduledVisit | null {
  if (place.fixedBooking) {
    const { start, end } = place.fixedBooking;
    if (arrivalMinute > start || end > dayEndMinute) return null;
    if (end - start < place.durationMinutes) return null;
    if (!windowSetContains(place.openingWindows, start, end)) return null;
    if (!constraintsContain(place, start, end)) return null;
    return { startMinute: start, endMinute: end };
  }

  const openings = place.openingWindows.length
    ? place.openingWindows
    : [{ start: 0, end: dayEndMinute }];

  for (const opening of openings.toSorted(compareWindows)) {
    let earliestStart = Math.max(arrivalMinute, opening.start);
    let latestEnd = Math.min(dayEndMinute, opening.end);

    for (const constraint of place.timingConstraints ?? []) {
      earliestStart = Math.max(earliestStart, constraint.window.start);
      latestEnd = Math.min(latestEnd, constraint.window.end);
    }

    const endMinute = earliestStart + place.durationMinutes;
    if (endMinute <= latestEnd) {
      return { startMinute: earliestStart, endMinute };
    }
  }

  return null;
}

function windowSetContains(
  windows: TimeWindow[],
  startMinute: number,
  endMinute: number,
): boolean {
  return (
    windows.length === 0 ||
    windows.some(
      (window) => startMinute >= window.start && endMinute <= window.end,
    )
  );
}

function constraintsContain(
  place: Place,
  startMinute: number,
  endMinute: number,
): boolean {
  return (place.timingConstraints ?? []).every(
    (constraint) =>
      startMinute >= constraint.window.start &&
      endMinute <= constraint.window.end,
  );
}

function compareWindows(a: TimeWindow, b: TimeWindow): number {
  return a.start - b.start || a.end - b.end;
}

function closeRoute(
  input: OptimizationInput,
  state: SearchState,
  allowedModes: Set<string>,
): Candidate | null {
  const options = getTravelOptions(
    input,
    state.lastId,
    input.day.endLocationId,
  ).filter((option) => allowedModes.has(option.mode));

  let best: Candidate | null = null;
  for (const option of options) {
    const walkingKm = state.walkingKm + option.walkingKm;
    const finishMinute = state.readyMinute + option.minutes;
    if (
      walkingKm > input.day.maxWalkingKm + Number.EPSILON ||
      finishMinute > input.day.endMinute
    ) {
      continue;
    }

    const returnLeg: PlannedLeg = {
      fromId: state.lastId,
      toId: input.day.endLocationId,
      mode: option.mode,
      departMinute: state.readyMinute,
      arriveMinute: finishMinute,
      minutes: option.minutes,
      walkingKm: option.walkingKm,
      distanceKm: option.distanceKm,
      fareHkd: option.fareHkd ?? 0,
    };
    const travelMinutes = state.travelMinutes + option.minutes;
    const fareHkd = state.fareHkd + (option.fareHkd ?? 0);
    const candidate: Candidate = {
      ...state,
      returnLeg,
      walkingKm,
      travelMinutes,
      fareHkd,
      finishMinute,
      // A destination's prize must justify its travel cost, while must-visits
      // are protected separately by the lexicographic comparison below.
      objectiveValue: state.priorityValue - travelMinutes * 1.25 - fareHkd * 0.1,
    };

    if (!best || compareCandidates(candidate, best) > 0) best = candidate;
  }

  return best;
}

function compareCandidates(a: Candidate, b: Candidate): number {
  if (a.mustCount !== b.mustCount) return a.mustCount - b.mustCount;
  if (a.objectiveValue !== b.objectiveValue) {
    return a.objectiveValue - b.objectiveValue;
  }
  if (a.priorityValue !== b.priorityValue) {
    return a.priorityValue - b.priorityValue;
  }
  if (a.travelMinutes !== b.travelMinutes) {
    return b.travelMinutes - a.travelMinutes;
  }
  if (a.walkingKm !== b.walkingKm) return b.walkingKm - a.walkingKm;
  if (a.finishMinute !== b.finishMinute) return b.finishMinute - a.finishMinute;

  const aKey = `${a.routeKey}>${a.returnLeg.toId}:${a.returnLeg.mode}`;
  const bKey = `${b.routeKey}>${b.returnLeg.toId}:${b.returnLeg.mode}`;
  return bKey.localeCompare(aKey);
}

function isDominated(
  labels: Map<string, DominanceLabel[]>,
  state: SearchState,
): boolean {
  const key = `${state.mask}:${state.lastId}`;
  const current: DominanceLabel = {
    readyMinute: state.readyMinute,
    walkingKm: state.walkingKm,
    travelMinutes: state.travelMinutes,
    fareHkd: state.fareHkd,
    routeKey: state.routeKey,
  };
  const existing = labels.get(key) ?? [];
  const dominated = existing.some(
    (label) =>
      label.readyMinute <= current.readyMinute &&
      label.walkingKm <= current.walkingKm + Number.EPSILON &&
      label.travelMinutes <= current.travelMinutes &&
      label.fareHkd <= current.fareHkd &&
      (label.routeKey.localeCompare(current.routeKey) <= 0 ||
        label.readyMinute < current.readyMinute ||
        label.walkingKm < current.walkingKm ||
        label.travelMinutes < current.travelMinutes ||
        label.fareHkd < current.fareHkd),
  );
  if (dominated) return true;

  labels.set(
    key,
    existing
      .filter(
        (label) =>
          !(
            current.readyMinute <= label.readyMinute &&
            current.walkingKm <= label.walkingKm + Number.EPSILON &&
            current.travelMinutes <= label.travelMinutes &&
            current.fareHkd <= label.fareHkd
          ),
      )
      .concat(current),
  );
  return false;
}

export function getTravelOptions(
  input: Pick<OptimizationInput, "travelMatrix">,
  fromId: string,
  toId: string,
): TravelOption[] {
  const options = input.travelMatrix[fromId]?.[toId] ?? [];
  return [...options].toSorted(
    (a, b) =>
      a.minutes - b.minutes ||
      a.walkingKm - b.walkingKm ||
      MODE_ORDER[a.mode] - MODE_ORDER[b.mode],
  );
}

function buildResult(
  input: OptimizationInput,
  places: Place[],
  best: Candidate,
  totalMust: number,
  requiredIds: Set<string>,
): OptimizationResult {
  const selectedIds = new Set(best.stops.map((stop) => stop.placeId));
  const fixedBookingCount = places.filter((place) => place.fixedBooking).length;
  const deferred = places
    .filter((place) => !selectedIds.has(place.id))
    .map((place): DeferredPlace => {
      if (place.priority === "must") {
        return {
          placeId: place.id,
          name: place.name,
          reasonCode: "MUST_VISIT_INFEASIBLE",
          message: `${place.name} is waiting for another day because its confirmed constraints do not fit this route.`,
        };
      }
      if (requiredIds.has(place.id)) {
        return {
          placeId: place.id,
          name: place.name,
          reasonCode: "REQUIRED_PLACE_INFEASIBLE",
          message: `${place.name} cannot fit without breaking a confirmed constraint.`,
        };
      }

      const overlapsDay = place.openingWindows.some(
        (window) =>
          window.end - window.start >= place.durationMinutes &&
          window.end >= input.day.startMinute &&
          window.start <= input.day.endMinute,
      );
      return overlapsDay
        ? {
            placeId: place.id,
            name: place.name,
            reasonCode: "OPTIONAL_DEFERRED_CAPACITY",
            message: `${place.name} is saved for another day, making room for what matters most.`,
          }
        : {
            placeId: place.id,
            name: place.name,
            reasonCode: "OPTIONAL_DEFERRED_WINDOW",
            message: `${place.name} is waiting for tomorrow because its available window does not overlap this day.`,
          };
    });

  const reasons: PlanReason[] = [];
  for (const stop of best.stops) {
    const place = places.find((item) => item.id === stop.placeId) as Place;
    if (place.priority === "must") {
      reasons.push({
        code: "MUST_VISIT_PROTECTED",
        placeId: place.id,
        message: `${place.name} remains protected.`,
      });
    }
    if (place.fixedBooking) {
      reasons.push({
        code: "FIXED_BOOKING_PROTECTED",
        placeId: place.id,
        message: `${place.name} stays at its confirmed booking time.`,
      });
    }
    for (const constraint of place.timingConstraints ?? []) {
      reasons.push({
        code: "TIME_WINDOW_PROTECTED",
        placeId: place.id,
        message: `${constraint.label} remains protected.`,
      });
    }
    if (place.shoppingLast) {
      reasons.push({
        code: "SHOPPING_LAST_RESPECTED",
        placeId: place.id,
        message: `${place.name} stays last so bags are not carried all day.`,
      });
    }
  }
  reasons.push(
    ...deferred.map((item) => ({
      code: item.reasonCode,
      placeId: item.placeId,
      message: item.message,
    })),
    {
      code: "WALKING_LIMIT_RESPECTED",
      message: `Walking stays within the ${input.day.maxWalkingKm.toFixed(1)} km comfort limit.`,
      details: { walkingKm: round(best.walkingKm) },
    },
    {
      code: "PRIORITY_VALUE_MAXIMIZED",
      message: "The route maximizes protected and meaningful places before reducing travel.",
      details: { priorityValue: best.priorityValue },
    },
  );

  const metrics: PlanMetrics = {
    selectedCount: best.stops.length,
    totalPlaceCount: places.length,
    mustVisitCount: totalMust,
    mustVisitProtectedCount: best.mustCount,
    fixedBookingCount,
    fixedBookingProtectedCount: best.stops.filter((stop) => stop.fixedBooking)
      .length,
    priorityValue: best.priorityValue,
    travelMinutes: best.travelMinutes,
    visitMinutes: best.visitMinutes,
    waitMinutes: best.waitMinutes,
    walkingKm: round(best.walkingKm),
    fareHkd: round(best.fareHkd),
    finishMinute: best.finishMinute,
  };

  const status: OptimizationResult["status"] =
    best.mustCount < totalMust || deferred.length > 0 ? "partial" : "feasible";
  const legs = [...best.legs, best.returnLeg];
  const fingerprint = makeFingerprint(status, best.stops, legs, deferred);

  return {
    status,
    feasible: true,
    itinerary: best.stops,
    legs,
    deferred,
    reasons,
    metrics,
    fingerprint,
  };
}

function infeasibleResult(
  input: OptimizationInput,
  places: Place[],
  reasons: PlanReason[],
): OptimizationResult {
  const fixedBookingCount = places.filter((place) => place.fixedBooking).length;
  const deferred = places.map(
    (place): DeferredPlace => ({
      placeId: place.id,
      name: place.name,
      reasonCode:
        place.priority === "must"
          ? "MUST_VISIT_INFEASIBLE"
          : "REQUIRED_PLACE_INFEASIBLE",
      message: `${place.name} has not been placed because the confirmed set is infeasible.`,
    }),
  );
  const metrics: PlanMetrics = {
    selectedCount: 0,
    totalPlaceCount: places.length,
    mustVisitCount: places.filter((place) => place.priority === "must").length,
    mustVisitProtectedCount: 0,
    fixedBookingCount,
    fixedBookingProtectedCount: 0,
    priorityValue: 0,
    travelMinutes: 0,
    visitMinutes: 0,
    waitMinutes: 0,
    walkingKm: 0,
    fareHkd: 0,
    finishMinute: input.day.startMinute,
  };

  return {
    status: "infeasible",
    feasible: false,
    itinerary: [],
    legs: [],
    deferred,
    reasons,
    metrics,
    fingerprint: makeFingerprint("infeasible", [], [], deferred),
  };
}

function makeFingerprint(
  status: OptimizationResult["status"],
  stops: PlannedStop[],
  legs: PlannedLeg[],
  deferred: DeferredPlace[],
): string {
  const stopPart = stops
    .map((stop) => `${stop.placeId}@${stop.startMinute}-${stop.endMinute}`)
    .join(",");
  const legPart = legs
    .map((leg) => `${leg.fromId}>${leg.toId}:${leg.mode}:${leg.minutes}`)
    .join(",");
  const deferredPart = deferred.map((place) => place.placeId).sort().join(",");
  return `dw1|${status}|${stopPart}|${legPart}|${deferredPart}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function validateInput(input: OptimizationInput): void {
  if (input.places.length > MAX_PLACES) {
    throw new Error(`DayWeave supports at most ${MAX_PLACES} places per day.`);
  }
  if (input.day.startMinute >= input.day.endMinute) {
    throw new Error("The day must end after it starts.");
  }
  if (input.day.maxWalkingKm < 0) {
    throw new Error("Walking comfort cannot be negative.");
  }
  if (input.day.allowedModes.length === 0) {
    throw new Error("At least one travel mode is required.");
  }

  const ids = new Set<string>();
  for (const place of input.places) {
    if (ids.has(place.id)) throw new Error(`Duplicate place id: ${place.id}`);
    ids.add(place.id);
    if (place.durationMinutes <= 0) {
      throw new Error(`${place.name} must have a positive visit duration.`);
    }
    for (const window of place.openingWindows) {
      if (window.start >= window.end) {
        throw new Error(`${place.name} has an invalid opening window.`);
      }
    }
    if (
      place.fixedBooking &&
      place.fixedBooking.start >= place.fixedBooking.end
    ) {
      throw new Error(`${place.name} has an invalid fixed booking.`);
    }
  }
}
