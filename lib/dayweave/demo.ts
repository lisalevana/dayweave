import { minute } from "./time";
import type {
  DiscoverySuggestion,
  ExperienceBrief,
  OptimizationInput,
  Place,
  TravelMatrix,
  TravelOption,
} from "./types";

export const HONG_KONG_DEMO_DATE = "2026-10-17";
export const HONG_KONG_DEMO_DELAY_MINUTES = 40;

interface DemoLocation {
  id: string;
  latitude: number;
  longitude: number;
}

const demoLocations: DemoLocation[] = [
  {
    id: "sheung-wan-start",
    latitude: 22.2866,
    longitude: 114.1509,
  },
  { id: "man-mo-temple", latitude: 22.2847, longitude: 114.1501 },
  { id: "tai-kwun", latitude: 22.2814, longitude: 114.1542 },
  { id: "victoria-peak", latitude: 22.2759, longitude: 114.1455 },
  { id: "maks-noodle", latitude: 22.2819, longitude: 114.1556 },
  { id: "pmq", latitude: 22.2832, longitude: 114.1511 },
  { id: "bakehouse-soho", latitude: 22.2821, longitude: 114.1528 },
  { id: "mid-levels-escalator", latitude: 22.2824, longitude: 114.1539 },
  { id: "star-ferry-central", latitude: 22.2878, longitude: 114.1618 },
  { id: "temple-street-market", latitude: 22.3068, longitude: 114.1705 },
  { id: "upper-lascar-row", latitude: 22.2845, longitude: 114.1494 },
  { id: "jordan-hotel-end", latitude: 22.3049, longitude: 114.1714 },
];

export const hongKongPlaces: Place[] = [
  {
    id: "man-mo-temple",
    name: "Man Mo Temple",
    area: "Sheung Wan",
    priority: "must",
    durationMinutes: 45,
    openingWindows: [
      { start: minute(8), end: minute(18), label: "Seeded demo hours" },
    ],
    source: "seeded_demo",
    icon: "temple",
    note: "A quiet first stop before Central becomes busy.",
  },
  {
    id: "tai-kwun",
    name: "Tai Kwun",
    area: "Central",
    priority: "must",
    durationMinutes: 75,
    openingWindows: [
      { start: minute(10), end: minute(19), label: "Seeded demo hours" },
    ],
    source: "seeded_demo",
    icon: "courtyard",
  },
  {
    id: "victoria-peak",
    name: "Victoria Peak",
    area: "The Peak",
    priority: "must",
    durationMinutes: 75,
    openingWindows: [
      { start: minute(10), end: minute(22), label: "Seeded demo hours" },
    ],
    timingConstraints: [
      {
        id: "peak-near-sunset",
        kind: "sunset",
        window: {
          start: minute(17, 10),
          end: minute(18, 35),
          label: "Near sunset",
        },
        label: "Victoria Peak near sunset",
      },
    ],
    source: "seeded_demo",
    icon: "sunset",
    note: "Near sunset — confirmed by the traveller.",
  },
  {
    id: "maks-noodle",
    name: "Mak’s Noodle",
    area: "Central",
    priority: "love",
    durationMinutes: 60,
    openingWindows: [
      { start: minute(11), end: minute(21), label: "Seeded demo hours" },
    ],
    fixedBooking: {
      start: minute(12, 30),
      end: minute(13, 30),
      label: "Lunch reservation",
      reference: "DW-DEMO-1230",
    },
    source: "seeded_demo",
    icon: "noodles",
  },
  {
    id: "pmq",
    name: "PMQ",
    area: "SoHo",
    priority: "love",
    durationMinutes: 65,
    openingWindows: [
      { start: minute(11), end: minute(19), label: "Seeded demo hours" },
    ],
    source: "seeded_demo",
    icon: "studio",
  },
  {
    id: "bakehouse-soho",
    name: "Bakehouse SoHo",
    area: "SoHo",
    priority: "love",
    durationMinutes: 30,
    openingWindows: [
      { start: minute(8), end: minute(18), label: "Seeded demo hours" },
    ],
    source: "seeded_demo",
    icon: "bakery",
  },
  {
    id: "mid-levels-escalator",
    name: "Central–Mid-Levels Escalator",
    area: "Central",
    priority: "convenient",
    durationMinutes: 35,
    openingWindows: [
      { start: minute(10), end: minute(19), label: "Seeded demo window" },
    ],
    source: "seeded_demo",
    icon: "steps",
  },
  {
    id: "star-ferry-central",
    name: "Star Ferry crossing",
    area: "Victoria Harbour",
    priority: "convenient",
    durationMinutes: 45,
    openingWindows: [
      { start: minute(10), end: minute(20), label: "Seeded demo window" },
    ],
    source: "seeded_demo",
    icon: "ferry",
  },
  {
    id: "temple-street-market",
    name: "Temple Street Night Market",
    area: "Jordan",
    priority: "love",
    durationMinutes: 65,
    openingWindows: [
      { start: minute(18), end: minute(23), label: "Seeded demo window" },
    ],
    shoppingLast: true,
    source: "seeded_demo",
    icon: "shopping-bag",
    note: "Shopping last so bags are not carried all day.",
  },
];

export const hongKongTravelMatrix: TravelMatrix = buildDemoTravelMatrix(
  demoLocations,
);

export const hongKongDemoInput: OptimizationInput = {
  places: hongKongPlaces,
  travelMatrix: hongKongTravelMatrix,
  day: {
    date: HONG_KONG_DEMO_DATE,
    timezone: "Asia/Hong_Kong",
    startLocationId: "sheung-wan-start",
    endLocationId: "jordan-hotel-end",
    startMinute: minute(10, 30),
    endMinute: minute(21),
    pace: "balanced",
    maxWalkingKm: 3.6,
    allowedModes: ["walk", "transit"],
  },
};

export const tangledDemoOrder: string[] = [
  "star-ferry-central",
  "man-mo-temple",
  "mid-levels-escalator",
  "pmq",
  "tai-kwun",
  "bakehouse-soho",
  "maks-noodle",
  "temple-street-market",
  "victoria-peak",
];

export const messyHongKongWishlist = `Hong Kong Saturday!!
NON-NEGOTIABLE: Man Mo Temple, Tai Kwun + Victoria Peak around sunset 🌇
Mak's lunch booking 12:30–1:30 (ref DW-DEMO-1230)
PMQ would be lovely
maybe Bakehouse Soho / the long escalator / Star Ferry if there’s time?
Temple Street for shopping — LAST please, don't want to carry bags all day
Starting near Sheung Wan MTR at 10:30, back to the hotel in Jordan by 9ish.`;

const bakehouseDemoClaim: import("../schemas/evidence").ExperienceClaim = {
  id: "demo-bakehouse-egg-tart",
  claim:
    "The seeded editorial brief repeatedly highlights the sourdough egg tart as the defining order.",
  placeOrArea: "Bakehouse SoHo",
  sourceUrl: "https://www.bakehouse.hk/",
  sourceType: "manually_curated",
  observationDate: "2026-06-08",
  lastCheckedDate: "2026-06-15",
  confidence: "high",
  recurrenceLevel: "strong_recurring_visitor_favourite",
  conflictingEvidence: [],
  canInfluenceScheduling: false,
  timingEvidence: {
    verification: "none",
    constraintKind: null,
    constraintValue: null,
  },
};

export const bakehouseExperienceBrief: ExperienceBrief = {
  placeId: "bakehouse-soho",
  whyPeopleCome:
    "A small bakery stop with a distinct Hong Kong identity and an easygoing neighbourhood feel.",
  dontMiss:
    "The sourdough egg tart is the seeded demo’s strongest recurring recommendation. If you choose one pastry, make it this one.",
  worthKnowing:
    "Try it while it is warm if the timing happens to work. The demo does not use unverified sell-out reports to move your route.",
  claims: [bakehouseDemoClaim],
  isSeededDemo: true,
};

const upperLascarDemoClaim: import("../schemas/evidence").ExperienceClaim = {
  id: "demo-upper-lascar-local-classic",
  claim:
    "This compact antique-market street adds a contrasting, place-specific browsing moment near the Sheung Wan cluster.",
  placeOrArea: "Upper Lascar Row",
  sourceUrl: "https://www.discoverhongkong.com/",
  sourceType: "manually_curated",
  observationDate: "2026-06-08",
  lastCheckedDate: "2026-06-15",
  confidence: "medium",
  recurrenceLevel: "destination_defining_local_classic",
  conflictingEvidence: [],
  canInfluenceScheduling: false,
  timingEvidence: {
    verification: "none",
    constraintKind: null,
    constraintValue: null,
  },
};

export const upperLascarRowSuggestion: DiscoverySuggestion = {
  id: "discovery-upper-lascar-row",
  place: {
    id: "upper-lascar-row",
    name: "Upper Lascar Row",
    area: "Sheung Wan",
    priority: "convenient",
    durationMinutes: 30,
    openingWindows: [
      { start: minute(10), end: minute(18), label: "Seeded demo window" },
    ],
    source: "approved_discovery",
    icon: "curio",
    note: "A nearby, optional browse — never added automatically.",
  },
  whyRelevant:
    "It sits close to the morning Sheung Wan cluster and adds a small street-level contrast to the larger heritage stops.",
  category: "destination_defining_local_classic",
  detourMinutes: 8,
  displacement: null,
  evidence: [upperLascarDemoClaim],
  isSeededDemo: true,
};

export const hongKongDemo = {
  input: hongKongDemoInput,
  messyWishlist: messyHongKongWishlist,
  tangledOrder: tangledDemoOrder,
  delayMinutes: HONG_KONG_DEMO_DELAY_MINUTES,
  experienceBrief: bakehouseExperienceBrief,
  discovery: upperLascarRowSuggestion,
} as const;

function buildDemoTravelMatrix(locations: DemoLocation[]): TravelMatrix {
  const matrix: TravelMatrix = {};

  for (const from of locations) {
    matrix[from.id] = {};
    for (const to of locations) {
      matrix[from.id][to.id] =
        from.id === to.id
          ? [
              {
                mode: "walk",
                minutes: 0,
                walkingKm: 0,
                distanceKm: 0,
                source: "seeded_demo_estimate",
              },
            ]
          : makeTravelOptions(from, to);
    }
  }

  return matrix;
}

function makeTravelOptions(
  from: DemoLocation,
  to: DemoLocation,
): readonly TravelOption[] {
  const directKm = haversineKm(from, to);
  const involvesPeak =
    from.id === "victoria-peak" || to.id === "victoria-peak";
  const crossesHarbourCluster =
    isKowloon(from.id) !== isKowloon(to.id) &&
    (isKowloon(from.id) || isKowloon(to.id));
  const roadKm = involvesPeak
    ? directKm * 1.55 + 1.1
    : directKm * 1.24 + 0.08;
  const walkMinutes = Math.max(
    3,
    Math.ceil(roadKm / 0.074) + (involvesPeak ? 12 : 0),
  );
  const transitMinutes = Math.max(
    8,
    Math.ceil(directKm / 0.26) +
      7 +
      (involvesPeak ? 16 : 0) +
      (crossesHarbourCluster ? 8 : 0),
  );
  const transitWalkingKm = Math.min(
    0.62,
    Math.max(0.16, directKm * 0.13 + 0.12),
  );

  return [
    {
      mode: "walk",
      minutes: walkMinutes,
      walkingKm: round(roadKm),
      distanceKm: round(roadKm),
      source: "seeded_demo_estimate",
    },
    {
      mode: "transit",
      minutes: transitMinutes,
      walkingKm: round(transitWalkingKm),
      distanceKm: round(directKm * 1.12),
      fareHkd: involvesPeak ? 18 : crossesHarbourCluster ? 7 : 5,
      source: "seeded_demo_estimate",
    },
  ];
}

function isKowloon(id: string): boolean {
  return id === "temple-street-market" || id === "jordan-hotel-end";
}

function haversineKm(from: DemoLocation, to: DemoLocation): number {
  const earthRadiusKm = 6371;
  const latitudeDelta = degreesToRadians(to.latitude - from.latitude);
  const longitudeDelta = degreesToRadians(to.longitude - from.longitude);
  const fromLatitude = degreesToRadians(from.latitude);
  const toLatitude = degreesToRadians(to.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
