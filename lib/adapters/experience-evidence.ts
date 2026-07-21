import {
  DontMissHereBriefSchema,
  type DontMissHereBrief,
  WorthWeavingSuggestionSchema,
  type WorthWeavingSuggestion,
} from "@/lib/schemas/evidence";

const CHECKED_DATE = "2026-07-21";

export const BAKEHOUSE_DONT_MISS_HERE: DontMissHereBrief =
  DontMissHereBriefSchema.parse({
    id: "brief-bakehouse-hk",
    placeId: "bakehouse",
    placeName: "Bakehouse",
    title: "Don’t Miss Here",
    whyPeopleCome: {
      heading: "WHY PEOPLE COME",
      body: "European-style artisan baking with a distinctly Hong Kong cult following.",
      evidenceLabel: "Currently popular experience",
      claim: {
        id: "bakehouse-why-people-come",
        claim:
          "Hong Kong Tourism Board describes Bakehouse as a cult favourite known for artisan pastries.",
        placeOrArea: "Bakehouse, Hong Kong",
        sourceUrl:
          "https://tastehk.discoverhongkong.com/en/restaurants/bakehouse-by-gregoire-michaud",
        sourceType: "official_tourism",
        observationDate: CHECKED_DATE,
        lastCheckedDate: CHECKED_DATE,
        confidence: "medium",
        recurrenceLevel: "currently_popular_experience",
        conflictingEvidence: [],
        canInfluenceScheduling: false,
        timingEvidence: {
          verification: "none",
          constraintKind: null,
          constraintValue: null,
        },
      },
    },
    dontMiss: {
      heading: "DON’T MISS",
      body:
        "The sourdough egg tart is the signature choice to notice here. If one bake fits, make it that one.",
      evidenceLabel: "Currently popular signature · recently checked",
      claim: {
        id: "bakehouse-sourdough-egg-tart",
        claim:
          "Bakehouse lists its sourdough egg tart on the venue’s official menu.",
        placeOrArea: "Bakehouse, Hong Kong",
        sourceUrl: "https://www.bakehouse.hk/menu",
        sourceType: "official_venue",
        observationDate: CHECKED_DATE,
        lastCheckedDate: CHECKED_DATE,
        confidence: "medium",
        recurrenceLevel: "currently_popular_experience",
        conflictingEvidence: [],
        canInfluenceScheduling: false,
        timingEvidence: {
          verification: "none",
          constraintKind: null,
          constraintValue: null,
        },
      },
    },
    worthKnowing: {
      heading: "WORTH KNOWING",
      body:
        "It can draw a queue. Give the stop a little breathing room and treat any wait as a choice, not a failure.",
      evidenceLabel: "Recently checked · no timing claim",
      claim: {
        id: "bakehouse-queues",
        claim:
          "Hong Kong Tourism Board notes that queues are part of Bakehouse’s current popularity.",
        placeOrArea: "Bakehouse, Hong Kong",
        sourceUrl:
          "https://tastehk.discoverhongkong.com/en/restaurants/bakehouse-by-gregoire-michaud",
        sourceType: "official_tourism",
        observationDate: CHECKED_DATE,
        lastCheckedDate: CHECKED_DATE,
        confidence: "medium",
        recurrenceLevel: "currently_popular_experience",
        conflictingEvidence: [],
        canInfluenceScheduling: false,
        timingEvidence: {
          verification: "none",
          constraintKind: null,
          constraintValue: null,
        },
      },
    },
  });

export const MAKS_NOODLE_DONT_MISS_HERE: DontMissHereBrief =
  DontMissHereBriefSchema.parse({
    id: "brief-maks-noodle-hk",
    placeId: "maks-noodle",
    placeName: "Mak’s Noodle",
    title: "Don’t Miss Here",
    whyPeopleCome: {
      heading: "WHY PEOPLE COME",
      body:
        "A no-frills Central institution for Cantonese wonton noodle soup, with roots reaching back to pre-war Guangzhou.",
      evidenceLabel: "Destination-defining local classic",
      claim: {
        id: "maks-noodle-heritage",
        claim:
          "Hong Kong Tourism Board describes Mak’s as a vintage Cantonese noodle shop with pre-war Guangzhou heritage.",
        placeOrArea: "Mak’s Noodle, Central",
        sourceUrl:
          "https://www.discoverhongkong.com/eng/place-to-go/travel.guide-mak-s-noodle.html",
        sourceType: "official_tourism",
        observationDate: CHECKED_DATE,
        lastCheckedDate: CHECKED_DATE,
        confidence: "high",
        recurrenceLevel: "destination_defining_local_classic",
        conflictingEvidence: [],
        canInfluenceScheduling: false,
        timingEvidence: {
          verification: "none",
          constraintKind: null,
          constraintValue: null,
        },
      },
    },
    dontMiss: {
      heading: "DON’T MISS",
      body:
        "Notice the signature combination: bouncy shrimp wontons and springy duck-egg noodles in a small, focused bowl.",
      evidenceLabel: "Official tourism source · recently checked",
      claim: {
        id: "maks-noodle-signature-bowl",
        claim:
          "The official tourism listing identifies shrimp wontons and duck-egg noodles as the house speciality.",
        placeOrArea: "Mak’s Noodle, Central",
        sourceUrl:
          "https://www.discoverhongkong.com/eng/place-to-go/travel.guide-mak-s-noodle.html",
        sourceType: "official_tourism",
        observationDate: CHECKED_DATE,
        lastCheckedDate: CHECKED_DATE,
        confidence: "high",
        recurrenceLevel: "destination_defining_local_classic",
        conflictingEvidence: [],
        canInfluenceScheduling: false,
        timingEvidence: {
          verification: "none",
          constraintKind: null,
          constraintValue: null,
        },
      },
    },
    worthKnowing: {
      heading: "WORTH KNOWING",
      body:
        "The room and bowls are compact, and crowds can form. Let the fixed reservation protect lunch without turning any wait into a failure.",
      evidenceLabel: "Current visitor context · no timing claim",
      claim: {
        id: "maks-noodle-crowds",
        claim:
          "Hong Kong Tourism Board advises visitors to expect crowds and waiting times at the Wellington Street shop.",
        placeOrArea: "Mak’s Noodle, Central",
        sourceUrl:
          "https://www.discoverhongkong.com/eng/place-to-go/travel.guide-mak-s-noodle.html",
        sourceType: "official_tourism",
        observationDate: CHECKED_DATE,
        lastCheckedDate: CHECKED_DATE,
        confidence: "medium",
        recurrenceLevel: "currently_popular_experience",
        conflictingEvidence: [],
        canInfluenceScheduling: false,
        timingEvidence: {
          verification: "none",
          constraintKind: null,
          constraintValue: null,
        },
      },
    },
  });

export const UPPER_LASCAR_ROW_SUGGESTION: WorthWeavingSuggestion =
  WorthWeavingSuggestionSchema.parse({
    id: "suggestion-upper-lascar-row",
    placeId: "upper-lascar-row",
    title: "A small antiques wander?",
    placeOrArea: "Upper Lascar Row, Sheung Wan",
    whyRelevant:
      "It adds a compact old-Hong-Kong browse near Man Mo Temple without implying your day is incomplete without it.",
    classification: "local_classic",
    routeImpact: {
      visitMinutes: 30,
      detourMinutes: null,
      detourStatus: "requires_optimizer",
      displacementSummary:
        "Nothing moves until you choose Add to my day; the deterministic optimizer must calculate the detour and show any displaced optional stop.",
    },
    evidence: [
      {
        id: "upper-lascar-row-history",
        claim:
          "Upper Lascar Row has been known for antiques and collectibles for more than a century.",
        placeOrArea: "Upper Lascar Row, Sheung Wan",
        sourceUrl:
          "https://www.discoverhongkong.com/eng/place-to-go/travel.guide-upper-lascar-row.html",
        sourceType: "official_tourism",
        observationDate: CHECKED_DATE,
        lastCheckedDate: CHECKED_DATE,
        confidence: "high",
        recurrenceLevel: "destination_defining_local_classic",
        conflictingEvidence: [],
        canInfluenceScheduling: false,
        timingEvidence: {
          verification: "none",
          constraintKind: null,
          constraintValue: null,
        },
      },
    ],
    requiresExplicitApproval: true,
  });

export interface ExperienceEvidenceAdapter {
  getDontMissHere(input: {
    placeId?: string;
    placeName?: string;
  }): Promise<DontMissHereBrief | null>;
  getWorthWeavingSuggestions(input: {
    savedPlaceIds: string[];
    limit?: 1 | 2;
  }): Promise<WorthWeavingSuggestion[]>;
}

function normalizePlaceKey(value: string | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("en-HK");
}

/** Offline-first, manually curated evidence. It never scrapes or calls a feed. */
export class CuratedHongKongEvidenceAdapter
  implements ExperienceEvidenceAdapter
{
  async getDontMissHere(input: {
    placeId?: string;
    placeName?: string;
  }): Promise<DontMissHereBrief | null> {
    const id = normalizePlaceKey(input.placeId);
    const name = normalizePlaceKey(input.placeName);

    if (id === "maks-noodle" || name.includes("mak’s") || name.includes("mak's")) {
      return DontMissHereBriefSchema.parse(MAKS_NOODLE_DONT_MISS_HERE);
    }
    if (id === "bakehouse" || id === "bakehouse-soho" || name.includes("bakehouse")) {
      return DontMissHereBriefSchema.parse(BAKEHOUSE_DONT_MISS_HERE);
    }
    return null;
  }

  async getWorthWeavingSuggestions(input: {
    savedPlaceIds: string[];
    limit?: 1 | 2;
  }): Promise<WorthWeavingSuggestion[]> {
    const savedIds = new Set(input.savedPlaceIds.map(normalizePlaceKey));
    if (savedIds.has(UPPER_LASCAR_ROW_SUGGESTION.placeId)) {
      return [];
    }

    return [
      WorthWeavingSuggestionSchema.parse(UPPER_LASCAR_ROW_SUGGESTION),
    ].slice(0, input.limit ?? 1);
  }
}
