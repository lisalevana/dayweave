export type PlaceId = string;
export type LocationId = string;
export type Minute = number;

export type Priority = "must" | "love" | "convenient";
export type Pace = "relaxed" | "balanced" | "packed";
export type TravelMode = "walk" | "transit" | "taxi";

export interface TimeWindow {
  start: Minute;
  end: Minute;
  label?: string;
}

export interface FixedBooking {
  /** The booking begins at this exact minute and is never shifted by the solver. */
  start: Minute;
  /** The reserved visit finishes at this exact minute. */
  end: Minute;
  label: string;
  reference?: string;
}

export interface TimingConstraint {
  id: string;
  kind: "sunset" | "verified_experience";
  window: TimeWindow;
  label: string;
  evidenceClaimId?: string;
}

export interface Place {
  id: PlaceId;
  name: string;
  area: string;
  priority: Priority;
  durationMinutes: number;
  openingWindows: TimeWindow[];
  fixedBooking?: FixedBooking;
  timingConstraints?: TimingConstraint[];
  /** When true, no non-shopping destination may follow this one. */
  shoppingLast?: boolean;
  source: "seeded_demo" | "user" | "approved_discovery";
  icon?: string;
  note?: string;
}

export interface TravelOption {
  mode: TravelMode;
  minutes: number;
  /** Includes access/egress walking for public transport. */
  walkingKm: number;
  distanceKm: number;
  fareHkd?: number;
  source: "seeded_demo_estimate" | "routing_adapter";
}

export type TravelMatrix = Record<
  LocationId,
  Record<LocationId, readonly TravelOption[]>
>;

export interface DayParameters {
  date: string;
  timezone: string;
  startLocationId: LocationId;
  endLocationId: LocationId;
  startMinute: Minute;
  endMinute: Minute;
  pace: Pace;
  maxWalkingKm: number;
  allowedModes: TravelMode[];
}

export interface OptimizationPolicy {
  /** Additional destinations that must be present in a feasible result. */
  requiredPlaceIds?: PlaceId[];
  /** Destinations explicitly removed by the traveller. */
  excludedPlaceIds?: PlaceId[];
}

export interface OptimizationInput {
  places: Place[];
  travelMatrix: TravelMatrix;
  day: DayParameters;
  policy?: OptimizationPolicy;
}

export type ReasonCode =
  | "MUST_VISIT_PROTECTED"
  | "MUST_VISIT_INFEASIBLE"
  | "FIXED_BOOKING_PROTECTED"
  | "FIXED_BOOKING_INFEASIBLE"
  | "TIME_WINDOW_PROTECTED"
  | "OPENING_WINDOW_RESPECTED"
  | "SHOPPING_LAST_RESPECTED"
  | "WALKING_LIMIT_RESPECTED"
  | "OPTIONAL_DEFERRED_CAPACITY"
  | "OPTIONAL_DEFERRED_WINDOW"
  | "REQUIRED_PLACE_INFEASIBLE"
  | "NO_ROUTE_AVAILABLE"
  | "PRIORITY_VALUE_MAXIMIZED"
  | "COMPLETED_STOP_PRESERVED"
  | "REPLAN_REMAINING_ONLY"
  | "DELAY_APPLIED"
  | "BREAK_PROTECTED"
  | "STAY_LONGER_HONORED"
  | "SKIP_CONFIRMED"
  | "FIXED_BOOKING_SKIP_CONFIRMED"
  | "RECOVERY_PROTECT_MOMENTS"
  | "RECOVERY_KEEP_EVERY_STOP"
  | "DAY_END_EXTENDED"
  | "DISCOVERY_PENDING_APPROVAL"
  | "DISCOVERY_APPROVED"
  | "DISCOVERY_REJECTED"
  | "DISCOVERY_SAVED_FOR_LATER"
  | "WEAK_EVIDENCE_IGNORED"
  | "VERIFIED_EVIDENCE_APPLIED";

export interface PlanReason {
  code: ReasonCode;
  message: string;
  placeId?: PlaceId;
  details?: Record<string, string | number | boolean>;
}

export interface PlannedLeg {
  fromId: LocationId;
  toId: LocationId;
  mode: TravelMode;
  departMinute: Minute;
  arriveMinute: Minute;
  minutes: number;
  walkingKm: number;
  distanceKm: number;
  fareHkd: number;
}

export interface PlannedStop {
  placeId: PlaceId;
  name: string;
  arrivalMinute: Minute;
  startMinute: Minute;
  endMinute: Minute;
  waitMinutes: number;
  fixedBooking: boolean;
  protected: boolean;
  reasonCodes: ReasonCode[];
}

export interface DeferredPlace {
  placeId: PlaceId;
  name: string;
  reasonCode:
    | "OPTIONAL_DEFERRED_CAPACITY"
    | "OPTIONAL_DEFERRED_WINDOW"
    | "MUST_VISIT_INFEASIBLE"
    | "REQUIRED_PLACE_INFEASIBLE";
  message: string;
}

export interface PlanMetrics {
  selectedCount: number;
  totalPlaceCount: number;
  mustVisitCount: number;
  mustVisitProtectedCount: number;
  fixedBookingCount: number;
  fixedBookingProtectedCount: number;
  priorityValue: number;
  travelMinutes: number;
  visitMinutes: number;
  waitMinutes: number;
  walkingKm: number;
  fareHkd: number;
  finishMinute: Minute;
}

export interface OptimizationResult {
  status: "feasible" | "partial" | "infeasible";
  feasible: boolean;
  itinerary: PlannedStop[];
  legs: PlannedLeg[];
  deferred: DeferredPlace[];
  reasons: PlanReason[];
  metrics: PlanMetrics;
  /** Stable serialization of the chosen result, useful for deterministic UI updates. */
  fingerprint: string;
}

export interface CompletedStop extends PlannedStop {
  actualEndMinute: Minute;
}

export interface ProtectedBreak {
  id: string;
  startMinute: Minute;
  endMinute: Minute;
  locationId: LocationId;
  label: string;
}

export interface LiveDayState {
  sourceInput: OptimizationInput;
  currentPlan: OptimizationResult;
  completedStops: CompletedStop[];
  protectedBreaks: ProtectedBreak[];
  skippedPlaceIds: PlaceId[];
  approvedDiscoveryIds: PlaceId[];
  savedDiscoveryIds: PlaceId[];
  rejectedDiscoveryIds: PlaceId[];
  originallyPlannedPlaceIds: PlaceId[];
  currentMinute: Minute;
  currentLocationId: LocationId;
  revision: number;
}

export type LiveEvent =
  | { type: "complete"; placeId: PlaceId; actualEndMinute?: Minute }
  | { type: "delay"; minutes: number }
  | { type: "break"; minutes: number; label?: string }
  | { type: "stay_longer"; placeId: PlaceId; minutes: 15 | 30 | 60 }
  | { type: "skip"; placeId: PlaceId };

export interface PlanChange {
  placeId?: PlaceId;
  type: "preserved" | "deferred" | "added" | "time_changed" | "rest_added";
  reasonCode: ReasonCode;
  message: string;
  previousStartMinute?: Minute;
  nextStartMinute?: Minute;
}

export interface LiveReplanResult {
  state: LiveDayState;
  event: LiveEvent;
  accepted: boolean;
  changes: PlanChange[];
  reasons: PlanReason[];
}

export interface RecoveryChoice {
  id: "protect_moments" | "keep_every_stop";
  title: string;
  description: string;
  valid: boolean;
  state: LiveDayState;
  changes: PlanChange[];
  reasons: PlanReason[];
}

export interface ExperienceBrief {
  placeId: PlaceId;
  whyPeopleCome: string;
  dontMiss: string;
  worthKnowing: string;
  claims: import("../schemas/evidence").ExperienceClaim[];
  isSeededDemo: boolean;
}

export interface DiscoverySuggestion {
  id: string;
  place: Place;
  whyRelevant: string;
  category:
    | "destination_defining_local_classic"
    | "strong_recurring_visitor_favourite"
    | "personalized_preference_match";
  detourMinutes: number;
  displacement: PlaceId | null;
  evidence: import("../schemas/evidence").ExperienceClaim[];
  isSeededDemo: boolean;
}

export type DiscoveryDecision = "add" | "save" | "reject";

export interface DiscoveryDecisionResult {
  state: LiveDayState;
  decision: DiscoveryDecision;
  changedPlan: boolean;
  reason: PlanReason;
}
