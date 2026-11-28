import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs } from "../helpers/accounts";
import { ORIGIN } from "../helpers/requests";

// DEF-01 (#67), found by the partner team's UAT: a 100-character item name without spaces pushed the
// request detail page wider than a 375 px phone screen (NFR-05 / AC-53).
test("TEST-L6-E2E-01 / AC-53: a 100-character unbroken item name wraps inside a 375 px window", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await loginAs(page, ACCOUNTS.requester);
  const created = await page.request.post("/api/requests", {
    headers: { Origin: ORIGIN },
    data: { itemName: "W".repeat(100), description: "[UAT] DEF-01 regression", quantity: 1, unitPrice: 10, reason: "Layout check", category: "OTHER" },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).request.id;

  await page.goto(`/requests/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("W".repeat(100));
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth, `page is ${scrollWidth}px wide in a ${innerWidth}px window`).toBeLessThanOrEqual(innerWidth);
});
