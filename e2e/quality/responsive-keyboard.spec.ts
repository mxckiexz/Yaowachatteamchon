import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, DEMO_PASSWORD, loginAs, logout } from "../helpers/accounts";

const ORIGIN = "http://localhost:5173";

async function noHorizontalScroll(page: Page, name: string) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth, `${name}: page is ${scrollWidth}px wide in a ${innerWidth}px window`).toBeLessThanOrEqual(innerWidth);
}

test("TEST-58 / AC-43: no horizontal scrolling at 375 px, and the login works with the keyboard alone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });

  // Keyboard only: Tab to the e-mail field, type, Tab to the password, type, Enter.
  await page.goto("/login");
  await noHorizontalScroll(page, "login");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("E-mail")).toBeFocused();
  await page.keyboard.type(ACCOUNTS.employee.email);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  await page.keyboard.type(DEMO_PASSWORD);
  await page.keyboard.press("Enter");
  await page.waitForURL("**/requests");

  const tag = Math.random().toString(36).slice(2, 6);
  const approverId = (await (await page.request.get("/api/approvers")).json()).approvers.find((a: { name: string }) => a.name === "Somchai").id;
  const created = await page.request.post("/api/requests", {
    headers: { Origin: ORIGIN },
    data: { title: `Narrow screen ${tag}`, justification: "A long justification text that should wrap on a small screen without pushing the page wider.", items: [{ name: "A very long item name that has to wrap inside the table cell on a phone", quantity: 12, unitPrice: 1234.5 }] },
  });
  const id = (await created.json()).request.id;
  await page.request.post(`/api/requests/${id}/submit`, { headers: { Origin: ORIGIN }, data: { approverId } });

  await page.goto("/requests");
  await expect(page.getByRole("link", { name: `Narrow screen ${tag}` })).toBeVisible();
  await noHorizontalScroll(page, "my requests");
  await page.goto("/requests/new");
  await expect(page.getByLabel("Title")).toBeVisible();
  await noHorizontalScroll(page, "new request");
  await page.goto(`/requests/${id}`);
  await expect(page.getByTestId("status-badge")).toBeVisible();
  await noHorizontalScroll(page, "request detail");
  await logout(page);

  await loginAs(page, ACCOUNTS.approver);
  await page.goto("/reviews");
  await expect(page.getByRole("link", { name: `Narrow screen ${tag}` })).toBeVisible();
  await noHorizontalScroll(page, "review queue");
  await page.getByRole("link", { name: `Narrow screen ${tag}` }).click();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await noHorizontalScroll(page, "decision panel");
});
