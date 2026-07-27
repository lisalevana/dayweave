"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  BAKEHOUSE_DONT_MISS_HERE,
  MAKS_NOODLE_DONT_MISS_HERE,
} from "@/lib/adapters/experience-evidence";
import { resolveSupportedHongKongPlaceId } from "@/lib/adapters/local-hong-kong-extraction";
import { hongKongDemo } from "@/lib/dayweave/demo";
import { materializeWishlistEnvelope } from "@/lib/dayweave/materialize-extraction";
import {
  materializeRecommendationDay,
  type RecommendationJourneyContext,
} from "@/lib/dayweave/materialize-recommendation";
import { getTravelOptions, optimizeDay } from "@/lib/dayweave/optimizer";
import {
  applyLiveEvent,
  buildRecoveryChoices,
  createLiveState,
} from "@/lib/dayweave/replan";
import { formatTime } from "@/lib/dayweave/time";
import type {
  LiveDayState,
  OptimizationInput,
  OptimizationResult,
  Pace,
  Place,
  PlanChange,
  Priority,
  RecoveryChoice as EngineRecoveryChoice,
} from "@/lib/dayweave/types";
import type { DayRecommendationBundle } from "@/lib/schemas/evidence";

import {
  ThreadMap,
  type CharmPriority,
  type ThreadPlace,
} from "./thread-map";
import {
  formatTimelineTime,
  RouteTimeline,
  travelModeLabel,
} from "./route-timeline";
import { DestinationCombobox } from "./destination-combobox";
import { Wivi } from "./wivi";

type Stage =
  | "opening"
  | "confirm"
  | "recommendation"
  | "result"
  | "live"
  | "repair"
  | "briefing"
  | "reweave"
  | "memory";

type ImportStatus = "idle" | "working" | "ready" | "error";
type PlanningMode = "adaptive" | "recommendation";
type SupportSheet = "stay" | "break" | "skip" | null;
type RecoveryChoiceId = EngineRecoveryChoice["id"] | null;
type BriefingOrigin = "result" | "live";

interface ExtractionCapabilities {
  available: boolean;
  screenshotAnalysisAvailable: boolean;
  model?: string | null;
}

interface JourneySnapshot {
  version: 1 | 2;
  savedAt: string;
  stage: "result" | "live";
  demoMode: boolean;
  places: Place[];
  pace: Pace;
  walkingKm: number;
  plan: OptimizationResult;
  liveState: LiveDayState | null;
  nowMinute: number;
  travelActive: boolean;
  arrived: boolean;
  recoveryApplied: boolean;
  recoveryChoice: RecoveryChoiceId;
  stayMinutes: 15 | 30 | 60 | null;
  breakMinutes: number | null;
  destination?: string;
  planningMode?: PlanningMode;
  activeJourneyInput?: OptimizationInput;
  journeyContext?: RecommendationJourneyContext | null;
}

const JOURNEY_STORAGE_KEY = "dayweave:journey:v1";

const stageProgress: Record<Stage, number> = {
  opening: 0,
  confirm: 2,
  recommendation: 2,
  result: 3,
  live: 3,
  repair: 3,
  briefing: 3,
  reweave: 3,
  memory: 3,
};

const iconGlyphs: Record<string, string> = {
  temple: "寺",
  courtyard: "▦",
  sunset: "◒",
  noodles: "麵",
  studio: "✦",
  bakery: "◫",
  steps: "↗",
  ferry: "≈",
  "shopping-bag": "袋",
  curio: "古",
};

const laneCopy: Record<Priority, { title: string; description: string }> = {
  must: {
    title: "Must visit",
    description: "Protected with a knot",
  },
  love: {
    title: "Would love",
    description: "High remembered value",
  },
  convenient: {
    title: "Only if convenient",
    description: "Lovely, never owed",
  },
};

const dontMissByPlaceId = {
  "man-mo-temple": {
    label: "Don’t miss here · Man Mo Temple",
    summary: "Look up: the hanging spiral incense coils make the temple’s atmosphere unforgettable.",
  },
  "tai-kwun": {
    label: "Don’t miss here · Tai Kwun",
    summary: "Pause in the historic courtyards, where old police buildings meet contemporary art.",
  },
  "victoria-peak": {
    label: "Don’t miss here · Victoria Peak",
    summary: "Protect the golden-hour window so the harbour changes from daylight to city lights.",
  },
  "maks-noodle": {
    label: "Don’t miss here · Mak’s Noodle",
    summary: "The signature bowl pairs bouncy shrimp wontons with springy duck-egg noodles.",
  },
  pmq: {
    label: "Don’t miss here · PMQ",
    summary: "Browse the small independent Hong Kong design studios, not only the central courtyard.",
  },
  "bakehouse-soho": {
    label: "Don’t miss here · Bakehouse SoHo",
    summary: "If one bake fits, make it the sourdough egg tart.",
  },
  "mid-levels-escalator": {
    label: "Don’t miss here · Mid-Levels Escalator",
    summary: "Notice how the city changes block by block as the moving walkway climbs through Central.",
  },
  "star-ferry-central": {
    label: "Don’t miss here · Star Ferry",
    summary: "Take the harbour-facing side and let the skyline unfold from the water.",
  },
  "temple-street-market": {
    label: "Don’t miss here · Temple Street",
    summary: "Come after dark for the street atmosphere, open-air stalls and late-night energy.",
  },
} as const;

const stageMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

function toThreadPlace(place: Place): ThreadPlace {
  const priority: CharmPriority =
    place.priority === "convenient" ? "optional" : place.priority;
  return {
    id: place.id,
    name: place.name,
    shortName:
      place.id === "mid-levels-escalator"
        ? "Mid-Levels"
        : place.id === "temple-street-market"
          ? "Temple Street"
          : place.id === "star-ferry-central"
            ? "Star Ferry"
            : place.name,
    priority,
    icon: iconGlyphs[place.icon ?? ""] ?? "✦",
    fixed: Boolean(place.fixedBooking),
  };
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function directionsUrl(
  placeName: string,
  area?: string,
  originName?: string,
  region = "",
) {
  const params = new URLSearchParams({
    api: "1",
    destination: [placeName, area, region].filter(Boolean).join(", "),
  });
  if (originName) {
    params.set("origin", [originName, region].filter(Boolean).join(", "));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function placeSearchUrl(placeName: string, destination: string) {
  const params = new URLSearchParams({
    api: "1",
    query: mapsPlaceQuery(placeName, destination),
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function mapsPlaceQuery(placeName: string, area: string) {
  const normalizedName = placeName.toLocaleLowerCase("en");
  const normalizedArea = area.trim().toLocaleLowerCase("en");
  return normalizedArea && !normalizedName.includes(normalizedArea)
    ? `${placeName}, ${area.trim()}`
    : placeName;
}

function recommendationDirectionsUrl(places: readonly Place[], destination: string) {
  if (places.length === 0) return placeSearchUrl(destination, destination);
  if (places.length === 1) {
    return placeSearchUrl(places[0].name, places[0].area || destination);
  }

  const queries = places.map((place) =>
    mapsPlaceQuery(place.name, place.area || destination),
  );
  const params = new URLSearchParams({
    api: "1",
    origin: queries[0],
    destination: queries.at(-1) ?? queries[0],
    travelmode: "transit",
  });
  if (queries.length > 2) params.set("waypoints", queries.slice(1, -1).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function placesFromRecommendationBundle(
  bundle: DayRecommendationBundle,
): Place[] {
  const hasSavedPlace = bundle.savedPlaceIds.length > 0;
  return bundle.orderedBriefs.map((brief, index) => ({
    id: brief.placeId,
    name: brief.placeName,
    area: brief.mapsArea ?? bundle.destination,
    priority:
      brief.origin === "saved" || (!hasSavedPlace && index === 0)
        ? ("must" as const)
        : ("love" as const),
    durationMinutes: 60,
    openingWindows: [],
    source:
      brief.origin === "saved"
        ? ("user" as const)
        : ("approved_discovery" as const),
    icon: index === 0 ? "temple" : index === 1 ? "sunset" : "curio",
  }));
}

function baselineRoute(input: OptimizationInput, order: readonly string[]) {
  let fromId = input.day.startLocationId;
  let travelMinutes = 0;
  let walkingKm = 0;

  for (const toId of [...order, input.day.endLocationId]) {
    const option = getTravelOptions(input, fromId, toId).find((candidate) =>
      input.day.allowedModes.includes(candidate.mode),
    );
    if (option) {
      travelMinutes += option.minutes;
      walkingKm += option.walkingKm;
    }
    fromId = toId;
  }

  return {
    travelMinutes,
    walkingKm: Math.round(walkingKm * 10) / 10,
  };
}

function ProgressDots({ stage }: { stage: Stage }) {
  const current = stageProgress[stage];
  return (
    <div
      className="progress-dots"
      role="progressbar"
      aria-label="Day planning progress"
      aria-valuemin={1}
      aria-valuemax={3}
      aria-valuenow={Math.max(1, current)}
      aria-valuetext={`Planning step ${Math.max(1, current)} of 3`}
    >
      {Array.from({ length: 3 }, (_, index) => (
        <i
          key={index}
          className={
            index + 1 < current
              ? "is-complete"
              : index + 1 === current
                ? "is-active"
                : ""
          }
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export default function DayWeaveApp() {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>("opening");
  const [destination, setDestination] = useState("");
  const [planningMode, setPlanningMode] = useState<PlanningMode>("adaptive");
  const [rawWishlist, setRawWishlist] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importMessage, setImportMessage] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [confirmationPrompts, setConfirmationPrompts] = useState<string[]>([]);
  const [unresolvedItems, setUnresolvedItems] = useState<string[]>([]);
  const [unconfirmedPriorityIds, setUnconfirmedPriorityIds] = useState<string[]>([]);
  const [recommendationBundle, setRecommendationBundle] =
    useState<DayRecommendationBundle | null>(null);
  const [recommendationJourneyError, setRecommendationJourneyError] =
    useState("");
  const [extractionCapabilities, setExtractionCapabilities] =
    useState<ExtractionCapabilities | null>(null);
  const [places, setPlaces] = useState<Place[]>(() =>
    hongKongDemo.input.places.map((place) => ({ ...place })),
  );
  const [activeJourneyInput, setActiveJourneyInput] =
    useState<OptimizationInput>(hongKongDemo.input);
  const [journeyContext, setJourneyContext] =
    useState<RecommendationJourneyContext | null>(null);
  const [pace, setPace] = useState<Pace>("balanced");
  const [walkingKm, setWalkingKm] = useState(3.6);
  const [isUntangling, setIsUntangling] = useState(false);
  const [plan, setPlan] = useState<OptimizationResult | null>(null);
  const [verificationAccepted, setVerificationAccepted] = useState(false);
  const [liveState, setLiveState] = useState<LiveDayState | null>(null);
  const [pendingDelayState, setPendingDelayState] =
    useState<LiveDayState | null>(null);
  const [recoveryOptions, setRecoveryOptions] = useState<
    EngineRecoveryChoice[]
  >([]);
  const [liveChanges, setLiveChanges] = useState<PlanChange[]>([]);
  const [travelActive, setTravelActive] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [supportMenuOpen, setSupportMenuOpen] = useState(false);
  const [supportSheet, setSupportSheet] = useState<SupportSheet>(null);
  const [recoveryChoice, setRecoveryChoice] =
    useState<RecoveryChoiceId>(null);
  const [recoveryApplied, setRecoveryApplied] = useState(false);
  const [stayMinutes, setStayMinutes] = useState<15 | 30 | 60 | null>(null);
  const [breakMinutes, setBreakMinutes] = useState<number | null>(null);
  const [liveNotice, setLiveNotice] = useState("");
  const [nowMinute, setNowMinute] = useState(hongKongDemo.input.day.startMinute);
  const [announcement, setAnnouncement] = useState("");
  const [savedJourney, setSavedJourney] = useState<JourneySnapshot | null>(null);
  const [briefingPlaceId, setBriefingPlaceId] = useState<
    "maks-noodle" | "bakehouse-soho"
  >("maks-noodle");
  const [briefingOrigin, setBriefingOrigin] =
    useState<BriefingOrigin>("live");
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const savedPlacesInputRef = useRef<HTMLTextAreaElement | null>(null);
  const sheetRef = useRef<HTMLButtonElement | null>(null);
  const supportTriggerRef = useRef<HTMLButtonElement | null>(null);

  const optimizationInput = useMemo<OptimizationInput>(
    () => ({
      ...activeJourneyInput,
      places,
      day: {
        ...activeJourneyInput.day,
        pace,
        maxWalkingKm: walkingKm,
      },
    }),
    [activeJourneyInput, pace, places, walkingKm],
  );

  const tangledPlaces = useMemo(() => {
    const byId = new Map(places.map((place) => [place.id, place]));
    const sourceOrder = demoMode
      ? hongKongDemo.tangledOrder
      : places.map((place) => place.id);
    const ordered = sourceOrder
      .map((id) => byId.get(id))
      .filter((place): place is Place => Boolean(place));
    const extras = places.filter(
      (place) => !sourceOrder.includes(place.id),
    );
    return [...ordered, ...extras].map(toThreadPlace);
  }, [demoMode, places]);

  const baseline = useMemo(() => {
    const sourceOrder = demoMode
      ? hongKongDemo.tangledOrder
      : places.map((place) => place.id);
    const selectedIds = plan
      ? new Set(plan.itinerary.map((stop) => stop.placeId))
      : null;
    const comparableOrder = selectedIds
      ? sourceOrder.filter((id) => selectedIds.has(id))
      : sourceOrder;
    return baselineRoute(optimizationInput, comparableOrder);
  }, [demoMode, optimizationInput, places, plan]);

  const livePlan = liveState?.currentPlan ?? plan;
  const plannedStops = livePlan?.itinerary ?? [];
  const completedIds = liveState?.completedStops.map((stop) => stop.placeId) ?? [];
  const currentStop = plannedStops[0];
  const routeStops = liveState
    ? [...liveState.completedStops, ...liveState.currentPlan.itinerary]
    : plannedStops;
  const isRecommendationJourney = journeyContext !== null;
  const insightsByPlaceId = useMemo(
    () => ({
      ...dontMissByPlaceId,
      ...(journeyContext?.insightsByPlaceId ?? {}),
    }),
    [journeyContext],
  );

  useEffect(() => {
    if (stage === "opening") return;
    window.requestAnimationFrame(() => headingRef.current?.focus());
  }, [stage]);

  useEffect(() => {
    let active = true;
    fetch("/api/extract", { cache: "no-store" })
      .then((response) => response.json())
      .then((capabilities: ExtractionCapabilities) => {
        if (active) setExtractionCapabilities(capabilities);
      })
      .catch(() => {
        if (active) {
          setExtractionCapabilities({
            available: false,
            screenshotAnalysisAvailable: false,
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const rawSnapshot = window.localStorage.getItem(JOURNEY_STORAGE_KEY);
        if (!rawSnapshot) return;
        const snapshot = JSON.parse(rawSnapshot) as JourneySnapshot;
        if (
          (snapshot.version === 1 || snapshot.version === 2) &&
          snapshot.plan &&
          Array.isArray(snapshot.places)
        ) {
          setSavedJourney(snapshot);
        }
      } catch {
        window.localStorage.removeItem(JOURNEY_STORAGE_KEY);
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!plan) return;
    const snapshot: JourneySnapshot = {
      version: 2,
      savedAt: new Date().toISOString(),
      stage: liveState ? "live" : "result",
      demoMode,
      places,
      pace,
      walkingKm,
      plan,
      liveState,
      nowMinute,
      travelActive,
      arrived,
      recoveryApplied,
      recoveryChoice,
      stayMinutes,
      breakMinutes,
      destination,
      planningMode,
      activeJourneyInput,
      journeyContext,
    };
    try {
      window.localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // The journey still works when private browsing blocks local storage.
    }
  }, [
    arrived,
    activeJourneyInput,
    breakMinutes,
    demoMode,
    destination,
    liveState,
    nowMinute,
    pace,
    places,
    plan,
    planningMode,
    journeyContext,
    recoveryApplied,
    recoveryChoice,
    stayMinutes,
    travelActive,
    walkingKm,
  ]);

  useEffect(() => {
    if (!supportSheet) return;
    window.requestAnimationFrame(() => sheetRef.current?.focus());
  }, [supportSheet]);

  function closeSupportSheet() {
    setSupportSheet(null);
    window.requestAnimationFrame(() => supportTriggerRef.current?.focus());
  }

  function resetApp({
    preserveSavedJourney = false,
  }: {
    preserveSavedJourney?: boolean;
  } = {}) {
    const journeyToPreserve: JourneySnapshot | null =
      preserveSavedJourney && plan
        ? {
            version: 2,
            savedAt: new Date().toISOString(),
            stage: liveState ? "live" : "result",
            demoMode,
            places,
            pace,
            walkingKm,
            plan,
            liveState,
            nowMinute,
            travelActive,
            arrived,
            recoveryApplied,
            recoveryChoice,
            stayMinutes,
            breakMinutes,
            destination,
            planningMode,
            activeJourneyInput,
            journeyContext,
          }
        : preserveSavedJourney
          ? savedJourney
          : null;

    setStage("opening");
    setDestination("");
    setPlanningMode("adaptive");
    setRawWishlist("");
    setDemoMode(false);
    setImportStatus("idle");
    setImportMessage("");
    setImageDataUrl(null);
    setUploadName("");
    setConfirmationPrompts([]);
    setUnresolvedItems([]);
    setUnconfirmedPriorityIds([]);
    setRecommendationBundle(null);
    setRecommendationJourneyError("");
    setPlaces(hongKongDemo.input.places.map((place) => ({ ...place })));
    setActiveJourneyInput(hongKongDemo.input);
    setJourneyContext(null);
    setPace("balanced");
    setWalkingKm(3.6);
    setIsUntangling(false);
    setPlan(null);
    setVerificationAccepted(false);
    setLiveState(null);
    setPendingDelayState(null);
    setRecoveryOptions([]);
    setLiveChanges([]);
    setTravelActive(false);
    setArrived(false);
    setSupportMenuOpen(false);
    setSupportSheet(null);
    setRecoveryChoice(null);
    setRecoveryApplied(false);
    setStayMinutes(null);
    setBreakMinutes(null);
    setLiveNotice("");
    setNowMinute(hongKongDemo.input.day.startMinute);
    setBriefingPlaceId("maks-noodle");
    setBriefingOrigin("live");
    setSavedJourney(journeyToPreserve);
    try {
      if (journeyToPreserve) {
        window.localStorage.setItem(
          JOURNEY_STORAGE_KEY,
          JSON.stringify(journeyToPreserve),
        );
      } else if (!preserveSavedJourney) {
        window.localStorage.removeItem(JOURNEY_STORAGE_KEY);
      }
    } catch {
      // Nothing else is required when storage is unavailable.
    }
    setAnnouncement(
      preserveSavedJourney && journeyToPreserve
        ? "Your current day is saved. Choose another destination when you are ready."
        : "DayWeave reset.",
    );
  }

  function exploreAnotherPlace() {
    resetApp({ preserveSavedJourney: true });
    window.requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }),
    );
  }

  function handleBrandClick() {
    if (stage === "opening") {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      return;
    }
    exploreAnotherPlace();
  }

  function continueSavedJourney() {
    if (!savedJourney) return;
    setRecommendationBundle(null);
    setRecommendationJourneyError("");
    setDemoMode(savedJourney.demoMode);
    setPlaces(savedJourney.places);
    setActiveJourneyInput(
      savedJourney.activeJourneyInput ??
        savedJourney.liveState?.sourceInput ??
        hongKongDemo.input,
    );
    setJourneyContext(savedJourney.journeyContext ?? null);
    setPace(savedJourney.pace);
    setWalkingKm(savedJourney.walkingKm);
    setPlan(savedJourney.plan);
    setLiveState(savedJourney.liveState);
    setNowMinute(savedJourney.nowMinute);
    setTravelActive(savedJourney.travelActive);
    setArrived(savedJourney.arrived);
    setRecoveryApplied(savedJourney.recoveryApplied);
    setRecoveryChoice(savedJourney.recoveryChoice);
    setStayMinutes(savedJourney.stayMinutes);
    setBreakMinutes(savedJourney.breakMinutes);
    setDestination(savedJourney.destination ?? "Hong Kong");
    setPlanningMode(savedJourney.planningMode ?? "adaptive");
    setStage(savedJourney.stage);
    setAnnouncement(savedJourney.stage === "live" ? "Your live day was restored." : "Your woven day was restored.");
  }

  async function loadHongKongExample() {
    const demoWishlist = hongKongDemo.messyWishlist;
    setDestination("Hong Kong");
    setPlanningMode("recommendation");
    setRecommendationBundle(null);
    setRecommendationJourneyError("");
    setDemoMode(false);
    setRawWishlist(demoWishlist);
    setImageDataUrl(null);
    setUploadName("");
    setVerificationAccepted(false);
    setImportStatus("working");
    setImportMessage("Opening the Hong Kong story…");

    try {
      await sleep(reduceMotion ? 20 : 260);
      await loadServiceRecommendations("Hong Kong", {
        rawWishlist: "Man Mo Temple\nStar Ferry\nVictoria Peak",
        continueIntoDemo: true,
      });
    } catch (error) {
      setImportStatus("error");
      setImportMessage(
        error instanceof Error
          ? error.message
          : "The Hong Kong story could not open just yet. Try again.",
      );
    }
  }

  async function loadServiceRecommendations(
    requestedDestination = destination.trim(),
    options: {
      rawWishlist?: string;
      continueIntoDemo?: boolean;
    } = {},
  ) {
    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: requestedDestination,
        rawWishlist: options.rawWishlist ?? rawWishlist,
      }),
    });
    const body = (await response.json()) as {
      ok?: boolean;
      bundle?: DayRecommendationBundle;
      error?: { message?: string };
    };

    if (!response.ok || !body.ok || !body.bundle) {
      const reason =
        body.error?.message ??
        "DayWeave could not reach enough destination knowledge for a trustworthy recommendation.";
      throw new Error(
        `${reason} Your saved places are still here. Try again shortly or open the Hong Kong example while DayWeave adds this source.`,
      );
    }

    const bundle = body.bundle;
    const recommendedPlaces = placesFromRecommendationBundle(bundle);

    setDestination(bundle.destination);
    setPlanningMode("recommendation");
    setRecommendationBundle(bundle);
    setRecommendationJourneyError("");
    setJourneyContext(null);
    setDemoMode(options.continueIntoDemo === true);
    setPlaces(recommendedPlaces);
    setUnconfirmedPriorityIds([]);
    setConfirmationPrompts([]);
    setUnresolvedItems([]);
    setVerificationAccepted(true);
    setPlan(null);
    setImportStatus("ready");
    setImportMessage(
      `${bundle.orderedBriefs.length} destination-backed stops found. DayWeave has made the recommendation and surfaced what not to miss.`,
    );
    setAnnouncement(`DayWeave recommendation ready for ${bundle.destination}.`);
    setStage("recommendation");
  }

  function openBriefing(
    placeId: "maks-noodle" | "bakehouse-soho",
    origin: BriefingOrigin,
  ) {
    setBriefingPlaceId(placeId);
    setBriefingOrigin(origin);
    setStage("briefing");
    setAnnouncement(`Don’t Miss Here opened for ${placeId === "maks-noodle" ? "Mak’s Noodle" : "Bakehouse SoHo"}.`);
  }

  async function handleScreenshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImportStatus("error");
      setImportMessage("Choose a PNG, JPEG, WebP or GIF screenshot.");
      return;
    }
    if (file.size > 8_000_000) {
      setImportStatus("error");
      setImportMessage("That screenshot is over 8 MB. Choose a smaller image.");
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read screenshot"));
      reader.readAsDataURL(file);
    }).catch(() => "");

    if (!dataUrl) {
      setImportStatus("error");
      setImportMessage("DayWeave could not read that screenshot. Try another image.");
      return;
    }

    setImageDataUrl(dataUrl);
    setUploadName(file.name);
    setImportStatus("idle");
    setImportMessage("Screenshot ready. It will be discarded immediately after processing.");
  }

  async function handleExtraction(destinationOverride?: string) {
    const requestedDestination = (
      destinationOverride ?? destination
    ).trim();
    if (!requestedDestination) {
      setImportStatus("error");
      setImportMessage("Choose a country or type a city, island or region first.");
      return;
    }

    const destinationIsHongKong =
      /^(?:hong\s*kong|hongkong|hk)$/i.test(requestedDestination);

    setImportStatus("working");
    setImportMessage(
      destinationIsHongKong && imageDataUrl
        ? "Separating wishes from constraints…"
        : "Finding the thread and what not to miss…",
    );
    setVerificationAccepted(false);

    try {
      if (demoMode) {
        await sleep(reduceMotion ? 20 : 620);
        setActiveJourneyInput(hongKongDemo.input);
        setJourneyContext(null);
        setPlaces(hongKongDemo.input.places.map((place) => ({ ...place })));
        setConfirmationPrompts([]);
        setUnresolvedItems([]);
        setUnconfirmedPriorityIds([]);
        setPlanningMode("adaptive");
        setImportStatus("ready");
        setImportMessage(
          "Nine places found. Three feel non-negotiable, one booking is fixed and two timing wishes need protecting.",
        );
        setAnnouncement("Seeded wishlist structured into nine places.");
        setStage("confirm");
        return;
      }

      if (!destinationIsHongKong || !imageDataUrl) {
        await sleep(reduceMotion ? 20 : 260);
        await loadServiceRecommendations(requestedDestination);
        return;
      }

      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawWishlist.trim() || null,
          imageDataUrl,
          sourceKind: imageDataUrl
            ? rawWishlist.trim()
              ? "mixed"
              : "screenshot"
            : "plain_text",
        }),
      });
      const body = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        const error = body.error as
          | { code?: string; message?: string }
          | undefined;
        const friendlyMessage =
          error?.code === "LOCAL_TEXT_REQUIRED"
            ? (error.message ??
              "Paste the visible text from your screenshot so I can read it locally.")
            : error?.code === "INVALID_EXTRACTION_REQUEST"
              ? "Check the notes and try once more."
              : "I couldn’t read those notes just yet. Paste at least three supported Hong Kong place names, or open the sample day.";
        throw new Error(friendlyMessage);
      }

      const materialized = materializeWishlistEnvelope(
        body,
        hongKongDemo.input.places,
      );
      if (materialized.places.length < 3) {
        throw new Error(
          "I found fewer than three supported Hong Kong places. Add another saved place or open the complete example.",
        );
      }

      setPlanningMode("adaptive");
      setRecommendationBundle(null);
      setActiveJourneyInput(hongKongDemo.input);
      setJourneyContext(null);
      setPlaces(materialized.places);
      setConfirmationPrompts(
        materialized.extraction?.confirmationPrompts.filter(
          (prompt) => !prompt.startsWith("Confirm the priority and timing for "),
        ) ?? [],
      );
      setUnresolvedItems(materialized.extraction?.unresolvedItems ?? []);
      setUnconfirmedPriorityIds(
        materialized.extraction?.places.flatMap((place) => {
          if (place.priorityIntent !== "unconfirmed") return [];
          const id = resolveSupportedHongKongPlaceId(place.normalizedName);
          return id ? [id] : [];
        }) ?? [],
      );
      if (materialized.pace) setPace(materialized.pace);
      if (materialized.walkingKm) setWalkingKm(materialized.walkingKm);
      setDemoMode(false);
      setImportStatus("ready");
      if (body.mode === "local_rules") {
        setImportMessage(
          `${materialized.places.length} supported Hong Kong places found. Read locally—nothing was uploaded.${imageDataUrl ? " The screenshot itself was not read; only your pasted text was used." : ""} Please confirm every priority and time.`,
        );
      } else {
        setImportMessage(
          `${materialized.places.length} supported Hong Kong places structured. Please confirm every priority and time before optimization.`,
        );
      }
      setAnnouncement(
        `${materialized.places.length} wishlist places structured.`,
      );
      setStage("confirm");
    } catch (error) {
      setImportStatus("error");
      setImportMessage(
        error instanceof Error
          ? error.message
          : "I couldn’t build that recommendation yet. Try Seoul, Singapore, Cheung Chau, Johor Bahru, or the Hong Kong demo.",
      );
    } finally {
      setImageDataUrl(null);
      setUploadName("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function openAdaptiveHongKongDemo() {
    const demoPlan = optimizeDay(hongKongDemo.input);
    setDestination("Hong Kong");
    setPlanningMode("adaptive");
    setRecommendationBundle(null);
    setActiveJourneyInput(hongKongDemo.input);
    setJourneyContext(null);
    setDemoMode(true);
    setRawWishlist(hongKongDemo.messyWishlist);
    setPlaces(hongKongDemo.input.places.map((place) => ({ ...place })));
    setConfirmationPrompts([]);
    setUnresolvedItems([]);
    setUnconfirmedPriorityIds([]);
    setPace(hongKongDemo.input.day.pace);
    setWalkingKm(hongKongDemo.input.day.maxWalkingKm);
    setPlan(demoPlan);
    setLiveState(null);
    setPendingDelayState(null);
    setRecoveryOptions([]);
    setLiveChanges([]);
    setTravelActive(false);
    setArrived(false);
    setRecoveryApplied(false);
    setRecoveryChoice(null);
    setStayMinutes(null);
    setBreakMinutes(null);
    setNowMinute(hongKongDemo.input.day.startMinute);
    setImportStatus("ready");
    setImportMessage(
      "The full adaptive Hong Kong day is ready. This is deterministic demo data, not live analysis.",
    );
    setVerificationAccepted(true);
    setAnnouncement(
      `${demoPlan.metrics.selectedCount} Hong Kong stops are woven. The live journey is ready to demonstrate.`,
    );
    setStage("result");
  }

  function startRecommendationJourney(dayNumber: number) {
    if (!recommendationBundle) return;

    try {
      setRecommendationJourneyError("");
      const journey = materializeRecommendationDay(
        recommendationBundle,
        dayNumber,
        {
          date: new Date().toISOString().slice(0, 10),
        },
      );
      if (!journey.plan.feasible || journey.plan.itinerary.length === 0) {
        throw new Error(
          "This day needs a smaller area or a longer planning window before the live companion can start.",
        );
      }
      const nextLiveState = createLiveState(journey.input, journey.plan);
      const capacityWarnings =
        journey.plan.deferred.length > 0
          ? [
              `${journey.plan.deferred.length} lower-priority ${journey.plan.deferred.length === 1 ? "stop is" : "stops are"} waiting for another day because the sample planning window is full.`,
            ]
          : [];
      const nextContext: RecommendationJourneyContext = {
        dayNumber: journey.dayNumber,
        areaLabel: journey.areaLabel,
        estimateBasis: journey.estimateBasis,
        warnings: [...journey.warnings, ...capacityWarnings],
        insightsByPlaceId: journey.insightsByPlaceId,
      };

      setPlanningMode("recommendation");
      setDemoMode(false);
      setActiveJourneyInput(journey.input);
      setJourneyContext(nextContext);
      setPlaces(journey.input.places);
      setPace(journey.input.day.pace);
      setWalkingKm(journey.input.day.maxWalkingKm);
      setPlan(journey.plan);
      setLiveState(nextLiveState);
      setPendingDelayState(null);
      setRecoveryOptions([]);
      setLiveChanges([]);
      setTravelActive(false);
      setArrived(false);
      setSupportMenuOpen(false);
      setSupportSheet(null);
      setRecoveryApplied(false);
      setRecoveryChoice(null);
      setStayMinutes(null);
      setBreakMinutes(null);
      setLiveNotice("");
      setNowMinute(nextLiveState.currentMinute);
      setAnnouncement(
        `${journey.areaLabel} day ${journey.dayNumber} is ready as a live companion.`,
      );
      setStage("live");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "This recommended day could not be opened just yet.";
      setRecommendationJourneyError(message);
      setAnnouncement("The live companion could not open yet.");
    }
  }

  function movePriority(placeId: string, priority: Priority) {
    setPlaces((current) =>
      current.map((place) =>
        place.id === placeId ? { ...place, priority } : place,
      ),
    );
    setUnconfirmedPriorityIds((current) => current.filter((id) => id !== placeId));
    setAnnouncement(
      `${places.find((place) => place.id === placeId)?.name ?? "Place"} moved to ${laneCopy[priority].title}.`,
    );
  }

  async function handleUntangle() {
    setIsUntangling(true);
    const nextPlan = optimizeDay(optimizationInput);
    setPlan(nextPlan);
    setAnnouncement(
      nextPlan.feasible
        ? `${nextPlan.metrics.selectedCount} places fit. ${nextPlan.metrics.mustVisitProtectedCount} must-visits protected.`
        : "The confirmed set needs one adjustment before it can be woven safely.",
    );
    await sleep(reduceMotion ? 30 : 860);
    setIsUntangling(false);
    setStage("result");
  }

  function beginDay() {
    if (!plan) return;
    const nextLiveState = createLiveState(optimizationInput, plan);
    setLiveState(nextLiveState);
    setPendingDelayState(null);
    setRecoveryOptions([]);
    setLiveChanges([]);
    setNowMinute(nextLiveState.currentMinute);
    setTravelActive(false);
    setArrived(false);
    setSupportMenuOpen(false);
    setSupportSheet(null);
    setRecoveryApplied(false);
    setRecoveryChoice(null);
    setLiveNotice("");
    setStage("live");
  }

  function takeMeThere() {
    if (!currentStop) return;
    if (!travelActive) {
      setTravelActive(true);
      setSupportMenuOpen(false);
      setLiveNotice(`Wivi is with you on the way to ${currentStop.name}.`);
      setAnnouncement(`Travel started toward ${currentStop.name}.`);
      return;
    }
    setArrived(true);
    setTravelActive(false);
    setSupportMenuOpen(false);
    setNowMinute(currentStop.startMinute);
    setLiveNotice(`You’re at ${currentStop.name}. There is time to be here.`);
    setAnnouncement(`Arrived at ${currentStop.name}.`);
  }

  function completeCurrentStop() {
    if (!currentStop || !liveState) return;
    const result = applyLiveEvent(liveState, {
      type: "complete",
      placeId: currentStop.placeId,
    });
    if (!result.accepted) {
      setLiveNotice(result.reasons[0]?.message ?? "That moment could not be tied yet.");
      return;
    }
    setLiveState(result.state);
    setLiveChanges(result.changes);
    setNowMinute(result.state.currentMinute);
    setArrived(false);
    setTravelActive(false);
    setSupportMenuOpen(false);
    setLiveNotice("");
    const remainingChanges = result.changes.filter(
      (change) => change.type !== "preserved",
    );
    setAnnouncement(
      remainingChanges.length === 0
        ? `${currentStop.name} completed. The remaining route is unchanged.`
        : `${currentStop.name} completed. Only the remaining plan was recalculated.`,
    );
  }

  function openRepair() {
    if (!liveState) return;
    const delayed = applyLiveEvent(liveState, {
      type: "delay",
      minutes: hongKongDemo.delayMinutes,
    });
    if (!delayed.accepted) {
      setLiveNotice(delayed.reasons[0]?.message ?? "That delay could not be applied.");
      return;
    }
    setPendingDelayState(delayed.state);
    setRecoveryOptions(buildRecoveryChoices(delayed.state));
    setSupportMenuOpen(false);
    setSupportSheet(null);
    setStage("repair");
    setAnnouncement("Two recovery paths are ready to compare. No place changed silently.");
  }

  function chooseRecovery(choiceId: Exclude<RecoveryChoiceId, null>) {
    const choice = recoveryOptions.find((option) => option.id === choiceId);
    if (!choice?.valid) return;
    const originalRemainingIds = new Set(liveState?.currentPlan.itinerary.map((stop) => stop.placeId) ?? []);
    const nextIds = new Set(choice.state.currentPlan.itinerary.map((stop) => stop.placeId));
    const deferredNames = places
      .filter((place) => originalRemainingIds.has(place.id) && !nextIds.has(place.id))
      .map((place) => place.name);
    setLiveState(choice.state);
    setLiveChanges(choice.changes);
    setRecoveryChoice(choiceId);
    setRecoveryApplied(true);
    setNowMinute(choice.state.currentMinute);
    setPendingDelayState(null);
    setSupportMenuOpen(false);
    setLiveNotice(
      choiceId === "protect_moments"
        ? isRecommendationJourney
          ? "The delay you entered is now reflected in the remaining plan. Maps will check each next leg."
          : "The day changed, but every remaining protected timing and fixed booking is still safe."
        : "Every chosen stop stays. You approved tighter transition buffers.",
    );
    setAnnouncement(
      choiceId === "protect_moments"
        ? `Protect the moments selected.${deferredNames.length > 0 ? ` ${deferredNames.join(", ")} ${deferredNames.length === 1 ? "is" : "are"} saved for another day.` : " No additional stop was deferred."}`
        : "Keep every stop selected. Tighter transition buffers were applied with permission.",
    );
    setStage("live");
  }

  function handleStayLonger(minutes: 15 | 30 | 60) {
    if (!liveState || !currentStop || !arrived) return;
    const result = applyLiveEvent(liveState, {
      type: "stay_longer",
      placeId: currentStop.placeId,
      minutes,
    });
    if (!result.accepted) {
      setLiveNotice(
        result.reasons[0]?.message ??
          "That extra time could not be added to the remaining plan.",
      );
      return;
    }
    setLiveState(result.state);
    setLiveChanges(result.changes);
    setStayMinutes(minutes);
    setSupportSheet(null);
    setNowMinute(result.state.currentMinute);
    setArrived(false);
    setTravelActive(false);
    setAnnouncement(`Staying ${minutes} minutes longer. Reweaving only the remaining day.`);
    setStage("reweave");
  }

  function protectBreak() {
    if (!liveState) return;
    const result = applyLiveEvent(liveState, {
      type: "break",
      minutes: 25,
      label: "A guilt-free pause",
    });
    if (!result.accepted) {
      setLiveNotice(result.reasons[0]?.message ?? "That break could not be protected yet.");
      return;
    }
    setLiveState(result.state);
    setLiveChanges(result.changes);
    setBreakMinutes(25);
    setNowMinute(result.state.currentMinute);
    setSupportSheet(null);
    window.requestAnimationFrame(() => supportTriggerRef.current?.focus());
    setLiveNotice("A 25-minute rest is protected. You do not need to earn it.");
    setAnnouncement("A protected 25-minute break was added to the remaining day.");
  }

  function confirmSkip() {
    if (!currentStop || !liveState) return;
    const skippedName = currentStop.name;
    const result = applyLiveEvent(liveState, {
      type: "skip",
      placeId: currentStop.placeId,
    });
    if (!result.accepted) {
      setLiveNotice(result.reasons[0]?.message ?? "That stop could not be skipped yet.");
      return;
    }
    setLiveState(result.state);
    setLiveChanges(result.changes);
    setNowMinute(result.state.currentMinute);
    setSupportSheet(null);
    setArrived(false);
    setTravelActive(false);
    window.requestAnimationFrame(() => headingRef.current?.focus());
    setLiveNotice(`${skippedName} is waiting for another day. Nothing else was added.`);
    setAnnouncement(`${skippedName} skipped with confirmation.`);
  }

  function finishDay() {
    setStage("memory");
    setAnnouncement("Your memory thread is ready.");
  }

  function returnToRecommendationDays() {
    if (!recommendationBundle) return;
    setPlaces(placesFromRecommendationBundle(recommendationBundle));
    setActiveJourneyInput(hongKongDemo.input);
    setJourneyContext(null);
    setPlan(null);
    setLiveState(null);
    setPendingDelayState(null);
    setRecoveryOptions([]);
    setLiveChanges([]);
    setTravelActive(false);
    setArrived(false);
    setRecoveryApplied(false);
    setRecoveryChoice(null);
    setStayMinutes(null);
    setBreakMinutes(null);
    setLiveNotice("");
    setStage("recommendation");
    setAnnouncement(`Choose the next ${destination} day when you are ready.`);
  }

  function confirmEndDay() {
    if (!window.confirm("End this route here and keep the moments you completed?")) return;
    setSupportMenuOpen(false);
    setSupportSheet(null);
    finishDay();
  }

  function renderHeader() {
    return (
      <header className="app-header">
        <button className="brand-button" type="button" onClick={handleBrandClick} aria-label="DayWeave home">
          <span className="thread-mark" aria-hidden="true" />
          <span className="brand-copy">
            <strong>DayWeave</strong>
            <small>Moments over checklists</small>
          </span>
        </button>
        <div className="header-status" aria-label="DayWeave’s core flow">
          <span className="offline-dot" aria-hidden="true" />
          Destination → what not to miss
        </div>
        {stage !== "opening" && (
          <button className="header-action" type="button" onClick={exploreAnotherPlace}>
            Explore another place
          </button>
        )}
      </header>
    );
  }

  function renderOpening() {
    function updateDestination(value: string) {
      if (demoMode) {
        setRawWishlist("");
        setImageDataUrl(null);
        setUploadName("");
      }
      setDestination(value);
      setDemoMode(false);
      setPlanningMode("recommendation");
      setRecommendationBundle(null);
      setRecommendationJourneyError("");
      setImportStatus("idle");
      setImportMessage("");
    }

    return (
      <section className="screen opening-screen" aria-labelledby="opening-title">
        <div className="opening-hero">
          <div className="opening-postcard-art" aria-label="DayWeave destination illustration">
            <Image
              src="/og-v2.png"
              alt="DayWeave postcard showing a coral thread weaving a city waterfront, green park and coastal path toward Wivi"
              width={1536}
              height={1024}
              priority
              unoptimized
            />
          </div>

          <div className="opening-search-shell">
            {savedJourney && (
              <button className="continue-journey" type="button" onClick={continueSavedJourney}>
                <span>Continue my saved day</span>
                <small>{savedJourney.stage === "live" ? "Pick up at the next stop" : "Return to the route you already wove"} →</small>
              </button>
            )}
            <form
              className="opening-searchbar"
              onSubmit={(event) => {
                event.preventDefault();
                void handleExtraction();
              }}
            >
              <DestinationCombobox
                value={destination}
                disabled={importStatus === "working"}
                onChange={updateDestination}
                onSubmit={() => savedPlacesInputRef.current?.focus()}
              />
              <label className="opening-saved-field" htmlFor="wishlist-input">
                <span>
                  Places you already saved
                  <small>Optional · one per line</small>
                </span>
                <textarea
                  ref={savedPlacesInputRef}
                  id="wishlist-input"
                  value={rawWishlist}
                  disabled={importStatus === "working"}
                  aria-label="Places you already saved (optional)"
                  aria-describedby="saved-places-hint"
                  onChange={(event) => {
                    setRawWishlist(event.target.value);
                    setDemoMode(false);
                    setRecommendationBundle(null);
                    setRecommendationJourneyError("");
                    setImportStatus("idle");
                    setImportMessage("");
                    setVerificationAccepted(false);
                  }}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      void handleExtraction();
                    }
                  }}
                  placeholder={"Man Mo Temple\nStar Ferry\nVictoria Peak"}
                  rows={2}
                />
                <small id="saved-places-hint">Leave blank and DayWeave will choose for you.</small>
              </label>
              <button className="opening-searchbar__submit" type="submit" disabled={importStatus === "working"} data-testid="extract-wishlist">
                <span>{importStatus === "working" ? "Finding what matters…" : "Show me what not to miss"}</span>
                <span aria-hidden="true">{importStatus === "working" ? "…" : "↗"}</span>
              </button>
            </form>

            {importMessage && (
              <div className={`import-feedback import-feedback--${importStatus}`} role={importStatus === "error" ? "alert" : "status"} aria-atomic="true">
                <strong>{importStatus === "working" ? "Reading your list…" : importStatus === "error" ? "DayWeave needs another source." : "Ready when you are."}</strong>
                <p>{importMessage}</p>
              </div>
            )}
            {importStatus === "error" && (
              <button
                className="button button--ghost opening-search-shell__fallback"
                type="button"
                onClick={() => void loadHongKongExample()}
                disabled={importStatus === "working"}
              >
                Try the Hong Kong demo
              </button>
            )}
          </div>
        </div>

        <div className="opening-copy">
          <div className="opening-message">
            <p className="eyebrow">Local insight before itinerary</p>
            <h1 id="opening-title">See the day worth taking, and what not to miss at every stop.</h1>
          </div>

          <div className="opening-composer">
            <p className="opening-lede">
              Choose where you are going. Add any places you already saved in the separate field above, or leave it blank and let DayWeave choose. The service brings back one clear recommendation with the details people discover too late.
            </p>
            <span className="brand-promise">The recommendation comes from DayWeave. Your notes never have to become the product.</span>

            <div className="opening-composer__tools">
              <button
                className="text-action"
                type="button"
                onClick={() => void loadHongKongExample()}
                disabled={importStatus === "working"}
                data-testid="open-hong-kong-demo"
              >
                {importStatus === "working" ? "Opening Hong Kong…" : "Try the Hong Kong demo"}
              </button>
              {extractionCapabilities?.screenshotAnalysisAvailable === true && (
                <label className="text-action text-action--upload" htmlFor="screenshot-upload">
                  <input ref={fileRef} id="screenshot-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleScreenshot} />
                  {uploadName || "Add screenshot"}
                </label>
              )}
            </div>
            <p className="opening-scope">Curated destination knowledge works offline for Hong Kong, Singapore, Seoul, Cheung Chau and Johor Bahru. Elsewhere, DayWeave checks the public travel guide and works best for a city, island or compact region with enough specific listings.</p>
          </div>
        </div>

        <ol className="opening-journey" aria-label="How DayWeave works">
          <li><span>01</span><strong>Name where you are going.</strong></li>
          <li><span>02</span><strong>Get one clear recommendation.</strong></li>
          <li><span>03</span><strong>Know what not to miss.</strong></li>
        </ol>
      </section>
    );
  }

  function renderConfirm() {
    const incompleteBookingPlaces = places.filter((place) =>
      place.note?.includes("confirm an end time before planning"),
    );
    const needsAcknowledgement =
      (confirmationPrompts.length > 0 || unresolvedItems.length > 0) &&
      !verificationAccepted;
    const hasBlockingVerification =
      incompleteBookingPlaces.length > 0 ||
      unconfirmedPriorityIds.length > 0 ||
      needsAcknowledgement;
    return (
      <section className="screen" aria-labelledby="confirm-title">
        <div className="screen-inner">
          <div className="screen-heading heading-with-wivi">
            <div>
              <p className="step-label">2 · Protect what matters</p>
              <h1 id="confirm-title" tabIndex={-1} ref={headingRef}>{places.length} places in {destination}. What matters most?</h1>
              <p>Check the order, booking times and priority. This is the only review before DayWeave builds the adaptive route.</p>
              <ProgressDots stage={stage} />
            </div>
            <Wivi mood="comforting" />
          </div>

          {(confirmationPrompts.length > 0 || unresolvedItems.length > 0 || hasBlockingVerification) && (
            <section className={`verification-panel${incompleteBookingPlaces.length > 0 ? " verification-panel--blocking" : ""}`} aria-labelledby="verification-title">
              <div>
                <p className="mono-label">Please verify</p>
                <h2 id="verification-title">No uncertain detail becomes a hidden assumption.</h2>
              </div>
              {incompleteBookingPlaces.length > 0 && (
                <div className="verification-blocker" role="alert">
                  <strong>A booking is not protected yet.</strong>
                  <p>{incompleteBookingPlaces.map((place) => `${place.name}: ${place.note}`).join(" ")} Add the end time to your notes and read them again before weaving.</p>
                  <button className="button button--ghost" type="button" onClick={() => setStage("opening")}>Fix the notes</button>
                </div>
              )}
              {confirmationPrompts.length > 0 && (
                <ul>{confirmationPrompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul>
              )}
              {unresolvedItems.length > 0 && (
                <details>
                  <summary>{unresolvedItems.length} note {unresolvedItems.length === 1 ? "line needs" : "lines need"} a human check</summary>
                  <ul>{unresolvedItems.map((item) => <li key={item}>{item}</li>)}</ul>
                </details>
              )}
              {needsAcknowledgement && (
                <div className="verification-actions">
                  <button className="button button--primary" type="button" onClick={() => setVerificationAccepted(true)}>I checked these details</button>
                  <button className="button button--ghost" type="button" onClick={() => setStage("opening")}>Edit my notes</button>
                </div>
              )}
            </section>
          )}

          <section className="priority-review" aria-labelledby="priority-review-title">
            <header>
              <div>
                <p className="mono-label">Your saved places</p>
                <h2 id="priority-review-title">{places.filter((place) => place.priority === "must").length} protected · {places.length} total</h2>
              </div>
              <p>Change only what needs changing.</p>
            </header>
            <ul>
              {places.map((place) => (
                <li className={`priority-review__row priority-review__row--${place.priority}${unconfirmedPriorityIds.includes(place.id) ? " priority-review__row--needs-choice" : ""}`} key={place.id}>
                  <span className="priority-review__icon" aria-hidden="true">{iconGlyphs[place.icon ?? ""] ?? "✦"}</span>
                  <div className="priority-review__place">
                    <strong>{place.name}</strong>
                    <small>{place.area}</small>
                    <div className="priority-review__facts">
                      {unconfirmedPriorityIds.includes(place.id) && <span className="needs-choice">Needs your choice</span>}
                      {place.fixedBooking && <span>Fixed · {formatTime(place.fixedBooking.start)}–{formatTime(place.fixedBooking.end)}</span>}
                      {place.timingConstraints?.map((constraint) => <span key={constraint.id}>{constraint.label}</span>)}
                      {place.shoppingLast && <span>Keep near the end</span>}
                      {place.note && <span>{place.note}</span>}
                    </div>
                  </div>
                  <label className="priority-review__control">
                    <span>Priority</span>
                    <select value={unconfirmedPriorityIds.includes(place.id) ? "" : place.priority} onChange={(event) => movePriority(place.id, event.target.value as Priority)} aria-label={`Priority for ${place.name}`}>
                      <option value="" disabled>Choose priority…</option>
                      <option value="must">Must visit</option>
                      <option value="love">Would love</option>
                      <option value="convenient">Only if convenient</option>
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <details className="plan-preferences">
            <summary>Day preferences <span>{pace} pace · up to {walkingKm.toFixed(1)} km walking</span></summary>
            <div className="trip-settings">
              <div className="trip-setting-fact"><span>Start</span><strong>10:30 · Sheung Wan MTR</strong><small>Confirmed in the Hong Kong example</small></div>
              <div className="trip-setting-fact"><span>End</span><strong>By 9:00 · Hotel in Jordan</strong><small>Confirmed in the Hong Kong example</small></div>
              <label className="form-label">Comfortable walking<select className="select-input" value={walkingKm} onChange={(event) => setWalkingKm(Number(event.target.value))}><option value={2.4}>Gentle · up to 2.4 km</option><option value={3.6}>Comfortable · up to 3.6 km</option><option value={5.2}>Happy to walk · up to 5.2 km</option></select></label>
              <fieldset className="pace-control"><legend className="form-label">Pace</legend><div className="pace-options">{(["relaxed", "balanced", "packed"] as Pace[]).map((option) => <button className="pace-option" type="button" aria-pressed={pace === option} onClick={() => setPace(option)} key={option}>{option[0].toUpperCase() + option.slice(1)}</button>)}</div></fieldset>
            </div>
          </details>

          <div className="action-row">
            <button className="button button--primary" type="button" onClick={handleUntangle} data-testid="weave-day" disabled={hasBlockingVerification || isUntangling}>
              {hasBlockingVerification ? "Choose every priority above" : isUntangling ? "Shaping your day…" : "Weave my day"}
            </button>
            <button className="button button--ghost" type="button" onClick={() => setStage("opening")}>Back to my list</button>
          </div>
        </div>
      </section>
    );
  }

  function renderRecommendation() {
    if (!recommendationBundle) return null;
    const destinationKey = destination.trim().toLocaleLowerCase("en");
    const isHongKongDemo =
      demoMode && /^(?:hong\s*kong|hongkong|hk)$/.test(destinationKey);
    const recommendedPlaceIds = new Set(
      recommendationBundle.orderedBriefs.map((brief) => brief.placeId),
    );
    const hasCanonicalHongKongArtwork =
      recommendedPlaceIds.size === 3 &&
      ["man-mo-temple", "star-ferry", "victoria-peak"].every(
        (placeId) => recommendedPlaceIds.has(placeId),
      );
    const recommendationArtwork =
      destinationKey === "singapore"
        ? {
            src: "/singapore-journey-v1.png",
            alt: "A mosaic journey from Fort Canning through Marina Bay to East Coast Park in Singapore",
          }
        : /^(?:hong\s*kong|hongkong|hk)$/.test(destinationKey) &&
            hasCanonicalHongKongArtwork
          ? {
              src: "/hong-kong-journey-v1.png",
              alt: "A mosaic Hong Kong journey connecting Man Mo Temple, Star Ferry and Victoria Peak",
            }
          : null;
    const stopImagePositions = ["18% center", "50% center", "84% center"];
    const stopImageOrigins = ["left center", "center", "right center"];
    const briefsById = new Map(
      recommendationBundle.orderedBriefs.map((brief) => [brief.placeId, brief]),
    );
    const dayThreads = recommendationBundle.routePlan.days.map((day) => {
      const briefs = day.stopIds.flatMap((placeId) => {
        const brief = briefsById.get(placeId);
        return brief ? [brief] : [];
      });
      const dayPlaces = briefs.map(
        (brief): Place => ({
          id: brief.placeId,
          name: brief.placeName,
          area: brief.mapsArea ?? day.areaLabel,
          priority: brief.origin === "saved" ? "must" : "love",
          durationMinutes: 60,
          openingWindows: [],
          source:
            brief.origin === "saved" ? "user" : "approved_discovery",
        }),
      );
      return {
        ...day,
        briefs,
        routeUrl: recommendationDirectionsUrl(
          dayPlaces,
          day.areaLabel || destination,
        ),
      };
    });
    const isMultiDay = dayThreads.length > 1;
    const singleDayRouteUrl = dayThreads[0]?.routeUrl;
    const storyPositionByPlaceId = new Map<
      string,
      {
        dayNumber: number;
        areaLabel: string;
        stopNumber: number;
        stopCount: number;
      }
    >();
    dayThreads.forEach((day) => {
      day.stopIds.forEach((placeId, index) => {
        storyPositionByPlaceId.set(placeId, {
          dayNumber: day.dayNumber,
          areaLabel: day.areaLabel,
          stopNumber: index + 1,
          stopCount: day.stopIds.length,
        });
      });
    });
    const routeBasisCopy =
      recommendationBundle.routePlan.basis === "verified_locations"
        ? "Grouped from verified venue locations and ordered by geographic proximity within each area. Maps checks live transit, closures and travel times when you open it."
        : "This is a sourced editorial sequence, not a live fastest-route claim. Maps checks current directions and timing when you open it.";

    return (
      <section className="screen recommendation-screen" aria-labelledby="recommendation-title">
        <header
          className={`recommendation-visual-hero${recommendationArtwork ? " recommendation-visual-hero--with-art" : ""}`}
        >
          <div className="recommendation-visual-hero__media" aria-hidden={!recommendationArtwork}>
            {recommendationArtwork ? (
              <Image
                src={recommendationArtwork.src}
                alt={recommendationArtwork.alt}
                fill
                priority
                unoptimized
                sizes="100vw"
              />
            ) : (
              <div className="recommendation-visual-hero__fallback" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            )}
          </div>

          <div className="recommendation-visual-hero__content">
            <p className="recommendation-visual-hero__eyebrow">
              DayWeave recommends · {destination}
            </p>
            <h1 id="recommendation-title" tabIndex={-1} ref={headingRef}>
              Your {destination} essentials.
            </h1>
            <p className="recommendation-visual-hero__promise">
              {recommendationBundle.headline}
            </p>
            <p className="recommendation-visual-hero__rationale">
              {recommendationBundle.rationale}
            </p>

            {recommendationBundle.branchResolutions.length > 0 && (
              <aside
                className="recommendation-branch-decisions"
                aria-label="How DayWeave matched branches to this route"
              >
                <p className="recommendation-branch-decisions__label">
                  Branch matched to your day
                </p>
                <ul>
                  {recommendationBundle.branchResolutions.map((resolution) => {
                    const matchLabel =
                      resolution.matchKind === "explicit"
                        ? "Your exact branch"
                        : resolution.matchKind === "same_complex"
                          ? "At the same stop"
                          : resolution.matchKind === "contextual_area"
                            ? "Best area match"
                            : "Destination default";
                    return (
                      <li key={`${resolution.intent}-${resolution.selectedPlaceId}`}>
                        <span>{matchLabel}</span>
                        <div>
                          <strong>{resolution.selectedPlaceName}</strong>
                          <p>{resolution.reason}</p>
                          {resolution.alternative && (
                            <small>
                              Chosen instead of {resolution.alternative.placeName}
                            </small>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </aside>
            )}

            {recommendationBundle.unresolvedWishlistItems.length > 0 && (
              <section
                className="recommendation-wishlist-followup"
                aria-labelledby="recommendation-wishlist-followup-title"
                data-testid="unresolved-wishlist"
              >
                <header>
                  <p className="recommendation-wishlist-followup__label">
                    Kept, never guessed
                  </p>
                  <h2 id="recommendation-wishlist-followup-title">
                    {recommendationBundle.unresolvedWishlistItems.length === 1
                      ? "One wish needs a quick check."
                      : `${recommendationBundle.unresolvedWishlistItems.length} wishes need a quick check.`}
                  </h2>
                  <p>
                    DayWeave searched the destination guides but could not
                    verify a route-ready place with enough confidence. It stayed
                    in your wishlist instead of becoming the wrong pin.
                  </p>
                </header>
                <div>
                  <ul>
                    {recommendationBundle.unresolvedWishlistItems.map(
                      (wishlistItem, index) => (
                        <li key={`${wishlistItem}-${index}`}>
                          <span aria-hidden="true">↳</span>
                          <strong>{wishlistItem}</strong>
                          <small>Kept for your review</small>
                        </li>
                      ),
                    )}
                  </ul>
                  <button
                    className="recommendation-wishlist-followup__action"
                    type="button"
                    data-testid="edit-unresolved-wishlist"
                    onClick={() => {
                      setStage("opening");
                      setAnnouncement(
                        "Your wishlist is still here. Review the item DayWeave could not verify confidently.",
                      );
                      window.requestAnimationFrame(() =>
                        savedPlacesInputRef.current?.focus(),
                      );
                    }}
                  >
                    Review this wish <span aria-hidden="true">→</span>
                  </button>
                </div>
              </section>
            )}

            <section
              className="recommendation-route-plan"
              aria-labelledby="recommendation-route-plan-title"
            >
              <header className="recommendation-route-plan__intro">
                <div>
                  <p className="recommendation-route-plan__label">
                    {isMultiDay
                      ? `${dayThreads.length} area-based days`
                      : "One area-based day"}
                  </p>
                  <h2 id="recommendation-route-plan-title">
                    {isMultiDay
                      ? "A route that stays in the area."
                      : "A clear order for the day."}
                  </h2>
                </div>
                <p>{recommendationBundle.routePlan.summary}</p>
              </header>

              <div className="recommendation-route-plan__days">
                {dayThreads.map((day) => (
                  <article
                    className="recommendation-day-thread"
                    data-testid={`recommendation-day-${day.dayNumber}`}
                    key={`${day.dayNumber}-${day.areaLabel}`}
                  >
                    <header>
                      <p>
                        Suggested day {day.dayNumber}
                        <span aria-hidden="true"> · </span>
                        <strong>{day.areaLabel}</strong>
                      </p>
                      <h3>{day.areaLabel} day</h3>
                      <span>{day.title}</span>
                    </header>
                    <ol aria-label={`Stop order for day ${day.dayNumber} in ${day.areaLabel}`}>
                      {day.briefs.map((brief, index) => (
                        <li key={brief.placeId}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <strong>{brief.placeName}</strong>
                        </li>
                      ))}
                    </ol>
                    <footer>
                      <p>{day.rationale}</p>
                      <div className="recommendation-day-thread__actions">
                        {isMultiDay && (
                          <button
                            type="button"
                            onClick={() =>
                              startRecommendationJourney(day.dayNumber)
                            }
                            data-testid={`start-recommended-day-${day.dayNumber}`}
                          >
                            Start this day live <span aria-hidden="true">→</span>
                          </button>
                        )}
                        <a
                          href={day.routeUrl}
                          target="_blank"
                          rel="noreferrer"
                          data-testid={`recommendation-day-route-${day.dayNumber}`}
                          aria-label={`Open ${day.areaLabel} day in Maps (opens in a new tab)`}
                        >
                          Check this route in Maps ↗
                        </a>
                      </div>
                    </footer>
                  </article>
                ))}
              </div>

              <p className="recommendation-route-plan__basis">
                <span aria-hidden="true">◎</span>
                {routeBasisCopy}
              </p>
            </section>

            <div className="recommendation-visual-hero__actions">
              {isMultiDay ? (
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() =>
                    document
                      .getElementById("recommendation-route-plan-title")
                      ?.scrollIntoView({
                        behavior: reduceMotion ? "auto" : "smooth",
                        block: "start",
                      })
                  }
                >
                  Choose the day to start ↓
                </button>
              ) : (
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => startRecommendationJourney(1)}
                  data-testid="start-recommended-journey"
                >
                  Start this journey live →
                </button>
              )}
              {!isMultiDay && singleDayRouteUrl && (
                <a
                  className="button button--ghost"
                  href={singleDayRouteUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Check the route in Maps ↗
                </a>
              )}
              {isHongKongDemo && (
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={openAdaptiveHongKongDemo}
                  data-testid="continue-hong-kong-demo"
                >
                  Open the complete Hong Kong demo
                </button>
              )}
            </div>
            {recommendationJourneyError && (
              <p className="recommendation-journey-error" role="alert">
                {recommendationJourneyError}
              </p>
            )}
            {isHongKongDemo && (
              <p className="recommendation-demo-next">
                The complete demo adds a seven-stop day with a fixed lunch,
                sunset timing and a richer recovery scenario.
              </p>
            )}
          </div>
        </header>

        <section
          className="recommendation-stories"
          aria-labelledby="recommendation-stories-title"
        >
          <header className="recommendation-stories__intro">
            <p className="mono-label">
              {recommendationBundle.orderedBriefs.length} sourced stops ·{" "}
              {dayThreads.length} {dayThreads.length === 1 ? "day thread" : "day threads"}
            </p>
            <h2 id="recommendation-stories-title">
              {isMultiDay
                ? "What not to miss, day by day."
                : "What not to miss, stop by stop."}
            </h2>
            <p>
              DayWeave keeps the area and order visible, then gives you the detail
              that makes each stop count.
            </p>
          </header>

          <ol className="recommendation-stories__list">
            {recommendationBundle.orderedBriefs.map((brief, index) => {
              const evidence = brief.evidence[0];
              const storyPosition = storyPositionByPlaceId.get(brief.placeId);
              const momentLabel = storyPosition
                ? `Day ${storyPosition.dayNumber} · ${storyPosition.areaLabel}`
                : `Stop ${index + 1}`;
              const stopPosition = storyPosition
                ? `stop ${storyPosition.stopNumber} of ${storyPosition.stopCount}`
                : `stop ${brief.order}`;
              return (
                <li
                  className={index % 2 === 1 ? "recommendation-story recommendation-story--reverse" : "recommendation-story"}
                  key={brief.placeId}
                >
                  <figure className="recommendation-story__visual" aria-hidden="true">
                    {recommendationArtwork ? (
                      <Image
                        src={recommendationArtwork.src}
                        alt=""
                        fill
                        unoptimized
                        sizes="(max-width: 980px) 100vw, 46vw"
                        style={{
                          objectPosition: stopImagePositions[index] ?? "center",
                          transformOrigin: stopImageOrigins[index] ?? "center",
                        }}
                      />
                    ) : (
                      <div className="recommendation-story__fallback">
                        <span>{String(brief.order).padStart(2, "0")}</span>
                      </div>
                    )}
                    <figcaption>
                      {momentLabel} · {stopPosition}
                    </figcaption>
                  </figure>

                  <article className="recommendation-story__content">
                    <header>
                      <div>
                        <p className="mono-label">
                          {momentLabel} · {stopPosition} ·{" "}
                          {brief.origin === "saved"
                            ? "one you saved"
                            : "picked by DayWeave"}
                        </p>
                        <h3>{brief.placeName}</h3>
                      </div>
                      <a
                        href={placeSearchUrl(
                          brief.placeName,
                          brief.mapsArea ?? destination,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Find ${brief.placeName} in Maps (opens in a new tab)`}
                      >
                        Maps ↗
                      </a>
                    </header>

                    <section
                      className="recommendation-story__dont-miss"
                      aria-label={`Don’t miss at ${brief.placeName}`}
                    >
                      <span>Don’t miss here</span>
                      <strong>{brief.dontMiss}</strong>
                    </section>

                    <div className="recommendation-story__why">
                      <span>Why it earns the stop</span>
                      <p>{brief.whyPeopleCome}</p>
                    </div>

                    <footer>
                      <p><strong>Worth knowing:</strong> {brief.worthKnowing}</p>
                      <a href={evidence.sourceUrl} target="_blank" rel="noreferrer">
                        {evidence.sourceName} · checked {evidence.lastCheckedDate}
                        {evidence.license ? ` · ${evidence.license}` : ""} ↗
                      </a>
                    </footer>
                  </article>
                </li>
              );
            })}
          </ol>
        </section>

        <details className="recommendation-provenance">
          <summary>
            <span>How DayWeave chose these places</span>
            <span aria-hidden="true">+</span>
          </summary>
          <div className="recommendation-provenance__content">
            <div>
              <p className="mono-label">Independent destination evidence</p>
              <h2>
                {recommendationBundle.mode === "curated_local"
                  ? "Local insight stays separate from what you typed."
                  : "Travel-guide knowledge, adapted with attribution."}
              </h2>
              <p>
                Nothing was copied from your notes and called a recommendation.
                Each “Don’t miss” detail has an independent source. Maps remains
                responsible for current directions, travel times and venue status.
              </p>
            </div>
            <a
              className="button button--sky"
              href={recommendationBundle.attribution.url}
              target="_blank"
              rel="noreferrer"
            >
              Open the source ↗
            </a>
          </div>
          {recommendationBundle.attribution.license && (
            <p className="recommendation-provenance__license">
              Adapted from {recommendationBundle.attribution.label} under{" "}
              {recommendationBundle.attribution.license}.
            </p>
          )}
        </details>
      </section>
    );
  }

  function renderResult() {
    if (!plan) return null;
    const returnedMinutes = Math.max(0, baseline.travelMinutes - plan.metrics.travelMinutes);
    const dayStartMinute = plan.legs[0]?.departMinute ?? optimizationInput.day.startMinute;
    const fixedStop = plan.itinerary.find((stop) => stop.fixedBooking);
    const fixedPlace = places.find((place) => place.id === fixedStop?.placeId);
    const timedStop = plan.itinerary.find((stop) =>
      places.find((place) => place.id === stop.placeId)?.timingConstraints?.length,
    );
    const timedPlace = places.find((place) => place.id === timedStop?.placeId);

    if (!plan.feasible) {
      return (
        <section className="screen result-screen" aria-labelledby="result-title">
          <div className="screen-inner">
            <div className="screen-heading">
              <p className="step-label">3 · Your route</p>
              <h1 id="result-title" tabIndex={-1} ref={headingRef}>This set needs a little more room.</h1>
              <p>DayWeave will not pretend everything fits. Adjust one priority or walking limit, and the protected places will be checked again.</p>
            </div>
            <div className="action-row">
              <button className="button button--primary" type="button" onClick={() => setStage("confirm")}>Adjust what matters</button>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="screen result-screen" aria-labelledby="result-title">
        <div className="screen-inner">
          <div className="screen-heading heading-with-wivi">
            <div>
              <p className="step-label">3 · Your route</p>
              <h1 id="result-title" tabIndex={-1} ref={headingRef}>A day you can follow, with the moments protected.</h1>
              <p>{plan.metrics.selectedCount} places fit without rushing. The route tells you what comes next and why its timing matters.</p>
              <ProgressDots stage={stage} />
            </div>
            <Wivi mood="happy" />
          </div>

          <section className="day-plan route-story" aria-labelledby="day-plan-title">
            <header className="day-plan__header">
              <div>
                <p className="mono-label">{demoMode ? "Saturday sample" : "Prototype day"} · {formatTimelineTime(dayStartMinute)}–{formatTimelineTime(plan.metrics.finishMinute)}</p>
                <h2 id="day-plan-title">Your day, woven in order.</h2>
                <p>Each stop keeps the essential cue close: when to move, what makes it worth the stop and what DayWeave is protecting.</p>
              </div>
            </header>

            <ul className="route-story__facts" aria-label="Route summary">
              <li><span>In the day</span><strong>{plan.metrics.selectedCount} stops</strong></li>
              <li><span>Must-visits safe</span><strong>{plan.metrics.mustVisitProtectedCount}</strong></li>
              <li><span>Walking</span><strong>{plan.metrics.walkingKm.toFixed(1)} km</strong></li>
              <li><span>Back by</span><strong>{formatTimelineTime(plan.metrics.finishMinute)}</strong></li>
            </ul>

            <div className="day-plan__actions day-plan__commit">
              <button className="button button--primary" type="button" onClick={beginDay} data-testid="begin-day">{demoMode ? "Try the live journey" : "Follow this route"}</button>
              <button className="button button--ghost" type="button" onClick={() => setStage("confirm")}>Adjust my choices</button>
            </div>

            <RouteTimeline
              stops={plan.itinerary}
              legs={plan.legs}
              places={places}
              startLabel="Sheung Wan MTR"
              endLabel="Hotel in Jordan"
              endLocationId={optimizationInput.day.endLocationId}
              finishMinute={plan.metrics.finishMinute}
              directionsRegion={destination}
              showConstraintReasons
              showDirectionsLinks
              insightsByPlaceId={dontMissByPlaceId}
              variant="editorial"
            />

            {plan.deferred.length > 0 && (
              <footer className="day-plan__deferred">
                <strong>Saved for another day</strong>
                <span>{plan.deferred.map((place) => place.name).join(" · ")}</span>
              </footer>
            )}
          </section>

          <details className="plan-secondary">
            <summary>How DayWeave decided</summary>
            <p className="decision-proof">OpenAI interprets messy travel intent when connected. AURORA verifies the real constraints. You approve every meaningful change.</p>
            <ul className="metric-list" aria-label="Optimization improvements">
              <li><span className="metric-icon">+{returnedMinutes}</span><span><strong>{returnedMinutes} minutes returned to your day</strong><small>Compared with the tangled saved order</small></span></li>
              <li><span className="metric-icon">{plan.metrics.walkingKm.toFixed(1)}</span><span><strong>Walking reduced from {baseline.walkingKm.toFixed(1)} to {plan.metrics.walkingKm.toFixed(1)} km</strong><small>Inside your selected comfort</small></span></li>
              <li><span className="metric-icon">⌁</span><span><strong>{plan.metrics.mustVisitProtectedCount} protected knots remain</strong><small>{timedPlace?.timingConstraints?.[0]?.label ?? "Every confirmed timing window remains valid"}</small></span></li>
              {fixedStop ? (
                <li><span className="metric-icon">{formatTime(fixedStop.startMinute).replace(/\s[AP]M$/, "")}</span><span><strong>{fixedPlace?.fixedBooking?.label ?? "Fixed booking"} protected</strong><small>Fixed bookings never move silently</small></span></li>
              ) : (
                <li><span className="metric-icon">✓</span><span><strong>Back by {formatTimelineTime(plan.metrics.finishMinute)}</strong><small>Inside your confirmed day boundary</small></span></li>
              )}
            </ul>
          </details>

          <p className="screen-footer-note">Place hours and travel estimates come from the verified Hong Kong prototype catalog; your pasted notes stay separate. This confirmed day is saved in this browser so a refresh does not erase it. DayWeave is a decision companion, not a replacement for turn-by-turn maps.</p>
        </div>
      </section>
    );
  }

  function renderSupportSheet() {
    if (!supportSheet) return null;

    if (supportSheet === "stay") {
      return (
        <motion.section className="choice-sheet" role="region" aria-labelledby="stay-title" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }}>
          <h2 id="stay-title">Stay. This is what the trip is for.</h2>
          <p>Choose how much more time feels right. DayWeave will reshape only what remains.</p>
          <div className="duration-options">
            {([15, 30, 60] as const).map((minutes, index) => (
              <button ref={index === 0 ? sheetRef : undefined} className="duration-option" type="button" onClick={() => handleStayLonger(minutes)} key={minutes}>+{minutes} minutes</button>
            ))}
          </div>
          <button className="button button--ghost" type="button" onClick={closeSupportSheet}>Keep the current timing</button>
        </motion.section>
      );
    }

    if (supportSheet === "break") {
      return (
        <motion.section className="choice-sheet" role="region" aria-labelledby="break-title" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }}>
          <h2 id="break-title">A break belongs in a meaningful day.</h2>
          <p>Wivi will hold a real rest window—never squeeze it invisibly between stops.</p>
          <button ref={sheetRef} className="button button--lime" type="button" onClick={protectBreak}>Protect a 25-minute break</button>
          <button className="button button--ghost" type="button" onClick={closeSupportSheet}>Not right now</button>
        </motion.section>
      );
    }

    if (supportSheet === "skip") {
      return (
        <motion.section className="choice-sheet" role="region" aria-labelledby="skip-title" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }}>
          <h2 id="skip-title">Save {currentStop?.name ?? "this place"} for another day?</h2>
          <p>Only this destination changes. Nothing new enters your route.</p>
          <button ref={sheetRef} className="button button--lavender" type="button" onClick={confirmSkip}>Yes, save it for another day</button>
          <button className="button button--ghost" type="button" onClick={closeSupportSheet}>Keep it in my day</button>
        </motion.section>
      );
    }

    return null;
  }

  function renderLive() {
    if (!plan || !livePlan) return null;
    const livePlaces = liveState?.sourceInput.places ?? places;
    const firstLiveLeg = livePlan.legs[0];
    const nextLeg = currentStop
      ? firstLiveLeg?.toId === currentStop.placeId
        ? firstLiveLeg
        : livePlan.legs.find((leg) => leg.toId === currentStop.placeId)
      : undefined;
    const isAfterFirstStop = (liveState?.completedStops.length ?? 0) >= 1;
    const selectedRecovery = recoveryOptions.find(
      (option) => option.id === recoveryChoice,
    );
    const recoveryDeferred = selectedRecovery?.state.currentPlan.deferred.find(
      (place) =>
        !liveState?.skippedPlaceIds.includes(place.placeId) &&
        plan.itinerary.some((stop) => stop.placeId === place.placeId),
    );
    const hasCurrentBrief =
      currentStop?.placeId === "maks-noodle" ||
      currentStop?.placeId === "bakehouse-soho";
    const currentPlaceRecord = livePlaces.find(
      (place) => place.id === currentStop?.placeId,
    );
    const currentOrigin =
      liveState?.completedStops.at(-1)?.name ??
      (demoMode ? "Sheung Wan MTR" : undefined);
    const currentJourneyInsight = currentStop
      ? journeyContext?.insightsByPlaceId[currentStop.placeId]
      : undefined;
    const currentInsight = currentStop
      ? insightsByPlaceId[currentStop.placeId]
      : undefined;
    const currentStopNumber = completedIds.length + 1;
    const laterStopCount = Math.max(0, plannedStops.length - 1);
    const upcomingStops = plannedStops.slice(1, 3);
    const destinationKey = destination.trim().toLocaleLowerCase("en");
    const livePlaceIds = new Set(livePlaces.map((place) => place.id));
    const hasSingaporeArtwork = [
      "fort-canning-park",
      "marina-bay-waterfront",
      "east-coast-park",
    ].every((placeId) => livePlaceIds.has(placeId));
    const liveArtwork =
      /^(?:hong\s*kong|hongkong|hk)$/.test(destinationKey)
        ? {
            src: "/hong-kong-journey-v1.png",
            alt: "A mosaic Hong Kong journey with Man Mo Temple, Victoria Harbour and Victoria Peak",
          }
        : destinationKey === "singapore" && hasSingaporeArtwork
          ? {
              src: "/singapore-journey-v1.png",
              alt: "A mosaic Singapore journey from Fort Canning through Marina Bay to East Coast Park",
            }
          : null;
    const liveArtworkPositions: Record<string, string> = {
      "man-mo-temple": "8% center",
      "bakehouse-soho": "25% center",
      "maks-noodle": "37% center",
      "tai-kwun": "46% center",
      pmq: "54% center",
      "victoria-peak": "87% center",
      "temple-street-market": "70% center",
    };
    const liveArtworkPosition =
      (currentStop && liveArtworkPositions[currentStop.placeId]) ?? "center";
    const startLabel = destination
      ? isRecommendationJourney
        ? `Start of the ${journeyContext.areaLabel} day`
        : `${destination} starting point`
      : "Starting point";
    const endLabel = destination
      ? isRecommendationJourney
        ? `End of the ${journeyContext.areaLabel} day`
        : `${destination} finish`
      : "End point";
    const travelTimingLabel =
      nextLeg?.source === "curated_sequence_estimate"
        ? `${nextLeg.minutes} min planning buffer`
        : nextLeg?.source === "geographic_estimate"
          ? `about ${nextLeg.minutes} min planning estimate`
          : nextLeg
            ? `${nextLeg.minutes} min ${travelModeLabel(nextLeg.mode).toLocaleLowerCase("en")}`
            : "";

    return (
      <section className="screen live-screen" aria-labelledby="live-title">
        <div className="live-shell">
          <div className="live-main">
            <div className="live-journey-status">
              <div>
                <p className="step-label">
                  {demoMode
                    ? "Guided demo"
                    : isRecommendationJourney
                      ? "Live companion"
                      : "Live route"}
                </p>
                <strong>{currentStop ? `Stop ${currentStopNumber} of ${routeStops.length}` : "Route complete"}</strong>
              </div>
              <div className="live-journey-clock">
                <span>
                  {demoMode
                    ? "Demo time"
                    : isRecommendationJourney
                      ? "Sample plan time"
                      : "Plan time"}
                </span>
                <strong>{formatTime(nowMinute)}</strong>
                <small>{destination || "Your day"}</small>
              </div>
            </div>

            {journeyContext && (
              <details className="live-journey-estimate-note">
                <summary>
                  {journeyContext.estimateBasis === "geographic_estimate"
                    ? "Planning estimates · Maps checks live travel"
                    : "Guided sequence · Maps checks live travel"}
                </summary>
                <ul>
                  {journeyContext.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </details>
            )}

            {currentStop ? (
              <article className="live-journey-focus">
                <figure className="live-journey-focus__visual">
                  {liveArtwork ? (
                    <Image
                      src={liveArtwork.src}
                      alt={liveArtwork.alt}
                      fill
                      priority
                      unoptimized
                      sizes="(max-width: 980px) 100vw, 46vw"
                      style={{ objectPosition: liveArtworkPosition }}
                    />
                  ) : (
                    <div
                      className="live-journey-focus__fallback"
                      aria-hidden="true"
                    >
                      <span>{journeyContext?.areaLabel ?? destination}</span>
                      <strong>
                        {(journeyContext?.areaLabel ?? destination ?? "Day")
                          .slice(0, 2)
                          .toLocaleUpperCase("en")}
                      </strong>
                      <i />
                      <i />
                      <i />
                    </div>
                  )}
                  <figcaption>
                    <span>Now</span>
                    <strong>{currentStop.name}</strong>
                  </figcaption>
                </figure>

                <div className="live-journey-focus__content">
                  <header className="live-journey-focus__heading">
                    <div>
                      <p className="next-kicker">{arrived ? "You are here" : travelActive ? "On your way" : "Up next"}</p>
                      <h1 id="live-title" tabIndex={-1} ref={headingRef}>
                        {arrived ? `Be here at ${currentStop.name}.` : travelActive ? `Head toward ${currentStop.name}.` : currentStop.name}
                      </h1>
                    </div>
                    <span aria-hidden="true">{String(currentStopNumber).padStart(2, "0")}</span>
                  </header>

                  <dl className="live-journey-timing" aria-label={`Timing for ${currentStop.name}`}>
                    {arrived ? (
                      <div>
                        <dt>Stay until</dt>
                        <dd>{formatTimelineTime(currentStop.endMinute)}</dd>
                      </div>
                    ) : nextLeg &&
                      isRecommendationJourney &&
                      nextLeg.fromId ===
                        liveState?.sourceInput.day.startLocationId ? (
                      <div>
                        <dt>Getting there</dt>
                        <dd>Start from your location · check Maps</dd>
                      </div>
                    ) : nextLeg ? (
                      <>
                        <div>
                          <dt>
                            {isRecommendationJourney ? "Suggested leave" : "Leave"}
                          </dt>
                          <dd>{formatTimelineTime(nextLeg.departMinute)}</dd>
                        </div>
                        <div>
                          <dt>{isRecommendationJourney ? "Allow" : "Travel"}</dt>
                          <dd>{travelTimingLabel}</dd>
                        </div>
                        <div>
                          <dt>
                            {isRecommendationJourney ? "Planned arrival" : "Arrive"}
                          </dt>
                          <dd>{formatTimelineTime(nextLeg.arriveMinute)}</dd>
                        </div>
                      </>
                    ) : (
                      <div>
                        <dt>Visit</dt>
                        <dd>{formatTimelineTime(currentStop.startMinute)}–{formatTimelineTime(currentStop.endMinute)}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="live-journey-actions">
                    {arrived ? (
                      <>
                        <button className="button button--primary" type="button" onClick={completeCurrentStop} data-testid="complete-stop">Done with this stop</button>
                        <button className="button button--ghost" type="button" onClick={() => setSupportSheet("stay")}>Stay a little longer</button>
                      </>
                    ) : (
                      <>
                        <button className="button button--primary" type="button" onClick={takeMeThere} data-testid="take-me-there">
                          <span className="button-icon" aria-hidden="true">→</span>
                          {travelActive ? "I’ve arrived" : "Start this leg"}
                        </button>
                        <a
                          className="button button--ghost"
                          href={directionsUrl(currentStop.name, currentPlaceRecord?.area, currentOrigin, destination)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open directions to ${currentStop.name} in Google Maps (opens in a new tab)`}
                        >
                          Open in Maps ↗
                        </a>
                      </>
                    )}
                    {isAfterFirstStop && !recoveryApplied && (
                      <button className="live-journey-actions__quiet" type="button" onClick={openRepair} data-testid="simulate-delay">Running late?</button>
                    )}
                  </div>

                  {currentInsight && (
                    <aside className="live-journey-insight" aria-label={`Don’t miss at ${currentStop.name}`}>
                      <span>Don’t miss here</span>
                      <strong>{currentInsight.summary}</strong>
                      {hasCurrentBrief && (
                        <button
                          className="live-journey-insight__action"
                          type="button"
                          onClick={() => openBriefing(currentStop.placeId as "maks-noodle" | "bakehouse-soho", "live")}
                          data-testid={recoveryApplied ? "view-briefing" : undefined}
                        >
                          See the local insight →
                        </button>
                      )}
                      {currentJourneyInsight && (
                        <details className="live-journey-insight__details">
                          <summary>Worth knowing</summary>
                          <p>{currentJourneyInsight.worthKnowing}</p>
                          <a
                            href={currentJourneyInsight.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {currentJourneyInsight.sourceName} ↗
                          </a>
                        </details>
                      )}
                    </aside>
                  )}

                  <p className="live-journey-reassurance">
                    {isRecommendationJourney
                      ? recoveryApplied
                        ? "The remaining plan now reflects the delay you entered. Maps will check each next leg."
                        : "Times are planning estimates, not live traffic. Maps checks current directions; venue sources remain responsible for hours and availability."
                      : recoveryApplied
                        ? "The rest of the route has already shifted around your delay. Protected moments remain safe."
                        : "Only this move needs your attention. The rest of the day waits quietly below."}
                  </p>
                  {liveNotice && <div className="live-journey-notice">{liveNotice}</div>}
                </div>
              </article>
            ) : (
              <article className="live-journey-complete">
                <p className="next-kicker">The day has been lived</p>
                <h1 id="live-title" tabIndex={-1} ref={headingRef}>Let’s tie the memory thread.</h1>
                <p className="decision-why">A meaningful day does not need a completion score. Keep the moments, not the checklist.</p>
                <div className="next-actions"><button className="button button--primary" type="button" onClick={finishDay}>See my memory thread</button></div>
              </article>
            )}

            {currentStop && (
              <section className="live-journey-support" aria-label="Change the remaining day">
                <button
                  ref={supportTriggerRef}
                  className="change-day-trigger"
                  type="button"
                  aria-expanded={supportMenuOpen}
                  aria-controls="day-change-options"
                  onClick={() => {
                    setSupportMenuOpen((open) => !open);
                    setSupportSheet(null);
                  }}
                >
                  <span aria-hidden="true">＋</span>
                  Change the rest of my day
                </button>
                <AnimatePresence initial={false}>
                  {supportMenuOpen && (
                    <motion.div
                      id="day-change-options"
                      className="support-actions"
                      role="group"
                      aria-label="Change the remaining day"
                      initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: reduceMotion ? 0 : 0.16 }}
                    >
                      {(!isAfterFirstStop || recoveryApplied) && (
                        <button className="support-action" type="button" onClick={openRepair}><span aria-hidden="true">+40</span><span>I’m running late</span></button>
                      )}
                      <button className="support-action support-action--break" type="button" onClick={() => {
                        setSupportMenuOpen(false);
                        setSupportSheet("break");
                      }}><span aria-hidden="true">☕</span><span>I need a break</span></button>
                      <button className="support-action" type="button" onClick={() => {
                        setSupportMenuOpen(false);
                        setSupportSheet("skip");
                      }}><span aria-hidden="true">↷</span><span>Skip this</span></button>
                      <button className="support-action" type="button" onClick={confirmEndDay}><span aria-hidden="true">✓</span><span>End my day here</span></button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}

            <AnimatePresence>{renderSupportSheet()}</AnimatePresence>

            {(recoveryApplied || breakMinutes || stayMinutes) && (
              <details className="live-changes">
                <summary>What changed in my route</summary>
                <div>
                  {recoveryApplied && (
                    <div className="change-summary">
                      <strong>{recoveryChoice === "protect_moments" ? "The moments are protected" : "Every chosen stop is kept"}</strong>
                      <p>
                        {recoveryChoice === "protect_moments"
                          ? isRecommendationJourney
                            ? `${recoveryDeferred ? `${recoveryDeferred.name} is saved for another day.` : "No stop was deferred."} Remaining times are planning estimates; Maps checks each move.`
                            : `${recoveryDeferred?.name ?? "One lower-priority stop"} is saved for another day. Your fixed booking and protected timing windows remain safe.`
                          : `You chose tighter transition buffers. The route still finishes by ${formatTimelineTime(selectedRecovery?.state.currentPlan.metrics.finishMinute ?? livePlan.metrics.finishMinute)}.`}
                      </p>
                    </div>
                  )}
                  {breakMinutes && <div className="change-summary"><strong>Rest is protected</strong><p>Your {breakMinutes}-minute break is part of the plan, not leftover time.</p></div>}
                  {stayMinutes && <div className="change-summary"><strong>You chose the moment</strong><p>{stayMinutes} extra minutes were honored. Only the remaining day was re-woven.</p></div>}
                </div>
              </details>
            )}

            <section className="live-journey-upcoming" aria-labelledby="live-route-title">
              <header className="live-journey-upcoming__header">
                <div>
                  <p className="mono-label">Coming up</p>
                  <h2 id="live-route-title">What comes next.</h2>
                  <p>{completedIds.length > 0 ? `${completedIds.length} ${completedIds.length === 1 ? "moment is" : "moments are"} already tied. ` : ""}{laterStopCount} {laterStopCount === 1 ? "stop remains" : "stops remain"} after this one.</p>
                </div>
                <span>
                  <small>{isRecommendationJourney ? "Estimated finish" : "Back by"}</small>
                  <strong>{formatTimelineTime(livePlan.metrics.finishMinute)}</strong>
                </span>
              </header>

              {upcomingStops.length > 0 ? (
                <ol className="live-journey-glance" aria-label="Next stops at a glance">
                  {upcomingStops.map((stop, index) => {
                    const place = livePlaces.find((item) => item.id === stop.placeId);
                    return (
                      <li key={stop.placeId}>
                        <span>{String(currentStopNumber + index + 1).padStart(2, "0")}</span>
                        <div>
                          <strong>{stop.name}</strong>
                          <small>{place?.area ?? destination}</small>
                        </div>
                        <time>{formatTimelineTime(stop.startMinute)}</time>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="live-journey-upcoming__last">This is the final stop in today’s thread.</p>
              )}

              {laterStopCount > 0 && (
                <details className="live-journey-route-details">
                  <summary>
                    See the full remaining route
                    <span>{laterStopCount} {laterStopCount === 1 ? "stop" : "stops"}</span>
                  </summary>
                  <RouteTimeline
                    stops={routeStops}
                    legs={livePlan.legs}
                    places={livePlaces}
                    startLabel={startLabel}
                    endLabel={endLabel}
                    endLocationId={liveState?.sourceInput.day.endLocationId ?? optimizationInput.day.endLocationId}
                    finishMinute={livePlan.metrics.finishMinute}
                    directionsRegion={destination}
                    completedIds={completedIds}
                    currentPlaceId={currentStop?.placeId}
                    currentStateLabel={arrived ? "You’re here" : travelActive ? "On the way" : "Up next"}
                    breaks={liveState?.protectedBreaks ?? []}
                    label={isRecommendationJourney ? "Guided route with completed, current and upcoming stops" : "Live route with completed, current and upcoming stops"}
                    insightsByPlaceId={insightsByPlaceId}
                    showConstraintReasons={!isRecommendationJourney}
                    showDirectionsLinks
                    variant="live"
                  />
                </details>
              )}
            </section>

            {recoveryApplied && stayMinutes && <button className="button button--primary button--wide" type="button" onClick={finishDay} data-testid="finish-day">See today’s memory</button>}
          </div>
        </div>
      </section>
    );
  }

  function renderRepair() {
    const protectOption = recoveryOptions.find(
      (option) => option.id === "protect_moments",
    );
    const keepOption = recoveryOptions.find(
      (option) => option.id === "keep_every_stop",
    );
    const newlyDeferred = plan?.itinerary.filter(
      (stop) =>
        !completedIds.includes(stop.placeId) &&
        !protectOption?.state.currentPlan.itinerary.some(
          (nextStop) => nextStop.placeId === stop.placeId,
      ),
    ) ?? [];
    const protectedPlan = protectOption?.state.currentPlan;
    const protectedFixedStop = protectedPlan?.itinerary.find((stop) => stop.fixedBooking);
    const protectedFixedPlace = places.find((place) => place.id === protectedFixedStop?.placeId);
    const protectedTimedStop = protectedPlan?.itinerary.find((stop) =>
      places.some((place) => place.id === stop.placeId && place.timingConstraints?.length),
    );
    const protectedTimedPlace = places.find((place) => place.id === protectedTimedStop?.placeId);
    const completedMomentCopy = completedIds.length > 0
      ? `${completedIds.length === 1 ? "Your completed moment stays" : `${completedIds.length} completed moments stay`} exactly where ${completedIds.length === 1 ? "it belongs" : "they belong"}.`
      : "Nothing in the original plan changes until you choose a path.";

    return (
      <section className="screen" aria-labelledby="repair-title">
        <div className="screen-inner">
          <div className="screen-heading">
            <p className="step-label">The day changed · you stay in control</p>
            <h1 id="repair-title" tabIndex={-1} ref={headingRef}>
              {isRecommendationJourney
                ? "Your plan is forty minutes later. Two clear choices."
                : "Forty minutes later. Two honest paths."}
            </h1>
            <p>
              {isRecommendationJourney
                ? `The sample plan now reads ${formatTime(pendingDelayState?.currentMinute ?? nowMinute)}. Only the remaining estimated schedule was recalculated.`
                : `At ${formatTime(pendingDelayState?.currentMinute ?? nowMinute)}, only the remaining day was recalculated.`}{" "}
              {completedMomentCopy}
            </p>
          </div>
          <div className="repair-intro">
            <Wivi mood="comforting" small />
            <p>
              {isRecommendationJourney
                ? "Nothing changes until you choose. DayWeave will only reshape the stops still ahead."
                : "The day changed, but nothing disappeared. Choose what matters now and Wivi will hold the protected pieces."}
            </p>
          </div>
          <div className="repair-paths">
            <article className="repair-path repair-path--protected">
              <p className="mono-label">Calmer recovery</p>
              <h2>{protectOption?.title ?? "Protect the moments"}</h2>
              <p>
                {isRecommendationJourney
                  ? "Keep saved places first and finish near the original estimate; a lower-priority recommendation may wait."
                  : protectOption?.description ??
                    "Keep the emotional anchors and create breathing room."}
              </p>
              <ul className="tradeoff-list">
                {isRecommendationJourney ? (
                  <>
                    <li>Keep saved places ahead of service-added stops</li>
                    <li>Use the same visible planning estimates</li>
                  </>
                ) : (
                  <>
                    <li>{protectedTimedPlace
                      ? `Keep ${protectedTimedPlace.name} ${protectedTimedPlace.timingConstraints?.[0]?.window.label?.toLocaleLowerCase("en") ?? "inside its protected timing window"}`
                      : "Keep every confirmed timing window valid"}</li>
                    <li>{protectedFixedPlace
                      ? `Keep ${protectedFixedPlace?.fixedBooking?.label.toLocaleLowerCase("en") ?? "the fixed booking"} at ${formatTime(protectedFixedPlace?.fixedBooking?.start ?? protectedFixedStop?.startMinute ?? 0)}`
                      : "Keep every confirmed booking fixed"}</li>
                  </>
                )}
                <li>{newlyDeferred.length > 0 ? `Save ${newlyDeferred.map((stop) => stop.name).join(", ")} for another day` : "No newly deferred stops"}</li>
                <li>{isRecommendationJourney ? "Estimated finish" : "Finish by"} {formatTime(protectOption?.state.currentPlan.metrics.finishMinute ?? 20 * 60 + 35)}</li>
              </ul>
              <button className="button button--primary" type="button" onClick={() => chooseRecovery("protect_moments")} disabled={!protectOption?.valid} data-testid="protect-sunset">Choose Protect the moments</button>
            </article>
            <article className="repair-path repair-path--complete">
              <p className="mono-label">Fuller recovery</p>
              <h2>{keepOption?.title ?? "Keep every chosen stop"}</h2>
              <p>
                {isRecommendationJourney && !keepOption?.valid
                  ? "Keeping every stop does not fit inside the recovery limit."
                  : keepOption?.description ??
                    "Preserve the chosen route with a more packed pace."}
              </p>
              <ul className="tradeoff-list">
                <li>Keep every remaining chosen destination</li>
                <li>Switch from balanced to packed pacing</li>
                <li>Use tighter transition buffers</li>
                <li>{isRecommendationJourney ? "Estimated finish" : "Finish by"} {formatTime(keepOption?.state.currentPlan.metrics.finishMinute ?? 20 * 60 + 27)}</li>
              </ul>
              <button className="button button--sky" type="button" onClick={() => chooseRecovery("keep_every_stop")} disabled={!keepOption?.valid}>Choose Keep every stop</button>
            </article>
          </div>
          <button className="button button--ghost" type="button" onClick={() => {
            setPendingDelayState(null);
            setRecoveryOptions([]);
            setStage("live");
          }}>Go back without changing anything</button>
        </div>
      </section>
    );
  }

  function renderBriefing() {
    const brief = briefingPlaceId === "maks-noodle"
      ? MAKS_NOODLE_DONT_MISS_HERE
      : BAKEHOUSE_DONT_MISS_HERE;
    const signatureConfidence = brief.dontMiss.claim.confidence;
    const confidenceLabel = signatureConfidence === "high"
      ? "High confidence"
      : signatureConfidence === "medium"
        ? "Moderate confidence"
        : "Emerging signal";
    const sourceLabel = brief.dontMiss.claim.sourceType === "official_venue"
      ? "Official venue source"
      : "Official tourism source";
    return (
      <section className="screen" aria-labelledby="brief-title">
        <div className="screen-inner">
          <div className="screen-heading heading-with-wivi">
            <div>
              <p className="step-label">Not a walkthrough · the thing people discover too late</p>
              <h1 id="brief-title" tabIndex={-1} ref={headingRef}>Don’t Miss Here</h1>
              <p>The one detail that helps {brief.placeName} feel like more than another pin on a map.</p>
            </div>
            <Wivi mood="pointing" />
          </div>
          <div className="briefing-layout">
            <article className="briefing-main">
              <header className="briefing-place">
                <p className="mono-label">Up next · {brief.placeName}</p>
                <h2>{brief.placeName}</h2>
              </header>
              {[brief.dontMiss, brief.whyPeopleCome, brief.worthKnowing].map((section) => (
                <section className="brief-section" key={section.heading}>
                  <h3>{section.heading}</h3>
                  <p>{section.body}</p>
                  <span className="micro-tag">{section.evidenceLabel}</span>
                </section>
              ))}
            </article>
            <aside className="briefing-aside">
              <div className="confidence-card">
                <strong>{confidenceLabel} · checked {brief.dontMiss.claim.lastCheckedDate}</strong>
                <p>{sourceLabel} supports this signature choice. Visitor context can enrich the stop, but it never moves your route on its own.</p>
              </div>
              <details className="evidence-details">
                <summary>View evidence</summary>
                <div className="evidence-body">
                  <span>{brief.dontMiss.claim.sourceType === "official_venue" ? "Official venue" : "Official tourism source"} · checked {brief.dontMiss.claim.lastCheckedDate}</span>
                  <a href={brief.dontMiss.claim.sourceUrl} target="_blank" rel="noreferrer" aria-label="Signature evidence (opens in a new tab)">Signature evidence ↗</a>
                  <span>Hong Kong Tourism Board · checked {brief.whyPeopleCome.claim.lastCheckedDate}</span>
                  <a href={brief.whyPeopleCome.claim.sourceUrl} target="_blank" rel="noreferrer" aria-label="Context evidence (opens in a new tab)">Context evidence ↗</a>
                </div>
              </details>
              <div className="notice"><span aria-hidden="true">✓</span><span><strong>Insight, not a scheduling fact.</strong><br />It helps you experience the stop; only verified timing evidence can change the route.</span></div>
              <button className="button button--primary button--wide" type="button" onClick={() => setStage(briefingOrigin)} data-testid="arrive-from-brief">
                {briefingOrigin === "result" ? "Back to the day plan" : "Back to my current stop"}
              </button>
            </aside>
          </div>
        </div>
      </section>
    );
  }

  function renderReweave() {
    const deferredChange = liveChanges.find(
      (change) =>
        change.type === "deferred" &&
        (!change.placeId || !completedIds.includes(change.placeId)),
    );
    const movedCount = liveChanges.filter(
      (change) => change.type === "time_changed",
    ).length;
    return (
      <section className="screen" aria-labelledby="reweave-title">
        <div className="screen-inner">
          <div className="tangle-layout">
            <ThreadMap places={tangledPlaces} untangled completedIds={completedIds} label="Completed places remain tied while the remaining route settles into a new shape" />
            <div className="tangle-action">
              <Wivi mood="sitting" />
              <div className="wivi-speech">This is what the trip is for. Let’s reshape the rest of your day.</div>
              <h1 id="reweave-title" tabIndex={-1} ref={headingRef}>Enjoying a place longer is not a mistake.</h1>
              <p>
                {stayMinutes} extra minutes are now honored.{" "}
                {isRecommendationJourney
                  ? "Completed stops remain fixed. DayWeave recalculated only the unvisited route using the same planning estimates."
                  : "Completed stops remain fixed and the solver checked every remaining window again."}
              </p>
              <div className="change-summary">
                <strong>What changed</strong>
                <p>
                  {deferredChange?.message ??
                    (isRecommendationJourney
                      ? `${movedCount} remaining ${movedCount === 1 ? "planning time was" : "planning times were"} recalculated. No destination was added; Maps checks each next leg.`
                      : `${movedCount} remaining ${movedCount === 1 ? "time was" : "times were"} recalculated. No destination was added, and every remaining protected timing stays valid.`)}
                </p>
              </div>
              <button className="button button--coral untangle-button" type="button" onClick={() => {
                setStage("live");
                setLiveNotice(
                  isRecommendationJourney
                    ? "Rewoven. This stop got the time it deserved, and only the remaining plan changed."
                    : "Rewoven. Your protected moments are still safe, and this stop got the time it deserved.",
                );
              }} data-testid="reweave-day"><span className="button-icon" aria-hidden="true">⌁</span>Reweave the rest</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderMemory() {
    const memoryStops = liveState?.completedStops ?? [];
    const returnedMinutes = plan ? Math.max(0, baseline.travelMinutes - plan.metrics.travelMinutes) : 0;
    const dayComplete = (liveState?.currentPlan.itinerary.length ?? 0) === 0;
    const rememberedMaks = memoryStops.some((stop) => stop.placeId === "maks-noodle");
    const deferredCount = livePlan?.deferred.length ?? plan?.deferred.length ?? 0;
    return (
      <section className="screen memory-screen" aria-labelledby="memory-title">
        <div className="screen-inner">
          <div className="memory-intro">
            <div>
              <p className="step-label">Your memory thread</p>
              <h1 id="memory-title" tabIndex={-1} ref={headingRef}>{dayComplete ? "A day worth remembering." : "Your thread so far."}</h1>
              <p>{dayComplete ? "The day is complete, but this is not a completion score. These are only the moments you actually tied." : "Only places you marked complete appear here. The rest of the route is still waiting, without pressure."}</p>
            </div>
            <Wivi mood="knotting" />
          </div>
          <div className="memory-thread" aria-label="Cheerful journey of enjoyed places">
            {memoryStops.length > 0 ? memoryStops.map((stop, index) => {
              const place = places.find((item) => item.id === stop.placeId);
              return <div className="memory-stop" key={stop.placeId}><span aria-hidden="true">{iconGlyphs[place?.icon ?? ""] ?? "✦"}</span><strong>{stop.name}</strong><small>{index === 0 ? "first memory" : "knot tied"}</small></div>;
            }) : <p className="memory-empty">No moment has been tied yet. That is honest, not a failure.</p>}
          </div>
          <div className="memory-moments">
            <div className="memory-moment"><strong>{memoryStops.length} {memoryStops.length === 1 ? "moment" : "moments"} tied</strong><p>Only places you explicitly completed become memories.</p></div>
            {isRecommendationJourney && journeyContext ? (
              <div className="memory-moment"><strong>{journeyContext.areaLabel} thread</strong><p>The day stayed inside one recommended area; Maps handled each current move.</p></div>
            ) : (
              <div className="memory-moment"><strong>{returnedMinutes} min returned</strong><p>Less backtracking, more room to actually be there.</p></div>
            )}
            {!isRecommendationJourney && rememberedMaks && <div className="memory-moment"><strong>Shrimp wonton noodles</strong><p>A signature detail remembered from Mak’s, not another task to complete.</p></div>}
            <div className="memory-moment"><strong>{deferredCount} waiting for another day</strong><p>Lovely places kept with kindness, not framed as loss.</p></div>
          </div>
          <div className="wivi-speech">{dayComplete ? "You did not complete a list. You made space for a day that mattered." : "The thread remembers what happened, never what the plan merely hoped for."}</div>
          <div className="action-row">
            {recommendationBundle &&
            recommendationBundle.routePlan.days.length > 1 ? (
              <>
                <button
                  className="button button--primary"
                  type="button"
                  onClick={returnToRecommendationDays}
                >
                  Back to my {destination} days
                </button>
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={exploreAnotherPlace}
                >
                  Explore another place
                </button>
              </>
            ) : (
              <button className="button button--primary" type="button" onClick={exploreAnotherPlace}>Weave another day</button>
            )}
            {!dayComplete && <button className="button button--sky" type="button" onClick={() => setStage("live")}>Return to my route</button>}
          </div>
        </div>
      </section>
    );
  }

  function renderStage() {
    switch (stage) {
      case "opening": return renderOpening();
      case "confirm": return renderConfirm();
      case "recommendation": return renderRecommendation();
      case "result": return renderResult();
      case "live": return renderLive();
      case "repair": return renderRepair();
      case "briefing": return renderBriefing();
      case "reweave": return renderReweave();
      case "memory": return renderMemory();
    }
  }

  return (
    <div className={`dayweave-app dayweave-app--${stage}`}>
      <a className="skip-link" href="#dayweave-main">Skip to DayWeave</a>
      {renderHeader()}
      <main className="app-main" id="dayweave-main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stage}
            initial={reduceMotion ? false : stageMotion.initial}
            animate={stageMotion.animate}
            exit={reduceMotion ? undefined : stageMotion.exit}
            transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {renderStage()}
          </motion.div>
        </AnimatePresence>
      </main>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
    </div>
  );
}
