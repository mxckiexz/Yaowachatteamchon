import { expect, test } from "@playwright/test";
import { ACCOUNTS, DEMO_PASSWORD, loginAs, logout } from "../helpers/accounts";

test("TEST-45 / AC-10: wrong login shows an error, correct login reaches the list, logout returns to login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ACCOUNTS.employee.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid email or password.");

  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/requests");
  await expect(page.getByTestId("current-user")).toHaveText("Ploy (Employee)");

  await logout(page);
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  // After logout a protected page is no longer reachable.
  await page.goto("/requests");
  await page.waitForURL("**/login");
});

test("AC-10: an anonymous visit to a protected route is redirected to login", async ({ page }) => {
  await page.goto("/requests");
  await page.waitForURL("**/login");
});

test("helper: login helper works for an approver and shows the review link", async ({ page }) => {
  await loginAs(page, ACCOUNTS.approver);
  await expect(page.getByRole("link", { name: "Review queue" })).toBeVisible();
});
