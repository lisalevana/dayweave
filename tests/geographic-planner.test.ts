import { describe, expect, it } from "vitest";

import {
  planGeographicDays,
  resolveContextualBranch,
  type ContextualBranchFamily,
  type GeographicStop,
} from "../lib/dayweave/geographic-planner";

type TestStop = GeographicStop & { name: string };

const starfieldFamily: ContextualBranchFamily<TestStop> = {
  id: "starfield",
  intentLabel: "Starfield",
  aliases: ["starfield", "starfield library"],
  defaultVariantId: "coex",
  includeByDefault: true,
  defaultReason: "COEX is the destination-default Seoul branch.",
  variants: [
    {
      id: "coex",
      stop: {
        id: "starfield-coex",
        name: "Starfield Library at COEX",
        localityKey: "seoul",
        localityLabel: "Seoul",
      },
      explicitAliases: ["starfield coex", "coex library"],
      contextAliases: ["coex", "gangnam"],
      contextMatchKind: "contextual_area",
      contextReason: "COEX was selected from the surrounding Seoul context.",
    },
    {
      id: "suwon",
      stop: {
        id: "starfield-suwon",
        name: "Starfield Library · Suwon",
        localityKey: "suwon",
        localityLabel: "Suwon",
      },
      explicitAliases: ["starfield suwon", "suwon starfield library"],
      contextAliases: ["samsung digital city", "samsung innovation museum"],
      contextMatchKind: "contextual_area",
      contextReason:
        "Starfield Suwon was selected because Samsung Digital City is also saved.",
    },
  ],
};

const bakehouseFamily: ContextualBranchFamily<TestStop> = {
  id: "bakehouse",
  intentLabel: "Bakehouse",
  aliases: ["bakehouse"],
  defaultVariantId: "soho",
  includeByDefault: false,
  defaultReason: "Soho is the central Hong Kong default.",
  variants: [
    {
      id: "the-peak",
      stop: {
        id: "bakehouse-the-peak",
        name: "Bakehouse · The Peak",
        localityKey: "hong-kong-core",
        localityLabel: "Hong Kong",
      },
      explicitAliases: ["bakehouse the peak", "peak tower bakehouse"],
      contextAliases: ["victoria peak", "the peak", "peak circle walk"],
      contextMatchKind: "same_complex",
      contextReason:
        "The Peak branch was selected because Victoria Peak is also saved.",
    },
    {
      id: "soho",
      stop: {
        id: "bakehouse-soho",
        name: "Bakehouse · Soho",
        localityKey: "hong-kong-core",
        localityLabel: "Hong Kong",
      },
      explicitAliases: ["bakehouse soho", "soho bakehouse"],
      contextAliases: ["soho", "man mo temple", "tai kwun"],
      contextMatchKind: "contextual_area",
      contextReason: "The Soho branch was selected from the Central context.",
    },
  ],
};

describe("contextual branch resolution", () => {
  it("uses the strong Suwon anchor for an ambiguous Starfield wish", () => {
    const result = resolveContextualBranch(
      starfieldFamily,
      "starfield\nsamsung digital city",
    );

    expect(result?.stop.id).toBe("starfield-suwon");
    expect(result?.resolution).toMatchObject({
      matchKind: "contextual_area",
      selectedPlaceName: "Starfield Library · Suwon",
    });
  });

  it("never overrides an explicitly named COEX branch", () => {
    const result = resolveContextualBranch(
      starfieldFamily,
      "starfield coex\nsamsung digital city",
    );

    expect(result?.stop.id).toBe("starfield-coex");
    expect(result?.resolution?.matchKind).toBe("explicit");
  });

  it("keeps the destination default when no branch intent was saved", () => {
    const result = resolveContextualBranch(starfieldFamily, "hangang river");

    expect(result?.stop.id).toBe("starfield-coex");
    expect(result?.intentMatched).toBe(false);
    expect(result?.resolution).toBeNull();
  });

  it("keeps a Bakehouse wish inside the Victoria Peak visit", () => {
    const result = resolveContextualBranch(
      bakehouseFamily,
      "Victoria Peak\nBakehouse",
    );

    expect(result?.stop.id).toBe("bakehouse-the-peak");
    expect(result?.resolution).toMatchObject({
      matchKind: "same_complex",
      selectedPlaceName: "Bakehouse · The Peak",
      alternative: {
        placeId: "bakehouse-soho",
        placeName: "Bakehouse · Soho",
      },
    });
  });

  it("does not include a branch family that was never requested", () => {
    expect(
      resolveContextualBranch(bakehouseFamily, "Victoria Peak"),
    ).toBeNull();
  });
});

describe("geographic day planning", () => {
  const stops: TestStop[] = [
    {
      id: "suwon-starfield",
      name: "Starfield Suwon",
      localityKey: "suwon",
      localityLabel: "Suwon",
      latitude: 37.287,
      longitude: 126.991,
      preferredDayOrder: 1,
      routeRank: 2,
    },
    {
      id: "seoul-hangang",
      name: "Jamsil Hangang Park",
      localityKey: "seoul",
      localityLabel: "Seoul",
      latitude: 37.518,
      longitude: 127.087,
      preferredDayOrder: 2,
    },
    {
      id: "suwon-samsung",
      name: "Samsung Innovation Museum",
      localityKey: "suwon",
      localityLabel: "Suwon",
      latitude: 37.258,
      longitude: 127.054,
      preferredDayOrder: 1,
      routeRank: 1,
    },
  ];

  it("groups Suwon together instead of producing Suwon → Seoul → Suwon", () => {
    const plan = planGeographicDays(stops);

    expect(plan.basis).toBe("verified_locations");
    expect(plan.days).toHaveLength(2);
    expect(plan.days[0]).toMatchObject({
      dayNumber: 1,
      areaLabel: "Suwon",
      stopIds: ["suwon-samsung", "suwon-starfield"],
    });
    expect(plan.days[1]).toMatchObject({
      dayNumber: 2,
      areaLabel: "Seoul",
      stopIds: ["seoul-hangang"],
    });
  });

  it("is deterministic even when the input arrives in another order", () => {
    const first = planGeographicDays(stops);
    const second = planGeographicDays([stops[2], stops[0], stops[1]]);

    expect(second).toEqual(first);
  });

  it("keeps every stop exactly once across all day threads", () => {
    const plan = planGeographicDays(stops);
    const flattened = plan.days.flatMap((day) => day.stopIds);

    expect(flattened).toHaveLength(stops.length);
    expect(new Set(flattened)).toEqual(new Set(stops.map((stop) => stop.id)));
  });

  it("does not claim location-backed optimization without coordinates", () => {
    const plan = planGeographicDays([
      {
        id: "one",
        name: "One",
        localityKey: "example",
        localityLabel: "Example",
      },
      {
        id: "two",
        name: "Two",
        localityKey: "example",
        localityLabel: "Example",
      },
    ]);

    expect(plan.basis).toBe("curated_sequence");
    expect(plan.summary).toMatch(/needs verified locations/i);
  });
});
