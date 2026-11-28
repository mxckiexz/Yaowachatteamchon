// Builds the Lab 6 UAT report PDF for the SerWongSerWay partner team.
//   node scripts/build-lab6-uat-report.mjs
// Source: docs/labs/lab-06/uat-report-serwongserway.md (images are resolved relative to docs/labs/lab-06).
// A line of the form {{file:relative/path.txt}} is replaced with that file's contents as a code block.
// Output: docs/labs/lab-06/uat-report-serwongserway.pdf
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { chromium } from "@playwright/test";

const DIR = path.resolve("docs/labs/lab-06");
const SRC = path.join(DIR, "uat-report-serwongserway.md");
const OUT_PDF = path.join(DIR, "uat-report-serwongserway.pdf");
const OUT_HTML = path.join(DIR, "_uat-report.html");

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Newlines become &#10; so a blank line inside the file cannot end the HTML block in Markdown.
const filePre = (rel) => `<pre>${escape(fs.readFileSync(path.join(DIR, rel), "utf8")).replace(/\n/g, "&#10;")}</pre>`;
// A bold caption line followed by images or a {{file:...}} block becomes one <figure>,
// so a caption is never left at the bottom of a page while its image starts the next one.
const source = fs
  .readFileSync(SRC, "utf8")
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

const html = `<!doctype html><html><head><meta charset="utf-8"><title>UAT report: SerWongSerWay</title><style>
@page { size: A4; margin: 15mm 14mm; }
body { font: 10pt/1.5 "Sukhumvit Set", Thonburi, Helvetica, Arial, sans-serif; color: #000; background: #fff; }
h1 { font-size: 15pt; margin: 0 0 8pt; }
h1:not(:first-of-type) { page-break-before: always; }
h2 { font-size: 12.5pt; margin: 14pt 0 5pt; }
h3 { font-size: 11pt; margin: 10pt 0 4pt; }
table { border-collapse: collapse; width: 100%; margin: 5pt 0 9pt; font-size: 8.6pt; }
th, td { text-align: left; vertical-align: top; padding: 2.5pt 5pt; border: 0.5pt solid #555; }
th { background: #f0f0f0; }
tr { page-break-inside: avoid; }
pre { font: 7.8pt/1.35 Menlo, monospace; white-space: pre-wrap; border: 0.5pt solid #999; padding: 5pt; page-break-inside: avoid; }
code { font: 8.5pt Menlo, monospace; }
p { margin: 4pt 0; }
img { display: block; max-width: 100%; max-height: 105mm; margin: 3pt 0 8pt; border: 0.5pt solid #999; page-break-inside: avoid; }
figure { margin: 6pt 0 10pt; break-inside: avoid; page-break-inside: avoid; }
figcaption { font-weight: bold; margin-bottom: 3pt; }
figure img + img { margin-top: 4pt; }
</style></head><body>${marked.parse(source, { gfm: true })}</body></html>`;
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
    '<div style="font:7.5pt Helvetica,Arial,sans-serif;width:100%;text-align:center;color:#444">UAT report: SerWongSerWay Sprint 1 · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  margin: { top: "15mm", bottom: "15mm", left: "14mm", right: "14mm" },
});
await browser.close();
fs.rmSync(OUT_HTML);
console.log(`Wrote ${path.relative(process.cwd(), OUT_PDF)}`);
