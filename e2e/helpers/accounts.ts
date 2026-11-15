import type { Page } from "@playwright/test";

// Synthetic demo accounts created by the seed. The password is the local demo value.
export const DEMO_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "ChangeMe123!";
export const ACCOUNTS = {
  requester: { email: "ploy@purchaseflow.test", name: "Ploy", landing: "**/requests" },
  requester2: { email: "nattapong@purchaseflow.test", name: "Nattapong", landing: "**/requests" },
  approver: { email: "somchai@purchaseflow.test", name: "Somchai", landing: "**/requests" },
  approver2: { email: "malee@purchaseflow.test", name: "Malee", landing: "**/requests" },
  admin: { email: "admin@purchaseflow.test", name: "Admin", landing: "**/admin/users" },
};

export async function loginAs(page: Page, account: { email: string; landing: string }) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(account.landing);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Logout" }).click();
  await page.waitForURL("**/login");
}
