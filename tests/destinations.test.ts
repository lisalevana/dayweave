import { describe, expect, it } from "vitest";

import {
  DESTINATION_SUGGESTIONS,
  WORLD_COUNTRIES_AND_REGIONS,
  searchDestinationSuggestions,
} from "../lib/dayweave/destinations";

describe("worldwide destination suggestions", () => {
  it("keeps a broad, duplicate-free country and region catalog", () => {
    expect(WORLD_COUNTRIES_AND_REGIONS.length).toBeGreaterThanOrEqual(195);
    expect(new Set(DESTINATION_SUGGESTIONS).size).toBe(
      DESTINATION_SUGGESTIONS.length,
    );
    expect(DESTINATION_SUGGESTIONS).toEqual(
      expect.arrayContaining([
        "Hong Kong",
        "Indonesia",
        "Singapore",
        "United Kingdom",
        "United States",
        "Zimbabwe",
      ]),
    );
  });

  it("starts with the destinations DayWeave can demonstrate most clearly", () => {
    expect(searchDestinationSuggestions("", 4).map(({ label }) => label)).toEqual(
      ["Singapore", "Hong Kong", "Cheung Chau", "Johor Bahru"],
    );
  });

  it("finds countries and common aliases without blocking free text", () => {
    expect(searchDestinationSuggestions("hk")[0]).toMatchObject({
      label: "Hong Kong",
      kind: "Curated by DayWeave",
    });
    expect(searchDestinationSuggestions("seoul")[0]).toMatchObject({
      label: "Seoul",
      kind: "Curated by DayWeave",
    });
    expect(searchDestinationSuggestions("uae")[0]?.label).toBe(
      "United Arab Emirates",
    );
    expect(
      searchDestinationSuggestions("uni").map(({ label }) => label),
    ).toEqual(
      expect.arrayContaining([
        "United Arab Emirates",
        "United Kingdom",
        "United States",
      ]),
    );
  });
});
