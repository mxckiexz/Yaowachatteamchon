# BuyFlow QA defect log and known limitations (Sprint 1)

QA here means checking quality as a whole: every Definition of Done item is checked against evidence, and every defect found is written down, fixed or disclosed. Dates are 2026-11-15 unless stated.

## Defects found and fixed

| ID | Found by | Defect | Severity | Fixed in | Re-test |
|---|---|---|---|---|---|
| DEF-01 | Clean setup run (M-01) | The README setup stopped at the seed step: `tsx` did not read `server/.env`, so the demo password was missing. An earlier setup check had exported the variables by hand and missed it. | Medium (setup blocked) | Seed and dev scripts load `.env`; the test config loads it too | M-01 repeated literally, PASS |
| DEF-02 | Review of the setup text | The README said the setup was 8 commands; it was 10. | Low | README reduced to 7 commands | M-01 |
| DEF-03 | Review of the red run of F-04 | TEST-38 passed before the feature existed (a missing route also answers 404), so it proved nothing. | Low (weak test) | Test now checks that the owner can read the request first | Red run repeated: 7 failed, then green |
| DEF-04 | TEST-52 (forged cookie) | A session cookie containing a null byte (`%00`) made the API answer 500. | Medium (server error from outside input) | Session ids must be UUIDs before any lookup | TEST-52 passes |
| DEF-05 | TEST-55 | The API announced `X-Powered-By: Express` and sent no protective headers. | Low | `X-Powered-By` removed; `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` added | TEST-55 passes |
| DEF-06 | TEST-58 | On a 375 px screen the request list was 516 px wide and the review screen 410 px, so the page scrolled sideways. | Medium (usability on phones) | Tables scroll inside their own box; the navigation bar wraps | TEST-58 passes |

## Checks that passed on the first run

SQL metacharacters (TEST-50), server-owned fields in the body (TEST-51), oversized body (TEST-53), cookie attributes (TEST-54), HTML and script in text (TEST-56), accessibility rules of axe-core (TEST-57), list speed with 200 requests (TEST-59, median 10 ms on the development machine), 70 simultaneous calls (TEST-60), the journey through all four features (TEST-61), validation boundaries (TEST-62) and client helpers (TEST-63). These are checks that the behavior is right; they did not go through a red run.

## Known limitations (not fixed, disclosed)

| ID | Limitation | Impact | Planned |
|---|---|---|---|
| LIM-01 | No limit on login attempts (no rate limiting, no lockout) | Passwords can be guessed by repeated tries | Sprint 3 hardening |
| LIM-02 | No Content-Security-Policy, HSTS or other advanced headers | Weaker defence in depth | Lab 5 deployment (headers on the web server) |
| LIM-03 | No real load test. TEST-60 sends 70 simultaneous calls from one process; it says nothing about 500 users, and the speed numbers come from one local machine | Capacity is unknown | A load tool against the deployed system after Lab 5, if required |
| LIM-04 | No professional penetration test; the security checks are automated and written by the team | Unknown holes may exist | Not planned |
| LIM-05 | No UAT yet (cases are prepared in `docs/uat/uat-cases.md`) | Real-user fit is unproven | Lab 6 |
| LIM-06 | Accessibility is checked by rules (axe-core) and by keyboard and narrow-screen tests only. Rules catch part of the problems; no screen reader or usability test with people | Some barriers may remain | Sprint 2 and 3 |
| LIM-07 | "Looks good and is easy to understand" is not tested automatically | Subjective quality unknown | UAT in Lab 6 |
