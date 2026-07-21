import type { CSSProperties, DragEvent } from "react";

export type CharmPriority = "must" | "love" | "optional";

export interface ThreadPlace {
  id: string;
  name: string;
  shortName?: string;
  priority: CharmPriority;
  icon?: string;
  fixed?: boolean;
}

const charmPositions = [
  [8, 17, -4],
  [61, 8, 3],
  [33, 30, -2],
  [73, 36, 4],
  [10, 50, 3],
  [47, 57, -4],
  [77, 69, 2],
  [26, 77, -2],
  [57, 84, 4],
] as const;

export function PlaceCharm({
  place,
  compact = false,
  completed = false,
  onClick,
  onDragStart,
}: {
  place: ThreadPlace;
  compact?: boolean;
  completed?: boolean;
  onClick?: () => void;
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
}) {
  const priorityLabel =
    place.priority === "must"
      ? "Must visit"
      : place.priority === "love"
        ? "Would love"
        : "Only if convenient";

  const className = `place-charm place-charm--${place.priority}${compact ? " place-charm--compact" : ""}${completed ? " place-charm--completed" : ""}`;
  const content = (
    <>
      <span className="charm-icon" aria-hidden="true">{place.icon ?? "✦"}</span>
      <span className="charm-copy">
        <strong>{place.shortName ?? place.name}</strong>
        {!compact && <small>{place.fixed ? "Fixed booking" : priorityLabel}</small>}
      </span>
      {place.priority === "must" && <span className="protected-knot" aria-hidden="true">⌁</span>}
      {completed && <span className="completed-knot" aria-hidden="true">●</span>}
    </>
  );

  if (!onClick && !onDragStart) {
    return <span className={className} aria-hidden="true">{content}</span>;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart}
      aria-label={`${place.name}. ${priorityLabel}${place.fixed ? ". Fixed booking" : ""}${onClick ? ". Tap to change priority" : ""}`}
    >
      {content}
    </button>
  );
}

export function ThreadMap({
  places,
  untangled = false,
  completedIds = [],
  label = "Travel wishes connected by a tangled coral thread",
}: {
  places: ThreadPlace[];
  untangled?: boolean;
  completedIds?: string[];
  label?: string;
}) {
  const placeSummary = untangled
    ? `Route order: ${places.map((place) => place.name).join(", ")}.`
    : `Included places: ${places.map((place) => place.name).join(", ")}.`;
  const completedNames = places
    .filter((place) => completedIds.includes(place.id))
    .map((place) => place.name);
  const completedSummary = completedNames.length > 0
    ? ` Completed: ${completedNames.join(", ")}.`
    : "";

  return (
    <div
      className={`thread-map${untangled ? " thread-map--untangled" : ""}`}
      role="img"
      aria-label={`${label}. ${placeSummary}${completedSummary}`}
    >
      <div className="thread-strands" aria-hidden="true">
        <i className="strand strand--one" />
        <i className="strand strand--two" />
        <i className="strand strand--three" />
        <i className="strand strand--four" />
        <i className="strand strand--five" />
      </div>
      <div className="thread-charms">
        {places.map((place, index) => {
          const [x, y, r] = charmPositions[index % charmPositions.length];
          const style = {
            "--charm-x": `${x}%`,
            "--charm-y": `${y}%`,
            "--charm-r": `${r}deg`,
            "--route-order": index,
            "--route-row": Math.floor(index / 3),
            "--route-col": index % 3,
          } as CSSProperties;
          return (
            <div className="thread-charm-position" style={style} key={place.id}>
              <PlaceCharm place={place} compact completed={completedIds.includes(place.id)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
