import type { Page } from "@playwright/test";

// Synthetic demo accounts created by the seed. The password is the local demo value.
export const DEMO_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "ChangeMe123!";
export const ACCOUNTS = {
  employee: { email: "ploy@buyflow.test", name: "Ploy" },
  employee2: { email: "nattapong@buyflow.test", name: "Nattapong" },
  approver: { email: "somchai@buyflow.test", name: "Somchai" },
  approver2: { email: "malee@buyflow.test", name: "Malee" },
};

export async function loginAs(page: Page, account: { email: string }) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/requests");
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Logout" }).click();
  await page.waitForURL("**/login");
}
