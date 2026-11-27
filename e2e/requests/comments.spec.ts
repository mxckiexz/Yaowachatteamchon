import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, loginAs, logout } from "../helpers/accounts";
import { ORIGIN, createDraftViaUi, submitViaUi, uniqueName } from "../helpers/requests";

const MESSAGE = "Enter a comment of 1 to 1000 characters.";

const section = (page: Page) => page.getByRole("region", { name: "Comments" });
const items = (page: Page) => section(page).getByRole("listitem");
const box = (page: Page) => section(page).getByLabel("Add a comment");
const postButton = (page: Page) => section(page).getByRole("button", { name: "Post comment" });

async function addViaApi(page: Page, requestId: number, text: string) {
  const res = await page.request.post(`/api/requests/${requestId}/comments`, { headers: { Origin: ORIGIN }, data: { text } });
  expect(res.status()).toBe(201);
}

async function postViaUi(page: Page, text: string) {
  await box(page).fill(text);
  await postButton(page).click();
}

test("TEST-182 / AC-151: comment text with HTML characters is shown as text", async ({ page }) => {
  let dialogs = 0;
  page.on("dialog", async (dialog) => {
    dialogs += 1;
    await dialog.dismiss();
  });
  await loginAs(page, ACCOUNTS.requester);
  const id = await createDraftViaUi(page, uniqueName("Comment text"));
  const text = "<img src=x onerror=alert(1)>';--";
  await addViaApi(page, id, text);
  await page.reload();
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText(text);
  await expect(section(page).locator("img")).toHaveCount(0);
  expect(dialogs).toBe(0);
});

test("TEST-186 / AC-155: the owner and an approver talk on a submitted request", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  const id = await createDraftViaUi(page, uniqueName("Comment talk"));
  await submitViaUi(page);
  await postViaUi(page, "Which model is needed?\nThe 2025 one?");
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText("Ploy");
  await expect(box(page)).toHaveValue("");
  await page.reload();
  await expect(items(page)).toHaveCount(1);
  await logout(page);

  await loginAs(page, ACCOUNTS.approver);
  await page.goto(`/requests/${id}`);
  await postViaUi(page, "Yes, the 2025 one.");
  await expect(items(page)).toHaveCount(2);
  await expect(box(page)).toHaveValue("");
  async function expectBoth() {
    await expect(items(page)).toHaveCount(2);
    await expect(items(page).nth(0)).toContainText("Ploy");
    // Line breaks are kept. Playwright's text matchers collapse white space, so the rendered text is read directly.
    expect(await items(page).nth(0).innerText()).toContain("Which model is needed?\nThe 2025 one?");
    await expect(items(page).nth(1)).toContainText("Somchai");
    await expect(items(page).nth(1)).toContainText("Yes, the 2025 one.");
  }
  await expectBoth();
  await page.reload();
  await expectBoth();
});

test("TEST-187 / AC-156: the administrator reads comments and has no form", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  const id = await createDraftViaUi(page, uniqueName("Comment admin"));
  await addViaApi(page, id, "Visible to the administrator");
  await logout(page);
  await loginAs(page, ACCOUNTS.admin);
  await page.goto(`/requests/${id}`);
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText("Visible to the administrator");
  await expect(section(page).getByRole("textbox")).toHaveCount(0);
  await expect(section(page).getByRole("button", { name: "Post comment" })).toHaveCount(0);
});

test("TEST-188 / AC-157: loading, empty, load error, post errors and a double click", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  const id = await createDraftViaUi(page, uniqueName("Comment states"));
  const pattern = `**/api/requests/${id}/comments`;

  let fail = true;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(pattern, async (route) => {
    if (route.request().method() !== "GET" || !fail) return route.continue();
    await gate;
    await route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Something went wrong."}' });
  });
  await page.reload();
  await expect(section(page).getByText("Loading comments...")).toBeVisible();
  release();
  await expect(section(page).getByText("Unable to load comments.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit request" })).toBeVisible();
  fail = false;
  await section(page).getByRole("button", { name: "Retry" }).click();
  await expect(section(page).getByText("No comments yet.")).toBeVisible();
  await page.unroute(pattern);

  // Blank text cannot be posted.
  await expect(postButton(page)).toBeDisabled();
  await box(page).fill("  \n  ");
  await expect(postButton(page)).toBeDisabled();

  // A failed post keeps the text and shows the server message.
  await page.route(pattern, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Something went wrong."}' })
      : route.continue()
  );
  await postViaUi(page, "Keep this text");
  await expect(section(page).getByRole("alert")).toContainText("Something went wrong.");
  await expect(box(page)).toHaveValue("Keep this text");
  await page.unroute(pattern);

  // The text area does not cut long text off; the server refuses it.
  await postViaUi(page, "a".repeat(1001));
  await expect(section(page).getByRole("alert")).toContainText(MESSAGE);
  await expect(box(page)).toHaveValue("a".repeat(1001));
  await expect(section(page).getByText("No comments yet.")).toBeVisible();

  // Two quick clicks while the first call is still running create one comment.
  let posts = 0;
  let finish: () => void = () => {};
  const held = new Promise<void>((resolve) => (finish = resolve));
  await page.route(pattern, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    posts += 1;
    await held;
    await route.continue();
  });
  await box(page).fill("Only once");
  await postButton(page).dblclick();
  await expect(postButton(page)).toBeDisabled();
  finish();
  await expect(items(page)).toHaveCount(1);
  expect(posts).toBe(1);
  await page.unroute(pattern);
  await page.reload();
  await expect(items(page)).toHaveCount(1);
});

test("TEST-189 / AC-158: a two-line comment with the keyboard only, announcement, error and focus", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await createDraftViaUi(page, uniqueName("Comment keyboard"));
  await expect(section(page).getByText("No comments yet.")).toBeVisible();
  const status = section(page).getByRole("status");
  await expect(status).toBeAttached();
  await expect(box(page)).toHaveAccessibleDescription("Up to 1000 characters.");

  // Reading order: from the control before the section, Tab reaches the text area.
  for (let i = 0; i < 40 && !(await box(page).evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(box(page)).toBeFocused();
  await page.keyboard.type("First line");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second line");
  await expect(box(page)).toHaveValue("First line\nSecond line");
  await expect(items(page)).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(postButton(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(items(page)).toHaveCount(1);
  await expect(status).toHaveText("Comment posted");
  await expect(box(page)).toBeFocused();
  await expect(box(page)).toHaveValue("");

  await page.keyboard.insertText("a".repeat(1001));
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(section(page).getByRole("alert")).toContainText(MESSAGE);
  await expect(box(page)).toHaveAccessibleDescription(new RegExp(MESSAGE.replace(/\./g, "\\.")));
  await expect(box(page)).toBeFocused();
  await expect(items(page)).toHaveCount(1);
});

test("TEST-190 / AC-159: a long word fits three widths and axe finds no serious violation", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  const id = await createDraftViaUi(page, uniqueName("Comment layout"));
  await addViaApi(page, id, "a".repeat(1000));
  await addViaApi(page, id, Array.from({ length: 40 }, (_, i) => `Line ${i + 1}`).join("\n"));
  await submitViaUi(page);

  async function check(label: string) {
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.reload();
      await expect(items(page)).toHaveCount(2);
      const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(scroll, `${label} width ${width}`).toBeLessThanOrEqual(client);
    }
    const result = await new AxeBuilder({ page }).include("section[aria-label='Comments']").analyze();
    expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  }

  await expect(box(page)).toBeVisible();
  await check("form");
  await logout(page);
  await loginAs(page, ACCOUNTS.admin);
  await page.goto(`/requests/${id}`);
  await expect(items(page)).toHaveCount(2);
  await expect(section(page).getByRole("textbox")).toHaveCount(0);
  await check("read only");
});
