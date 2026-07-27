import { describe, expect, it } from "vitest";

import {
  LocalHongKongExtractionAdapter,
  LocalTextRequiredError,
} from "../lib/adapters/local-hong-kong-extraction";
import {
  hongKongPlaces,
  messyHongKongWishlist,
} from "../lib/dayweave/demo";
import { materializeWishlistEnvelope } from "../lib/dayweave/materialize-extraction";

const adapter = new LocalHongKongExtractionAdapter();

function textRequest(text: string) {
  return {
    text,
    imageDataUrl: null,
    sourceKind: "plain_text" as const,
  };
}

describe("local Hong Kong extraction", () => {
  it("reads the complete messy demo deterministically without a model", async () => {
    const first = await adapter.extract(textRequest(messyHongKongWishlist));
    const second = await adapter.extract(textRequest(messyHongKongWishlist));

    expect(second).toEqual(first);
    expect(first.mode).toBe("local_rules");
    expect(first.isLiveAnalysis).toBe(false);
    expect(first.model).toBeNull();
    expect(first.extraction.places).toHaveLength(9);
    expect(
      first.extraction.places
        .filter((place) => place.priorityIntent === "must_visit")
        .map((place) => place.normalizedName),
    ).toEqual(["Man Mo Temple", "Tai Kwun", "Victoria Peak"]);
    expect(first.extraction.bookings).toContainEqual(
      expect.objectContaining({
        placeName: "Mak’s Noodle",
        startTime: "12:30",
        endTime: "13:30",
        confirmationCode: "DW-DEMO-1230",
      }),
    );
    expect(first.extraction.semanticConstraints).toContainEqual(
      expect.objectContaining({
        kind: "near_sunset",
        placeName: "Victoria Peak",
      }),
    );
    expect(first.extraction.semanticConstraints).toContainEqual(
      expect.objectContaining({
        kind: "avoid_carrying",
        placeName: "Temple Street Night Market",
      }),
    );
  });

  it("honors aliases and word boundaries instead of guessing", async () => {
    const result = await adapter.extract(
      textRequest(
        "Peak performance matters to me.\nPMQ maybe\nThe Star Ferry\nMak’s Noodle would be lovely",
      ),
    );

    expect(result.extraction.places.map((place) => place.normalizedName)).toEqual([
      "PMQ",
      "Star Ferry crossing",
      "Mak’s Noodle",
    ]);
    expect(
      result.extraction.places.some(
        (place) => place.normalizedName === "Victoria Peak",
      ),
    ).toBe(false);
  });

  it("does not inherit seeded intent that the traveller never wrote", async () => {
    const result = await adapter.extract(
      textRequest(
        "Man Mo Temple\nVictoria Peak\nMak's Noodle\nTemple Street Night Market",
      ),
    );
    const materialized = materializeWishlistEnvelope(result, hongKongPlaces);

    expect(materialized.places).toHaveLength(4);
    expect(materialized.places.every((place) => place.source === "user")).toBe(
      true,
    );
    expect(materialized.places.every((place) => !place.fixedBooking)).toBe(true);
    expect(materialized.places.every((place) => !place.timingConstraints)).toBe(
      true,
    );
    expect(materialized.places.every((place) => !place.shoppingLast)).toBe(true);
  });

  it("materializes only explicit booking and timing constraints", async () => {
    const result = await adapter.extract(
      textRequest(
        "Man Mo Temple must visit\nVictoria Peak near sunset\nMak's Noodle reservation 12:30-13:30 ref HK-123\nTemple Street shopping last so I don't carry bags",
      ),
    );
    const materialized = materializeWishlistEnvelope(result, hongKongPlaces);
    const manMo = materialized.places.find(
      (place) => place.id === "man-mo-temple",
    );
    const peak = materialized.places.find(
      (place) => place.id === "victoria-peak",
    );
    const maks = materialized.places.find((place) => place.id === "maks-noodle");
    const market = materialized.places.find(
      (place) => place.id === "temple-street-market",
    );

    expect(manMo?.priority).toBe("must");
    expect(peak?.timingConstraints?.[0]?.kind).toBe("sunset");
    expect(maks?.fixedBooking).toMatchObject({
      start: 12 * 60 + 30,
      end: 13 * 60 + 30,
      reference: "HK-123",
    });
    expect(market?.shoppingLast).toBe(true);
  });

  it("asks for pasted text when only a screenshot is available", async () => {
    await expect(
      adapter.extract({
        text: null,
        imageDataUrl: "data:image/png;base64,AAAA",
        sourceKind: "screenshot",
      }),
    ).rejects.toBeInstanceOf(LocalTextRequiredError);
  });
});
