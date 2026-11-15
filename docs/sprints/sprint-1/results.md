# Sprint 1 Results

Tested commit: `74ab71c091896273e532c2c0efdcd10237c7c94a` on branch `feature/quality-checks` (clean working tree).
Run started: 2026-11-15T10:46:55.223Z. Raw output: `docs/sprints/sprint-1/test-output/`.

## Commands and counts

| Suite | Command | Result |
|---|---|---|
| Server (API integration and unit, real PostgreSQL) | `cd server && npx vitest run` | 12 files, 71 passed, 0 failed, 0 skipped |
| Client (component) | `cd client && npx vitest run` | 3 files, 14 passed, 0 failed, 0 skipped |
| End to end (browser, real API and database) | `npx playwright test` | 13 passed, 0 failed, 0 skipped |

No test is skipped or disabled. Automated tests are listed in the table below; the one manual check is M-01.

## Acceptance criteria to test results

Planned test IDs come from the feature contracts. The test file and name are the actual executed tests.

| Test | AC | Level | Actual file and test name | Result |
|---|---|---|---|---|
| TEST-01 | AC-01 | API integration | server/tests/f01/auth.test.ts: F-01 authentication TEST-01 / AC-01: correct credentials return the user and an HttpOnly cookie, no hash | PASS |
| TEST-02 | AC-02 | API integration | server/tests/f01/auth.test.ts: F-01 authentication TEST-02 / AC-02: a wrong password gives 401 with the standard message | PASS |
| TEST-03 | AC-02 | API integration | server/tests/f01/auth.test.ts: F-01 authentication TEST-03 / AC-02: an unknown e-mail gives exactly the same response as a wrong password | PASS |
| TEST-04 | AC-03 | API integration | server/tests/f01/auth.test.ts: F-01 authentication TEST-04 / AC-03: me returns the current user for a valid session | PASS |
| TEST-05 | AC-03 | API integration | server/tests/f01/auth.test.ts: F-01 authentication TEST-05 / AC-03: me without a session gives 401 | PASS |
| TEST-06 | AC-04 | API integration | server/tests/f01/auth.test.ts: F-01 authentication TEST-06 / AC-04: logout destroys the session and is idempotent | PASS |
| TEST-07 | AC-05 | API integration | server/tests/f01/auth.test.ts: F-01 authentication TEST-07 / AC-05: an expired session gives 401 | PASS |
| TEST-08 | AC-06 | Unit | server/tests/f01/password.test.ts: F-01 password handling TEST-08 / AC-06: hashPassword produces a bcrypt hash (cost >= 10) that verifies only the right password | PASS |
| TEST-09 | AC-06 | API integration | server/tests/f01/password.test.ts: F-01 password handling TEST-09 / AC-06: seeded users hold bcrypt hashes, never the plaintext password | PASS |
| TEST-10 | AC-07 | API integration | server/tests/f01/auth.test.ts: F-01 authentication TEST-10 / AC-07: a deactivated user cannot log in | PASS |
| TEST-11 | AC-07 | API integration | server/tests/f01/auth.test.ts: F-01 authentication TEST-11 / AC-07: the session of a user who is deactivated afterwards stops working at once | PASS |
| TEST-12 | AC-08 | API integration | server/tests/f01/protected-routes.test.ts: NFR-01 anonymous access TEST-12 / AC-08: every protected route returns 401 with no data when there is no session | PASS |
| TEST-13 | AC-09 | API integration | server/tests/f01/auth.test.ts: F-01 authentication TEST-13 / AC-09: a state-changing request with a foreign Origin is rejected and the session survives | PASS |
| TEST-14 | AC-10 | API integration | server/tests/f01/auth.test.ts: F-01 authentication TEST-14 / AC-10: malformed JSON gives 400 and no stack trace | PASS |
| TEST-15 | AC-11 | API integration | server/tests/f01/auth.test.ts: F-01 authentication TEST-15 / AC-11: health is public | PASS |
| TEST-16 | AC-13 | API integration | server/tests/f02/create-edit-submit.test.ts: F-02 create TEST-16 / AC-13: creates a DRAFT with a request number; the server calculates the total and ignores a client total | PASS |
| TEST-17 | AC-13 | Unit | server/tests/f02/money-validation.unit.test.ts: F-02 money helpers (unit) TEST-17 / AC-13: the total is the exact product in satang (0.1 baht x 3 = 30 satang) | PASS |
| TEST-18 | AC-14 | API integration | server/tests/f02/create-edit-submit.test.ts: F-02 create TEST-18 / AC-14: item name and description rules; nothing is stored on failure | PASS |
| TEST-19 | AC-14 | API integration | server/tests/f02/create-edit-submit.test.ts: F-02 create TEST-19 / AC-14: quantity boundaries (0, 1001, 1.5, -1 and text fail; 1 and 1000 pass) | PASS |
| TEST-20 | AC-14 | API integration | server/tests/f02/create-edit-submit.test.ts: F-02 create TEST-20 / AC-14: unit price boundaries (0, -1, 10.505, 1000000.01 fail; 0.01 and 1000000 pass) | PASS |
| TEST-21 | AC-14 | API integration | server/tests/f02/create-edit-submit.test.ts: F-02 create TEST-21 / AC-14: the category must be one of the list and the reason has a length limit | PASS |
| TEST-22 | AC-15 | API integration | server/tests/f02/create-edit-submit.test.ts: F-02 create TEST-22 / AC-15: 20 simultaneous creates get 20 different request numbers | PASS |
| TEST-23 | AC-16 | API integration | server/tests/f02/create-edit-submit.test.ts: F-02 edit TEST-23 / AC-16: the owner edits a DRAFT; the total is recalculated and the number stays | PASS |
| TEST-24 | AC-17 | API integration | server/tests/f02/create-edit-submit.test.ts: F-02 edit TEST-24 / AC-17: only a DRAFT can be edited (SUBMITTED, APPROVED, REJECTED, CANCELLED are refused) | PASS |
| TEST-25 | AC-17 | API integration | server/tests/f02/create-edit-submit.test.ts: F-02 edit TEST-25 / AC-17: someone who is not the owner (requester, approver, administrator) gets 404 | PASS |
| TEST-26 | AC-18 | API integration | server/tests/f02/create-edit-submit.test.ts: F-02 submit TEST-26 / AC-18: the owner submits a complete DRAFT | PASS |
| TEST-27 | AC-19 | API integration | server/tests/f02/create-edit-submit.test.ts: F-02 submit TEST-27 / AC-19: a draft without a reason or a category cannot be submitted (INCOMPLETE) | PASS |
| TEST-28 | AC-20 | API integration | server/tests/f02/create-edit-submit.test.ts: F-02 submit TEST-28 / AC-20: submitting a request that is not a DRAFT gives 409 and changes nothing | PASS |
| TEST-29 | AC-20 | API integration | server/tests/f02/create-edit-submit.test.ts: F-02 submit TEST-29 / AC-20: someone who is not the owner gets 404 when submitting | PASS |
| TEST-30 | AC-21 | API integration | server/tests/f02/create-edit-submit.test.ts: F-02 submit TEST-30 / AC-21: editing and submitting one user's request leaves another user's request untouched | PASS |
| TEST-31 | AC-22 | API integration | server/tests/f02/create-edit-submit.test.ts: F-02 create TEST-31 / AC-22: the administrator cannot create a request | PASS |
| TEST-32 | AC-22 | API integration | server/tests/f02/create-edit-submit.test.ts: F-02 create TEST-32 / AC-22: an approver can create a request of their own | PASS |
| TEST-33 | AC-13, AC-14 | Unit | server/tests/f02/money-validation.unit.test.ts: F-02 money helpers (unit) TEST-33 / AC-13, AC-14: bahtToSatang accepts numbers and numeric strings with at most 2 decimals | PASS |
| TEST-34 | AC-14 | Unit | server/tests/f02/money-validation.unit.test.ts: F-02 validation (unit) TEST-34 / AC-14: accepts exactly the valid boundaries and names every invalid field | PASS |
| TEST-36 | AC-24 | API integration | server/tests/f03/approve-reject.test.ts: F-03 approve and reject TEST-36 / AC-24: an approver approves a submitted request and one history row is written | PASS |
| TEST-37 | AC-25 | API integration | server/tests/f03/approve-reject.test.ts: F-03 approve and reject TEST-37 / AC-25: an approver rejects with a reason; the reason is stored in the request and in the history | PASS |
| TEST-38 | AC-25 | API integration | server/tests/f03/approve-reject.test.ts: F-03 approve and reject TEST-38 / AC-25: a rejection needs a reason of at least 5 characters | PASS |
| TEST-39 | AC-26 | API integration | server/tests/f03/approve-reject.test.ts: F-03 approve and reject TEST-39 / AC-26: a requester and the administrator cannot approve or reject | PASS |
| TEST-40 | AC-27 | API integration | server/tests/f03/approve-reject.test.ts: F-03 approve and reject TEST-40 / AC-27: an approver cannot approve or reject their own request | PASS |
| TEST-41 | AC-28 | API integration | server/tests/f03/approve-reject.test.ts: F-03 approve and reject TEST-41 / AC-28: any other approver can decide a submitted request (there is no assignment) | PASS |
| TEST-42 | AC-29 | API integration | server/tests/f03/approve-reject.test.ts: F-03 approve and reject TEST-42 / AC-29: a decided request cannot be decided again | PASS |
| TEST-43 | AC-29 | API integration | server/tests/f03/approve-reject.test.ts: F-03 approve and reject TEST-43 / AC-29: the draft of another user is not found | PASS |
| TEST-44 | AC-29 | API integration | server/tests/f03/approve-reject.test.ts: F-03 approve and reject TEST-44 / AC-29: a CANCELLED request cannot be decided | PASS |
| TEST-45 | AC-30 | API integration | server/tests/f03/approve-reject.test.ts: F-03 approve and reject TEST-45 / AC-30: two simultaneous decisions produce exactly one decision | PASS |
| TEST-46 | AC-31 | Unit | server/tests/f03/transitions.test.ts: F-03 status transitions (unit) TEST-46 / AC-31: only DRAFT to SUBMITTED, SUBMITTED to APPROVED and SUBMITTED to REJECTED are allowed | PASS |
| TEST-51 | AC-33 | API integration | server/tests/f04/lists-detail-history.test.ts: F-04 lists TEST-51 / AC-33: a user lists only their own requests, newest first | PASS |
| TEST-52 | AC-34 | API integration | server/tests/f04/lists-detail-history.test.ts: F-04 lists TEST-52 / AC-34: the review queue holds only submitted requests of others, oldest first | PASS |
| TEST-53 | AC-34 | API integration | server/tests/f04/lists-detail-history.test.ts: F-04 lists TEST-53 / AC-34: a requester and the administrator get 403 and no data from the review queue | PASS |
| TEST-54 | AC-35 | API integration | server/tests/f04/lists-detail-history.test.ts: F-04 detail and history TEST-54 / AC-35: the owner sees every field, the rejection reason and the history in order | PASS |
| TEST-55 | AC-35 | API integration | server/tests/f04/lists-detail-history.test.ts: F-04 detail and history TEST-55 / AC-35: an approver can open a submitted request but not another user's draft | PASS |
| TEST-56 | AC-35 | API integration | server/tests/f04/lists-detail-history.test.ts: F-04 detail and history TEST-56 / AC-35: another requester gets 404 and no request data | PASS |
| TEST-57 | AC-36 | API integration | server/tests/f04/lists-detail-history.test.ts: F-04 detail and history TEST-57 / AC-36: the history endpoint has the same visibility and order as the detail | PASS |
| TEST-58 | AC-37 | API integration | server/tests/f04/lists-detail-history.test.ts: F-04 lists TEST-58 / AC-37: only the administrator can list all requests, and can read any of them | PASS |
| TEST-61 | AC-39 | API integration | server/tests/f05/admin-users.test.ts: F-05 administrator, user management TEST-61 / AC-39: the administrator lists users without any password hash | PASS |
| TEST-62 | AC-39 | API integration | server/tests/f05/admin-users.test.ts: F-05 administrator, user management TEST-62 / AC-39: a requester and an approver get 403 and no data, and cannot change a user | PASS |
| TEST-63 | AC-40 | API integration | server/tests/f05/admin-users.test.ts: F-05 administrator, user management TEST-63 / AC-40: after the administrator deactivates a user, they cannot log in and their session stops at once | PASS |
| TEST-64 | AC-41 | API integration | server/tests/f05/admin-users.test.ts: F-05 administrator, user management TEST-64 / AC-41: the administrator reactivates a user, who can then log in | PASS |
| TEST-65 | AC-41 | API integration | server/tests/f05/admin-users.test.ts: F-05 administrator, user management TEST-65 / AC-41: the role can be changed to a valid value; invalid values and an empty body give 422 | PASS |
| TEST-66 | AC-42 | API integration | server/tests/f05/admin-users.test.ts: F-05 administrator, user management TEST-66 / AC-42: the administrator cannot change their own account | PASS |
| TEST-67 | AC-43 | API integration | server/tests/f05/admin-users.test.ts: F-05 administrator, user management TEST-67 / AC-43: an unknown id gives 404 and an invalid body gives 422 | PASS |
| TEST-70 | AC-12 | UI end to end | e2e/f01/login.spec.ts: TEST-70 / AC-12: wrong login shows an error, correct login reaches the role's first screen, logout returns to login | PASS |
| TEST-71 | AC-23 | UI end to end | e2e/requests/requester-journey.spec.ts: TEST-71 / AC-23: a requester creates a draft, edits it, is refused an incomplete submit, completes it and submits; TEST-71 / AC-14 in the UI: server validation messages appear beside the fields | PASS |
| TEST-72 | AC-32 | UI end to end | e2e/requests/approver-journey.spec.ts: TEST-72 / AC-32: an approver approves one request and rejects another (first without a reason); the requester sees both | PASS |
| TEST-73 | AC-26, AC-32 | UI end to end plus API | e2e/requests/approver-journey.spec.ts: TEST-73 / AC-26, AC-32: a requester has no decision buttons and the API refuses them | PASS |
| TEST-74 | AC-38 | UI end to end | e2e/requests/requester-journey.spec.ts: TEST-74 / AC-38: saved data is still there after reloading the detail page and the list | PASS |
| TEST-75 | AC-44 | UI end to end | e2e/admin/users.spec.ts: TEST-75 / AC-44: the administrator deactivates a user, who cannot log in; the own row is locked; others are redirected | PASS |
| TEST-80 | AC-45 | API integration | server/tests/q/security.test.ts: NFR-09 input is data (penetration-style checks, automated) TEST-80 / AC-45: SQL metacharacters never log anyone in, never cause a 500, and are stored unchanged | PASS |
| TEST-81 | AC-46 | API integration | server/tests/q/security.test.ts: NFR-09 input is data (penetration-style checks, automated) TEST-81 / AC-46: fields owned by the server cannot be set by the client | PASS |
| TEST-82 | AC-47 | API integration | server/tests/q/security.test.ts: NFR-09 input is data (penetration-style checks, automated) TEST-82 / AC-47: forged session cookies get 401 on protected routes and never a 500 | PASS |
| TEST-83 | AC-48 | API integration | server/tests/q/security.test.ts: NFR-09 input is data (penetration-style checks, automated) TEST-83 / AC-48: an oversized body gives 413 and a JSON error without a stack | PASS |
| TEST-84 | AC-49 | API integration | server/tests/q/security.test.ts: NFR-09 input is data (penetration-style checks, automated) TEST-84 / AC-49: the session cookie is HttpOnly, SameSite=Lax, Path=/ and lasts 8 hours | PASS |
| TEST-85 | AC-50 | API integration | server/tests/q/security.test.ts: NFR-09 input is data (penetration-style checks, automated) TEST-85 / AC-50: no technology header, and the basic protective headers are sent | PASS |
| TEST-86 | AC-51 | UI end to end | server/tests/q/security.test.ts, e2e/quality/xss.spec.ts: AC-51 data side: HTML in text is stored as typed returns HTML text unchanged from the API (the UI escapes it, see TEST-86); TEST-86 / AC-51: HTML and script typed into text is shown as text and never executed | PASS |
| TEST-87 | AC-52 | UI end to end (axe-core) | e2e/quality/accessibility.spec.ts: TEST-87 / AC-52: the main screens of the three roles have no serious or critical accessibility violations | PASS |
| TEST-88 | AC-53 | UI end to end | e2e/quality/responsive-keyboard.spec.ts: TEST-88 / AC-53: no horizontal scrolling at 1280, 768 and 375 px, and the login works with the keyboard alone | PASS |
| TEST-89 | AC-54 | API integration (timing) | server/tests/q/performance.test.ts: NFR-12 early smoke checks (this is not a load test) TEST-89 / AC-54: the list of 200 requests has a median response time under 500 ms | PASS |
| TEST-90 | AC-55 | API integration | server/tests/q/performance.test.ts: NFR-12 early smoke checks (this is not a load test) TEST-90 / AC-55: 50 simultaneous list calls and 20 simultaneous creates all succeed and exactly 20 are stored | PASS |
| TEST-91 | AC-56 | API integration | server/tests/q/regression.test.ts: Regression: one journey through the features TEST-91 / AC-56: create, edit, submit, list, queue, approve, detail, second decision refused, outsider refused, administrator reads | PASS |
| TEST-92 | AC-57 | Unit (client) | client/tests/q/format.test.ts: client helpers (unit) TEST-92 / AC-57: formatBaht always shows two decimals and a thousands separator; client helpers (unit) TEST-92 / AC-57: the estimate is quantity times price, and 0 when a value is empty or not a number | PASS |

## Tests that are not in the STS table

Component tests CT-01 to CT-12 (client), the API test of HTML text kept as typed (AC-51 data side), the unit test that trims text and ignores a total, and extra end-to-end checks (anonymous redirect, role landing screens, approver cannot approve their own request, validation messages in the UI) were added during implementation as supporting checks. They are in the raw output above.

## Manual checks

| ID | Check | Result |
|---|---|---|
| M-01 | NFR-11: a fresh clone (commit cb75eeb) and an empty database, then exactly the 7 commands of the README setup (no variables exported by hand): both migrations applied, seed ran, `npm run dev` started the API, health returned 200, a seeded approver could log in, and `npm test` passed in server (71) and client (14) | PASS (run 2026-11-15) |
