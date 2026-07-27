import { expect, test } from "@playwright/test";

test("the seeded Hong Kong day stays truthful as plans change", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/DayWeave.*Make time for what matters/i);
  await expect(
    page.getByRole("heading", { name: "See the day worth taking, and what not to miss at every stop." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "DayWeave home" }),
  ).toBeVisible();
  await expect(page.getByText("Moments over checklists")).toHaveCount(1);

  await page.getByTestId("open-hong-kong-demo").click();
  await expect(
    page.getByRole("heading", { name: "Your Hong Kong essentials." }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /mosaic Hong Kong journey connecting Man Mo Temple/i,
    }),
  ).toBeVisible();
  await expect(page.getByText("Don’t miss here")).toHaveCount(3);
  await expect(page.getByTestId("continue-hong-kong-demo")).toBeVisible();
  await page.getByTestId("continue-hong-kong-demo").click();
  await expect(
    page.getByRole("heading", { name: "A day you can follow, with the moments protected." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your day, woven in order." })).toBeVisible();
  await expect(page.getByRole("list", { name: "Route summary" })).toContainText("7 stops");
  await expect(page.getByText("Man Mo Temple", { exact: true })).toBeVisible();
  await expect(page.getByText(/signature bowl pairs bouncy shrimp wontons/i)).toBeVisible();

  await page.getByTestId("begin-day").click();
  await expect(page.getByRole("heading", { name: "Man Mo Temple" })).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /mosaic Hong Kong journey with Man Mo Temple/i,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("take-me-there")).toBeInViewport();

  await page.getByTestId("take-me-there").click();
  await expect(page.getByRole("heading", { name: /Head toward .*\./ })).toBeVisible();
  await page.getByTestId("take-me-there").click();
  await expect(page.getByRole("heading", { name: /Be here at .*\./ })).toBeVisible();
  await page.getByTestId("complete-stop").click();

  await page.getByTestId("simulate-delay").click();
  await expect(
    page.getByRole("heading", { name: "Forty minutes later. Two honest paths." }),
  ).toBeVisible();
  await expect(page.getByText("Keep Victoria Peak near sunset")).toBeVisible();
  await expect(page.getByText(/taxi|HK\$92/i)).toHaveCount(0);

  await page.getByTestId("protect-sunset").click();
  await expect(page.getByText(/Protected moments remain safe\./)).toBeVisible();
  await page.getByTestId("view-briefing").click();

  await expect(
    page.getByRole("heading", { name: "Don’t Miss Here" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mak’s Noodle" })).toBeVisible();
  await expect(page.getByText("Insight, not a scheduling fact.")).toBeVisible();
  await page.getByTestId("arrive-from-brief").click();

  await page.getByTestId("take-me-there").click();
  await page.getByTestId("take-me-there").click();
  await page.getByRole("button", { name: "Stay a little longer" }).click();
  await expect(
    page.getByRole("region", { name: "Stay. This is what the trip is for." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+30 minutes" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Enjoying a place longer is not a mistake.",
    }),
  ).toBeVisible();
  await page.getByTestId("reweave-day").click();
  await expect(page.getByText(/Rewoven\./)).toBeVisible();

  await page.getByTestId("finish-day").click();
  await expect(
    page.getByRole("heading", { name: "Your thread so far." }),
  ).toBeVisible();
  await expect(
    page.getByText(/The thread remembers what happened, never what the plan merely hoped for\./),
  ).toBeVisible();
});

test("Singapore becomes a service-backed recommendation, not a notes outline", async ({
  page,
}) => {
  await page.goto("/");

  const destinationInput = page.getByRole("combobox", { name: "Destination" });
  await destinationInput.fill("Singapore");
  await page.getByRole("option", { name: /^Singapore/ }).click();
  const savedPlacesInput = page.getByLabel("Places you already saved (optional)");
  await expect(savedPlacesInput).toBeFocused();
  await savedPlacesInput.fill(
    "Marina Bay\nFort Canning\nEast Coast Park",
  );
  await page.getByRole("button", { name: "Show me what not to miss" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Your Singapore essentials.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What not to miss, stop by stop." }),
  ).toBeVisible();
  await expect(page.getByText("Don’t miss here")).toHaveCount(3);
  await expect(page.getByText(/Fort Canning Heritage Gallery/)).toBeVisible();
  await expect(page.getByText(/East Coast Lagoon Food Village/)).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /mosaic journey from Fort Canning through Marina Bay/i,
    }),
  ).toBeVisible();
  await expect(page.getByText(/What matters here/)).toHaveCount(0);
  await expect(page.getByText(/one-hour visit/i)).toHaveCount(0);
  await expect(page.getByText(/original order kept/i)).toHaveCount(0);
  await expect(page.getByText(/Create my trip outline/i)).toHaveCount(0);
  await expect(page.getByText("Sheung Wan MTR")).toHaveCount(0);
  await expect(page.getByText("Screenshot reading unavailable")).toHaveCount(0);

  const routeLink = page.getByRole("link", { name: "Use this recommendation in Maps" });
  await expect(routeLink).toBeVisible();
  await expect(routeLink).toHaveAttribute("href", /Singapore/);
  await page.getByText("How DayWeave chose these places").click();
  await expect(page.getByText(/Nothing was copied from your notes/)).toBeVisible();
  await expect(page.getByText(/Maps remains responsible for current directions/)).toBeVisible();
});

test("Seoul turns saved ideas into specific experiences without a dead end", async ({
  page,
}) => {
  await page.goto("/");

  const destinationInput = page.getByRole("combobox", { name: "Destination" });
  await destinationInput.fill("Seoul");
  await page.getByRole("option", { name: /^Seoul/ }).click();
  await page
    .getByLabel("Places you already saved (optional)")
    .fill("starfield\nsamsung digital city\nhangang river\neat ramyeon");
  await page.getByRole("button", { name: "Show me what not to miss" }).click();

  await expect(
    page.getByRole("heading", { name: "Your Seoul essentials." }),
  ).toBeVisible();
  await expect(page.getByText("Don’t miss here")).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: "Starfield Library · Suwon" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Jamsil Hangang Park ramyeon picnic",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Samsung Innovation Museum · Suwon",
    }),
  ).toBeVisible();
  await expect(page.getByText(/self-service cooking machine/i)).toBeVisible();
  await expect(page.getByText(/Outside Seoul · Suwon/i)).toBeVisible();

  const branchDecision = page.getByLabel(
    "How DayWeave matched branches to this route",
  );
  await expect(branchDecision).toContainText("Best area match");
  await expect(branchDecision).toContainText("Starfield Library · Suwon");
  await expect(branchDecision).toContainText(
    /Samsung Digital City.*same Suwon day/i,
  );
  await expect(branchDecision).toContainText(
    "Chosen instead of Starfield Library at COEX",
  );

  const suwonDay = page.getByTestId("recommendation-day-1");
  await expect(suwonDay).toContainText("Suggested day 1");
  await expect(suwonDay).toContainText("Suwon");
  await expect(
    suwonDay.getByRole("heading", { name: "Suwon day" }),
  ).toBeVisible();
  await expect(suwonDay).toContainText("Samsung Innovation Museum · Suwon");
  await expect(suwonDay).toContainText("Starfield Library · Suwon");
  await expect(suwonDay).not.toContainText("Jamsil Hangang Park");

  const seoulDay = page.getByTestId("recommendation-day-2");
  await expect(seoulDay).toContainText("Suggested day 2");
  await expect(seoulDay).toContainText("Seoul");
  await expect(
    seoulDay.getByRole("heading", { name: "Seoul day" }),
  ).toBeVisible();
  await expect(seoulDay).toContainText("Jamsil Hangang Park ramyeon picnic");
  await expect(seoulDay).not.toContainText("Samsung Innovation Museum");
  await expect(seoulDay).not.toContainText("Starfield Library");

  const suwonRouteHref = await suwonDay
    .getByRole("link")
    .getAttribute("href");
  const seoulRouteHref = await seoulDay
    .getByRole("link")
    .getAttribute("href");
  expect(suwonRouteHref).not.toBeNull();
  expect(seoulRouteHref).not.toBeNull();
  const suwonRoute = [
    ...new URL(suwonRouteHref ?? "").searchParams.values(),
  ].join(" ");
  const seoulRoute = [
    ...new URL(seoulRouteHref ?? "").searchParams.values(),
  ].join(" ");
  expect(suwonRoute).toContain("Samsung Innovation Museum · Suwon");
  expect(suwonRoute).toContain("Starfield Library · Suwon");
  expect(suwonRoute).not.toContain("Jamsil Hangang Park");
  expect(seoulRoute).toContain("Jamsil Hangang Park ramyeon picnic");
  expect(seoulRoute).not.toContain("Samsung Innovation Museum");
  expect(seoulRoute).not.toContain("Starfield Library");

  await expect(
    page.getByRole("link", {
      name: /Find Samsung Innovation Museum · Suwon in Maps/,
    }),
  ).not.toHaveAttribute("href", /Suwon%2C\+Seoul/);
  await expect(
    page.getByText(/DayWeave could not find enough sourced recommendations/i),
  ).toHaveCount(0);
});

test("Seoul keeps a Lovely Runner filming wish inside the Suwon day", async ({
  page,
}) => {
  await page.goto("/");

  const destinationInput = page.getByRole("combobox", {
    name: "Destination",
  });
  await destinationInput.fill("Seoul");
  await page.getByRole("option", { name: /^Seoul/ }).click();
  await page
    .getByLabel("Places you already saved (optional)")
    .fill(
      "starfield\nHangang\nsamsung digital city\nlovely runner filming location",
    );
  await page.getByRole("button", { name: "Show me what not to miss" }).click();

  await expect(
    page.getByRole("heading", { name: "Your Seoul essentials." }),
  ).toBeVisible();
  await expect(page.getByText("Don’t miss here")).toHaveCount(4);
  await expect(
    page.getByRole("heading", {
      name: "Mong Ted · Lovely Runner filming location",
    }),
  ).toBeVisible();
  await expect(page.getByTestId("unresolved-wishlist")).toHaveCount(0);

  const suwonDay = page.getByTestId("recommendation-day-1");
  await expect(suwonDay).toContainText("Samsung Innovation Museum · Suwon");
  await expect(suwonDay).toContainText(
    "Mong Ted · Lovely Runner filming location",
  );
  await expect(suwonDay).toContainText("Starfield Library · Suwon");
  await expect(suwonDay).not.toContainText("Jamsil Hangang Park");

  const seoulDay = page.getByTestId("recommendation-day-2");
  await expect(seoulDay).toContainText("Jamsil Hangang Park ramyeon picnic");
  await expect(seoulDay).not.toContainText("Mong Ted");

  const suwonRouteHref = await suwonDay
    .getByRole("link")
    .getAttribute("href");
  expect(suwonRouteHref).not.toBeNull();
  const suwonRoute = [
    ...new URL(suwonRouteHref ?? "").searchParams.values(),
  ].join(" ");
  expect(suwonRoute).toContain("Samsung Innovation Museum · Suwon");
  expect(suwonRoute).toContain(
    "Mong Ted · Lovely Runner filming location",
  );
  expect(suwonRoute).toContain("Starfield Library · Suwon");
  expect(suwonRoute).not.toContain("Jamsil Hangang Park");
  await expect(page.getByText(/private family residence/i)).toBeVisible();
});

test("an unknown wishlist line stays visible until the traveller clarifies it", async ({
  page,
}) => {
  await page.goto("/");

  const destinationInput = page.getByRole("combobox", {
    name: "Destination",
  });
  await destinationInput.fill("Seoul");
  await page.getByRole("option", { name: /^Seoul/ }).click();
  const savedPlacesInput = page.getByLabel(
    "Places you already saved (optional)",
  );
  await savedPlacesInput.fill("starfield\nmy cousin's secret cafe");
  await page.getByRole("button", { name: "Show me what not to miss" }).click();

  const unresolved = page.getByTestId("unresolved-wishlist");
  await expect(unresolved).toBeVisible();
  await expect(
    unresolved.getByRole("heading", {
      name: "Wishlist items that need a specific place.",
    }),
  ).toBeVisible();
  await expect(unresolved).toContainText("my cousin's secret cafe");
  await expect(unresolved).toContainText("Kept for your review");
  await expect(unresolved).toContainText("instead of becoming the wrong pin");

  await page.getByTestId("edit-unresolved-wishlist").click();
  await expect(
    page.getByLabel("Places you already saved (optional)"),
  ).toHaveValue("starfield\nmy cousin's secret cafe");
  await expect(
    page.getByRole("combobox", { name: "Destination" }),
  ).toHaveValue("Seoul");
});

test("Hong Kong keeps a Bakehouse wish inside the Victoria Peak visit", async ({
  page,
}) => {
  await page.goto("/");

  const destinationInput = page.getByRole("combobox", { name: "Destination" });
  await destinationInput.fill("Hong Kong");
  await page.getByRole("option", { name: /^Hong Kong/ }).click();
  await page
    .getByLabel("Places you already saved (optional)")
    .fill("Victoria Peak\nBakehouse");
  await page.getByRole("button", { name: "Show me what not to miss" }).click();

  await expect(
    page.getByRole("heading", { name: "Your Hong Kong essentials." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Bakehouse · The Peak" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Bakehouse · Soho" }),
  ).toHaveCount(0);

  const branchDecision = page.getByLabel(
    "How DayWeave matched branches to this route",
  );
  await expect(branchDecision).toContainText("At the same stop");
  await expect(branchDecision).toContainText("Bakehouse · The Peak");
  await expect(branchDecision).toContainText(
    /inside The Peak Tower.*one Peak visit/i,
  );

  const hongKongDay = page.getByTestId("recommendation-day-1");
  await expect(hongKongDay).toContainText("Victoria Peak");
  await expect(hongKongDay).toContainText("Bakehouse · The Peak");
  await expect(hongKongDay).not.toContainText("Bakehouse · Soho");

  const routeLink = page.getByRole("link", {
    name: "Use this recommendation in Maps",
  });
  const routeHref = await routeLink.getAttribute("href");
  expect(routeHref).not.toBeNull();
  const route = [
    ...new URL(routeHref ?? "").searchParams.values(),
  ].join(" ");
  expect(route).toContain("Victoria Peak");
  expect(route).toContain("Bakehouse · The Peak");
  expect(route).not.toContain("Bakehouse · Soho");
});

test("destination-only Hong Kong gives recommendations without asking for saved places", async ({
  page,
}) => {
  await page.goto("/");

  const destinationInput = page.getByRole("combobox", { name: "Destination" });
  await destinationInput.fill("Hong Kong");
  await page.getByRole("option", { name: /^Hong Kong/ }).click();
  await page.getByRole("button", { name: "Show me what not to miss" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Your Hong Kong essentials.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Don’t miss here")).toHaveCount(3);
  await expect(page.getByText(/Add the Hong Kong places you saved/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Man Mo Temple" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Star Ferry" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Victoria Peak" })).toBeVisible();
});
