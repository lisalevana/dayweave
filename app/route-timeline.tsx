import type {
  PlannedLeg,
  PlannedStop,
  Place,
  ProtectedBreak,
  TravelMode,
} from "@/lib/dayweave/types";
import { formatTime } from "@/lib/dayweave/time";

type TimelineStop = PlannedStop & { actualEndMinute?: number };

export function travelModeLabel(mode: TravelMode) {
  if (mode === "walk") return "Walk";
  if (mode === "transit") return "Public transport";
  return "Taxi";
}

export function formatTimelineTime(minute: number) {
  return `${formatTime(minute)}${minute >= 24 * 60 ? " · next day" : ""}`;
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
}: {
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
}) {
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
  const returnLeg = legs.find((leg) => leg.toId === endLocationId);

  return (
    <ol className="itinerary-list" aria-label={label}>
      {timelineItems.map((item) => {
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
              <div className="itinerary-labels">
                {place?.priority === "must" && <span>Must-visit</span>}
                {stop.fixedBooking && <span>{place?.fixedBooking?.label ?? "Fixed booking"}</span>}
                {timingLabels.map((timingLabel) => <span key={timingLabel}>{timingLabel}</span>)}
                {place?.shoppingLast && <span>Shopping last</span>}
                {isCurrent && <span>{currentStateLabel}</span>}
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
