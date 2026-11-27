import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, loginAs, logout } from "../helpers/accounts";
import { ORIGIN, createDraftViaUi, submitViaUi, uniqueName } from "../helpers/requests";

// Synthetic files: only the first bytes matter to the type check.
const PDF = Buffer.from("%PDF-1.4\n% synthetic test file\n");
const pdfFile = (name: string) => ({ name, mimeType: "application/pdf", buffer: PDF });

const section = (page: Page) => page.getByRole("region", { name: "Attachments" });
const rows = (page: Page) => section(page).getByRole("listitem");

async function addViaApi(page: Page, requestId: number, name: string) {
  const res = await page.request.post(`/api/requests/${requestId}/attachments`, {
    headers: { Origin: ORIGIN, "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(name) },
    data: PDF,
  });
  expect(res.status()).toBe(201);
}

async function uploadViaUi(page: Page, name: string) {
  await section(page).getByLabel("Add attachment").setInputFiles(pdfFile(name));
  await section(page).getByRole("button", { name: "Upload" }).click();
}

test("TEST-164 / AC-133: a file name with HTML characters is shown as text", async ({ page }) => {
  let dialogs = 0;
  page.on("dialog", async (dialog) => {
    dialogs += 1;
    await dialog.dismiss();
  });
  await loginAs(page, ACCOUNTS.requester);
  const id = await createDraftViaUi(page, uniqueName("Attachment text"));
  const name = "<img src=x onerror=alert(1)>';--.pdf";
  await addViaApi(page, id, name);
  await page.reload();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText(name);
  await expect(section(page).locator("img")).toHaveCount(0);
  expect(dialogs).toBe(0);
});

test("TEST-167 / AC-136: the owner uploads, keeps and deletes a file", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await createDraftViaUi(page, uniqueName("Attachment owner"));
  await expect(section(page).getByText("No attachments.")).toBeVisible();
  await expect(section(page).getByRole("button", { name: "Upload" })).toBeDisabled();
  await uploadViaUi(page, "quotation.pdf");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("quotation.pdf");
  await expect(rows(page).first()).toContainText("Ploy");
  await expect(section(page).getByRole("button", { name: "Upload" })).toBeDisabled();

  await section(page).getByRole("button", { name: "Delete quotation.pdf" }).click();
  await expect(section(page).getByText("Delete quotation.pdf?")).toBeVisible();
  await section(page).getByRole("button", { name: "Keep file" }).click();
  await expect(rows(page)).toHaveCount(1);
  await page.reload();
  await expect(rows(page)).toHaveCount(1);

  await section(page).getByRole("button", { name: "Delete quotation.pdf" }).click();
  await section(page).getByRole("button", { name: "Confirm delete" }).click();
  await expect(section(page).getByText("No attachments.")).toBeVisible();
  await page.reload();
  await expect(section(page).getByText("No attachments.")).toBeVisible();
});

test("TEST-168 / AC-137: read-only views have Download and no add or delete", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  const id = await createDraftViaUi(page, uniqueName("Attachment read only"));
  await uploadViaUi(page, "evidence.pdf");
  await expect(rows(page)).toHaveCount(1);
  await submitViaUi(page);

  async function expectReadOnly() {
    await expect(section(page).getByRole("link", { name: "Download evidence.pdf" })).toBeVisible();
    await expect(section(page).getByLabel("Add attachment")).toHaveCount(0);
    await expect(section(page).getByRole("button", { name: "Upload" })).toHaveCount(0);
    await expect(section(page).getByRole("button", { name: /^Delete/ })).toHaveCount(0);
  }
  await expectReadOnly();
  await logout(page);
  for (const account of [ACCOUNTS.approver, ACCOUNTS.admin]) {
    await loginAs(page, account);
    await page.goto(`/requests/${id}`);
    await expectReadOnly();
    await logout(page);
  }
});

test("TEST-169 / AC-138: loading, load error with Retry, action error and the 5-file limit", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  const id = await createDraftViaUi(page, uniqueName("Attachment states"));

  let fail = true;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**/api/requests/${id}/attachments`, async (route) => {
    if (route.request().method() !== "GET" || !fail) return route.continue();
    await gate;
    await route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Something went wrong."}' });
  });
  await page.reload();
  await expect(section(page).getByText("Loading attachments...")).toBeVisible();
  release();
  await expect(section(page).getByText("Unable to load attachments.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit request" })).toBeVisible();
  fail = false;
  await section(page).getByRole("button", { name: "Retry" }).click();
  await expect(section(page).getByText("No attachments.")).toBeVisible();

  await uploadViaUi(page, "first.pdf");
  await expect(rows(page)).toHaveCount(1);
  await section(page).getByLabel("Add attachment").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await section(page).getByRole("button", { name: "Upload" }).click();
  await expect(section(page).getByRole("alert")).toContainText("Only PDF, PNG or JPG files are allowed");
  await expect(rows(page)).toHaveCount(1);
  // A file over the limit gets the server's answer in a real browser.
  const tooLarge = Buffer.alloc(5 * 1024 * 1024 + 1, 0x61);
  PDF.copy(tooLarge);
  await section(page).getByLabel("Add attachment").setInputFiles({ name: "big.pdf", mimeType: "application/pdf", buffer: tooLarge });
  await section(page).getByRole("button", { name: "Upload" }).click();
  await expect(section(page).getByRole("alert")).toContainText("The file is larger than 5 MB.");
  await expect(rows(page)).toHaveCount(1);

  for (const n of [2, 3, 4, 5]) await addViaApi(page, id, `file-${n}.pdf`);
  await page.reload();
  await expect(rows(page)).toHaveCount(5);
  await expect(section(page).getByText("This request already has 5 attachments.")).toBeVisible();
  await expect(section(page).getByLabel("Add attachment")).toBeDisabled();
  await expect(section(page).getByRole("button", { name: "Upload" })).toBeDisabled();
});

test("TEST-170 / AC-139: upload, download and delete with the keyboard", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  await createDraftViaUi(page, uniqueName("Attachment keyboard"));
  await expect(section(page).getByText("No attachments.")).toBeVisible();

  const input = section(page).getByLabel("Add attachment");
  await input.focus();
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (await chooser).setFiles(pdfFile("keys.pdf"));
  await page.keyboard.press("Tab");
  await expect(section(page).getByRole("button", { name: "Upload" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(rows(page)).toHaveCount(1);
  await expect(section(page).getByRole("status")).toHaveText("Attachment uploaded");

  const link = section(page).getByRole("link", { name: "Download keys.pdf" });
  await link.focus();
  const downloading = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  expect((await downloading).suggestedFilename()).toBe("keys.pdf");

  await page.keyboard.press("Tab");
  const del = section(page).getByRole("button", { name: "Delete keys.pdf" });
  await expect(del).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(section(page).getByRole("button", { name: "Confirm delete" })).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(del).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(section(page).getByRole("status")).toHaveText("Attachment deleted");
  await expect(section(page).getByRole("heading", { name: "Attachments" })).toBeFocused();
});

test("TEST-171 / AC-140: long file names fit three widths and axe finds no serious violation", async ({ page }) => {
  await loginAs(page, ACCOUNTS.requester);
  const id = await createDraftViaUi(page, uniqueName("Attachment layout"));
  await addViaApi(page, id, `${"a".repeat(96)}.pdf`);

  async function check() {
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.reload();
      await expect(rows(page)).toHaveCount(1);
      const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(scroll, `width ${width}`).toBeLessThanOrEqual(client);
    }
    const result = await new AxeBuilder({ page }).include("section[aria-label='Attachments']").analyze();
    expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  }
  await check();
  await submitViaUi(page);
  await check();
});
