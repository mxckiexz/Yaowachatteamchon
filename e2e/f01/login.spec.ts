import { expect, test } from "@playwright/test";
import { ACCOUNTS, DEMO_PASSWORD, loginAs, logout } from "../helpers/accounts";

test("TEST-70 / AC-12: wrong login shows an error, correct login reaches the role's first screen, logout returns to login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ACCOUNTS.requester.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid email or password.");

  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/requests");
  await expect(page.getByTestId("current-user")).toHaveText("Ploy (Requester)");
  await expect(page.getByRole("link", { name: "Review queue" })).toHaveCount(0);

  await logout(page);
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  // After logout a protected page is no longer reachable.
  await page.goto("/requests");
  await page.waitForURL("**/login");
});

test("AC-12: an anonymous visit to a protected route is redirected to login", async ({ page }) => {
  await page.goto("/requests");
  await page.waitForURL("**/login");
});

test("AC-12: an approver sees the review link and an administrator lands on the users screen", async ({ page }) => {
  await loginAs(page, ACCOUNTS.approver);
  await expect(page.getByRole("link", { name: "Review queue" })).toBeVisible();
  await logout(page);
  await loginAs(page, ACCOUNTS.admin);
  await expect(page.getByTestId("current-user")).toHaveText("Admin (Administrator)");
  await expect(page.getByRole("link", { name: "My requests" })).toHaveCount(0);
});
