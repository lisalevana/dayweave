export type GeographicRouteBasis =
  | "verified_locations"
  | "curated_sequence";

export interface GeographicStop {
  id: string;
  localityKey: string;
  localityLabel: string;
  latitude?: number;
  longitude?: number;
  preferredDayOrder?: number;
  routeRank?: number;
  dayTitle?: string;
  dayRationale?: string;
}

export interface PlannedGeographicDay {
  dayNumber: number;
  areaLabel: string;
  title: string;
  rationale: string;
  stopIds: string[];
  basis: GeographicRouteBasis;
}

export interface GeographicRoutePlan {
  basis: GeographicRouteBasis;
  summary: string;
  days: PlannedGeographicDay[];
}

export type BranchMatchKind =
  | "explicit"
  | "same_complex"
  | "contextual_area"
  | "destination_default";

export interface ContextualBranchVariant<TStop> {
  id: string;
  stop: TStop;
  explicitAliases: string[];
  contextAliases: string[];
  contextMatchKind: Exclude<
    BranchMatchKind,
    "explicit" | "destination_default"
  >;
  contextReason: string;
}

export interface ContextualBranchFamily<TStop> {
  id: string;
  intentLabel: string;
  aliases: string[];
  defaultVariantId: string;
  includeByDefault: boolean;
  defaultReason: string;
  variants: ContextualBranchVariant<TStop>[];
}

export interface ContextualBranchResolution<TStop> {
  stop: TStop;
  intentMatched: boolean;
  resolution:
    | {
        intent: string;
        selectedPlaceId: string;
        selectedPlaceName: string;
        matchKind: BranchMatchKind;
        reason: string;
        alternative:
          | {
              placeId: string;
              placeName: string;
            }
          | null;
      }
    | null;
}

function normalizePhrase(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/&(?:amp;)?/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function textContainsPhrase(
  text: string,
  aliases: readonly string[],
): boolean {
  const haystack = ` ${normalizePhrase(text)} `;
  return aliases.some((alias) => {
    const needle = normalizePhrase(alias);
    return needle.length > 1 && haystack.includes(` ${needle} `);
  });
}

function longestMatchingAlias(
  text: string,
  aliases: readonly string[],
): number {
  return aliases.reduce(
    (longest, alias) =>
      textContainsPhrase(text, [alias])
        ? Math.max(longest, normalizePhrase(alias).length)
        : longest,
    0,
  );
}

export function resolveContextualBranch<
  TStop extends { id: string; name: string },
>(
  family: ContextualBranchFamily<TStop>,
  wishlistText: string,
): ContextualBranchResolution<TStop> | null {
  const explicitMatches = family.variants
    .map((variant) => ({
      variant,
      matchLength: longestMatchingAlias(
        wishlistText,
        variant.explicitAliases,
      ),
    }))
    .filter(({ matchLength }) => matchLength > 0)
    .sort(
      (left, right) =>
        right.matchLength - left.matchLength ||
        left.variant.id.localeCompare(right.variant.id),
    );
  const intentMatched =
    textContainsPhrase(wishlistText, family.aliases) ||
    explicitMatches.length > 0;

  if (!family.includeByDefault && !intentMatched) return null;

  let selected = explicitMatches[0]?.variant;
  let matchKind: BranchMatchKind = "explicit";
  let reason = selected
    ? `You named ${selected.stop.name} directly, so DayWeave kept that branch.`
    : "";

  if (!selected && intentMatched) {
    const contextualMatches = family.variants
      .map((variant) => ({
        variant,
        matchCount: variant.contextAliases.filter((alias) =>
          textContainsPhrase(wishlistText, [alias]),
        ).length,
      }))
      .filter(({ matchCount }) => matchCount > 0)
      .sort(
        (left, right) =>
          right.matchCount - left.matchCount ||
          left.variant.id.localeCompare(right.variant.id),
      );
    selected = contextualMatches[0]?.variant;
    if (selected) {
      matchKind = selected.contextMatchKind;
      reason = selected.contextReason;
    }
  }

  if (!selected) {
    selected =
      family.variants.find(
        (variant) => variant.id === family.defaultVariantId,
      ) ?? family.variants[0];
    matchKind = "destination_default";
    reason = family.defaultReason;
  }

  if (!selected) return null;

  const alternative = family.variants.find(
    (variant) => variant.id !== selected?.id,
  );

  return {
    stop: selected.stop,
    intentMatched,
    resolution: intentMatched
      ? {
          intent: family.intentLabel,
          selectedPlaceId: selected.stop.id,
          selectedPlaceName: selected.stop.name,
          matchKind,
          reason,
          alternative: alternative
            ? {
                placeId: alternative.stop.id,
                placeName: alternative.stop.name,
              }
            : null,
        }
      : null,
  };
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineKm(left: GeographicStop, right: GeographicStop): number {
  if (
    left.latitude === undefined ||
    left.longitude === undefined ||
    right.latitude === undefined ||
    right.longitude === undefined
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const earthRadiusKm = 6_371;
  const latitudeDelta = degreesToRadians(
    right.latitude - left.latitude,
  );
  const longitudeDelta = degreesToRadians(
    right.longitude - left.longitude,
  );
  const leftLatitude = degreesToRadians(left.latitude);
  const rightLatitude = degreesToRadians(right.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function comparePath(
  left: number[],
  right: number[],
  stops: readonly GeographicStop[],
): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const leftStop = stops[left[index]];
    const rightStop = stops[right[index]];
    const rankDifference =
      (leftStop.routeRank ?? Number.MAX_SAFE_INTEGER) -
      (rightStop.routeRank ?? Number.MAX_SAFE_INTEGER);
    if (rankDifference !== 0) return rankDifference;
    const idDifference = leftStop.id.localeCompare(rightStop.id);
    if (idDifference !== 0) return idDifference;
  }
  return left.length - right.length;
}

function shortestOpenPath(
  stops: readonly GeographicStop[],
): GeographicStop[] {
  if (stops.length <= 1) return [...stops];

  type PathState = { distance: number; path: number[] };
  const stateByMaskAndLast = new Map<string, PathState>();

  stops.forEach((_, index) => {
    stateByMaskAndLast.set(`${1 << index}:${index}`, {
      distance: 0,
      path: [index],
    });
  });

  const fullMask = (1 << stops.length) - 1;
  for (let mask = 1; mask <= fullMask; mask += 1) {
    for (let last = 0; last < stops.length; last += 1) {
      const state = stateByMaskAndLast.get(`${mask}:${last}`);
      if (!state) continue;

      for (let next = 0; next < stops.length; next += 1) {
        if ((mask & (1 << next)) !== 0) continue;
        const nextMask = mask | (1 << next);
        const nextPath = [...state.path, next];
        const nextDistance =
          state.distance + haversineKm(stops[last], stops[next]);
        const key = `${nextMask}:${next}`;
        const current = stateByMaskAndLast.get(key);
        if (
          !current ||
          nextDistance < current.distance - 0.000_001 ||
          (Math.abs(nextDistance - current.distance) <= 0.000_001 &&
            comparePath(nextPath, current.path, stops) < 0)
        ) {
          stateByMaskAndLast.set(key, {
            distance: nextDistance,
            path: nextPath,
          });
        }
      }
    }
  }

  const complete = [...stateByMaskAndLast.entries()]
    .filter(([key]) => key.startsWith(`${fullMask}:`))
    .map(([, state]) => state)
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        comparePath(left.path, right.path, stops),
    )[0];

  return complete ? complete.path.map((index) => stops[index]) : [...stops];
}

export function planGeographicDays(
  stops: readonly GeographicStop[],
): GeographicRoutePlan {
  const groups = new Map<string, GeographicStop[]>();
  stops.forEach((stop) => {
    const current = groups.get(stop.localityKey) ?? [];
    current.push(stop);
    groups.set(stop.localityKey, current);
  });

  const orderedGroups = [...groups.values()].sort((left, right) => {
    const orderDifference =
      Math.min(
        ...left.map(
          (stop) => stop.preferredDayOrder ?? Number.MAX_SAFE_INTEGER,
        ),
      ) -
      Math.min(
        ...right.map(
          (stop) => stop.preferredDayOrder ?? Number.MAX_SAFE_INTEGER,
        ),
      );
    if (orderDifference !== 0) return orderDifference;
    return left[0].localityLabel.localeCompare(right[0].localityLabel);
  });

  const multipleDays = orderedGroups.length > 1;
  const days = orderedGroups.map((group, index): PlannedGeographicDay => {
    const hasVerifiedLocations = group.every(
      (stop) =>
        stop.latitude !== undefined && stop.longitude !== undefined,
    );
    const orderedStops = hasVerifiedLocations
      ? shortestOpenPath(group)
      : [...group];
    const areaLabel = group[0].localityLabel;
    return {
      dayNumber: index + 1,
      areaLabel,
      title:
        group[0].dayTitle ??
        (multipleDays ? `${areaLabel} day` : `${areaLabel} thread`),
      rationale:
        group[0].dayRationale ??
        (multipleDays
          ? `These stops stay together in ${areaLabel}, avoiding a leave-and-return pattern between regions.`
          : `These stops form one ${areaLabel} thread. Their order reduces geographic backtracking; Maps remains responsible for live travel time.`),
      stopIds: orderedStops.map((stop) => stop.id),
      basis: hasVerifiedLocations
        ? "verified_locations"
        : "curated_sequence",
    };
  });

  const basis = days.every((day) => day.basis === "verified_locations")
    ? "verified_locations"
    : "curated_sequence";
  const labels = days.map((day) => day.areaLabel);

  return {
    basis,
    summary:
      days.length > 1
        ? `${days.length} geographic day threads keep ${labels.join(" and ")} separate, avoiding cross-region backtracking.`
        : basis === "verified_locations"
          ? "One location-backed day thread reduces geographic backtracking. Check Maps for current travel time."
          : "One recommended sequence is shown. Live route optimization needs verified locations and current routing data.",
    days,
  };
}
