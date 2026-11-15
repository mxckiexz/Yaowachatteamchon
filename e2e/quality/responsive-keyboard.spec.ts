import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, DEMO_PASSWORD, loginAs, logout } from "../helpers/accounts";
import { ORIGIN } from "../helpers/requests";

const WIDTHS = [1280, 768, 375];

async function noHorizontalScroll(page: Page, name: string) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth, `${name}: page is ${scrollWidth}px wide in a ${innerWidth}px window`).toBeLessThanOrEqual(innerWidth);
}

test("TEST-88 / AC-53: no horizontal scrolling at 1280, 768 and 375 px, and the login works with the keyboard alone", async ({ page }) => {
  const tag = Math.random().toString(36).slice(2, 6);

  // Keyboard only at the narrowest width: Tab to the e-mail field, type, Tab to the password, type, Enter.
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("E-mail")).toBeFocused();
  await page.keyboard.type(ACCOUNTS.requester.email);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  await page.keyboard.type(DEMO_PASSWORD);
  await page.keyboard.press("Enter");
  await page.waitForURL("**/requests");

  const created = await page.request.post("/api/requests", {
    headers: { Origin: ORIGIN },
    data: {
      itemName: `Narrow screen item with a very long name that has to wrap inside the table cell on a phone ${tag}`,
      description: "A long description text that should wrap on a small screen without pushing the page wider than the window.",
      quantity: 12,
      unitPrice: 1234.5,
      reason: "A long reason text that should also wrap on a small screen.",
      category: "FURNITURE",
    },
  });
  const id = (await created.json()).request.id;
  await page.request.post(`/api/requests/${id}/submit`, { headers: { Origin: ORIGIN }, data: {} });
  await logout(page);

  const visit = async (width: number, account: { email: string; landing: string }, steps: [string, (p: Page) => Promise<void>][]) => {
    await page.setViewportSize({ width, height: 800 });
    await loginAs(page, account);
    for (const [name, step] of steps) {
      await step(page);
      await noHorizontalScroll(page, `${name} at ${width}px`);
    }
    await logout(page);
  };

  for (const width of WIDTHS) {
    await visit(width, ACCOUNTS.requester, [
      ["my requests", async (p) => { await p.goto("/requests"); await expect(p.getByRole("link", { name: /^PR-/ }).first()).toBeVisible(); }],
      ["new request", async (p) => { await p.goto("/requests/new"); await expect(p.getByLabel("Item name")).toBeVisible(); }],
      ["request detail", async (p) => { await p.goto(`/requests/${id}`); await expect(p.getByTestId("status-badge")).toBeVisible(); }],
    ]);
    await visit(width, ACCOUNTS.approver, [
      ["review queue", async (p) => { await p.goto("/reviews"); await expect(p.getByRole("link", { name: /^PR-/ }).first()).toBeVisible(); }],
      ["decision panel", async (p) => { await p.goto(`/requests/${id}`); await p.getByRole("button", { name: "Reject", exact: true }).click(); }],
    ]);
    await visit(width, ACCOUNTS.admin, [
      ["administrator users", async (p) => { await p.goto("/admin/users"); await expect(p.getByRole("row", { name: /Nattapong/ })).toBeVisible(); }],
      ["administrator all requests", async (p) => { await p.goto("/all-requests"); await expect(p.getByRole("heading", { name: "All requests (read only)" })).toBeVisible(); }],
    ]);
  }
});
