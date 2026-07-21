import {
  ExtractionEnvelopeSchema,
  type ExtractionEnvelope,
  type ExtractionRequest,
  type WishlistExtraction,
  WishlistExtractionSchema,
} from "@/lib/schemas/extraction";

export type AiExtractionAvailability =
  | {
      available: true;
      provider: "openai";
      model: string;
      demoAvailable: true;
    }
  | {
      available: false;
      provider: "openai";
      model: string;
      reason: "missing_api_key";
      demoAvailable: true;
    };

export interface AiExtractionAdapter {
  readonly id: "openai" | "seeded_hong_kong_demo";
  availability(): AiExtractionAvailability;
  extract(input: ExtractionRequest): Promise<ExtractionEnvelope>;
}

export const SEEDED_HONG_KONG_WISHLIST_TEXT = `
Hong Kong day — Saturday
Start: hotel near Sheung Wan MTR. Finish: Central.
MAN MO TEMPLE — absolutely cannot miss
PMQ if there is time
Bakehouse (everyone says egg tart)
Tai Kwun — must
Central Market, maybe shopping — please keep shopping late so I don't carry bags
Star Ferry — non-negotiable
Tsim Sha Tsui promenade if convenient
Victoria Peak near sunset!!!
Yardbird reservation at 7:30pm, confirmation YB-731
I don't want a packed day. Normal walking is fine.
`.trim();

export const SEEDED_HONG_KONG_EXTRACTION: WishlistExtraction =
  WishlistExtractionSchema.parse({
    schemaVersion: "1.0",
    city: "Hong Kong",
    citySupport: "hong_kong",
    travelDate: null,
    places: [
      {
        sourceIndex: 0,
        sourceText: "MAN MO TEMPLE — absolutely cannot miss",
        normalizedName: "Man Mo Temple",
        aliases: [],
        priorityIntent: "must_visit",
        appearsNonNegotiable: true,
        hasFixedBooking: false,
        note: null,
        confidence: "high",
        requiresConfirmation: false,
      },
      {
        sourceIndex: 1,
        sourceText: "PMQ if there is time",
        normalizedName: "PMQ",
        aliases: ["Police Married Quarters"],
        priorityIntent: "only_if_convenient",
        appearsNonNegotiable: false,
        hasFixedBooking: false,
        note: null,
        confidence: "high",
        requiresConfirmation: false,
      },
      {
        sourceIndex: 2,
        sourceText: "Bakehouse (everyone says egg tart)",
        normalizedName: "Bakehouse",
        aliases: [],
        priorityIntent: "would_love",
        appearsNonNegotiable: false,
        hasFixedBooking: false,
        note: "Interested in the egg tart.",
        confidence: "high",
        requiresConfirmation: true,
      },
      {
        sourceIndex: 3,
        sourceText: "Tai Kwun — must",
        normalizedName: "Tai Kwun",
        aliases: ["Tai Kwun Centre for Heritage and Arts"],
        priorityIntent: "must_visit",
        appearsNonNegotiable: true,
        hasFixedBooking: false,
        note: null,
        confidence: "high",
        requiresConfirmation: false,
      },
      {
        sourceIndex: 4,
        sourceText:
          "Central Market, maybe shopping — please keep shopping late so I don't carry bags",
        normalizedName: "Central Market",
        aliases: [],
        priorityIntent: "only_if_convenient",
        appearsNonNegotiable: false,
        hasFixedBooking: false,
        note: "Prefer this shopping stop late in the flexible day.",
        confidence: "high",
        requiresConfirmation: false,
      },
      {
        sourceIndex: 5,
        sourceText: "Star Ferry — non-negotiable",
        normalizedName: "Star Ferry",
        aliases: ["The Star Ferry"],
        priorityIntent: "must_visit",
        appearsNonNegotiable: true,
        hasFixedBooking: false,
        note: null,
        confidence: "high",
        requiresConfirmation: false,
      },
      {
        sourceIndex: 6,
        sourceText: "Tsim Sha Tsui promenade if convenient",
        normalizedName: "Tsim Sha Tsui Promenade",
        aliases: ["TST Promenade"],
        priorityIntent: "only_if_convenient",
        appearsNonNegotiable: false,
        hasFixedBooking: false,
        note: null,
        confidence: "high",
        requiresConfirmation: false,
      },
      {
        sourceIndex: 7,
        sourceText: "Victoria Peak near sunset!!!",
        normalizedName: "Victoria Peak",
        aliases: ["The Peak"],
        priorityIntent: "would_love",
        appearsNonNegotiable: false,
        hasFixedBooking: false,
        note: "Near sunset.",
        confidence: "high",
        requiresConfirmation: true,
      },
      {
        sourceIndex: 8,
        sourceText: "Yardbird reservation at 7:30pm, confirmation YB-731",
        normalizedName: "Yardbird",
        aliases: [],
        priorityIntent: "would_love",
        appearsNonNegotiable: false,
        hasFixedBooking: true,
        note: "Dinner reservation.",
        confidence: "high",
        requiresConfirmation: false,
      },
    ],
    bookings: [
      {
        placeName: "Yardbird",
        date: null,
        startTime: "19:30",
        endTime: null,
        confirmationCode: "YB-731",
        sourceText: "Yardbird reservation at 7:30pm, confirmation YB-731",
        confidence: "high",
        requiresConfirmation: true,
      },
    ],
    startLocation: "Hotel near Sheung Wan MTR",
    endLocation: "Central",
    walkingComfort: "moderate",
    pace: "relaxed",
    semanticConstraints: [
      {
        kind: "near_sunset",
        placeName: "Victoria Peak",
        value: "near sunset",
        sourceText: "Victoria Peak near sunset!!!",
        confidence: "high",
        requiresConfirmation: true,
      },
      {
        kind: "avoid_carrying",
        placeName: "Central Market",
        value: "keep shopping late",
        sourceText: "please keep shopping late so I don't carry bags",
        confidence: "high",
        requiresConfirmation: false,
      },
    ],
    unresolvedItems: [
      "Confirm the travel date.",
      "Confirm which Bakehouse location is intended.",
      "Confirm the desired Yardbird reservation duration.",
    ],
    confirmationPrompts: [
      "Is Victoria Peak one of your must-visits?",
      "Which Bakehouse location did you save?",
      "How long would you like to allow for dinner at Yardbird?",
    ],
  });

export class SeededHongKongExtractionAdapter implements AiExtractionAdapter {
  readonly id = "seeded_hong_kong_demo" as const;

  availability(): AiExtractionAvailability {
    return {
      available: false,
      provider: "openai",
      model: "seeded-demo",
      reason: "missing_api_key",
      demoAvailable: true,
    };
  }

  async extract(input: ExtractionRequest): Promise<ExtractionEnvelope> {
    void input;
    return ExtractionEnvelopeSchema.parse({
      mode: "seeded_demo",
      isLiveAnalysis: false,
      model: null,
      extraction: SEEDED_HONG_KONG_EXTRACTION,
    });
  }
}
