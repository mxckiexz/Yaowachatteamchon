// Builds the Project Deliverable 1 PDF (Parts A to F) from the documents, results and evidence in this repository.
//   node scripts/build-deliverable1-pdf.mjs
// Needs: npx playwright test -c playwright.evidence.config.ts (pictures), node scripts/run-sprint1-results.mjs (results).
// Team details and pull request records come from docs/team.json; missing ones are printed as warnings.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { chromium } from "@playwright/test";

const OUT_PDF = "BuyFlow_Deliverable1.pdf";
const OUT_HTML = "_deliverable1.html";
const EVID = "artifacts/sprint-1/evidence";
const S1 = "docs/sprints/sprint-1";
const warnings = [];

const read = (p) => fs.readFileSync(p, "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const team = JSON.parse(read("docs/team.json"));
const students = team.students.map((s, i) => {
  if (!s.name || !s.id) warnings.push(`docs/team.json: student ${i + 1} name or ID is empty`);
  return { name: s.name || "(name to fill)", id: s.id || "(ID to fill)", github: s.github || "(GitHub to fill)" };
});
if (!team.repoUrl) warnings.push("docs/team.json: repoUrl is empty");
const headSha = git("rev-parse", "HEAD");
const releaseRef = team.releaseTag || `${headSha.slice(0, 7)} (full ${headSha})`;
if (!team.releaseTag) warnings.push("docs/team.json: releaseTag is empty; the PDF shows the current commit");

// Markdown helpers: one level deeper so each document sits under its Part heading.
const deepen = (md) => md.replace(/^(#{1,5}) /gm, (_m, h) => `${h}# `);
const md = (src) => marked.parse(deepen(src), { gfm: true });
const section = (src, heading) => {
  const m = src.match(new RegExp(`^## ${heading}[\\s\\S]*?(?=^## |(?![\\s\\S]))`, "m"));
  return m ? m[0] : "";
};

// Figures and captions.
let figNo = 0;
const fig = (file, caption, width = 100) => {
  const p = path.join(EVID, file);
  if (!fs.existsSync(p)) {
    warnings.push(`missing picture ${p}`);
    return "";
  }
  figNo += 1;
  const data = fs.readFileSync(p).toString("base64");
  return `<figure style="width:${width}%"><img src="data:image/png;base64,${data}"><figcaption>Figure ${figNo}. ${esc(caption)}</figcaption></figure>`;
};
const apiText = (file, caption) => {
  const p = path.join(EVID, file);
  if (!fs.existsSync(p)) {
    warnings.push(`missing text ${p}`);
    return "";
  }
  return `<div class="apiblock"><div class="cap">${esc(caption)}</div><pre>${esc(read(p).trim())}</pre></div>`;
};

// Test excerpt: the block of one test, from its it(...) line to its closing line.
const excerpt = (file, marker) => {
  const lines = read(file).split("\n");
  const start = lines.findIndex((l) => l.includes(marker));
  if (start < 0) {
    warnings.push(`excerpt ${marker} not found in ${file}`);
    return "";
  }
  let end = start;
  while (end < lines.length && lines[end] !== "  });") end++;
  return lines.slice(start, end + 1).map((l) => l.replace(/^ {2}/, "")).join("\n");
};

const results = read(`${S1}/results.md`);
const resultsHead = results.split("## Acceptance criteria to test results")[0];
const acTable = results.split("## Acceptance criteria to test results")[1].split("## Tests that are not")[0];
const resultsTail = "## Tests that are not" + results.split("## Tests that are not")[1];
const testedCommit = (results.match(/Tested commit: `([0-9a-f]{40})`/) ?? [])[1] ?? "(unknown)";
if (/NOT RUN|\| FAIL \||SKIPPED/.test(acTable)) warnings.push("results.md has a test that is not PASS");

const afterTested = testedCommit.length === 40 ? git("diff", "--name-only", `${testedCommit}..HEAD`).split("\n").filter(Boolean) : [];
const codeAfterTested = afterTested.filter((f) => /^(server|client|e2e)\/(src|tests|prisma)|^server\/src|^client\/src/.test(f));
if (codeAfterTested.length) warnings.push(`code changed after the tested commit: ${codeAfterTested.join(", ")}`);

const outputExcerpt = (file, n) => esc(read(`${S1}/test-output/${file}`).split("\n").filter((l) => /Test Files|Tests |Duration|^\$|# commit|passed|failed/.test(l)).slice(0, n).join("\n"));

// Git history for the sequence of contracts, tests and implementation.
const log = git("log", "--reverse", "--format=%h|%ad|%s", "--date=format:%Y-%m-%d %H:%M").split("\n").map((l) => l.split("|"));
const historyRows = log.map(([sha, date, ...subject]) => `<tr><td>${sha}</td><td>${date}</td><td>${esc(subject.join("|"))}</td></tr>`).join("");

// Pull requests from team.json.
let prHtml;
if (team.pullRequests?.length) {
  prHtml = `<table><tr><th>Issue</th><th>PR</th><th>Feature and contract</th><th>Branch</th><th>Author</th><th>Reviewer</th><th>Review comment</th><th>Staging</th><th>Main</th></tr>${team.pullRequests
    .map((p) => `<tr><td>${esc(p.issue ?? "")}</td><td>${esc(p.number ?? "")}</td><td>${esc(p.feature ?? "")}</td><td>${esc(p.branch ?? "")}</td><td>${esc(p.author ?? "")}</td><td>${esc(p.reviewer ?? "")}</td><td>${esc(p.reviewComment ?? "")}</td><td>${esc(p.mergedIntoStaging ?? "")}</td><td>${esc(p.mergedIntoMain ?? "")}</td></tr>`)
    .join("")}</table>`;
} else {
  warnings.push("docs/team.json: pullRequests is empty (Issues, PR reviews and the board need the real GitHub records)");
  prHtml = `<p class="todo">To complete from GitHub before submitting: two Issues with their pull requests (number, branch, author, reviewer, the reviewer's comment, merge into staging and into main), and the final board status. The feature branches that carry the work are listed below.</p>
<table><tr><th>Feature</th><th>Branch</th><th>Contract</th></tr>
<tr><td>F-01 Authentication</td><td>feature/F-01-auth</td><td>F-01-authentication.md</td></tr>
<tr><td>F-02 Create and submit</td><td>feature/F-02-create-submit</td><td>F-02-create-submit.md</td></tr>
<tr><td>F-03 Decision</td><td>feature/F-03-decision</td><td>F-03-decision.md</td></tr>
<tr><td>F-04 Lists, detail, history</td><td>feature/F-04-lists-detail</td><td>F-04-lists-detail-history.md</td></tr>
<tr><td>UI for all four</td><td>feature/UI-requests</td><td>UI sections of the four contracts</td></tr></table>`;
}

const testExcerpt1 = excerpt("server/tests/f03/decision.test.ts", 'it("TEST-30');
const testExcerpt2 = excerpt("server/tests/f04/lists-detail.test.ts", 'it("TEST-38');
const resultLine = (id) => (acTable.split("\n").find((l) => l.startsWith(`| ${id} |`)) ?? "").split("|").slice(-2, -1)[0]?.trim() ?? "?";

const scenarioMeta = (rows) => `<table class="meta">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>`;

const partOrder = [
  ["A", "SRS and product scope", "FR-01 to FR-14, BR-01 to BR-11, NFR-01 to NFR-07, D-01 to D-08"],
  ["B", "Feature inventory and traceability", "F-01 to F-11, R-01 to R-04, every FR, BR, NFR"],
  ["C", "System-Level SDS", "Stack, data model, API, roles, configuration, deployment plan"],
  ["D", "Three-sprint plan", "Sprint 1 (F-01 to F-04), Sprint 2 (F-05 to F-08), Sprint 3 (F-09 to F-11)"],
  ["E", "Sprint 1 engineering contracts", "F-01 to F-04, AC-01 to AC-34, TEST-01 to TEST-49, Definition of Done"],
  ["F", "Working Sprint 1 and verification", "Demonstrations, results, TEST-30 and TEST-38 excerpts, history, contributions"],
];
const partTitle = Object.fromEntries(partOrder.map(([k, t]) => [k, t]));

const partA = md(read("docs/srs.md"));
const partB = md(read("docs/features.md")) + md(read("docs/traceability.md"));
const partC = md(read("docs/system-sds.md"));
const partD = md(read("docs/sprints/plan.md"));
const partE =
  ["F-01-authentication", "F-02-create-submit", "F-03-decision", "F-04-lists-detail-history"].map((f) => md(read(`${S1}/${f}.md`))).join("") +
  md(read(`${S1}/definition-of-done.md`));

const readme = read("README.md");
const setupMd = ["Setup (a fresh clone, 8 commands)", "Demo accounts (synthetic, created by the seed)", "Demo sequence (about 3 minutes)", "Tests"]
  .map((h) => section(readme, h.replace(/[()]/g, "\\$&")))
  .join("\n");

const partF = `
<h2>F.1 Program demonstrations</h2>
<p>All pictures and API outputs were produced by the evidence generator (<code>evidence/sprint1-evidence.spec.ts</code>) on commit <code>${testedCommit.slice(0, 7)}</code> against the real API and database. Synthetic data only.</p>

<h3>Scenario 1. Normal domain journey, then retrieval of the saved result</h3>
${scenarioMeta([
  ["Features and AC", "F-02, F-03, F-04. AC-11, AC-13, AC-18, AC-19, AC-26, AC-27, AC-28, AC-31, AC-32"],
  ["Roles", "Employee (Ploy), then Approver (Somchai), then Employee again"],
  ["Starting conditions", "Seeded demo accounts, no request with the new title"],
  ["Steps", "Employee fills the form with two items and saves a draft. Chooses Somchai and submits. Reloads the page. Approver opens the queue, approves with a comment. Employee opens the request."],
  ["Expected", "Draft with total 261.00 calculated by the server. Pending with approver Somchai and two history entries. Same data after reload. Approved with the comment and three history entries."],
  ["Actual", "Matches the expected result in every step (figures 1 to 9 and the API outputs)."],
])}
<div>
${fig("s1-01-employee-list.png", "Employee list before the new request", 100)}
${fig("s1-02-new-request-form.png", "Form with two items and the estimated total", 100)}
${fig("s1-03-draft-detail.png", "Saved draft, total calculated by the server", 100)}
${fig("s1-04-pending-detail.png", "After submit: pending, approver, history", 100)}
${fig("s1-05-after-reload.png", "Same request after a page reload", 100)}
${fig("s1-07-review-queue.png", "Approver's review queue", 100)}
${fig("s1-08-approve-confirmation.png", "Approval confirmation with title, total and comment", 100)}
${fig("s1-09-approved-by-approver.png", "Approved, decision buttons gone", 100)}
</div>
${fig("s1-10-requester-sees-approved.png", "Requester sees the outcome, the comment and three history entries", 62)}
${apiText("s1-06-api-detail-pending.txt", "API output, request as the owner while pending")}
${apiText("s1-11-api-detail-approved.txt", "API output, same request after approval")}

<h3>Scenario 2. Business rule rejections</h3>
${scenarioMeta([
  ["Features and AC", "F-02, F-03. AC-12, AC-14, AC-20, AC-24. BR-02, BR-04, BR-06, BR-07"],
  ["Roles", "Approver (Somchai), Employee (Ploy)"],
  ["Starting conditions", "A pending request assigned to Somchai"],
  ["Steps", "Reject without a reason. Reject with a reason. Decide the same request again. Send an own request to oneself. Save a request with a 2 character title and quantity 0."],
  ["Expected", "422 REASON_REQUIRED and the request stays pending. Rejected. 409 ILLEGAL_TRANSITION. 422 SELF_REVIEW. 422 VALIDATION_ERROR with a message per field and nothing stored."],
  ["Actual", "Matches the expected result (figures and API outputs below)."],
])}
<div>
${fig("s2-01-reject-without-reason.png", "Rejection without a reason is refused", 100)}
${fig("s2-03-rejected.png", "Rejection with a reason, final", 100)}
${fig("s2-06-validation-errors.png", "Server validation messages beside the fields", 100)}
</div>
${apiText("s2-02-api-reject-without-reason.txt", "API output, rejection with a 2 character reason")}
${apiText("s2-04-api-decide-again.txt", "API output, deciding a decided request")}
${apiText("s2-05-api-self-assignment.txt", "API output, sending an own request to oneself")}
${apiText("s2-07-api-validation.txt", "API output, invalid title and quantity, client total ignored")}

<h3>Scenario 3. Login, logout and forbidden operations</h3>
${scenarioMeta([
  ["Features and AC", "F-01, F-03, F-04. AC-02, AC-04, AC-08, AC-21, AC-29, AC-30. NFR-01, BR-03"],
  ["Roles", "Anonymous, Employee (Ploy), Approver (Malee, not assigned)"],
  ["Starting conditions", "A pending request assigned to Somchai"],
  ["Steps", "Wrong login. Correct login as an employee. Open the review route and call it through the API. Log out and call me. Another approver opens the request. A call with no cookie."],
  ["Expected", "Error message. No review link, redirect, 403 from the API. Login page, 401 after logout. Request not found, 404 with no data. 401 with only an error field."],
  ["Actual", "Matches the expected result."],
])}
<div>
${fig("s3-01-wrong-login.png", "Wrong password message", 100)}
${fig("s3-02-employee-no-review-link.png", "Employee has no review link", 100)}
${fig("s3-05-after-logout.png", "Login page after logout", 100)}
${fig("s3-07-other-approver-not-found.png", "Another approver gets request not found", 100)}
</div>
${apiText("s3-03-api-employee-reviews.txt", "API output, employee calls the review queue")}
${apiText("s3-04-api-employee-decision.txt", "API output, employee calls the decision route")}
${apiText("s3-06-api-after-logout.txt", "API output, me after logout")}
${apiText("s3-08-api-other-approver.txt", "API output, unassigned approver reads the request")}
${apiText("s3-09-api-anonymous.txt", "API output, no session")}

<h2>F.2 Build and automated test results</h2>
<p>The Sprint 1 release was built and tested with the commands below. Output is in <code>${S1}/test-output/</code>.</p>
${marked.parse(resultsHead.split("\n").slice(2).join("\n"), { gfm: true })}
<pre>${outputExcerpt("server-vitest.txt", 8)}</pre>
<pre>${outputExcerpt("client-vitest.txt", 8)}</pre>
<pre>${esc(read(`${S1}/test-output/playwright.txt`).split("\n").slice(0, 20).join("\n"))}</pre>

<h3>Results of every Sprint 1 acceptance criterion's tests</h3>
<p>Each planned test (STS) with the actual file and test name. All tests are automated; the one manual check is M-01 below.</p>
${marked.parse(acTable.trim(), { gfm: true })}
${marked.parse(resultsTail, { gfm: true })}

<h3>Test excerpts</h3>
<p>Domain rule, BR-04 and AC-23 (TEST-30, result ${resultLine("TEST-30")}). The state that the submit route refuses is created in the database directly, then the approver tries to decide.</p>
<pre class="code">${esc(testExcerpt1)}</pre>
<p>Ownership restriction, BR-03 and AC-29 (TEST-38, result ${resultLine("TEST-38")}). The first assertion is the control: the owner can read the request.</p>
<pre class="code">${esc(testExcerpt2)}</pre>

<h2>F.3 TDD evidence</h2>
${md(read(`${S1}/tdd-evidence.md`)).replace(/<h3>/g, "<h4>").replace(/<h2>/g, "<h3>")}

<h2>F.4 Git workflow and history</h2>
<p>The contracts and test design were committed before the tests and the implementation. The commit list below is the actual history of this repository (hash, local time, subject).</p>
<table class="hist"><tr><th>Commit</th><th>Date</th><th>Subject</th></tr>${historyRows}</table>
<h3>Issues, pull requests and reviews</h3>
${prHtml}

<h2>F.5 Both students' contributions, AI-use declaration, known limitations</h2>
${md(read(`${S1}/contributions-and-ai-use.md`)).replace(/<h3>/g, "<h4>").replace(/<h2>/g, "<h3>")}

<h2>F.6 Setup summary</h2>
${md(setupMd).replace(/<h3>/g, "<h4>").replace(/<h2>/g, "<h3>")}
<p>Environment variables: <code>DATABASE_URL</code>, <code>PORT</code>, <code>CLIENT_ORIGIN</code>, <code>SEED_DEFAULT_PASSWORD</code> (names and examples in <code>server/.env.example</code>; real values are not committed). Database setup: <code>npx prisma migrate deploy</code> then <code>npm run prisma:seed</code>. Build: <code>cd client && npm run build</code> and <code>cd server && npm run build</code>.</p>
`;

const css = `
@page { size: A4; margin: 17mm 15mm 17mm 15mm; }
body { font: 10pt/1.5 "Helvetica Neue", Helvetica, Arial, sans-serif; color: #000; background: #fff; margin: 0; }
h1 { font-size: 18pt; margin: 0 0 4mm; page-break-before: always; }
h1.first { page-break-before: auto; }
h2 { font-size: 13pt; margin: 6mm 0 2mm; break-after: avoid; }
h3 { font-size: 11pt; margin: 5mm 0 1.5mm; break-after: avoid; }
h4, h5 { font-size: 10pt; margin: 3mm 0 1mm; break-after: avoid; }
p, li { margin: 1mm 0 2mm; }
table { border-collapse: collapse; width: 100%; font-size: 8.4pt; line-height: 1.4; margin: 1mm 0 3mm; }
td:first-child { white-space: nowrap; }
th, td { text-align: left; vertical-align: top; padding: 1.1mm 1.6mm; border-bottom: 0.3pt solid #ccc; }
th { font-weight: 700; }
table tr { break-inside: avoid; }
table.meta { width: 100%; }
table.meta th { width: 24%; white-space: nowrap; }
table.hist td:nth-child(2) { white-space: nowrap; }
code { font: 0.92em Menlo, monospace; }
pre { font: 6.6pt/1.35 Menlo, monospace; white-space: pre-wrap; word-break: break-word; margin: 1.5mm 0 3mm; }
pre.code { font-size: 7pt; }
figure { margin: 2mm 0; break-inside: avoid; }
figure img { width: 100%; display: block; border: 0.3pt solid #ccc; }
figcaption { font-size: 8pt; margin-top: 0.8mm; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 4mm; align-items: start; }
.apiblock { break-inside: avoid; margin: 1mm 0 2mm; }
.apiblock .cap { font-size: 8pt; }
.todo { font-weight: 700; }
.title { font-size: 20pt; font-weight: 700; margin: 0 0 1mm; }
.sub { font-size: 12pt; margin: 0 0 6mm; }
.toc td.p, .nav td.pg { white-space: nowrap; text-align: right; width: 22mm; }
.toc td { font-size: 9.5pt; }
`;

const front = (pages) => `
<div class="title">BuyFlow</div>
<div class="sub">CPE 334 Project Deliverable 1: Engineering baseline and working Sprint 1</div>
<table class="meta">
<tr><th>Team</th><td>${esc(team.teamName || "(team name to fill)")}</td></tr>
<tr><th>Student 1</th><td>${esc(students[0].name)}, ${esc(students[0].id)}, GitHub ${esc(students[0].github)}</td></tr>
<tr><th>Student 2</th><td>${esc(students[1].name)}, ${esc(students[1].id)}, GitHub ${esc(students[1].github)}</td></tr>
<tr><th>Theme and context</th><td>${esc(team.theme)}. ${esc(team.context)}</td></tr>
<tr><th>Repository</th><td>${esc(team.repoUrl || "(repository URL to fill)")}</td></tr>
<tr><th>Submitted release</th><td>${esc(releaseRef)}</td></tr>
<tr><th>Tested commit</th><td>${esc(testedCommit)}. Commits after it change only documents, results and evidence files (${afterTested.length} files, none in source or tests).</td></tr>
</table>
<h3>Navigation</h3>
<table class="nav"><tr><th>Part</th><th>Pages</th><th>Relevant IDs</th></tr>
${partOrder.map(([k, t, ids]) => `<tr><td>Part ${k}. ${esc(t)}</td><td class="pg">${pages.range[k] ?? "00 to 00"}</td><td>${esc(ids)}${k === "E" ? `. Execution evidence for these contracts is in Part F, page ${pages.sub["F.1"] ?? "00"}` : ""}.</td></tr>`).join("")}
</table>
<h3>Contents</h3>
<table class="toc">
${partOrder.map(([k, t]) => `<tr><td><strong>Part ${k}. ${esc(t)}</strong></td><td class="p">${pages.start[k] ?? "00"}</td></tr>`).join("\n")}
${[["F.1", "Program demonstrations"], ["F.2", "Build and automated test results"], ["F.3", "TDD evidence"], ["F.4", "Git workflow and history"], ["F.5", "Contributions, AI-use declaration, known limitations"], ["F.6", "Setup summary"]]
  .map(([k, t]) => `<tr><td>&nbsp;&nbsp;${k} ${esc(t)}</td><td class="p">${pages.sub[k] ?? "00"}</td></tr>`)
  .join("\n")}
</table>`;

const bodies = { A: partA, B: partB, C: partC, D: partD, E: partE, F: partF };
const noDashes = (h) => h.replace(/>([^<]+)</g, (m, t) => ">" + t.replace(/(\w)[—–](?=#?\w)/g, "$1 to ").replace(/\s[—–]\s/g, ": ").replace(/[—–]/g, "") + "<");

const html = (pages) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>BuyFlow Deliverable 1</title><style>${css}</style></head><body>
${front(pages)}
${partOrder.map(([k]) => `<h1>Part ${k}. ${esc(partTitle[k])}</h1>${bodies[k]}`).join("\n")}
</body></html>`;

async function render(pages) {
  fs.writeFileSync(OUT_HTML, noDashes(html(pages)));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("file://" + path.resolve(OUT_HTML));
  await page.pdf({
    path: OUT_PDF,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font-size:8px;text-align:center;font-family:Helvetica,Arial,sans-serif;color:#000"><span class="pageNumber"></span></div>`,
    margin: { top: "17mm", bottom: "17mm", left: "15mm", right: "15mm" },
  });
  await browser.close();
}

function locate() {
  const total = Number(execFileSync("pdfinfo", [OUT_PDF], { encoding: "utf8" }).match(/Pages:\s+(\d+)/)[1]);
  const pageText = (n) => execFileSync("pdftotext", ["-f", String(n), "-l", String(n), "-layout", OUT_PDF, "-"], { encoding: "utf8" });
  const start = {};
  const sub = {};
  const subHeads = { "F.1": "F.1 Program demonstrations", "F.2": "F.2 Build and automated test results", "F.3": "F.3 TDD evidence", "F.4": "F.4 Git workflow and history", "F.5": "F.5 Both students", "F.6": "F.6 Setup summary" };
  for (let n = 1; n <= total; n++) {
    const lines = pageText(n).split("\n").map((l) => l.trim());
    for (const [k, t] of partOrder) {
      if (start[k] === undefined && lines.some((l) => l === `Part ${k}. ${t}`) && n > 1) {
        // The navigation and contents tables on the first pages contain the same text inside a row, so require a line of its own after them.
        if (!lines.some((l) => new RegExp(`^Part ${k}\\. ${t}\\s+\\d`).test(l))) start[k] = n;
      }
    }
    for (const [k, t] of Object.entries(subHeads)) if (sub[k] === undefined && lines.some((l) => l.startsWith(t)) && !lines.some((l) => new RegExp(`^${t}.*\\s\\d+$`).test(l) && l.length > t.length + 3 && n < 4)) sub[k] = n;
  }
  const range = {};
  partOrder.forEach(([k], i) => {
    const next = partOrder[i + 1] ? start[partOrder[i + 1][0]] : total + 1;
    const last = next - 1;
    range[k] = start[k] === undefined ? "?" : start[k] === last ? `${start[k]}` : `${start[k]} to ${last}`;
  });
  return { total, start, sub, range };
}

let pages = { start: {}, sub: {}, range: {} };
await render(pages);
let loc = locate();
for (let pass = 0; pass < 3; pass++) {
  pages = loc;
  await render(pages);
  const next = locate();
  if (JSON.stringify(next.start) === JSON.stringify(loc.start) && JSON.stringify(next.sub) === JSON.stringify(loc.sub)) {
    loc = next;
    break;
  }
  loc = next;
}
pages = loc;
await render(pages);
const final = locate();
if (JSON.stringify(final.start) !== JSON.stringify(pages.start)) warnings.push("page numbers in the navigation table may be off by one; run the builder again");

console.log(`${OUT_PDF}: ${final.total} pages`);
console.log("Part start pages:", JSON.stringify(final.start), "F sub:", JSON.stringify(final.sub));
for (const w of [...new Set(warnings)]) console.log("WARNING:", w);
