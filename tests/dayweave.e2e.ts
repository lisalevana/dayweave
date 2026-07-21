import { expect, test } from "@playwright/test";

test("the seeded Hong Kong day stays truthful as plans change", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/DayWeave.*Make time for what matters/i);
  await expect(
    page.getByRole("heading", { name: "Make time for what matters." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "DayWeave home" }),
  ).toBeVisible();
  await expect(page.getByText("Powered by AURORA")).toHaveCount(1);

  await page.getByTestId("try-demo").click();
  await expect(
    page.getByRole("heading", {
      name: "Start with the places already in your heart.",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Your notes, links or booking details")).toHaveValue(
    /Victoria Peak/,
  );

  await page.getByTestId("extract-wishlist").click();
  await expect(page.getByText("Your wishes have shape.")).toBeVisible();
  await expect(page.getByText(/Nine places found\./)).toBeVisible();

  await page.getByTestId("confirm-intent").click();
  await expect(
    page.getByRole("heading", { name: "Give every place the right weight." }),
  ).toBeVisible();
  await expect(page.getByLabel("Must visit priority group")).toContainText(
    "3",
  );
  await expect(page.getByLabel("Start location")).toHaveValue(
    "sheung-wan-start",
  );
  await expect(page.getByLabel("End location")).toHaveValue(
    "jordan-hotel-end",
  );

  await page.getByTestId("review-thread").click();
  await expect(
    page.getByRole("heading", { name: "These wishes are allowed to be messy." }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Nine destination charms attached to a tangled coral travel thread",
    }),
  ).toBeVisible();

  await page.getByTestId("untangle-day").click();
  await expect(
    page.getByRole("heading", { name: "Your Hong Kong day, in one clear order." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "7 stops, with room to breathe." })).toBeVisible();
  await expect(page.getByText(/7 of 9 chosen places fit\./)).toBeVisible();
  await expect(page.getByText(/All 3 must-visits are protected\./)).toBeVisible();
  await expect(page.getByText("Man Mo Temple", { exact: true })).toBeVisible();

  await page.getByText("Optional nearby idea", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A small antiques wander?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "No thanks" }).click();
  await expect(page.getByText("No problem. Today’s route is unchanged.")).toBeVisible();

  await page.getByTestId("begin-day").click();
  await expect(page.getByRole("heading", { name: /Go to .* next\./ })).toBeVisible();

  await page.getByTestId("take-me-there").click();
  await expect(page.getByRole("heading", { name: /Head toward .*\./ })).toBeVisible();
  await page.getByTestId("take-me-there").click();
  await expect(page.getByRole("heading", { name: /Enjoy .*\./ })).toBeVisible();
  await page.getByTestId("complete-stop").click();

  await page.getByTestId("simulate-delay").click();
  await expect(
    page.getByRole("heading", { name: "Forty minutes later. Two honest paths." }),
  ).toBeVisible();
  await expect(page.getByText("Keep Victoria Peak inside the sunset window")).toBeVisible();
  await expect(page.getByText(/taxi|HK\$92/i)).toHaveCount(0);

  await page.getByTestId("protect-sunset").click();
  await expect(page.getByText("The moments are protected", { exact: true })).toBeVisible();
  await page.getByTestId("view-briefing").click();

  await expect(
    page.getByRole("heading", { name: "Don’t Miss Here" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mak’s Noodle" })).toBeVisible();
  await expect(page.getByText("No timing claim applied.")).toBeVisible();
  await page.getByTestId("arrive-from-brief").click();

  await page.getByRole("button", { name: "Change the rest of my day" }).click();
  await page.getByRole("button", { name: "I’m loving it here" }).click();
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
    page.getByRole("heading", { name: "A day worth remembering." }),
  ).toBeVisible();
  await expect(
    page.getByText(/You did not complete a list\. You made space for a day that mattered\./),
  ).toBeVisible();
});
