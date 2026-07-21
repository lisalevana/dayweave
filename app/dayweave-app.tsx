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
  type DragEvent,
} from "react";

import {
  BAKEHOUSE_DONT_MISS_HERE,
  MAKS_NOODLE_DONT_MISS_HERE,
  UPPER_LASCAR_ROW_SUGGESTION,
} from "@/lib/adapters/experience-evidence";
import { hongKongDemo } from "@/lib/dayweave/demo";
import { materializeWishlistEnvelope } from "@/lib/dayweave/materialize-extraction";
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

import {
  PlaceCharm,
  ThreadMap,
  type CharmPriority,
  type ThreadPlace,
} from "./thread-map";
import {
  formatTimelineTime,
  RouteTimeline,
  travelModeLabel,
} from "./route-timeline";
import { Wivi } from "./wivi";

type Stage =
  | "opening"
  | "import"
  | "confirm"
  | "tangle"
  | "result"
  | "live"
  | "repair"
  | "briefing"
  | "reweave"
  | "memory";

type ImportStatus = "idle" | "working" | "ready" | "error";
type SupportSheet = "stay" | "break" | "skip" | "alternative" | null;
type DiscoveryDecision = "pending" | "added" | "saved" | "declined";
type RecoveryChoiceId = EngineRecoveryChoice["id"] | null;

const stageProgress: Record<Stage, number> = {
  opening: 0,
  import: 1,
  confirm: 2,
  tangle: 3,
  result: 4,
  live: 5,
  repair: 5,
  briefing: 5,
  reweave: 5,
  memory: 6,
};

const priorityOrder: Priority[] = ["must", "love", "convenient"];

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

function nextPriority(priority: Priority): Priority {
  const index = priorityOrder.indexOf(priority);
  return priorityOrder[(index + 1) % priorityOrder.length];
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
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
      aria-valuemax={6}
      aria-valuenow={Math.max(1, current)}
      aria-valuetext={`Journey step ${Math.max(1, current)} of 6`}
    >
      {Array.from({ length: 6 }, (_, index) => (
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
  const [rawWishlist, setRawWishlist] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importMessage, setImportMessage] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [places, setPlaces] = useState<Place[]>(() =>
    hongKongDemo.input.places.map((place) => ({ ...place })),
  );
  const [pace, setPace] = useState<Pace>("balanced");
  const [walkingKm, setWalkingKm] = useState(3.6);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<Priority | null>(null);
  const [isUntangling, setIsUntangling] = useState(false);
  const [threadUntangled, setThreadUntangled] = useState(false);
  const [plan, setPlan] = useState<OptimizationResult | null>(null);
  const [, setDiscoveryDecision] =
    useState<DiscoveryDecision>("pending");
  const [discoveryMessage, setDiscoveryMessage] = useState("");
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
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const sheetRef = useRef<HTMLButtonElement | null>(null);
  const supportTriggerRef = useRef<HTMLButtonElement | null>(null);

  const optimizationInput = useMemo<OptimizationInput>(
    () => ({
      ...hongKongDemo.input,
      places,
      day: {
        ...hongKongDemo.input.day,
        pace,
        maxWalkingKm: walkingKm,
      },
    }),
    [pace, places, walkingKm],
  );

  const tangledPlaces = useMemo(() => {
    const byId = new Map(places.map((place) => [place.id, place]));
    const ordered = hongKongDemo.tangledOrder
      .map((id) => byId.get(id))
      .filter((place): place is Place => Boolean(place));
    const extras = places.filter(
      (place) => !hongKongDemo.tangledOrder.includes(place.id),
    );
    return [...ordered, ...extras].map(toThreadPlace);
  }, [places]);

  const baseline = useMemo(
    () => baselineRoute(optimizationInput, hongKongDemo.tangledOrder),
    [optimizationInput],
  );

  const livePlan = liveState?.currentPlan ?? plan;
  const plannedStops = livePlan?.itinerary ?? [];
  const completedIds = liveState?.completedStops.map((stop) => stop.placeId) ?? [];
  const currentStop = plannedStops[0];
  const routeStops = liveState
    ? [...liveState.completedStops, ...liveState.currentPlan.itinerary]
    : plannedStops;

  useEffect(() => {
    if (stage === "opening") return;
    window.requestAnimationFrame(() => headingRef.current?.focus());
  }, [stage]);

  useEffect(() => {
    if (!supportSheet) return;
    window.requestAnimationFrame(() => sheetRef.current?.focus());
  }, [supportSheet]);

  function closeSupportSheet() {
    setSupportSheet(null);
    window.requestAnimationFrame(() => supportTriggerRef.current?.focus());
  }

  function resetApp() {
    setStage("opening");
    setRawWishlist("");
    setDemoMode(false);
    setImportStatus("idle");
    setImportMessage("");
    setImageDataUrl(null);
    setUploadName("");
    setPlaces(hongKongDemo.input.places.map((place) => ({ ...place })));
    setPace("balanced");
    setWalkingKm(3.6);
    setDraggingId(null);
    setDragTarget(null);
    setIsUntangling(false);
    setThreadUntangled(false);
    setPlan(null);
    setDiscoveryDecision("pending");
    setDiscoveryMessage("");
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
    setAnnouncement("DayWeave reset.");
  }

  function openImport(useDemo: boolean) {
    setDemoMode(useDemo);
    setRawWishlist(useDemo ? hongKongDemo.messyWishlist : "");
    setImportStatus("idle");
    setImportMessage("");
    setStage("import");
  }

  function previewDemoDay() {
    const demoPlaces = hongKongDemo.input.places.map((place) => ({ ...place }));
    const demoInput: OptimizationInput = {
      ...hongKongDemo.input,
      places: demoPlaces,
    };
    const demoPlan = optimizeDay(demoInput);

    setDemoMode(true);
    setRawWishlist(hongKongDemo.messyWishlist);
    setPlaces(demoPlaces);
    setPace(hongKongDemo.input.day.pace);
    setWalkingKm(hongKongDemo.input.day.maxWalkingKm);
    setThreadUntangled(true);
    setPlan(demoPlan);
    setDiscoveryDecision("pending");
    setDiscoveryMessage("");
    setLiveState(null);
    setLiveChanges([]);
    setAnnouncement("The ready Hong Kong day is open in one clear itinerary.");
    setStage("result");
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

  async function handleExtraction() {
    if (!rawWishlist.trim() && !imageDataUrl) {
      setImportStatus("error");
      setImportMessage("Paste a wishlist or choose a screenshot first.");
      return;
    }

    setImportStatus("working");
    setImportMessage("Separating wishes from constraints…");

    try {
      if (demoMode) {
        await sleep(reduceMotion ? 20 : 620);
        setPlaces(hongKongDemo.input.places.map((place) => ({ ...place })));
        setImportStatus("ready");
        setImportMessage(
          "Nine places found. Three feel non-negotiable, one booking is fixed and two timing wishes need protecting.",
        );
        setAnnouncement("Seeded wishlist structured into nine places.");
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
        setImportStatus("error");
        setImportMessage(
          materialized.places.length === 0
            ? "I couldn’t match a supported Hong Kong place yet. Try Man Mo Temple, Tai Kwun, Star Ferry or Victoria Peak."
            : `I matched ${materialized.places.length} supported ${materialized.places.length === 1 ? "place" : "places"}. Add at least ${3 - materialized.places.length} more so DayWeave can shape a useful day.`,
        );
        return;
      }

      setPlaces(materialized.places);
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
    } catch (error) {
      setImportStatus("error");
      setImportMessage(
        error instanceof Error
          ? error.message
          : "I couldn’t read those notes yet. Paste the place names as text or open the sample day.",
      );
    } finally {
      setImageDataUrl(null);
      setUploadName("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function useDemoFallback() {
    setDemoMode(true);
    setRawWishlist(hongKongDemo.messyWishlist);
    setPlaces(hongKongDemo.input.places.map((place) => ({ ...place })));
    setImportStatus("ready");
    setImportMessage(
      "Seeded demo loaded. This is deterministic demo data, not live analysis.",
    );
  }

  function movePriority(placeId: string, priority: Priority) {
    setPlaces((current) =>
      current.map((place) =>
        place.id === placeId ? { ...place, priority } : place,
      ),
    );
    setAnnouncement(
      `${places.find((place) => place.id === placeId)?.name ?? "Place"} moved to ${laneCopy[priority].title}.`,
    );
  }

  function handleDrop(event: DragEvent<HTMLElement>, priority: Priority) {
    event.preventDefault();
    if (draggingId) movePriority(draggingId, priority);
    setDraggingId(null);
    setDragTarget(null);
  }

  async function handleUntangle() {
    setIsUntangling(true);
    setThreadUntangled(true);
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

  function decideDiscovery(decision: Exclude<DiscoveryDecision, "pending">) {
    const beforeFingerprint = plan?.fingerprint;
    setDiscoveryDecision(decision);

    if (decision === "added") {
      const nextPlaces = places.some(
        (place) => place.id === hongKongDemo.discovery.place.id,
      )
        ? places
        : [...places, hongKongDemo.discovery.place];
      const nextInput: OptimizationInput = {
        ...optimizationInput,
        places: nextPlaces,
      };
      const nextPlan = optimizeDay(nextInput);
      setPlaces(nextPlaces);
      setPlan(nextPlan);
      const fitted = nextPlan.itinerary.some(
        (stop) => stop.placeId === hongKongDemo.discovery.place.id,
      );
      setDiscoveryMessage(
        fitted
          ? "Upper Lascar Row now fits without displacing a protected moment. You chose this change."
          : "Upper Lascar Row is approved, but this version still saves it for another day rather than forcing it in.",
      );
      setAnnouncement("Discovery decision applied and route recalculated.");
      return;
    }

    setDiscoveryMessage(
      decision === "saved"
        ? "Saved for later. Today’s route is unchanged."
        : "No problem. Today’s route is unchanged.",
    );
    if (beforeFingerprint && plan?.fingerprint === beforeFingerprint) {
      setAnnouncement("Discovery declined. The plan stayed unchanged.");
    }
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
      setLiveNotice(`Wivi is walking with you toward ${currentStop.name}.`);
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
    setLiveNotice(`${currentStop.name} is now a memory knot in your thread.`);
    setAnnouncement(`${currentStop.name} completed. The remaining route is unchanged.`);
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
    setAnnouncement("Two valid recovery paths are ready. No place changed silently.");
  }

  function chooseRecovery(choiceId: Exclude<RecoveryChoiceId, null>) {
    const choice = recoveryOptions.find((option) => option.id === choiceId);
    if (!choice?.valid) return;
    setLiveState(choice.state);
    setLiveChanges(choice.changes);
    setRecoveryChoice(choiceId);
    setRecoveryApplied(true);
    setNowMinute(choice.state.currentMinute);
    setPendingDelayState(null);
    setSupportMenuOpen(false);
    setLiveNotice(
      choiceId === "protect_moments"
        ? "The day changed, but your sunset and lunch booking are still safe."
        : "Every chosen stop stays. You approved tighter transition buffers.",
    );
    setAnnouncement(
      choiceId === "protect_moments"
        ? "Protect the moments selected. PMQ is saved for another day."
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
      setLiveNotice(result.reasons[0]?.message ?? "That extra time could not be protected.");
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
    if (!result.accepted) return;
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
    if (!result.accepted) return;
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

  function renderHeader() {
    return (
      <header className="app-header">
        <button className="brand-button" type="button" onClick={resetApp} aria-label="DayWeave home">
          <span className="thread-mark" aria-hidden="true" />
          <span className="brand-copy">
            <strong>DayWeave</strong>
            <small>Powered by AURORA</small>
          </span>
        </button>
        <div className="header-status" aria-label="Demo availability">
          <span className="offline-dot" aria-hidden="true" />
          Hong Kong demo ready offline
        </div>
        {stage === "opening" ? (
          <button className="header-action" type="button" onClick={previewDemoDay}>
            See sample day
          </button>
        ) : (
          <button className="header-action" type="button" onClick={resetApp}>
            Start over
          </button>
        )}
      </header>
    );
  }

  function renderOpening() {
    return (
      <section className="screen opening-screen" aria-labelledby="opening-title">
        <div className="opening-copy">
          <p className="eyebrow">For the trip you’ve been saving for.</p>
          <h1 id="opening-title">Make time for what matters.</h1>
          <p className="opening-lede">
            You chose the places. DayWeave helps the important ones fit, adapts when the day changes and tells you what not to miss.
          </p>
          <span className="brand-promise">
            You chose the places. We make the most important ones fit.
          </span>
          <div className="action-row">
            <button className="button button--primary" type="button" onClick={() => openImport(false)}>
              <span className="button-icon" aria-hidden="true">⌁</span>
              Untangle my day
            </button>
            <button className="button button--sky" type="button" onClick={() => openImport(true)} data-testid="try-demo">
              Try the Hong Kong demo
            </button>
          </div>
        </div>
        <button
          className="opening-postcard-art"
          type="button"
          onClick={previewDemoDay}
          aria-label="Open the ready Hong Kong itinerary from the DayWeave postcard"
          data-testid="postcard-demo"
        >
          <Image
            src="/og.png"
            alt="DayWeave postcard showing a coral thread weaving through a temple, noodles and sunset toward Wivi above the Hong Kong harbour"
            width={1731}
            height={909}
            priority
            unoptimized
          />
          <span className="postcard-art-callout">
            Open the ready Hong Kong day <span aria-hidden="true">→</span>
          </span>
        </button>
      </section>
    );
  }

  function renderImport() {
    return (
      <section className="screen" aria-labelledby="import-title">
        <div className="screen-inner">
          <div className="screen-heading heading-with-wivi">
            <div>
              <p className="step-label">1 · Bring the wishes</p>
              <h1 id="import-title" tabIndex={-1} ref={headingRef}>Start with the places already in your heart.</h1>
              <p>Paste the beautiful mess. DayWeave separates places, bookings and wishes—then you confirm what it understood.</p>
              <ProgressDots stage={stage} />
            </div>
            <Wivi mood="tangled" />
          </div>

          <div className="import-layout">
            <div className="import-editor">
              <label className="form-label" htmlFor="wishlist-input">
                Your notes, links or booking details
                <textarea
                  id="wishlist-input"
                  className="text-area"
                  value={rawWishlist}
                  onChange={(event) => {
                    setRawWishlist(event.target.value);
                    setDemoMode(false);
                    setImportStatus("idle");
                    setImportMessage("");
                  }}
                  placeholder={"Man Mo is non-negotiable\nPeak near sunset\nLunch booked at 12:30…"}
                />
              </label>
              <div className="import-tools">
                <label className="upload-tile" htmlFor="screenshot-upload">
                  <input
                    ref={fileRef}
                    id="screenshot-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleScreenshot}
                  />
                  <strong>{uploadName || "Add a screenshot"}</strong>
                  <small>Processed once, then discarded</small>
                </label>
                <button className="button button--sky button--wide" type="button" onClick={() => {
                  setDemoMode(true);
                  setRawWishlist(hongKongDemo.messyWishlist);
                  setImportStatus("idle");
                  setImportMessage("Demo notes loaded. Structure them when you’re ready.");
                }}>
                  Use the messy demo list
                </button>
              </div>
              <p className="import-assurance">
                <span className="import-assurance__mark" aria-hidden="true">✓</span>
                <span><strong>Private by default.</strong> Pasted notes are matched without AI. Screenshots are discarded after each attempt and can only be read when vision is connected.</span>
              </p>
              {importMessage && (
                <div className={`import-feedback import-feedback--${importStatus}`} role={importStatus === "error" ? "alert" : "status"} aria-atomic="true">
                  <span className="import-feedback__eyebrow">
                    {importStatus === "ready" ? "Ready to review" : importStatus === "working" ? "Reading notes" : importStatus === "error" ? "Try another way" : "Notes updated"}
                  </span>
                  <strong>{importStatus === "ready" ? "Your day is ready to review." : importStatus === "working" ? "Following the thread…" : importStatus === "error" ? "We couldn’t read that yet." : "Ready when you are."}</strong>
                  <p>{importMessage}</p>
                </div>
              )}
              <div className="action-row">
                {importStatus === "ready" ? (
                  <button className="button button--primary" type="button" onClick={() => setStage("confirm")} data-testid="confirm-intent">
                    Confirm what matters
                  </button>
                ) : (
                  <button className="button button--primary" type="button" onClick={handleExtraction} disabled={importStatus === "working"} data-testid="extract-wishlist">
                    <span className="button-icon" aria-hidden="true">{importStatus === "working" ? "…" : "⌁"}</span>
                    {importStatus === "working" ? "Reading your notes…" : "Read my notes"}
                  </button>
                )}
                {importStatus === "error" && (
                  <button className="button button--lime" type="button" onClick={useDemoFallback}>Open the sample day</button>
                )}
              </div>
            </div>

            <aside className="demo-mess" aria-label="What DayWeave can understand">
              <h2>Messy is welcome</h2>
              <p className="messy-line">“Victoria Peak near sunset” → a window to confirm</p>
              <p className="messy-line">“shopping last so I don’t carry bags” → a sequence wish</p>
              <p className="messy-line">booking screenshot → a fixed time to protect</p>
              <p className="messy-line">“absolutely cannot miss” → a must-visit suggestion, never a silent decision</p>
              <p className="quiet-note">Local matching understands supported place names and clear wishes. Connected AI helps with screenshots and messier phrasing. Verified application logic decides what is possible.</p>
            </aside>
          </div>
        </div>
      </section>
    );
  }

  function renderConfirm() {
    return (
      <section className="screen" aria-labelledby="confirm-title">
        <div className="screen-inner">
          <div className="screen-heading heading-with-wivi">
            <div>
              <p className="step-label">2 · Protect what matters</p>
              <h1 id="confirm-title" tabIndex={-1} ref={headingRef}>Give every place the right weight.</h1>
              <p>Tap a charm to move it, or drag it between groups. Must-visits get a visible protection knot—not just a different color.</p>
              <ProgressDots stage={stage} />
            </div>
            <Wivi mood="comforting" />
          </div>

          <div className="priority-board">
            {priorityOrder.map((priority) => {
              const lanePlaces = places.filter((place) => place.priority === priority);
              return (
                <section
                  className={`priority-lane priority-lane--${priority === "convenient" ? "optional" : priority}${dragTarget === priority ? " is-dragging-over" : ""}`}
                  key={priority}
                  aria-label={`${laneCopy[priority].title} priority group`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragTarget(priority);
                  }}
                  onDragLeave={() => setDragTarget(null)}
                  onDrop={(event) => handleDrop(event, priority)}
                >
                  <div className="lane-heading">
                    <div>
                      <strong>{laneCopy[priority].title}</strong>
                      <p className="quiet-note">{laneCopy[priority].description}</p>
                    </div>
                    <span aria-label={`${lanePlaces.length} places`}>{lanePlaces.length}</span>
                  </div>
                  <div className="lane-charms">
                    {lanePlaces.map((place) => (
                      <PlaceCharm
                        key={place.id}
                        place={toThreadPlace(place)}
                        onClick={() => movePriority(place.id, nextPriority(place.priority))}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          setDraggingId(place.id);
                        }}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="trip-settings">
            <label className="form-label">
              Start
              <select className="select-input" defaultValue="sheung-wan-start" aria-label="Start location">
                <option value="sheung-wan-start">Sheung Wan MTR</option>
              </select>
            </label>
            <label className="form-label">
              End
              <select className="select-input" defaultValue="jordan-hotel-end" aria-label="End location">
                <option value="jordan-hotel-end">Hotel in Jordan</option>
              </select>
            </label>
            <label className="form-label">
              Comfortable walking
              <select className="select-input" value={walkingKm} onChange={(event) => setWalkingKm(Number(event.target.value))}>
                <option value={2.4}>Gentle · up to 2.4 km</option>
                <option value={3.6}>Comfortable · up to 3.6 km</option>
                <option value={5.2}>Happy to walk · up to 5.2 km</option>
              </select>
            </label>
            <fieldset className="pace-control">
              <legend className="form-label">Pace</legend>
              <div className="pace-options">
                {(["relaxed", "balanced", "packed"] as Pace[]).map((option) => (
                  <button
                    className="pace-option"
                    type="button"
                    aria-pressed={pace === option}
                    onClick={() => setPace(option)}
                    key={option}
                  >
                    {option[0].toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="action-row">
            <button className="button button--primary" type="button" onClick={() => setStage("tangle")} data-testid="review-thread">
              See my tangled thread
            </button>
            <button className="button button--ghost" type="button" onClick={() => setStage("import")}>Back to the notes</button>
          </div>
        </div>
      </section>
    );
  }

  function renderTangle() {
    return (
      <section className="screen" aria-labelledby="tangle-title">
        <div className="screen-inner">
          <p className="step-label">3 · The honest tangle</p>
          <div className="tangle-layout">
              <ThreadMap
                places={tangledPlaces}
                untangled={threadUntangled}
                label={threadUntangled ? "Destination charms reorganized along a calmer coral route" : `${places.length} destination charms attached to a tangled coral travel thread`}
              />
            <div className="tangle-action">
              <Wivi mood={isUntangling ? "pulling" : "tangled"} />
              <div className="wivi-speech">Your {places.filter((place) => place.priority === "must").length} must-visits are held safely while I check what truly fits.</div>
              <h1 id="tangle-title" tabIndex={-1} ref={headingRef}>{isUntangling ? "Finding the calmer shape…" : "These wishes are allowed to be messy."}</h1>
              <p>DayWeave tests the real combinations against opening windows{places.some((place) => place.fixedBooking) ? ", your fixed booking" : ""}{places.some((place) => place.timingConstraints?.length) ? ", your timing wishes" : ""}, walking comfort and travel time.</p>
              <button className={`button button--coral untangle-button${isUntangling ? " is-working" : ""}`} type="button" onClick={handleUntangle} disabled={isUntangling} data-testid="untangle-day">
                <span className="button-icon" aria-hidden="true">⌁</span>
                {isUntangling ? "Untangling…" : "Untangle my day"}
              </button>
              <p className="quiet-note">A deterministic solver makes the final decision. Nothing is added, removed or reprioritized silently.</p>
            </div>
          </div>
        </div>
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
        <section className="screen" aria-labelledby="result-title">
          <div className="screen-inner">
            <div className="screen-heading">
              <p className="step-label">4 · A truthful result</p>
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
      <section className="screen" aria-labelledby="result-title">
        <div className="screen-inner">
          <div className="screen-heading heading-with-wivi">
            <div>
              <p className="step-label">4 · Your actionable day</p>
              <h1 id="result-title" tabIndex={-1} ref={headingRef}>Your Hong Kong day, in one clear order.</h1>
              <p>Every stop, travel cue and protected moment is together below. Start when you’re ready; DayWeave will adapt only the part still ahead.</p>
              <ProgressDots stage={stage} />
            </div>
            <Wivi mood="happy" />
          </div>

          <section className="day-plan" aria-labelledby="day-plan-title">
            <header className="day-plan__header">
              <div>
                <p className="mono-label">Saturday · {formatTimelineTime(dayStartMinute)}–{formatTimelineTime(plan.metrics.finishMinute)}</p>
                <h2 id="day-plan-title">{plan.metrics.selectedCount} stops, with room to breathe.</h2>
                <p>{plan.metrics.selectedCount} of {plan.metrics.totalPlaceCount} chosen places fit.</p>
              </div>
            </header>

            <RouteTimeline
              stops={plan.itinerary}
              legs={plan.legs}
              places={places}
              startLabel="Sheung Wan MTR"
              endLabel="Hotel in Jordan"
              endLocationId={optimizationInput.day.endLocationId}
              finishMinute={plan.metrics.finishMinute}
            />

            <div className="day-plan__actions day-plan__commit">
              <button className="button button--primary" type="button" onClick={beginDay} data-testid="begin-day">Begin my day</button>
              <button className="button button--ghost" type="button" onClick={() => setStage("confirm")}>Adjust my choices</button>
            </div>

            {plan.deferred.length > 0 && (
              <footer className="day-plan__deferred">
                <strong>Saved for another day</strong>
                <span>{plan.deferred.map((place) => place.name).join(" · ")}</span>
              </footer>
            )}
          </section>

          <details className="plan-secondary">
            <summary>Why this route works</summary>
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

          <details className="plan-secondary plan-secondary--discovery">
            <summary>
              <span>Optional nearby idea</span>
              <strong>{UPPER_LASCAR_ROW_SUGGESTION.title}</strong>
            </summary>
            <aside className="discovery-card" aria-labelledby="discovery-title">
              <div>
                <p className="mono-label">Only if you want one more possibility</p>
                <h2 id="discovery-title">{UPPER_LASCAR_ROW_SUGGESTION.title}</h2>
                <p>{UPPER_LASCAR_ROW_SUGGESTION.whyRelevant}</p>
                <div className="discovery-meta">
                  <span className="micro-tag">Local classic</span>
                  <span className="micro-tag">30 min</span>
                  <span className="micro-tag">Route changes only after approval</span>
                </div>
                {discoveryMessage ? (
                  <div className="change-summary"><strong>Your choice is saved</strong><p>{discoveryMessage}</p></div>
                ) : (
                  <div className="discovery-actions">
                    <button className="button button--primary" type="button" onClick={() => decideDiscovery("added")}>Add to my day</button>
                    <button className="button button--ghost" type="button" onClick={() => decideDiscovery("saved")}>Save for later</button>
                    <button className="button button--ghost" type="button" onClick={() => decideDiscovery("declined")}>No thanks</button>
                    <details className="evidence-details">
                      <summary>Why this?</summary>
                      <div className="evidence-body">A 100+ year antiques street near your morning cluster. Official tourism source, checked {UPPER_LASCAR_ROW_SUGGESTION.evidence[0].lastCheckedDate}. It cannot affect scheduling until you approve it.</div>
                    </details>
                  </div>
                )}
              </div>
            </aside>
          </details>

          <p className="screen-footer-note">Place hours and travel estimates come from the verified Hong Kong prototype catalog; your pasted notes stay separate. DayWeave is a decision companion, not a replacement for turn-by-turn maps.</p>
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

    const alternative = plannedStops.find(
      (stop) => !completedIds.includes(stop.placeId) && stop.placeId !== currentStop?.placeId,
    );
    return (
      <motion.section className="choice-sheet" role="region" aria-labelledby="another-title" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }}>
        <h2 id="another-title">Another gentle option</h2>
        <p>{alternative ? `${alternative.name} could come next, but it would add about 18 minutes and reduce your breathing room before sunset.` : "There is no equally safe alternative right now. The current suggestion protects the moments you chose."}</p>
        <button ref={sheetRef} className="button button--sky" type="button" onClick={closeSupportSheet}>Keep the calmer route</button>
      </motion.section>
    );
  }

  function renderLive() {
    if (!plan || !livePlan) return null;
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

    return (
      <section className="screen" aria-labelledby="live-title">
        <div className="live-shell">
          <div className="live-main">
            <div className="live-topline">
              <p className="step-label">Live day · {currentStop ? `stop ${completedIds.length + 1} of ${routeStops.length}` : "route complete"}</p>
              <span className="live-time">{formatTime(nowMinute)} · Hong Kong</span>
            </div>

            {currentStop ? (
              <article className="next-card">
                <p className="next-kicker">{arrived ? "You are here" : travelActive ? "On the thread" : "Your next gentle decision"}</p>
                <h1 id="live-title" tabIndex={-1} ref={headingRef}>
                  {arrived ? `Enjoy ${currentStop.name}.` : travelActive ? `Head toward ${currentStop.name}.` : `Go to ${currentStop.name} next.`}
                </h1>
                <div className="next-timing">
                  <span aria-hidden="true">◷</span>
                  {arrived
                    ? `Stay until around ${formatTimelineTime(currentStop.endMinute)}`
                    : nextLeg
                      ? `Depart ${formatTimelineTime(nextLeg.departMinute)} · ${nextLeg.minutes} min ${travelModeLabel(nextLeg.mode).toLocaleLowerCase("en")} · arrive ${formatTimelineTime(nextLeg.arriveMinute)} · visit until ${formatTimelineTime(currentStop.endMinute)}`
                      : `Visit ${formatTimelineTime(currentStop.startMinute)}–${formatTimelineTime(currentStop.endMinute)} · travel estimate unavailable`}
                </div>
                <p className="decision-why">{recoveryApplied ? "This keeps every remaining booking and protected timing window valid after the delay." : "This follows the route below and keeps every confirmed booking and timing window valid."}</p>
                {liveNotice && <div className="wivi-speech">{liveNotice}</div>}
                <div className="next-actions">
                  {arrived ? (
                    <>
                      <button className="button button--primary" type="button" onClick={completeCurrentStop} data-testid="complete-stop">Tie this moment</button>
                      {hasCurrentBrief && <button className="button button--sun" type="button" onClick={() => setStage("briefing")}>Don’t miss here</button>}
                    </>
                  ) : (
                    <button className="button button--primary" type="button" onClick={takeMeThere} data-testid="take-me-there">
                      <span className="button-icon" aria-hidden="true">→</span>
                      {travelActive ? "I’ve arrived" : "Take me there"}
                    </button>
                  )}
                  {isAfterFirstStop && !recoveryApplied && (
                    <button className="button button--lavender" type="button" onClick={openRepair} data-testid="simulate-delay">I’m running 40 minutes late</button>
                  )}
                  {recoveryApplied && !arrived && hasCurrentBrief && (
                    <button className="button button--sun" type="button" onClick={() => setStage("briefing")} data-testid="view-briefing">View Don’t Miss Here</button>
                  )}
                </div>
              </article>
            ) : (
              <article className="next-card">
                <p className="next-kicker">The day has been lived</p>
                <h1 id="live-title" tabIndex={-1} ref={headingRef}>Let’s tie the memory thread.</h1>
                <p className="decision-why">A meaningful day does not need a completion score. Keep the moments, not the checklist.</p>
                <div className="next-actions"><button className="button button--primary" type="button" onClick={finishDay}>See my memory thread</button></div>
              </article>
            )}

            <section className="live-route" aria-labelledby="live-route-title">
              <header className="live-route__header">
                <div>
                  <p className="mono-label">Done · now · later</p>
                  <h2 id="live-route-title">Today’s route, in one place.</h2>
                </div>
                <span>Back by {formatTimelineTime(livePlan.metrics.finishMinute)}</span>
              </header>
              <RouteTimeline
                stops={routeStops}
                legs={livePlan.legs}
                places={liveState?.sourceInput.places ?? places}
                startLabel="Sheung Wan MTR"
                endLabel="Hotel in Jordan"
                endLocationId={liveState?.sourceInput.day.endLocationId ?? optimizationInput.day.endLocationId}
                finishMinute={livePlan.metrics.finishMinute}
                completedIds={completedIds}
                currentPlaceId={currentStop?.placeId}
                currentStateLabel={arrived ? "You’re here" : travelActive ? "On the way" : "Up next"}
                breaks={liveState?.protectedBreaks ?? []}
                label="Live route with completed, current and upcoming stops"
              />
            </section>

            {(recoveryApplied || breakMinutes || stayMinutes) && (
              <details className="live-changes">
                <summary>What changed in my route</summary>
                <div>
                  {recoveryApplied && (
                    <div className="change-summary">
                      <strong>{recoveryChoice === "protect_moments" ? "The moments are protected" : "Every chosen stop is kept"}</strong>
                      <p>{recoveryChoice === "protect_moments" ? `${recoveryDeferred?.name ?? "One lower-priority stop"} is saved for another day. Your fixed booking and protected timing windows remain safe.` : `You chose tighter transition buffers. The route still finishes by ${formatTimelineTime(selectedRecovery?.state.currentPlan.metrics.finishMinute ?? livePlan.metrics.finishMinute)}.`}</p>
                    </div>
                  )}
                  {breakMinutes && <div className="change-summary"><strong>Rest is protected</strong><p>Your {breakMinutes}-minute break is part of the plan, not leftover time.</p></div>}
                  {stayMinutes && <div className="change-summary"><strong>You chose the moment</strong><p>{stayMinutes} extra minutes were honored. Only the remaining day was re-woven.</p></div>}
                </div>
              </details>
            )}

            {currentStop && (
              <div className="support-tools">
                <button
                  ref={supportTriggerRef}
                  className="change-day-trigger"
                  type="button"
                  aria-expanded={supportMenuOpen}
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
                      {arrived && (
                        <button className="support-action support-action--love" type="button" onClick={() => {
                          setSupportMenuOpen(false);
                          setSupportSheet("stay");
                        }}><span aria-hidden="true">♡</span><span>I’m loving it here</span></button>
                      )}
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
                      <button className="support-action" type="button" onClick={() => {
                        setSupportMenuOpen(false);
                        setSupportSheet("alternative");
                      }}><span aria-hidden="true">⇄</span><span>Another option</span></button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <AnimatePresence>{renderSupportSheet()}</AnimatePresence>
            {recoveryApplied && stayMinutes && (
              <button className="button button--primary button--wide" type="button" onClick={finishDay} data-testid="finish-day">Finish the demo day</button>
            )}
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

    return (
      <section className="screen" aria-labelledby="repair-title">
        <div className="screen-inner">
          <div className="screen-heading">
            <p className="step-label">The day changed · you stay in control</p>
            <h1 id="repair-title" tabIndex={-1} ref={headingRef}>Forty minutes later. Two honest paths.</h1>
            <p>At {formatTime(pendingDelayState?.currentMinute ?? nowMinute)}, only the remaining day was recalculated. Your completed moment stays exactly where it belongs.</p>
          </div>
          <div className="repair-intro">
            <Wivi mood="comforting" small />
            <p>The day changed, but nothing disappeared. Choose what matters now and Wivi will hold the protected pieces.</p>
          </div>
          <div className="repair-paths">
            <article className="repair-path repair-path--protected">
              <p className="mono-label">Calmer recovery</p>
              <h2>{protectOption?.title ?? "Protect the moments"}</h2>
              <p>{protectOption?.description ?? "Keep the emotional anchors and create breathing room."}</p>
              <ul className="tradeoff-list">
                <li>Keep Victoria Peak inside the sunset window</li>
                <li>Keep the 12:30 lunch reservation</li>
                <li>{newlyDeferred.length > 0 ? `Save ${newlyDeferred.map((stop) => stop.name).join(", ")} for another day` : "No newly deferred stops"}</li>
                <li>Finish by {formatTime(protectOption?.state.currentPlan.metrics.finishMinute ?? 20 * 60 + 35)}</li>
              </ul>
              <button className="button button--primary" type="button" onClick={() => chooseRecovery("protect_moments")} disabled={!protectOption?.valid} data-testid="protect-sunset">Choose Protect the moments</button>
            </article>
            <article className="repair-path repair-path--complete">
              <p className="mono-label">Fuller recovery</p>
              <h2>{keepOption?.title ?? "Keep every chosen stop"}</h2>
              <p>{keepOption?.description ?? "Preserve the chosen route with a more packed pace."}</p>
              <ul className="tradeoff-list">
                <li>Keep every remaining chosen destination</li>
                <li>Switch from balanced to packed pacing</li>
                <li>Use tighter transition buffers</li>
                <li>Finish by {formatTime(keepOption?.state.currentPlan.metrics.finishMinute ?? 20 * 60 + 27)}</li>
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
    const brief = currentStop?.placeId === "maks-noodle"
      ? MAKS_NOODLE_DONT_MISS_HERE
      : BAKEHOUSE_DONT_MISS_HERE;
    return (
      <section className="screen" aria-labelledby="brief-title">
        <div className="screen-inner">
          <div className="screen-heading heading-with-wivi">
            <div>
              <p className="step-label">Not a walkthrough · the thing people discover too late</p>
              <h1 id="brief-title" tabIndex={-1} ref={headingRef}>Don’t Miss Here</h1>
              <p>A concise, evidence-aware briefing for {brief.placeName}. Popularity and cultural significance are kept distinct.</p>
            </div>
            <Wivi mood="pointing" />
          </div>
          <div className="briefing-layout">
            <article className="briefing-main">
              <header className="briefing-place">
                <p className="mono-label">Up next · {brief.placeName}</p>
                <h2>{brief.placeName}</h2>
              </header>
              {[brief.whyPeopleCome, brief.dontMiss, brief.worthKnowing].map((section) => (
                <section className="brief-section" key={section.heading}>
                  <h3>{section.heading}</h3>
                  <p>{section.body}</p>
                  <span className="micro-tag">{section.evidenceLabel}</span>
                </section>
              ))}
            </article>
            <aside className="briefing-aside">
              <div className="confidence-card">
                <strong>Confidence · evidence-aware</strong>
                <p>Official sources support the heritage and signature choice. No unverified queue or sell-out timing is allowed to move your day.</p>
                <div className="confidence-bar" aria-label="Strong evidence for the main experience claim"><i className="is-filled" /><i className="is-filled" /><i className="is-filled" /><i className="is-filled" /><i /></div>
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
              <div className="notice"><span aria-hidden="true">✓</span><span><strong>No timing claim applied.</strong><br />This insight enriches the visit, but cannot move the route without verified timing evidence.</span></div>
              <button className="button button--primary button--wide" type="button" onClick={() => {
                setStage("live");
                setArrived(true);
                setTravelActive(false);
                setNowMinute(currentStop?.startMinute ?? nowMinute);
                setLiveNotice(`You’re here. ${brief.dontMiss.body}`);
              }} data-testid="arrive-from-brief">Take me there</button>
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
              <div className="wivi-speech">This is what the trip is for. Let’s reshape the rest of your afternoon.</div>
              <h1 id="reweave-title" tabIndex={-1} ref={headingRef}>Enjoying a place longer is not a mistake.</h1>
              <p>{stayMinutes} extra minutes are now honored. Completed stops remain fixed and the solver checked every remaining window again.</p>
              <div className="change-summary"><strong>What changed</strong><p>{deferredChange?.message ?? `${movedCount} remaining ${movedCount === 1 ? "time was" : "times were"} recalculated. No destination was added, and the protected sunset remains valid.`}</p></div>
              <button className="button button--coral untangle-button" type="button" onClick={() => {
                setStage("live");
                setLiveNotice("Rewoven. Your sunset is safe, and this moment got the time it deserved.");
              }} data-testid="reweave-day"><span className="button-icon" aria-hidden="true">⌁</span>Reweave the rest</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderMemory() {
    const memoryStops = routeStops.slice(0, 5);
    const returnedMinutes = plan ? Math.max(0, baseline.travelMinutes - plan.metrics.travelMinutes) : 0;
    return (
      <section className="screen memory-screen" aria-labelledby="memory-title">
        <div className="screen-inner">
          <div className="memory-intro">
            <div>
              <p className="step-label">Your memory thread</p>
              <h1 id="memory-title" tabIndex={-1} ref={headingRef}>A day worth remembering.</h1>
              <p>You protected what mattered, let the day change and stayed longer when a place deserved it. Nothing here is a score.</p>
            </div>
            <Wivi mood="knotting" />
          </div>
          <div className="memory-thread" aria-label="Cheerful journey of enjoyed places">
            {memoryStops.map((stop, index) => {
              const place = places.find((item) => item.id === stop.placeId);
              return <div className="memory-stop" key={stop.placeId}><span aria-hidden="true">{iconGlyphs[place?.icon ?? ""] ?? "✦"}</span><strong>{stop.name}</strong><small>{index === 0 ? "first memory" : "knot tied"}</small></div>;
            })}
          </div>
          <div className="memory-moments">
            <div className="memory-moment"><strong>{plan?.metrics.mustVisitProtectedCount ?? 3} moments protected</strong><p>Must-visits held without turning the day into a checklist.</p></div>
            <div className="memory-moment"><strong>{returnedMinutes} min returned</strong><p>Less backtracking, more room to actually be there.</p></div>
            <div className="memory-moment"><strong>Shrimp wonton noodles</strong><p>A signature detail remembered from Mak’s—not another task to complete.</p></div>
            <div className="memory-moment"><strong>{livePlan?.deferred.length ?? plan?.deferred.length ?? 2} waiting for tomorrow</strong><p>Lovely places kept with kindness, not framed as loss.</p></div>
          </div>
          <div className="wivi-speech">You did not complete a list. You made space for a day that mattered.</div>
          <div className="action-row">
            <button className="button button--primary" type="button" onClick={resetApp}>Weave another day</button>
            <button className="button button--sky" type="button" onClick={() => setStage("live")}>Return to live day</button>
          </div>
        </div>
      </section>
    );
  }

  function renderStage() {
    switch (stage) {
      case "opening": return renderOpening();
      case "import": return renderImport();
      case "confirm": return renderConfirm();
      case "tangle": return renderTangle();
      case "result": return renderResult();
      case "live": return renderLive();
      case "repair": return renderRepair();
      case "briefing": return renderBriefing();
      case "reweave": return renderReweave();
      case "memory": return renderMemory();
    }
  }

  return (
    <div className="dayweave-app">
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
