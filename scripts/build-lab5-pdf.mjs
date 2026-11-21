// Builds the Lab 5 evidence PDF from docs/labs/lab-05/evidence-index.md.
//   node scripts/build-lab5-pdf.mjs --section 1
// Output: lab5_sec<section>_yaowachatteamchon.pdf (git-ignored). Lines that still say TO FILL are counted and printed:
// the PDF must not be submitted while that count is above zero.
import fs from "node:fs";
import { marked } from "marked";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const sIdx = args.indexOf("--section");
const section = sIdx >= 0 ? args[sIdx + 1] : "SECTION";
const SRC = "docs/labs/lab-05/evidence-index.md";
const OUT_PDF = `lab5_sec${section}_yaowachatteamchon.pdf`;
const OUT_HTML = "_lab5.html";

const source = fs.readFileSync(SRC, "utf8");
const todo = source.split("\n").filter((l) => l.includes("TO FILL"));
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Lab 5</title><style>
@page { size: A4; margin: 17mm 15mm 17mm 15mm; }
body { font: 10.5pt/1.45 Helvetica, Arial, sans-serif; color: #000; background: #fff; }
h1 { font-size: 15pt; margin: 18pt 0 6pt; page-break-before: always; }
h1:first-of-type { page-break-before: auto; }
h2 { font-size: 12pt; margin: 14pt 0 4pt; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 9.5pt; }
th, td { text-align: left; vertical-align: top; padding: 3pt 8pt 3pt 0; }
th { font-weight: bold; }
tr { page-break-inside: avoid; }
pre { font: 8.5pt/1.35 Menlo, monospace; white-space: pre-wrap; margin: 6pt 0; }
code { font: 9pt Menlo, monospace; }
p { margin: 5pt 0; }
a { color: #000; word-break: break-all; }
</style></head><body>${marked.parse(source, { gfm: true })}</body></html>`;
fs.writeFileSync(OUT_HTML, html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file://" + process.cwd() + "/" + OUT_HTML);
await page.pdf({
  path: OUT_PDF,
  format: "A4",
  printBackground: false,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: '<div style="font:8pt Helvetica,Arial,sans-serif;width:100%;text-align:center;color:#000"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  margin: { top: "17mm", bottom: "17mm", left: "15mm", right: "15mm" },
});
await browser.close();
fs.rmSync(OUT_HTML);
console.log(`Wrote ${OUT_PDF}`);
if (todo.length) console.log(`NOT READY: ${todo.length} line(s) still say TO FILL. Do not submit yet.`);
else console.log("No TO FILL lines left.");
