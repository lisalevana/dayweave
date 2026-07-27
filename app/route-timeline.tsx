import type {
  PlannedLeg,
  PlannedStop,
  Place,
  ProtectedBreak,
  TravelMode,
} from "@/lib/dayweave/types";
import { formatTime } from "@/lib/dayweave/time";

export type TimelineStop = PlannedStop & { actualEndMinute?: number };

export interface RouteStopInsight {
  /** Short category shown above the insight, such as "Don't miss here". */
  label?: string;
  /** The useful, place-specific detail to surface in the itinerary. */
  summary: string;
  /** Short tap target copy. Defaults to "See why". */
  actionLabel?: string;
}

export interface RouteTimelineProps {
  stops: readonly TimelineStop[];
  legs: readonly PlannedLeg[];
  places: readonly Place[];
  startLabel: string;
  endLabel: string;
  endLocationId: string;
  finishMinute: number;
  completedIds?: readonly string[];
  currentPlaceId?: string;
  currentStateLabel?: string;
  breaks?: readonly ProtectedBreak[];
  label?: string;
  /** Place-indexed insights. Only supplied stops receive an inline callout. */
  insightsByPlaceId?: Readonly<
    Record<string, RouteStopInsight | undefined>
  >;
  /** Called when the traveller taps an inline insight. */
  onInsightSelect?: (placeId: string) => void;
  /** Shows a short explanation for fixed, timed, and shopping-last stops. */
  showConstraintReasons?: boolean;
  /** Adds Google Maps directions for each destination. */
  showDirectionsLinks?: boolean;
  /** Appended to destination searches to disambiguate place names. */
  directionsRegion?: string;
  /** Changes only the visual density; ordered-list semantics stay intact. */
  variant?: "detailed" | "editorial" | "live";
}

export function travelModeLabel(mode: TravelMode) {
  if (mode === "walk") return "Walk";
  if (mode === "transit") return "Public transport";
  return "Taxi";
}

export function formatTimelineTime(minute: number) {
  return `${formatTime(minute)}${minute >= 24 * 60 ? " · next day" : ""}`;
}

function constraintReason(place: Place | undefined) {
  if (!place) return null;

  const reasons: string[] = [];
  if (place.fixedBooking) {
    reasons.push(
      `${place.fixedBooking.label.toLocaleLowerCase("en")} held at ${formatTimelineTime(place.fixedBooking.start)}`,
    );
  }
  for (const constraint of place.timingConstraints ?? []) {
    reasons.push(`${constraint.label} protected`);
  }
  if (place.shoppingLast) {
    reasons.push("shopping kept last so bags do not follow you all day");
  }

  return reasons.length > 0 ? `Why this time: ${reasons.join("; ")}.` : null;
}

function googleMapsDirectionsUrl(
  stop: TimelineStop,
  place: Place | undefined,
  mode: TravelMode | undefined,
  originLabel: string,
  region: string,
) {
  const destination = [stop.name, place?.area, region]
    .filter(Boolean)
    .join(", ");
  const travelmode =
    mode === "walk" ? "walking" : mode === "transit" ? "transit" : "driving";
  const params = new URLSearchParams({
    api: "1",
    origin: [originLabel, region].filter(Boolean).join(", "),
    destination,
    travelmode,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function timeValue(minute: number) {
  const normalized = ((minute % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function RouteTimeline({
  stops,
  legs,
  places,
  startLabel,
  endLabel,
  endLocationId,
  finishMinute,
  completedIds = [],
  currentPlaceId,
  currentStateLabel = "Up next",
  breaks = [],
  label = "Planned day in chronological order",
  insightsByPlaceId = {},
  onInsightSelect,
  showConstraintReasons = false,
  showDirectionsLinks = false,
  directionsRegion = "",
  variant = "detailed",
}: RouteTimelineProps) {
  const placesById = new Map(places.map((place) => [place.id, place]));
  const completed = new Set(completedIds);
  const timelineItems = [
    ...stops.map((stop, stopIndex) => ({
      kind: "stop" as const,
      startMinute: stop.startMinute,
      stop,
      stopIndex,
    })),
    ...breaks.map((item) => ({
      kind: "break" as const,
      startMinute: item.startMinute,
      item,
    })),
  ].sort((a, b) => a.startMinute - b.startMinute);
  const visibleTimelineItems =
    variant === "live"
      ? timelineItems.filter(
          (item) =>
            item.kind === "break" ||
            (!completed.has(item.stop.placeId) &&
              item.stop.placeId !== currentPlaceId),
        )
      : timelineItems;
  const returnLeg = legs.find((leg) => leg.toId === endLocationId);

  return (
    <ol
      className={`itinerary-list itinerary-list--${variant}`}
      aria-label={label}
    >
      {visibleTimelineItems.map((item) => {
        if (item.kind === "break") {
          return (
            <li className="itinerary-row itinerary-row--break" key={item.item.id}>
              <div className="itinerary-time">
                <time dateTime={timeValue(item.item.startMinute)}><strong>{formatTimelineTime(item.item.startMinute)}</strong></time>
                <span>to <time dateTime={timeValue(item.item.endMinute)}>{formatTimelineTime(item.item.endMinute)}</time></span>
              </div>
              <span className="itinerary-rail" aria-hidden="true"><i>☕</i></span>
              <div className="itinerary-copy">
                <p className="itinerary-travel">Protected pause</p>
                <h3>{item.item.label}</h3>
                <p>Real rest time, held inside the route.</p>
              </div>
            </li>
          );
        }

        const { stop, stopIndex } = item;
        const place = placesById.get(stop.placeId);
        const indexedLeg = legs[stopIndex];
        const inboundLeg = indexedLeg?.toId === stop.placeId
          ? indexedLeg
          : legs.find((leg) => leg.toId === stop.placeId);
        const previousLabel = stopIndex === 0
          ? startLabel
          : stops[stopIndex - 1]?.name ?? startLabel;
        const isComplete = completed.has(stop.placeId);
        const isCurrent = currentPlaceId === stop.placeId;
        const endMinute = stop.actualEndMinute ?? stop.endMinute;
        const timingLabels = place?.timingConstraints?.map((constraint) => constraint.label) ?? [];
        const insight = insightsByPlaceId[stop.placeId];
        const whyThisTime = showConstraintReasons
          ? constraintReason(place)
          : null;
        const directionsUrl = showDirectionsLinks
          ? googleMapsDirectionsUrl(stop, place, inboundLeg?.mode, previousLabel, directionsRegion)
          : null;

        return (
          <li
            className={`itinerary-row${stop.protected ? " itinerary-row--protected" : ""}${isComplete ? " itinerary-row--complete" : ""}${isCurrent ? " itinerary-row--current" : ""}`}
            key={stop.placeId}
            aria-current={isCurrent ? "step" : undefined}
          >
            <div className="itinerary-time">
              <time dateTime={timeValue(stop.startMinute)}><strong>{formatTimelineTime(stop.startMinute)}</strong></time>
              <span>to <time dateTime={timeValue(endMinute)}>{formatTimelineTime(endMinute)}</time></span>
            </div>
            <span className="itinerary-rail" aria-hidden="true">
              <i>{isComplete ? "✓" : stopIndex + 1}</i>
            </span>
            <div className="itinerary-copy">
              {isComplete ? (
                <p className="itinerary-travel">Memory tied</p>
              ) : inboundLeg ? (
                <p className="itinerary-travel">
                  <span className="itinerary-travel-full">Depart {formatTimelineTime(inboundLeg.departMinute)} · {travelModeLabel(inboundLeg.mode)} {inboundLeg.minutes} min from {previousLabel} · arrive {formatTimelineTime(inboundLeg.arriveMinute)}</span>
                  <span className="itinerary-travel-short">{formatTimelineTime(inboundLeg.departMinute)} · {travelModeLabel(inboundLeg.mode)} {inboundLeg.minutes} min</span>
                </p>
              ) : null}
              <div className="itinerary-place-line">
                <h3>{stop.name}</h3>
                {place?.area && <span>{place.area}</span>}
              </div>
              {stop.waitMinutes > 0 && !isComplete && (
                <p>{stop.waitMinutes} minutes of breathing room before the visit begins.</p>
              )}
              {whyThisTime && (
                <p className="itinerary-constraint-reason">{whyThisTime}</p>
              )}
              {insight && (
                onInsightSelect ? (
                  <button
                    className="itinerary-insight"
                    type="button"
                    onClick={() => onInsightSelect(stop.placeId)}
                    aria-label={`${insight.actionLabel ?? "See why"} for ${stop.name}: ${insight.summary}`}
                  >
                    <span className="itinerary-insight-label">
                      {insight.label ?? "Don't miss here"}
                    </span>
                    <strong className="itinerary-insight-summary">
                      {insight.summary}
                    </strong>
                    <span className="itinerary-insight-action" aria-hidden="true">
                      {insight.actionLabel ?? "See why"} →
                    </span>
                  </button>
                ) : (
                  <aside
                    className="itinerary-insight"
                    aria-label={`${insight.label ?? "Don't miss here"} at ${stop.name}`}
                  >
                    <span className="itinerary-insight-label">
                      {insight.label ?? "Don't miss here"}
                    </span>
                    <strong className="itinerary-insight-summary">
                      {insight.summary}
                    </strong>
                  </aside>
                )
              )}
              <div className="itinerary-labels">
                {place?.priority === "must" && <span>Must-visit</span>}
                {stop.fixedBooking && <span>{place?.fixedBooking?.label ?? "Fixed booking"}</span>}
                {timingLabels.map((timingLabel) => <span key={timingLabel}>{timingLabel}</span>)}
                {place?.shoppingLast && <span>Shopping last</span>}
                {isCurrent && <span>{currentStateLabel}</span>}
                {directionsUrl && (
                  <span className="itinerary-directions">
                    <a
                      className="itinerary-directions-link"
                      href={directionsUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Directions to ${stop.name} in Google Maps (opens in a new tab)`}
                    >
                      Directions ↗
                    </a>
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}

      <li className="itinerary-row itinerary-row--end">
        <div className="itinerary-time">
          <time dateTime={timeValue(returnLeg?.arriveMinute ?? finishMinute)}><strong>{formatTimelineTime(returnLeg?.arriveMinute ?? finishMinute)}</strong></time>
          <span>day complete</span>
        </div>
        <span className="itinerary-rail" aria-hidden="true"><i>✓</i></span>
        <div className="itinerary-copy">
          {returnLeg && (
            <p className="itinerary-travel">
              <span className="itinerary-travel-full">Depart {formatTimelineTime(returnLeg.departMinute)} · {travelModeLabel(returnLeg.mode)} {returnLeg.minutes} min from {stops.at(-1)?.name ?? startLabel}</span>
              <span className="itinerary-travel-short">{formatTimelineTime(returnLeg.departMinute)} · {travelModeLabel(returnLeg.mode)} {returnLeg.minutes} min</span>
            </p>
          )}
          <div className="itinerary-place-line">
            <h3>{endLabel}</h3>
            <span>End of the planned day</span>
          </div>
        </div>
      </li>
    </ol>
  );
}
