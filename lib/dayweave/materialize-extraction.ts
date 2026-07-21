import { resolveSupportedHongKongPlaceId } from "../adapters/local-hong-kong-extraction";
import {
  WishlistExtractionSchema,
  type WishlistExtraction,
} from "../schemas/extraction";

import type { Pace, Place, Priority } from "./types";

function priorityFromIntent(
  intent: WishlistExtraction["places"][number]["priorityIntent"],
): Priority {
  if (intent === "must_visit") return "must";
  if (intent === "only_if_convenient") return "convenient";
  return "love";
}

function minuteFromClock(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export type MaterializedWishlist = {
  extraction: WishlistExtraction | null;
  places: Place[];
  pace: Pace | null;
  walkingKm: number | null;
};

export function materializeWishlistEnvelope(
  envelope: unknown,
  catalog: readonly Place[],
): MaterializedWishlist {
  const rawExtraction =
    envelope && typeof envelope === "object"
      ? (envelope as { extraction?: unknown }).extraction
      : null;
  const parsed = WishlistExtractionSchema.safeParse(rawExtraction);
  if (!parsed.success) {
    return { extraction: null, places: [], pace: null, walkingKm: null };
  }

  const extraction = parsed.data;
  const catalogById = new Map(catalog.map((place) => [place.id, place]));
  const bookingById = new Map(
    extraction.bookings.flatMap((booking) => {
      const id = resolveSupportedHongKongPlaceId(booking.placeName);
      return id ? [[id, booking] as const] : [];
    }),
  );
  const nearSunsetIds = new Set(
    extraction.semanticConstraints.flatMap((constraint) => {
      if (constraint.kind !== "near_sunset" || !constraint.placeName) return [];
      const id = resolveSupportedHongKongPlaceId(constraint.placeName);
      return id ? [id] : [];
    }),
  );
  const shoppingLastIds = new Set(
    extraction.semanticConstraints.flatMap((constraint) => {
      if (
        !["avoid_carrying", "last"].includes(constraint.kind) ||
        !constraint.placeName
      ) {
        return [];
      }
      const id = resolveSupportedHongKongPlaceId(constraint.placeName);
      return id ? [id] : [];
    }),
  );
  const seen = new Set<string>();
  const places = extraction.places.flatMap((extractedPlace) => {
    const id = resolveSupportedHongKongPlaceId(extractedPlace.normalizedName);
    const catalogPlace = id ? catalogById.get(id) : undefined;
    if (!id || !catalogPlace || seen.has(id)) return [];
    seen.add(id);

    const place: Place = {
      ...catalogPlace,
      priority: priorityFromIntent(extractedPlace.priorityIntent),
      source: "user",
      note: extractedPlace.note ?? undefined,
      fixedBooking: undefined,
      timingConstraints: undefined,
      shoppingLast: undefined,
    };
    const booking = bookingById.get(id);

    if (booking?.startTime && booking.endTime) {
      const start = minuteFromClock(booking.startTime);
      const end = minuteFromClock(booking.endTime);
      if (end > start) {
        place.fixedBooking = {
          start,
          end,
          label: "Booking from your notes",
          reference: booking.confirmationCode ?? undefined,
        };
      }
    } else if (booking?.startTime) {
      place.note = `Booking starts at ${booking.startTime}; confirm an end time before planning.`;
    }

    if (nearSunsetIds.has(id) && catalogPlace.timingConstraints) {
      place.timingConstraints = catalogPlace.timingConstraints.map((constraint) => ({
        ...constraint,
        window: { ...constraint.window },
      }));
    }
    if (shoppingLastIds.has(id)) place.shoppingLast = true;

    return [place];
  });

  const pace = extraction.pace === "unknown" ? null : extraction.pace;
  const walkingKm =
    extraction.walkingComfort === "minimal"
      ? 2.4
      : extraction.walkingComfort === "moderate"
        ? 3.6
        : extraction.walkingComfort === "comfortable_with_more"
          ? 5.2
          : null;

  return { extraction, places, pace, walkingKm };
}
