# PurchaseFlow QA defect log and known limitations (Sprint 1)

QA here means checking quality as a whole: every Definition of Done item is checked against evidence, and every defect found is written down, fixed or disclosed. Dates are 2026-11-15 unless stated. The earlier design (tag `archive/buyflow-v1`) was built and tested first; the defects it taught us about are listed at the end because the 2.0 code was written with them in mind.

## Defects found while building version 2.0

| ID | Found by | Defect | Severity | Fixed in | Re-test |
|---|---|---|---|---|---|
| DEF-01 | TEST-20 (both maxima together), red phase of F-02 | A request with 1000 items at 1,000,000 baht has a total of 100,000,000,000 satang, which does not fit the 32-bit integer of the first schema. The earlier design had the same latent defect and had never tested the two maxima together. | Medium (a valid request would fail with a server error) | Migration `total_bigint` and BigInt handling in `d001caa` | TEST-20 passes |
| DEF-02 | Review of the red run of F-03 | TEST-43 passed before the feature existed (a missing route also answers 404), so it proved nothing. | Low (weak test) | A control was added: the approver can approve a submitted request first | Red run repeated (10 failed), then green |
| DEF-03 | A browser test run (environment, not the product) | Playwright reused a development server that was still running from the earlier design, with the old database, and every login answered "Something went wrong". | Low (test environment) | The old servers were stopped; the README now tells the reader to stop anything on ports 3000 and 5173 first | Browser tests pass |

## Checks that passed on the first run

SQL metacharacters (TEST-80), server-owned fields in a body (TEST-81), forged cookies (TEST-82), oversized body (TEST-83), cookie attributes (TEST-84), protective headers and no technology header (TEST-85), HTML and script in text (TEST-86), accessibility rules of axe-core on the screens of all three roles (TEST-87), no sideways scrolling at 1280, 768 and 375 px and keyboard login (TEST-88), list speed with 200 requests (TEST-89, median about 6 ms on the development machine), 70 simultaneous calls (TEST-90), the journey through all features (TEST-91) and client helpers (TEST-92). They are checks that the behavior is right; they did not go through a red run.

## Lessons from the earlier design that are built in

The earlier design (BuyFlow) found these defects, which the 2.0 code avoids from the start: the README setup stopped at the seed step because `tsx` did not read `server/.env`, and the test configuration did not load it either (the 2.0 scripts load it); a session cookie with a null byte made the API answer 500 (the 2.0 code accepts only UUID session ids); the API announced `X-Powered-By: Express` and sent no protective headers; list tables made the page wider than a 375 px screen.

## Known limitations (not fixed, disclosed)

| ID | Limitation | Impact | Planned |
|---|---|---|---|
| LIM-01 | No limit on login attempts (no rate limiting, no lockout) | Passwords can be guessed by repeated tries | Sprint 3 hardening |
| LIM-02 | No Content-Security-Policy, HSTS or other advanced headers | Weaker defence in depth | Lab 5 deployment (headers on the web server) |
| LIM-03 | No real load test. TEST-90 sends 70 simultaneous calls from one process; it says nothing about 500 users, and the speed numbers come from one local machine | Capacity is unknown | A load tool against the deployed system after Lab 5, if required |
| LIM-04 | No professional penetration test; the security checks are automated and written by the team | Unknown holes may exist | Not planned |
| LIM-05 | No UAT yet (cases are prepared in `docs/uat/uat-cases.md`) | Real-user fit is unproven | Lab 6 |
| LIM-06 | Accessibility is checked by rules (axe-core), keyboard and three-width tests only. Rules catch part of the problems; no screen reader or usability test with people | Some barriers may remain | Sprint 2 and 3 |
| LIM-07 | "Looks good and is easy to understand" is not tested automatically | Subjective quality unknown | UAT in Lab 6 |
| LIM-08 | A deactivated user's open page keeps showing until it calls the API (the next call answers 401) | A short delay in the browser, none on the server | Sprint 2 |
