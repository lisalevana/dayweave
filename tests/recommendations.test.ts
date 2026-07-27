import { describe, expect, it, vi } from "vitest";

import { POST } from "../app/api/recommendations/route";
import {
  CuratedDestinationRecommendationAdapter,
  DayRecommendationService,
  WikivoyageRecommendationAdapter,
  parseWikivoyageListings,
  parseWikivoyageTravelListings,
} from "../lib/adapters/day-recommendations.server";
import {
  DayRecommendationBundleSchema,
  RecommendationRequestSchema,
} from "../lib/schemas/evidence";

function recommendationRequest(body: unknown) {
  return new Request("http://localhost/api/recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("curated destination recommendations", () => {
  it("turns a partial Singapore wishlist into three sourced experience briefs", async () => {
    const input = RecommendationRequestSchema.parse({
      destination: "Singapore",
      rawWishlist: "Marina Bay\nFort Canning",
      savedPlaces: [
        { id: "user-01-marina-bay", name: "Marina Bay" },
        { id: "user-02-fort-canning", name: "Fort Canning" },
      ],
    });
    const bundle = await new DayRecommendationService(
      new CuratedDestinationRecommendationAdapter(),
      {
        recommend: async () => {
          throw new Error("The curated test must not use a network fallback.");
        },
      },
    ).recommend(input);

    expect(DayRecommendationBundleSchema.parse(bundle)).toEqual(bundle);
    expect(bundle).toMatchObject({
      destination: "Singapore",
      mode: "curated_local",
      savedPlaceIds: ["fort-canning-park", "marina-bay-waterfront"],
      serviceAddedPlaceIds: ["east-coast-park"],
    });
    expect(bundle.orderedBriefs).toHaveLength(3);
    expect(bundle.orderedBriefs.map((brief) => brief.order)).toEqual([1, 2, 3]);
    expect(
      bundle.orderedBriefs.every(
        (brief) =>
          brief.whyPeopleCome &&
          brief.dontMiss &&
          brief.worthKnowing &&
          brief.evidence.length > 0,
      ),
    ).toBe(true);
    expect(bundle.orderedBriefs[0].evidence[0].sourceUrl).toContain(
      "nparks.gov.sg",
    );
    expect(bundle.orderedBriefs[1].evidence[0].sourceUrl).toContain(
      "visitsingapore.com",
    );
    expect(bundle.orderedBriefs[2].evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceUrl: expect.stringContaining("en.wikivoyage.org"),
          license: "CC BY-SA 4.0",
        }),
      ]),
    );
    expect(
      bundle.orderedBriefs.some((brief) =>
        Object.prototype.hasOwnProperty.call(brief, "note"),
      ),
    ).toBe(false);
  });

  it("serves curated recommendations from a no-store POST endpoint", async () => {
    const response = await POST(
      recommendationRequest({
        destination: "Singapore",
        rawWishlist: "Marina Bay\nFort Canning\nEast Coast Park",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.ok).toBe(true);
    expect(body.bundle.mode).toBe("curated_local");
    expect(body.bundle.orderedBriefs).toHaveLength(3);
    expect(body.bundle.savedPlaceIds).toHaveLength(3);
  });

  it("resolves an ambiguous Starfield save to Suwon and separates Hangang into a Seoul day", async () => {
    const response = await POST(
      recommendationRequest({
        destination: "Seoul",
        rawWishlist:
          "starfield\nsamsung digital city\nhangang river\neat ramyeon",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.bundle).toMatchObject({
      destination: "Seoul",
      mode: "curated_local",
      savedPlaceIds: [
        "samsung-innovation-museum-suwon",
        "starfield-library-suwon",
        "jamsil-hangang-ramyeon",
      ],
      serviceAddedPlaceIds: [],
      branchResolutions: [
        {
          intent: "Starfield",
          selectedPlaceId: "starfield-library-suwon",
          selectedPlaceName: "Starfield Library · Suwon",
          matchKind: "contextual_area",
          alternative: {
            placeId: "starfield-library-coex",
            placeName: "Starfield Library at COEX",
          },
        },
      ],
      routePlan: {
        basis: "verified_locations",
        days: [
          {
            dayNumber: 1,
            areaLabel: "Suwon",
            stopIds: [
              "samsung-innovation-museum-suwon",
              "starfield-library-suwon",
            ],
            basis: "verified_locations",
          },
          {
            dayNumber: 2,
            areaLabel: "Seoul",
            stopIds: ["jamsil-hangang-ramyeon"],
            basis: "verified_locations",
          },
        ],
      },
    });
    expect(body.bundle.branchResolutions[0].reason).toMatch(
      /Samsung Digital City.*same Suwon day/i,
    );
    expect(body.bundle.orderedBriefs).toHaveLength(3);
    expect(
      body.bundle.orderedBriefs.map(
        (brief: { placeName: string }) => brief.placeName,
      ),
    ).toEqual([
      "Samsung Innovation Museum · Suwon",
      "Starfield Library · Suwon",
      "Jamsil Hangang Park ramyeon picnic",
    ]);
    expect(body.bundle.orderedBriefs[0].worthKnowing).toMatch(
      /Outside Seoul · Suwon.*advance reservation/i,
    );
    expect(body.bundle.orderedBriefs[0].mapsArea).toBe("Suwon");
    expect(body.bundle.orderedBriefs[0].evidence[0].sourceUrl).toContain(
      "samsunginnovationmuseum.com",
    );
    expect(body.bundle.orderedBriefs[1].mapsArea).toBe("Suwon");
    expect(body.bundle.orderedBriefs[1].evidence[0].sourceUrl).toContain(
      "starfield.co.kr",
    );
    expect(body.bundle.orderedBriefs[2].dontMiss).toMatch(
      /self-service cooking machine/i,
    );
    expect(body.bundle.unresolvedWishlistItems).toEqual([]);
  });

  it("adds a Lovely Runner filming wish to the existing Suwon day", async () => {
    const response = await POST(
      recommendationRequest({
        destination: "Seoul",
        rawWishlist:
          "starfield\nHangang\nsamsung digital city\nlovely runner filming location",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.bundle.savedPlaceIds).toEqual([
      "samsung-innovation-museum-suwon",
      "mong-ted-lovely-runner-suwon",
      "starfield-library-suwon",
      "jamsil-hangang-ramyeon",
    ]);
    expect(body.bundle.serviceAddedPlaceIds).toEqual([]);
    expect(body.bundle.unresolvedWishlistItems).toEqual([]);
    expect(body.bundle.routePlan).toMatchObject({
      basis: "verified_locations",
      days: [
        {
          dayNumber: 1,
          areaLabel: "Suwon",
          stopIds: [
            "samsung-innovation-museum-suwon",
            "mong-ted-lovely-runner-suwon",
            "starfield-library-suwon",
          ],
        },
        {
          dayNumber: 2,
          areaLabel: "Seoul",
          stopIds: ["jamsil-hangang-ramyeon"],
        },
      ],
    });

    const mongTed = body.bundle.orderedBriefs.find(
      (brief: { placeId: string }) =>
        brief.placeId === "mong-ted-lovely-runner-suwon",
    );
    expect(mongTed).toMatchObject({
      placeName: "Mong Ted · Lovely Runner filming location",
      mapsArea: "Suwon",
      origin: "saved",
    });
    expect(mongTed.dontMiss).toMatch(/private family residence/i);
    expect(mongTed.evidence[0].sourceUrl).toContain("visitkorea.or.kr");
  });

  it("surfaces an unmatched wishlist line instead of silently discarding it", async () => {
    const bundle =
      await new CuratedDestinationRecommendationAdapter().recommend(
        RecommendationRequestSchema.parse({
          destination: "Seoul",
          rawWishlist:
            "starfield\neat ramyeon\nmy cousin's secret cafe",
        }),
      );

    expect(bundle).not.toBeNull();
    expect(bundle?.unresolvedWishlistItems).toEqual([
      "my cousin's secret cafe",
    ]);
    expect(
      bundle?.orderedBriefs.some((brief) =>
        brief.placeName.includes("my cousin"),
      ),
    ).toBe(false);
  });

  it("keeps an explicitly named COEX branch even when Samsung Digital City is also saved", async () => {
    const bundle = await new CuratedDestinationRecommendationAdapter().recommend(
      RecommendationRequestSchema.parse({
        destination: "Seoul",
        rawWishlist: "starfield coex\nsamsung digital city",
      }),
    );

    expect(bundle).not.toBeNull();
    expect(bundle?.orderedBriefs.map((brief) => brief.placeId)).toContain(
      "starfield-library-coex",
    );
    expect(bundle?.orderedBriefs.map((brief) => brief.placeId)).not.toContain(
      "starfield-library-suwon",
    );
    expect(bundle?.branchResolutions).toEqual([
      expect.objectContaining({
        selectedPlaceId: "starfield-library-coex",
        matchKind: "explicit",
      }),
    ]);
  });

  it("defaults a destination-only Seoul request to COEX without inventing a Samsung detour", async () => {
    const bundle = await new CuratedDestinationRecommendationAdapter().recommend(
      RecommendationRequestSchema.parse({
        destination: "Seoul",
        rawWishlist: "",
      }),
    );

    expect(bundle).not.toBeNull();
    expect(bundle?.savedPlaceIds).toEqual([]);
    expect(bundle?.orderedBriefs.map((brief) => brief.placeId)).toEqual(
      expect.arrayContaining([
        "starfield-library-coex",
        "jamsil-hangang-ramyeon",
        "gyeongbokgung-palace",
      ]),
    );
    expect(bundle?.orderedBriefs.map((brief) => brief.placeId)).not.toContain(
      "samsung-innovation-museum-suwon",
    );
    expect(bundle?.orderedBriefs.map((brief) => brief.placeId)).not.toContain(
      "starfield-library-suwon",
    );
    expect(bundle?.branchResolutions).toEqual([]);
    expect(bundle?.routePlan.days).toEqual([
      expect.objectContaining({
        dayNumber: 1,
        areaLabel: "Seoul",
      }),
    ]);
  });

  it("matches a general Bakehouse wish to The Peak when Victoria Peak is saved", async () => {
    const bundle = await new CuratedDestinationRecommendationAdapter().recommend(
      RecommendationRequestSchema.parse({
        destination: "Hong Kong",
        rawWishlist: "Victoria Peak\nBakehouse",
      }),
    );

    expect(bundle).not.toBeNull();
    expect(DayRecommendationBundleSchema.parse(bundle)).toEqual(bundle);
    expect(bundle?.orderedBriefs.map((brief) => brief.placeId)).toEqual([
      "man-mo-temple",
      "victoria-peak",
      "bakehouse-the-peak",
    ]);
    expect(bundle?.orderedBriefs.map((brief) => brief.placeId)).not.toContain(
      "bakehouse-soho",
    );
    expect(bundle?.branchResolutions).toEqual([
      expect.objectContaining({
        intent: "Bakehouse",
        selectedPlaceId: "bakehouse-the-peak",
        matchKind: "same_complex",
        alternative: {
          placeId: "bakehouse-soho",
          placeName: "Bakehouse · Soho",
        },
      }),
    ]);
    expect(bundle?.branchResolutions[0].reason).toMatch(
      /inside The Peak Tower.*one Peak visit/i,
    );
    expect(bundle?.routePlan).toMatchObject({
      basis: "verified_locations",
      days: [
        {
          dayNumber: 1,
          areaLabel: "Hong Kong",
          stopIds: [
            "man-mo-temple",
            "victoria-peak",
            "bakehouse-the-peak",
          ],
          basis: "verified_locations",
        },
      ],
    });
  });

  it("enriches unresolved curated wishes through the shared destination resolver", async () => {
    const resolveWishlist = vi.fn(
      async (destination: string, wishlistItems: readonly string[]) => {
        expect(destination).toBe("Seoul");
        expect(wishlistItems).toEqual(["river capsule"]);
        return [
          {
            wishlistItem: "river capsule",
            score: 0.91,
            reason: "the destination guide explicitly uses this wording",
            stop: {
              id: "wikivoyage-seoul-river-capsule",
              name: "River Capsule",
              mapsArea: "Songpa",
              localityKey: "seoul-songpa",
              localityLabel: "Songpa",
              latitude: 37.52,
              longitude: 127.03,
              aliases: ["River Capsule"],
              whyPeopleCome: "A sourced riverside experience.",
              dontMiss: "Look across the river as the capsule moves.",
              worthKnowing: "Check current operations before going.",
              evidence: [
                {
                  id: "wikivoyage-seoul-river-capsule",
                  claim:
                    "The destination guide describes the riverside capsule.",
                  sourceName: "Wikivoyage: Seoul",
                  sourceUrl: "https://en.wikivoyage.org/wiki/Seoul",
                  sourceType: "licensed_editorial" as const,
                  lastCheckedDate: "2026-07-24",
                  license: "CC BY-SA 4.0",
                },
              ],
            },
          },
        ];
      },
    );
    const adapter = new CuratedDestinationRecommendationAdapter({
      resolveWishlist,
    });
    const bundle = await adapter.recommend(
      RecommendationRequestSchema.parse({
        destination: "Seoul",
        rawWishlist: "starfield\nriver capsule",
      }),
    );

    expect(resolveWishlist).toHaveBeenCalledTimes(1);
    expect(bundle?.unresolvedWishlistItems).toEqual([]);
    expect(bundle?.savedPlaceIds).toContain(
      "wikivoyage-seoul-river-capsule",
    );
    expect(bundle?.orderedBriefs.map((brief) => brief.placeName)).toContain(
      "River Capsule",
    );
    expect(bundle?.branchResolutions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          intent: "river capsule",
          selectedPlaceId: "wikivoyage-seoul-river-capsule",
          matchKind: "contextual_area",
        }),
      ]),
    );
    expect(bundle?.routePlan.days).toHaveLength(1);
    expect(bundle?.routePlan.days[0]).toMatchObject({
      areaLabel: "Seoul",
      basis: "verified_locations",
    });
    expect(bundle?.routePlan.days[0].stopIds).toContain(
      "wikivoyage-seoul-river-capsule",
    );
  });

  it.each([
    {
      destination: "Hong Kong",
      expectedName: "Man Mo Temple",
      expectedDontMiss: /incense coils/i,
    },
    {
      destination: "Cheng Chau",
      expectedName: "Cheung Chau mango mochi",
      expectedDontMiss: /giant fish ball/i,
    },
    {
      destination: "JB",
      expectedName: "Senibong Bay Seafood",
      expectedDontMiss: /Alaska king crab/i,
    },
    {
      destination: "Seoul",
      expectedName: "Starfield Library at COEX",
      expectedDontMiss: /self-service cooking machine/i,
    },
  ])(
    "keeps the $destination flagship knowledge available without a provider",
    async ({ destination, expectedName, expectedDontMiss }) => {
      const bundle = await new CuratedDestinationRecommendationAdapter().recommend(
        RecommendationRequestSchema.parse({
          destination,
          rawWishlist: "",
        }),
      );

      expect(bundle?.mode).toBe("curated_local");
      expect(bundle?.orderedBriefs).toHaveLength(3);
      expect(
        bundle?.orderedBriefs.some((brief) => brief.placeName === expectedName),
      ).toBe(true);
      expect(
        bundle?.orderedBriefs.some((brief) =>
          expectedDontMiss.test(brief.dontMiss),
        ),
      ).toBe(true);
    },
  );
});

describe("Wikivoyage fallback", () => {
  const listingHtml = `
    <section>
      <ul>
        <li>
          <span class="vcard">
            <span class="listing-name"><a href="/wiki/Museum">River &amp; City Museum</a></span>
            <span class="listing-content">A museum about the city&rsquo;s life beside the river.</span>
          </span>
        </li>
        <li>
          <span class='vcard'>
            <b class='listing-name'>Old Market</b>
            <span class='listing-description'>A covered market with breakfast stalls &amp; local produce.</span>
          </span>
        </li>
        <li>
          <span class="vcard">
            <span class="listing-name"><a>Hilltop Garden</a></span>
            <span class="listing-content">A public garden overlooking the old centre.</span>
          </span>
        </li>
      </ul>
    </section>
  `;

  it("parses semantic listings from a pure HTML string", () => {
    expect(parseWikivoyageListings(listingHtml)).toEqual([
      {
        name: "River & City Museum",
        description: "A museum about the city’s life beside the river.",
      },
      {
        name: "Old Market",
        description: "A covered market with breakfast stalls & local produce.",
      },
      {
        name: "Hilltop Garden",
        description: "A public garden overlooking the old centre.",
      },
    ]);
  });

  it("keeps verified listing coordinates from Wikivoyage markup", () => {
    const [listing] = parseWikivoyageListings(`
      <li>
        <span class="listing-coordinates">
          <span class="geo">
            <abbr class="latitude">35.16</abbr>
            <abbr class="longitude">129.17</abbr>
          </span>
        </span>
        <span class="listing-name">Blueline Park</span>
        <span class="listing-content">A coastal sky capsule ride.</span>
      </li>
    `);

    expect(listing).toMatchObject({
      name: "Blueline Park",
      latitude: 35.16,
      longitude: 129.17,
    });
  });

  it("keeps source-provided alternate place names for nickname matching", () => {
    const [listing] = parseWikivoyageListings(`
      <li>
        <span class="listing-name">Lotte World Tower</span>
        <span class="nickname listing-alt">Seoul Sky, 롯데월드타워</span>
        <span class="listing-content">An observation deck above Songpa.</span>
      </li>
    `);

    expect(listing).toMatchObject({
      name: "Lotte World Tower",
      altNames: ["Seoul Sky, 롯데월드타워"],
    });
  });

  it("only recommends listings from traveller-facing guide sections", () => {
    const sectionedHtml = `
      <div class="mw-heading mw-heading2"><h2 id="Get_in">Get in</h2></div>
      <span class="listing-name">Example Airport</span>
      <span class="listing-content">The main airport.</span>
      <div class="mw-heading mw-heading2"><h2 id="See">See</h2></div>
      ${listingHtml}
      <div class="mw-heading mw-heading2"><h2 id="Sleep">Sleep</h2></div>
      <span class="listing-name">Example Hotel</span>
      <span class="listing-content">A central hotel.</span>
    `;

    expect(
      parseWikivoyageTravelListings(sectionedHtml).map(
        (listing) => listing.name,
      ),
    ).toEqual(["River & City Museum", "Old Market", "Hilltop Garden"]);
  });

  it("uses the no-key MediaWiki API with attribution and a named user agent", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      const action = url.searchParams.get("action");
      const body =
        action === "query"
          ? { query: { search: [{ title: "Example City" }] } }
          : {
              parse: {
                title: "Example City",
                displaytitle: "Example City",
                text: `
                  <div class="mw-heading mw-heading2"><h2 id="See">See</h2></div>
                  ${listingHtml}
                  <div class="mw-heading mw-heading2"><h2 id="Sleep">Sleep</h2></div>
                `,
              },
            };
      expect(new Headers(init?.headers).get("Api-User-Agent")).toContain(
        "DayWeave",
      );
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;
    const adapter = new WikivoyageRecommendationAdapter(fetcher);
    const bundle = await adapter.recommend(
      RecommendationRequestSchema.parse({
        destination: "Example City",
        rawWishlist: "Old Market",
      }),
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(bundle?.mode).toBe("wikivoyage");
    expect(bundle?.orderedBriefs).toHaveLength(3);
    expect(bundle?.savedPlaceIds).toEqual(["wikivoyage-old-market"]);
    expect(bundle?.attribution).toMatchObject({
      url: "https://en.wikivoyage.org/wiki/Example_City",
      license: "CC BY-SA 4.0",
    });
    expect(bundle?.attribution.label).toMatch(/Wikivoyage contributors/i);
  });

  it("resolves a source-provided alternate name without a hand-written alias", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      const body =
        url.searchParams.get("action") === "query"
          ? { query: { search: [{ title: "Example City" }] } }
          : {
              parse: {
                title: "Example City",
                text: `
                  <div class="mw-heading mw-heading2"><h2 id="See">See</h2></div>
                  <ul>
                    <li><span class="listing-name">Lotte World Tower</span><span class="listing-alt">Seoul Sky</span><span class="listing-content">An observation deck above the city.</span></li>
                    <li><span class="listing-name">Lotte World</span><span class="listing-content">A nearby theme park.</span></li>
                    <li><span class="listing-name">Old Market</span><span class="listing-content">A covered local market.</span></li>
                  </ul>
                  <div class="mw-heading mw-heading2"><h2 id="Sleep">Sleep</h2></div>
                `,
              },
            };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;
    const adapter = new WikivoyageRecommendationAdapter(fetcher);
    const bundle = await adapter.recommend(
      RecommendationRequestSchema.parse({
        destination: "Example City",
        rawWishlist: "Seoul Sky",
      }),
    );

    expect(bundle?.unresolvedWishlistItems).toEqual([]);
    expect(bundle?.savedPlaceIds).toEqual([
      "wikivoyage-lotte-world-tower",
    ]);
    expect(bundle?.branchResolutions[0]).toMatchObject({
      intent: "Seoul Sky",
      selectedPlaceName: "Lotte World Tower",
    });

    const exactBundle = await adapter.recommend(
      RecommendationRequestSchema.parse({
        destination: "Example City",
        rawWishlist: "Lotte World Tower",
      }),
    );
    expect(exactBundle?.unresolvedWishlistItems).toEqual([]);
    expect(exactBundle?.savedPlaceIds).toEqual([
      "wikivoyage-lotte-world-tower",
    ]);
  });

  it("resolves a nickname from a destination subpage before choosing fillers", async () => {
    const rootHtml = `
      <div class="mw-heading mw-heading2"><h2 id="Do">Do</h2></div>
      <ul>
        <li><span class="listing-name">Polar Bear Swim</span><span class="listing-content">A winter sea swim.</span></li>
        <li><span class="listing-name">Rock Festival</span><span class="listing-content">An annual music festival.</span></li>
        <li><span class="listing-name">Sea Art Festival</span><span class="listing-content">A seasonal art event.</span></li>
      </ul>
      <div class="mw-heading mw-heading2"><h2 id="Sleep">Sleep</h2></div>
    `;
    const haeundaeHtml = `
      <div class="mw-heading mw-heading2"><h2 id="See">See</h2></div>
      <ul>
        <li>
          <span class="geo"><abbr class="latitude">35.1587</abbr><abbr class="longitude">129.1604</abbr></span>
          <span class="listing-name">Haeundae Beach</span>
          <span class="listing-content">Busan's best-known urban beach.</span>
        </li>
        <li>
          <span class="geo"><abbr class="latitude">35.1640</abbr><abbr class="longitude">129.1710</abbr></span>
          <span class="listing-name">Cheongsapo Observatory</span>
          <span class="listing-content">A coastal observation walk.</span>
        </li>
      </ul>
      <div class="mw-heading mw-heading2"><h2 id="Do">Do</h2></div>
      <ul>
        <li>
          <span class="geo"><abbr class="latitude">35.1600</abbr><abbr class="longitude">129.1700</abbr></span>
          <span class="listing-name">Blueline Park</span>
          <span class="listing-content">An old railway now offers a sky capsule and coastal train.</span>
        </li>
      </ul>
      <div class="mw-heading mw-heading2"><h2 id="Sleep">Sleep</h2></div>
    `;
    const requestedUrls: URL[] = [];
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      requestedUrls.push(url);
      const action = url.searchParams.get("action");
      const list = url.searchParams.get("list");
      const page = url.searchParams.get("page");
      const body =
        action === "query" && list === "search"
          ? { query: { search: [{ title: "Busan" }] } }
          : action === "query" && list === "allpages"
            ? {
                query: {
                  allpages: [{ title: "Busan/Haeundae" }],
                },
              }
            : {
                parse: {
                  title: page,
                  text:
                    page === "Busan/Haeundae"
                      ? haeundaeHtml
                      : rootHtml,
                },
              };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;
    const adapter = new WikivoyageRecommendationAdapter(fetcher);
    const bundle = await adapter.recommend(
      RecommendationRequestSchema.parse({
        destination: "Busan",
        rawWishlist: "busan capsule",
      }),
    );

    expect(bundle?.unresolvedWishlistItems).toEqual([]);
    expect(bundle?.savedPlaceIds).toEqual([
      "wikivoyage-haeundae-blueline-park",
    ]);
    expect(
      bundle?.orderedBriefs.map((brief) => brief.placeName),
    ).toEqual(
      expect.arrayContaining([
        "Blueline Park",
        "Haeundae Beach",
        "Cheongsapo Observatory",
      ]),
    );
    expect(bundle?.routePlan).toMatchObject({
      basis: "verified_locations",
      days: [
        {
          areaLabel: "Haeundae",
          basis: "verified_locations",
        },
      ],
    });
    expect(bundle?.branchResolutions[0]).toMatchObject({
      intent: "busan capsule",
      selectedPlaceName: "Blueline Park",
      matchKind: "contextual_area",
    });
    expect(
      requestedUrls.every(
        (url) => !decodeURIComponent(url.search).includes("capsule"),
      ),
    ).toBe(true);

    const typoBundle = await adapter.recommend(
      RecommendationRequestSchema.parse({
        destination: "Busan",
        rawWishlist: "busan capsul",
      }),
    );
    expect(typoBundle?.unresolvedWishlistItems).toEqual([]);
    expect(typoBundle?.savedPlaceIds).toContain(
      "wikivoyage-haeundae-blueline-park",
    );
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("keeps an ambiguous local phrase unresolved instead of guessing", async () => {
    const rootHtml = `
      <div class="mw-heading mw-heading2"><h2 id="See">See</h2></div>
      ${listingHtml}
      <div class="mw-heading mw-heading2"><h2 id="Sleep">Sleep</h2></div>
    `;
    const districtHtml = `
      <div class="mw-heading mw-heading2"><h2 id="Do">Do</h2></div>
      <ul>
        <li><span class="listing-name">Harbour Line</span><span class="listing-content">Ride a glass capsule beside the water.</span></li>
        <li><span class="listing-name">Hill Line</span><span class="listing-content">Ride a glass capsule above the old town.</span></li>
      </ul>
      <div class="mw-heading mw-heading2"><h2 id="Sleep">Sleep</h2></div>
    `;
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      const list = url.searchParams.get("list");
      const page = url.searchParams.get("page");
      const body =
        list === "search"
          ? { query: { search: [{ title: "Example City" }] } }
          : list === "allpages"
            ? {
                query: {
                  allpages: [{ title: "Example City/Harbour" }],
                },
              }
            : {
                parse: {
                  title: page,
                  text:
                    page === "Example City/Harbour"
                      ? districtHtml
                      : rootHtml,
                },
              };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;
    const bundle = await new WikivoyageRecommendationAdapter(
      fetcher,
    ).recommend(
      RecommendationRequestSchema.parse({
        destination: "Example City",
        rawWishlist: "capsule",
      }),
    );

    expect(bundle?.unresolvedWishlistItems).toEqual(["capsule"]);
    expect(bundle?.savedPlaceIds).toEqual([]);
    expect(bundle?.branchResolutions).toEqual([]);
    expect(
      bundle?.orderedBriefs.map((brief) => brief.placeName),
    ).not.toEqual(expect.arrayContaining(["Harbour Line", "Hill Line"]));
  });
});
