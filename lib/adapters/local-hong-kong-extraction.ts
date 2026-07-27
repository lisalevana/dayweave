import {
  ExtractionEnvelopeSchema,
  ExtractionRequestSchema,
  type ExtractionEnvelope,
  type ExtractionRequest,
  type WishlistExtraction,
} from "../schemas/extraction";

type SupportedPlace = {
  id: string;
  normalizedName: string;
  aliases: readonly string[];
};

export const SUPPORTED_HONG_KONG_PLACES: readonly SupportedPlace[] = [
  {
    id: "man-mo-temple",
    normalizedName: "Man Mo Temple",
    aliases: ["man mo temple", "man mo"],
  },
  {
    id: "tai-kwun",
    normalizedName: "Tai Kwun",
    aliases: ["tai kwun", "tai kwun centre for heritage and arts"],
  },
  {
    id: "victoria-peak",
    normalizedName: "Victoria Peak",
    aliases: ["victoria peak", "the peak"],
  },
  {
    id: "maks-noodle",
    normalizedName: "Mak’s Noodle",
    aliases: ["mak's noodle", "maks noodle", "mak’s noodle", "mak's", "mak’s"],
  },
  {
    id: "pmq",
    normalizedName: "PMQ",
    aliases: ["pmq", "police married quarters"],
  },
  {
    id: "bakehouse-soho",
    normalizedName: "Bakehouse SoHo",
    aliases: ["bakehouse soho", "bakehouse"],
  },
  {
    id: "mid-levels-escalator",
    normalizedName: "Central–Mid-Levels Escalator",
    aliases: [
      "central-mid-levels escalator",
      "central mid-levels escalator",
      "mid-levels escalator",
      "mid levels escalator",
      "the long escalator",
      "long escalator",
    ],
  },
  {
    id: "star-ferry-central",
    normalizedName: "Star Ferry crossing",
    aliases: ["star ferry crossing", "star ferry", "the star ferry"],
  },
  {
    id: "temple-street-market",
    normalizedName: "Temple Street Night Market",
    aliases: ["temple street night market", "temple street market", "temple street"],
  },
] as const;

export class LocalTextRequiredError extends Error {
  readonly code = "LOCAL_TEXT_REQUIRED";

  constructor() {
    super(
      "I can read pasted notes locally, but I can’t read a screenshot locally yet. Paste the visible text, or open the sample Hong Kong day.",
    );
    this.name = "LocalTextRequiredError";
  }
}

function normalizeForMatch(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-HK")
    .replace(/[’`]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function wholeTermIndex(source: string, term: string) {
  let index = source.indexOf(term);

  while (index >= 0) {
    const before = source[index - 1];
    const after = source[index + term.length];
    const beginsCleanly = !before || !/[\p{L}\p{N}]/u.test(before);
    const endsCleanly = !after || !/[\p{L}\p{N}]/u.test(after);
    if (beginsCleanly && endsCleanly) return index;
    index = source.indexOf(term, index + 1);
  }

  return -1;
}

function firstAliasIndex(source: string, place: SupportedPlace) {
  return place.aliases.reduce((best, alias) => {
    const index = wholeTermIndex(source, normalizeForMatch(alias));
    if (index < 0) return best;
    return best < 0 ? index : Math.min(best, index);
  }, -1);
}

export function resolveSupportedHongKongPlaceId(value: string) {
  const source = normalizeForMatch(value);
  return SUPPORTED_HONG_KONG_PLACES.find(
    (place) => firstAliasIndex(source, place) >= 0,
  )?.id;
}

function sourceLineForPlace(lines: readonly string[], place: SupportedPlace) {
  return (
    lines.find((line) => firstAliasIndex(normalizeForMatch(line), place) >= 0) ??
    place.normalizedName
  );
}

function priorityFromContext(context: string) {
  const value = normalizeForMatch(context);
  const hasNegatedPriority =
    /\b(?:not|isn't|is not|don't make|do not make)\s+(?:a\s+)?(?:must|priority)\b/.test(
      value,
    );
  const must =
    !hasNegatedPriority &&
    /\b(?:non-?negotiable|must(?: visit)?|cannot miss|can't miss|absolutely|essential|top priority)\b/.test(
      value,
    );
  const convenient =
    /\b(?:maybe|optional|only if|if convenient|skip if|if it fits|if (?:there(?:'s| is) )?time)\b/.test(
      value,
    );
  const love =
    /\b(?:would love|would be lovely|love to|want to|keen to|hope to)\b/.test(
      value,
    );

  if ([must, convenient, love].filter(Boolean).length > 1) {
    return "unconfirmed" as const;
  }
  if (must) return "must_visit" as const;
  if (convenient) return "only_if_convenient" as const;
  if (love) return "would_love" as const;
  return "unconfirmed" as const;
}

function clockTimesFromContext(context: string) {
  const times: string[] = [];
  const pattern =
    /\b(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b|\b([01]?\d|2[0-3]):([0-5]\d)\b/gi;

  for (const match of context.matchAll(pattern)) {
    let hour = Number(match[1] ?? match[4]);
    const minute = Number(match[2] ?? match[5] ?? 0);
    const meridiem = match[3]?.toLocaleLowerCase("en-HK");

    if (meridiem?.startsWith("p") && hour < 12) hour += 12;
    if (meridiem?.startsWith("a") && hour === 12) hour = 0;
    if (hour > 23) continue;

    times.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }

  const uniqueTimes = [...new Set(times)];
  if (uniqueTimes.length >= 2) {
    const [startHour, startMinute] = uniqueTimes[0].split(":").map(Number);
    const [endHour, endMinute] = uniqueTimes[1].split(":").map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;

    // People commonly write lunch ranges as “12:30–1:30” without repeating PM.
    if (end <= start && startHour >= 12 && endHour < 12) {
      uniqueTimes[1] = `${String(endHour + 12).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
    }
  }

  return uniqueTimes;
}

function confirmationCodeFromContext(context: string) {
  return (
    context.match(
      /\b(?:confirmation|confirm(?:ation)?|reference|ref|code)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,})\b/i,
    )?.[1] ?? null
  );
}

function extractStartLocation(lines: readonly string[]) {
  for (const line of lines) {
    const match = line.match(
      /^\s*(?:start|starting)\s*(?::|at|from|near)?\s*(.+?)(?=\s+at\s+\d|,\s*back\b|[.;]|$)/i,
    );
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractEndLocation(text: string) {
  return (
    text.match(
      /\b(?:back to|finish(?:ing)?(?: at)?|end(?:ing)?(?: at)?)\s+(.+?)(?=\s+by\s+\d|[.,;\n]|$)/i,
    )?.[1]?.trim() ?? null
  );
}

function unique(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(
    0,
    20,
  );
}

function extractionFromText(input: ExtractionRequest): WishlistExtraction {
  const text = input.text?.trim();
  if (!text) throw new LocalTextRequiredError();

  const normalizedText = normalizeForMatch(text);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const matches = SUPPORTED_HONG_KONG_PLACES.map((place) => ({
    place,
    index: firstAliasIndex(normalizedText, place),
  }))
    .filter((match) => match.index >= 0)
    .sort((left, right) => left.index - right.index);

  const places = matches.map(({ place }, sourceIndex) => {
    const sourceText = sourceLineForPlace(lines, place);
    const priorityIntent = priorityFromContext(sourceText);
    const times = clockTimesFromContext(sourceText);
    const hasBookingCue =
      /\b(?:booked|booking|reservation|reserved|ticket(?:ed)?)\b/i.test(
        sourceText,
      );
    const hasFixedBooking = hasBookingCue && times.length > 0;
    const nearSunset = /\b(?:near|around|at|for)?\s*sunset\b/i.test(sourceText);
    const shoppingLate =
      /\b(?:shopping\s+(?:last|late)|last\s+(?:please|stop)?|don't (?:want to )?carry|do not (?:want to )?carry|carry bags)\b/i.test(
        sourceText,
      );
    const note = hasFixedBooking
      ? `Booking mentioned${times[0] ? ` at ${times[0]}` : ""}.`
      : nearSunset
        ? "Near sunset."
        : shoppingLate
          ? "Prefer this stop late to avoid carrying bags."
          : null;

    return {
      sourceIndex,
      sourceText,
      normalizedName: place.normalizedName,
      aliases: [],
      priorityIntent,
      appearsNonNegotiable: priorityIntent === "must_visit",
      hasFixedBooking,
      note,
      confidence: "high" as const,
      requiresConfirmation:
        priorityIntent === "unconfirmed" || (hasFixedBooking && times.length < 2),
    };
  });

  const bookings = matches.flatMap(({ place }) => {
    const sourceText = sourceLineForPlace(lines, place);
    const times = clockTimesFromContext(sourceText);
    if (
      !/\b(?:booked|booking|reservation|reserved|ticket(?:ed)?)\b/i.test(
        sourceText,
      ) ||
      times.length === 0
    ) {
      return [];
    }

    return [
      {
        placeName: place.normalizedName,
        date: null,
        startTime: times[0],
        endTime: times[1] ?? null,
        confirmationCode: confirmationCodeFromContext(sourceText),
        sourceText,
        confidence: "high" as const,
        requiresConfirmation: times.length < 2,
      },
    ];
  });

  const semanticConstraints = matches.flatMap(({ place }) => {
    const sourceText = sourceLineForPlace(lines, place);
    const constraints: WishlistExtraction["semanticConstraints"] = [];

    if (/\bsunset\b/i.test(sourceText)) {
      constraints.push({
        kind: "near_sunset",
        placeName: place.normalizedName,
        value: "near sunset",
        sourceText,
        confidence: "high",
        requiresConfirmation: false,
      });
    }
    if (
      /\b(?:shopping\s+(?:last|late)|last\s+(?:please|stop)?|don't (?:want to )?carry|do not (?:want to )?carry|carry bags)\b/i.test(
        sourceText,
      )
    ) {
      constraints.push({
        kind: "avoid_carrying",
        placeName: place.normalizedName,
        value: "keep this stop late",
        sourceText,
        confidence: "high",
        requiresConfirmation: false,
      });
    }
    return constraints;
  });

  const matchedLines = new Set(
    matches.map(({ place }) => sourceLineForPlace(lines, place)),
  );
  const unresolvedItems = lines.filter((line) => {
    if (matchedLines.has(line)) return false;
    if (/^hong kong\b/i.test(line)) return false;
    if (/^(?:start|starting)\b/i.test(line)) return false;
    if (/\b(?:relaxed|balanced|packed|walking|walk)\b/i.test(line)) return false;
    return line.length > 2;
  });
  if (input.imageDataUrl) {
    unresolvedItems.push(
      "The screenshot was not read by the local parser; only the pasted text was matched.",
    );
  }

  const confirmationPrompts = places
    .filter((place) => place.requiresConfirmation)
    .map((place) => `Confirm the priority and timing for ${place.normalizedName}.`);
  if (bookings.some((booking) => booking.requiresConfirmation)) {
    confirmationPrompts.push(
      "Add an end time for each booking before treating it as a protected time block.",
    );
  }
  if (input.imageDataUrl) {
    confirmationPrompts.push(
      "Paste any important text from the screenshot so it can be matched locally.",
    );
  }

  const isoDate = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? null;
  const pace = /\b(?:don't|do not)\s+want\s+(?:a\s+)?packed\b|\brelaxed\b/i.test(
    text,
  )
    ? "relaxed"
    : /\b(?:packed|full-on|fast-paced)\b/i.test(text)
      ? "packed"
      : /\bbalanced\b/i.test(text)
        ? "balanced"
        : "unknown";
  const walkingComfort = /\b(?:minimal|very little|less)\s+walking\b|\bavoid walking\b/i.test(
    text,
  )
    ? "minimal"
    : /\b(?:happy to|love|lots of|more)\s+walk(?:ing)?\b/i.test(text)
      ? "comfortable_with_more"
      : /\b(?:normal|some|moderate)\s+walking\b/i.test(text)
        ? "moderate"
        : "unknown";

  return {
    schemaVersion: "1.0",
    city: matches.length > 0 || /\bhong kong\b|\bhk\b/i.test(text) ? "Hong Kong" : null,
    citySupport:
      matches.length > 0 || /\bhong kong\b|\bhk\b/i.test(text)
        ? "hong_kong"
        : "unknown",
    travelDate:
      isoDate && !Number.isNaN(Date.parse(`${isoDate}T00:00:00.000Z`))
        ? isoDate
        : null,
    places,
    bookings,
    startLocation: extractStartLocation(lines),
    endLocation: extractEndLocation(text),
    walkingComfort,
    pace,
    semanticConstraints,
    unresolvedItems: unique(unresolvedItems),
    confirmationPrompts: unique(confirmationPrompts),
  };
}

export class LocalHongKongExtractionAdapter {
  readonly id = "local_hong_kong" as const;

  async extract(rawInput: ExtractionRequest): Promise<ExtractionEnvelope> {
    const input = ExtractionRequestSchema.parse(rawInput);
    return ExtractionEnvelopeSchema.parse({
      mode: "local_rules",
      isLiveAnalysis: false,
      model: null,
      extraction: extractionFromText(input),
    });
  }
}
