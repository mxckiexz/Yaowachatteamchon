// Builds the team's Lab 6 PDF (Product Team + UAT Team roles in one document).
//   node scripts/build-lab6-team-report.mjs
// Source: docs/labs/lab-06/lab6-report-purchaseflow.md (images are resolved relative to docs/labs/lab-06).
//   {{file:relative/path.txt}}  -> the file's contents as a code block
//   {{md:relative/path.md}}     -> another Markdown file, with every heading moved down one level
//   {{mark:ID}}                 -> an invisible marker; {{page:ID}} is replaced by the page it lands on
// Output: docs/labs/lab-06/lab6-report-purchaseflow.pdf
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { marked } from "marked";
import { chromium } from "@playwright/test";

const DIR = path.resolve("docs/labs/lab-06");
const SRC = path.join(DIR, "lab6-report-purchaseflow.md");
const OUT_PDF = path.join(DIR, "lab6-report-purchaseflow.pdf");
const OUT_HTML = path.join(DIR, "_lab6-report.html");

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Newlines become &#10; so a blank line inside the file cannot end the HTML block in Markdown.
const filePre = (rel) => `<pre>${escape(fs.readFileSync(path.join(DIR, rel), "utf8")).replace(/\n/g, "&#10;")}</pre>`;

function expand(text) {
  return text.replace(/^\{\{md:(.+?)\}\}$/gm, (_, rel) =>
    fs.readFileSync(path.join(DIR, rel), "utf8").replace(/^(#{1,5}) /gm, "#$1 ")
  );
}

function toHtml(markdown, pages) {
  const source = expand(markdown)
    .replace(/\{\{page:([A-Za-z0-9-]+)\}\}/g, (_, id) => String(pages[id] ?? "?"))
    .replace(/\{\{mark:([A-Za-z0-9-]+)\}\}/g, (_, id) => `<span class="mark">MARK-${id}-END</span>`)
    .replace(
      /^\*\*(.+?)\*\*\n\n((?:(?:!\[[^\]]*\]\([^)]+\)|\{\{file:[^}]+\}\})\n\n?)+)/gm,
      (_, caption, body) => {
        const items = body
          .trim()
          .split(/\n+/)
          .map((line) => {
            const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
            if (img) return `<img src="${img[2]}" alt="${escape(img[1])}">`;
            return filePre(line.match(/^\{\{file:(.+?)\}\}$/)[1]);
          });
        return `<figure><figcaption>${marked.parseInline(caption)}</figcaption>${items.join("")}</figure>\n\n`;
      }
    )
    .replace(/^\{\{file:(.+?)\}\}$/gm, (_, rel) => filePre(rel));

  return `<!doctype html><html><head><meta charset="utf-8"><title>Lab 6: PurchaseFlow</title><style>
@page { size: A4; margin: 15mm 14mm; }
body { font: 10pt/1.5 "Sukhumvit Set", Thonburi, Helvetica, Arial, sans-serif; color: #000; background: #fff; }
h1 { font-size: 15pt; margin: 0 0 8pt; }
h1:not(:first-of-type) { page-break-before: always; }
h2 { font-size: 12.5pt; margin: 14pt 0 5pt; }
h3 { font-size: 11pt; margin: 10pt 0 4pt; }
h4 { font-size: 10pt; margin: 8pt 0 3pt; }
table { border-collapse: collapse; width: 100%; margin: 5pt 0 9pt; font-size: 8.6pt; }
th, td { text-align: left; vertical-align: top; padding: 2.5pt 5pt; border: 0.5pt solid #555; }
th { background: #f0f0f0; }
tr { page-break-inside: avoid; }
pre { font: 7.6pt/1.35 Menlo, monospace; white-space: pre-wrap; border: 0.5pt solid #999; padding: 5pt; page-break-inside: avoid; }
code { font: 8.5pt Menlo, monospace; }
p { margin: 4pt 0; }
img { display: block; max-width: 100%; max-height: 105mm; margin: 3pt 0 8pt; border: 0.5pt solid #999; page-break-inside: avoid; }
figure { margin: 6pt 0 10pt; break-inside: avoid; page-break-inside: avoid; }
figcaption { font-weight: bold; margin-bottom: 3pt; }
figure img + img { margin-top: 4pt; }
.mark { font-size: 1pt; color: #fff; }
.pagebreak { page-break-after: always; }
</style></head><body>${marked.parse(source, { gfm: true })}</body></html>`;
}

async function render(html) {
  fs.writeFileSync(OUT_HTML, html);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("file://" + OUT_HTML);
  await page.pdf({
    path: OUT_PDF,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate:
      '<div style="font:7.5pt Helvetica,Arial,sans-serif;width:100%;text-align:center;color:#444">Lab 6 Sprint 1 UAT: PurchaseFlow (Yaowachatteamchon) · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    margin: { top: "15mm", bottom: "15mm", left: "14mm", right: "14mm" },
  });
  await browser.close();
}

// Finds the page each marker landed on (pdftotext separates pages with a form feed).
function findPages() {
  const text = execFileSync("pdftotext", [OUT_PDF, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const pages = {};
  text.split("\f").forEach((pageText, i) => {
    for (const m of pageText.matchAll(/MARK-([A-Za-z0-9-]+?)-END/g)) pages[m[1]] ??= i + 1;
  });
  return pages;
}

const markdown = fs.readFileSync(SRC, "utf8");
await render(toHtml(markdown, {}));
let pages = findPages();
await render(toHtml(markdown, pages));
const again = findPages();
if (JSON.stringify(again) !== JSON.stringify(pages)) {
  pages = again;
  await render(toHtml(markdown, pages));
}
fs.rmSync(OUT_HTML);
console.log(`Wrote ${path.relative(process.cwd(), OUT_PDF)}`, JSON.stringify(pages));
