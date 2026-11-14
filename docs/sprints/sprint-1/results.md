# Sprint 1 Results

Tested commit: `95878ec3973dbdb1946e536ddefb706771050f2d` on branch `feature/UI-requests` (clean working tree).
Run started: 2026-11-14T19:46:49.091Z. Raw output: `docs/sprints/sprint-1/test-output/`.

## Commands and counts

| Suite | Command | Result |
|---|---|---|
| Server (API integration and unit, real PostgreSQL) | `cd server && npx vitest run` | 7 files, 43 passed, 0 failed, 0 skipped |
| Client (component) | `cd client && npx vitest run` | 2 files, 10 passed, 0 failed, 0 skipped |
| End to end (browser, real API and database) | `npx playwright test` | 9 passed, 0 failed, 0 skipped |

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
| TEST-10 | AC-07 | API integration | server/tests/f01/auth.test.ts: F-01 authentication TEST-10 / AC-07: an inactive user cannot log in | PASS |
| TEST-11 | AC-08 | API integration | server/tests/f04/lists-detail.test.ts: NFR-01 anonymous access TEST-11 / AC-08: every protected route returns 401 with no data when there is no session | PASS |
| TEST-12 | AC-09 | API integration | server/tests/f01/auth.test.ts: F-01 authentication TEST-12 / AC-09: a state-changing request with a foreign Origin is rejected and the session survives | PASS |
| TEST-13 | AC-11 | API integration | server/tests/f02/create-submit.test.ts: F-02 create a request TEST-13 / AC-11: creates a DRAFT, the server calculates the total and ignores a client total | PASS |
| TEST-14 | AC-11 | Unit | server/tests/f02/money.test.ts: F-02 money helpers (unit) TEST-14 / AC-11: the total is the exact sum in satang (0.1 x 3 = 30 satang) | PASS |
| TEST-15 | AC-12 | API integration | server/tests/f02/create-submit.test.ts: F-02 create a request TEST-15 / AC-12: title boundaries (empty and 2 characters fail, 3 passes) and nothing is stored on failure | PASS |
| TEST-16 | AC-12 | API integration | server/tests/f02/create-submit.test.ts: F-02 create a request TEST-16 / AC-12: quantity boundaries (0, 1001, 1.5 fail; 1 and 1000 pass) and at least one item | PASS |
| TEST-17 | AC-12 | API integration | server/tests/f02/create-submit.test.ts: F-02 create a request TEST-17 / AC-12: unit price boundaries (0, -1, 10.505, 1000000.01 fail; 0.01 and 1000000 pass) | PASS |
| TEST-18 | AC-13 | API integration | server/tests/f02/create-submit.test.ts: F-02 submit a request TEST-18 / AC-13: the owner submits a DRAFT to an active approver | PASS |
| TEST-19 | AC-14 | API integration | server/tests/f02/create-submit.test.ts: F-02 submit a request TEST-19 / AC-14: a request cannot be assigned to its own requester (SELF_REVIEW) | PASS |
| TEST-20 | AC-15 | API integration | server/tests/f02/create-submit.test.ts: F-02 submit a request TEST-20 / AC-15: an employee, an inactive approver and an unknown id are not valid approvers | PASS |
| TEST-21 | AC-16 | API integration | server/tests/f02/create-submit.test.ts: F-02 submit a request TEST-21 / AC-16: someone who is not the owner gets 404 and nothing changes | PASS |
| TEST-22 | AC-16 | API integration | server/tests/f02/create-submit.test.ts: F-02 submit a request TEST-22 / AC-16: submitting a request that is not a DRAFT gives 409 and changes nothing | PASS |
| TEST-23 | AC-17 | API integration | server/tests/f02/create-submit.test.ts: F-02 submit a request TEST-23 / AC-17: the approver list holds active approvers except the caller | PASS |
| TEST-24 | AC-11, AC-12 | Unit | server/tests/f02/money.test.ts: F-02 money helpers (unit) TEST-24 / AC-11, AC-12: bahtToSatang accepts numbers and numeric strings with at most 2 decimals | PASS |
| TEST-25 | AC-19, AC-26 | API integration | server/tests/f03/decision.test.ts: F-03 approver decision TEST-25 / AC-19, AC-26: the assigned approver approves and one history row is written | PASS |
| TEST-26 | AC-20, AC-26 | API integration | server/tests/f03/decision.test.ts: F-03 approver decision TEST-26 / AC-20, AC-26: the assigned approver rejects with a reason | PASS |
| TEST-27 | AC-20 | API integration | server/tests/f03/decision.test.ts: F-03 approver decision TEST-27 / AC-20: a rejection needs a reason of at least 5 characters | PASS |
| TEST-28 | AC-21 | API integration | server/tests/f03/decision.test.ts: F-03 approver decision TEST-28 / AC-21: an employee cannot use the decision route | PASS |
| TEST-29 | AC-22 | API integration | server/tests/f03/decision.test.ts: F-03 approver decision TEST-29 / AC-22: an approver who is not assigned cannot decide | PASS |
| TEST-30 | AC-23 | API integration | server/tests/f03/decision.test.ts: F-03 approver decision TEST-30 / AC-23: a requester cannot decide their own request even with the APPROVER role | PASS |
| TEST-31 | AC-24 | API integration | server/tests/f03/decision.test.ts: F-03 approver decision TEST-31 / AC-24: a decided request cannot be decided again | PASS |
| TEST-32 | AC-24 | API integration | server/tests/f03/decision.test.ts: F-03 approver decision TEST-32 / AC-24: a DRAFT cannot be decided | PASS |
| TEST-33 | AC-25 | API integration | server/tests/f03/decision.test.ts: F-03 approver decision TEST-33 / AC-25: two simultaneous decisions produce exactly one decision | PASS |
| TEST-34 | AC-19 to AC-24 | Unit | server/tests/f03/transitions.test.ts: F-03 status transitions (unit) TEST-34 / BR-01: only DRAFT to PENDING, PENDING to APPROVED and PENDING to REJECTED are allowed | PASS |
| TEST-35 | AC-27 | API integration | server/tests/f04/lists-detail.test.ts: F-04 lists, detail and history TEST-35 / AC-27: a user lists only their own requests, newest first | PASS |
| TEST-36 | AC-28 | API integration | server/tests/f04/lists-detail.test.ts: F-04 lists, detail and history TEST-36 / AC-28: detail for the owner has items, total, decision fields and history in order | PASS |
| TEST-37 | AC-29 | API integration | server/tests/f04/lists-detail.test.ts: F-04 lists, detail and history TEST-37 / AC-29: the assigned approver can read the request | PASS |
| TEST-38 | AC-29 | API integration | server/tests/f04/lists-detail.test.ts: F-04 lists, detail and history TEST-38 / AC-29: anyone else, including another approver, gets 404 and no data | PASS |
| TEST-39 | AC-30 | API integration | server/tests/f04/lists-detail.test.ts: F-04 lists, detail and history TEST-39 / AC-30: the review queue holds only the caller's PENDING requests | PASS |
| TEST-40 | AC-30 | API integration | server/tests/f04/lists-detail.test.ts: F-04 lists, detail and history TEST-40 / AC-30: an employee gets 403 and no data from the review queue | PASS |
| TEST-41 | AC-33 | API integration | server/tests/f01/auth.test.ts: F-01 authentication TEST-41 / AC-33: malformed JSON gives 400 and no stack trace | PASS |
| TEST-42 | AC-34 | API integration | server/tests/f01/auth.test.ts: F-01 authentication TEST-42 / AC-34: health is public | PASS |
| TEST-45 | AC-10 | UI end to end | e2e/f01/login.spec.ts: TEST-45 / AC-10: wrong login shows an error, correct login reaches the list, logout returns to login | PASS |
| TEST-46 | AC-18 | UI end to end | e2e/requests/employee-journey.spec.ts: TEST-46 / AC-18: an employee creates a draft with two items and submits it to an approver; TEST-46 / AC-12 in the UI: server validation messages appear beside the fields | PASS |
| TEST-47 | AC-31 | UI end to end | e2e/requests/employee-journey.spec.ts: TEST-47 / AC-31: saved data is still there after reloading the detail page and the list | PASS |
| TEST-48 | AC-32 | UI end to end | e2e/requests/approver-journey.spec.ts: TEST-48 / AC-32: the approver approves one request and rejects another with a reason; the requester sees both | PASS |
| TEST-49 | AC-32, AC-21 | UI end to end plus API | e2e/requests/approver-journey.spec.ts: TEST-49 / AC-32, AC-21: an employee has no review link, is redirected from /reviews, and the API says 403 | PASS |

## Tests that are not in the STS table

Component tests CT-01 to CT-10 (client) and extra end-to-end checks (anonymous redirect, approver 2 cannot read another approver's request, validation messages in the UI) were added during implementation as supporting checks. They are in the raw output above.

## Manual checks

| ID | Check | Result |
|---|---|---|
| M-01 | NFR-05: a fresh clone, an empty database, then the README setup commands; migration applied, seed ran, the API started, health returned 200 and a seeded user could log in | PASS (run on the Sprint 1 release branch, 2026-11-15) |
