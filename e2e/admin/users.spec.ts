import { expect, test } from "@playwright/test";
import { ACCOUNTS, DEMO_PASSWORD, loginAs, logout } from "../helpers/accounts";

test("TEST-75 / AC-44: the administrator deactivates a user, who cannot log in; the own row is locked; others are redirected", async ({ page, browser }) => {
  await loginAs(page, ACCOUNTS.admin);
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  await expect(page.getByText("Your own account cannot be changed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Deactivate Admin" })).toHaveCount(0);

  const row = page.getByRole("row", { name: /Nattapong/ });
  try {
    await page.getByRole("button", { name: "Deactivate Nattapong" }).click();
    await expect(row).toContainText("Inactive");

    // The deactivated user is refused at login.
    const other = await browser.newPage();
    await other.goto("/login");
    await other.getByLabel("E-mail").fill(ACCOUNTS.requester2.email);
    await other.getByLabel("Password").fill(DEMO_PASSWORD);
    await other.getByRole("button", { name: "Log in" }).click();
    await expect(other.getByRole("alert")).toHaveText("Invalid email or password.");
    await other.close();
  } finally {
    // Leave the demo data as it was found.
    await page.getByRole("button", { name: "Activate Nattapong" }).click();
    await expect(row).toContainText("Active");
  }

  await page.getByRole("link", { name: "All requests" }).click();
  await expect(page.getByRole("heading", { name: "All requests (read only)" })).toBeVisible();
  await logout(page);

  await loginAs(page, ACCOUNTS.requester);
  await page.goto("/admin/users");
  await page.waitForURL("**/requests");
  const api = await page.request.get("/api/admin/users");
  expect(api.status()).toBe(403);
  expect(await api.json()).not.toHaveProperty("users");
});
