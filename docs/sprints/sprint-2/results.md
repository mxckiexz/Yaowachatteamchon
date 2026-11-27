# Sprint 2 results: F-06 cancellation

Run date: 25 November 2026. The implementation commit is `8d46bad`.

The server suite passed 112 tests, the client suite passed 14 tests, and the two new browser tests passed. The raw F-06 runs are in `test-output/` and the red/green evidence is in `tdd/`.

| AC | Implementation | Test | Actual result | Commit |
|---|---|---|---|---|
| AC-58 | `POST /api/requests/:id/cancel` | TEST-93 | Owner cancelled a DRAFT; 200 and CANCELLED persisted | `8d46bad` |
| AC-59 | Same route | TEST-94 | Owner cancelled a SUBMITTED request; 200 and CANCELLED persisted | `8d46bad` |
| AC-60, AC-61 | Transactional history append and retained request data | TEST-95 | One CANCELLED history row; fields and earlier history unchanged | `8d46bad` |
| AC-62, AC-63 | Owner-scoped lookup | TEST-96 | Other requester, approver and administrator received 404 | `8d46bad` |
| AC-64 | Status guard | TEST-97 | APPROVED, REJECTED and CANCELLED each returned 409 ILLEGAL_TRANSITION | `8d46bad` |
| AC-65 | Conditional update | TEST-98 | Two simultaneous cancels produced one 200, one 409 and one history row | `8d46bad` |
| AC-66 | Conditional update shared with decisions | TEST-99 | Concurrent decision/cancel produced one successful transition and one history row | `8d46bad` |
| AC-67 | Prisma transaction rollback | TEST-100 | Forced history failure returned 500 and left status/history unchanged | `8d46bad` |
| AC-68 | `parseId` and authentication checks | TEST-101 | Non-numeric id returned 404; anonymous request with correct Origin returned 401 | `8d46bad` |
| AC-69 | Application `requireSameOrigin` middleware | TEST-102 | Foreign Origin returned 403 and made no change | `8d46bad` |
| AC-70 | Existing edit/submit/decision/list/detail routes | TEST-103 | Later actions were rejected, queue omitted the request, owner still read CANCELLED | `8d46bad` |
| AC-71, AC-73 | Cancel panel and focus management | TEST-104 | Owner saw the button, focus moved to confirmation, and cancellation/history appeared | `8d46bad` |
| AC-72 | Owner/status visibility guard in UI | TEST-105 | Non-owner and owner of an approved request saw no Cancel button | `8d46bad` |

## Suite totals

| Suite | Result |
|---|---|
| Server | 112 passed, 0 failed |
| Client | 14 passed, 0 failed |
| F-06 browser tests | 2 passed, 0 failed |

## F-07 search and filter

Implementation and coverage commit: `fc0189f` (27 November 2026). The server F-07 suite has 18 tests and the browser file has 8 tests; together they cover TEST-106 to TEST-131. Raw output is in `test-output/server-f07-vitest.txt` and `test-output/browser-f07-playwright.txt`.

| AC | Implementation | Test | Actual result | Commit |
|---|---|---|---|---|
| AC-74 to AC-85 | `GET /api/requests` scope, status, category and text filters | TEST-106 to TEST-117 | 12 server tests passed; visibility, role scope, validation and no-data leakage verified | `fc0189f` |
| AC-86 | Unfiltered mine list timing | TEST-118 | 200 rows, one warm-up and 20 individual calls; median 39.01 ms, p95 47.03 ms, max 47.56 ms. Environment: ASUS Vivobook X1502ZA, Intel Core i7-1255U, 15.69 GB RAM, Windows 11 Home, Node.js v22.14.0, PostgreSQL 16.16 | `fc0189f` |
| AC-87 to AC-91 | Filter toolbar, URL parameters, clear action and live result status | TEST-119 to TEST-123 | 5 browser tests passed, including keyboard/Enter, labels, clear, empty state and live announcement | `fc0189f` |
| AC-92 to AC-96 | Literal metacharacters, parameter boundaries, NULL fields and review status | TEST-124 to TEST-128 | 5 server tests passed, including literal `%`, `_`, `\\`, quotes, `;--`, HTML and NULL fields | `fc0189f` |
| AC-97 to AC-99 | Responsive widths, axe-core and reload/Back | TEST-129 to TEST-131 | 3 browser tests passed at 375/768/1280 px, axe filter-toolbar check and URL persistence | `fc0189f` |

### F-07 suite totals

| Suite | Result |
|---|---|
| Server F-07 | 18 passed, 0 failed |
| Browser F-07 | 8 passed, 0 failed |

## F-08 dashboard counts

Implementation and acceptance-coverage commit: `03ba1fc`. The endpoint returns role-scoped counts only; approvers also receive `reviewWaiting`. The dashboard cards link to the corresponding filtered list, and the client tests and browser checks cover the role explanations, labels, loading/error/retry states, responsive layout and anonymous redirect.

| AC | Implementation | Test | Actual result | Commit |
|---|---|---|---|---|
| AC-100 to AC-106 | `GET /api/dashboard` role scope and response shape | TEST-132 to TEST-138 | Requester own counts, approver own plus exact review count, administrator all counts, ignored unknown parameters, numeric status keys and no data leakage passed | `03ba1fc` |
| AC-107 to AC-111 | Dashboard cards, labelled status badges, role explanation and loading/error states | TEST-139 to TEST-143, CT-08 to CT-10 | Component and browser checks cover role groups, keyboard access, responsive widths, exact error announcement, retry and zero-state cards | `03ba1fc` |
| AC-112 | Card count equals linked list rows for requester, approver and administrator | TEST-144 | Browser check compares all six approver cards (including review queue) and every other role card with its filtered list | `03ba1fc` |
| AC-113 to AC-116 | Live success/failure announcement, navigation and state transitions | TEST-142, TEST-145, TEST-146, TEST-147 | Retry announcement, anonymous redirect and unchanged landing paths for all roles, fresh requester/approver counts, and exact submit/approve/reject/cancel count movement passed | `03ba1fc` |

### F-08 suite totals

| Suite | Result |
|---|---|
| Server F-08 | 9 passed, 0 failed |
| Client | 17 passed, 0 failed |
| Build and type check | passed |
| Browser F-08 | 7 passed, 0 failed; raw terminal output in `test-output/browser-f08-playwright.txt` |
| Full Playwright suite | 30 passed, 0 failed; raw terminal output in `test-output/browser-f08-playwright.txt` |

## F-09 attachments

Branch `feature/F-09-attachments`, 27 November 2026, run before review. Implementation commit: `bf1c4ee`. The suites below ran on the files of this commit before it was created. Contract: `F-09-attachments.md` v1.0. Environment: Apple M2, 8 GB RAM, macOS 26.6, Node.js v24.19.0, PostgreSQL 16.15, a separate local test database.

| AC | Implementation | Test | Actual result |
|---|---|---|---|
| AC-117 to AC-123 | `attachmentRules.ts`, upload route, size CHECK constraint | TEST-148 to TEST-154 | Passed, including the 5,242,880-byte boundary and simultaneous uploads (3 rounds) |
| AC-124 to AC-127 | Ownership and draft checks before the body is read; row lock and second check in the transaction | TEST-155 to TEST-158 | Passed; TEST-156 waits for a real row lock |
| AC-128 to AC-132 | List, download and delete routes with `visibilityWhere` (BR-12) | TEST-159 to TEST-163 | Passed |
| AC-133 to AC-135 | Server-owned fields, text rendering, no history or status change | TEST-164 to TEST-166 (and TEST-164 in the browser) | Passed |
| AC-136 to AC-140 | `Attachments.tsx` on the request page | TEST-167 to TEST-171 | Passed in Chromium |

| Suite | Result |
|---|---|
| Server, all files (`test-output/server-f09-full-vitest.txt`) | 151 passed, 0 failed. Of these 21 are F-09: 19 API tests and 2 unit tests (TEST-150 and TEST-152) |
| Client (`test-output/client-f09.txt`) | 14 passed, 0 failed; build passed |
| Browser, all files (`test-output/browser-f09-full-playwright.txt`) | 29 passed, 0 failed. Of these 6 are F-09 |
| Server type check and build | passed |

Not done: virus scanning (out of scope in the contract), a run of the migration against a copy of the deployed data, and any deployment. F-09 has no client unit tests; its UI is covered by the browser tests.

### After merging `staging` (with F-08)

Merge commit `91286fc`, 27 November 2026, same environment. The F-08 and F-09 changes conflicted in `api.ts`, `app.ts` and four documents; both sides were kept. All suites were run again on the merge commit. The earlier totals above are for `bf1c4ee`.

| Suite | Result |
|---|---|
| Server, all files (`test-output/server-f09-merged-vitest.txt`) | 160 passed, 0 failed |
| Client (`test-output/client-f09-merged.txt`) | 17 passed, 0 failed; build passed |
| Browser, all files (`test-output/browser-f09-merged-playwright.txt`) | 36 passed, 0 failed |
| Server type check and build | passed |

## F-10 comments

Branch `feature/F-10-comments` from `staging` at `7d50cdc`, 27 November 2026, run before review. Implementation commit: `71936a5`. The server, client and full browser suites ran on the files of this commit before it was created; the F-10 server and browser tests ran again on the commit. Contract: `F-10-comments.md` v1.1. Environment: Apple M2, 8 GB RAM, macOS 26.6, Node.js v24.19.0, PostgreSQL 16.15, a separate local test database.

| AC | Implementation | Test | Actual result |
|---|---|---|---|
| AC-141 to AC-143 | `commentRoutes.ts`, `POST` route | TEST-172 to TEST-174 | Passed, including the nine posts across all statuses |
| AC-144, AC-145 | `commentRules.ts`, CHECK constraint on `Comment.text` | TEST-175 (unit and API), TEST-176 | Passed, including 1000 and 1001 characters |
| AC-146 to AC-148 | `requireAuth`, `requireRole`, `visibilityWhere` (BR-12), in this order | TEST-177 to TEST-179 | Passed |
| AC-149, AC-150 | `GET` route | TEST-180, TEST-181 | Passed |
| AC-151 to AC-154 | Only `text` is read from the body; no change or delete route; one insert only | TEST-182 to TEST-185 (and TEST-182 in the browser) | Passed |
| AC-155 to AC-159 | `Comments.tsx` on the request page | TEST-186 to TEST-190 | Passed in Chromium |

| Suite | Result |
|---|---|
| Server, all files (`test-output/server-f10-full-vitest.txt`) | 175 passed, 0 failed. Of these 15 are F-10: 14 API tests and 1 unit test (TEST-175) |
| Client (`test-output/client-f10.txt`) | 17 passed, 0 failed; build passed |
| Browser, all files (`test-output/browser-f10-full-playwright.txt`) | 42 passed, 0 failed. Of these 6 are F-10 |
| Server type check and build | passed |

Migration: the `Comment` migration was applied to a temporary local database that already held seeded users and one request. Row counts and checksums of `User`, `PurchaseRequest`, `RequestHistory` and `Attachment` were the same before and after (the last two tables were empty). The CHECK constraint refused 0 and 1001 characters and accepted 1000.

Known limitations: there is no paging (see the contract). A text that contains an unpaired UTF-16 surrogate, which can be sent by calling the API directly, answers 500 with the safe error body instead of 422. The contract does not list this case; the existing request fields answer the same way. It is not changed here.

Not done: a run of the migration against a copy of the deployed data, and any deployment. F-10 has no client unit tests; its UI is covered by the browser tests.

## F-11 return for editing

Implementation commit: pending. Contract: `F-11-return-editing.md` v1.1. The API and UI implement the approver return flow, the atomic `RETURNED` history transition, owner edit/resubmit, and cross-feature visibility rules.

| AC | Implementation | Test | Actual result | Commit |
|---|---|---|---|---|
| AC-160 to AC-172 | `POST /api/requests/:id/return`, transition and history handling | TEST-191 to TEST-199 | 9 server tests passed locally; owner, approver, visibility, validation, history and race behavior verified | pending |
| AC-173 to AC-179 | Return form, success announcement, focus, responsive/accessibility behavior and additive `RETURNED` migration | TEST-200 to TEST-208 | Browser and final evidence are pending; no deployment claimed | pending |

Known limitation: Playwright coverage for F-11 is not yet added in this implementation step.

