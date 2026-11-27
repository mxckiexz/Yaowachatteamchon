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

Implementation and acceptance-coverage commit: `85ef900`. The endpoint returns role-scoped counts only; approvers also receive `reviewWaiting`. The dashboard cards link to the corresponding filtered list, and the client tests and browser checks cover the role explanations, labels, loading/error/retry states, responsive layout and anonymous redirect.

| AC | Implementation | Test | Actual result | Commit |
|---|---|---|---|---|
| AC-100 to AC-106 | `GET /api/dashboard` role scope and response shape | TEST-132 to TEST-138 | Requester own counts, approver own plus exact review count, administrator all counts, ignored unknown parameters, numeric status keys and no data leakage passed | `85ef900` |
| AC-107 to AC-111 | Dashboard cards, labelled status badges, role explanation and loading/error states | TEST-139 to TEST-143, CT-08 to CT-10 | Component and browser checks cover role groups, keyboard access, responsive widths, exact error announcement, retry and zero-state cards | `85ef900` |
| AC-112 | Card count equals linked list rows for requester, approver and administrator | TEST-144 | Browser check compares all six approver cards (including review queue) and every other role card with its filtered list | `85ef900` |
| AC-113 to AC-116 | Live success/failure announcement, navigation and state transitions | TEST-142, TEST-145, TEST-146, TEST-147 | Retry announcement, anonymous redirect and unchanged landing paths for all roles, fresh requester/approver counts, and exact submit/approve/reject/cancel count movement passed | `85ef900` |

### F-08 suite totals

| Suite | Result |
|---|---|
| Server F-08 | 9 passed, 0 failed |
| Client | 17 passed, 0 failed |
| Build and type check | passed |
| Browser F-08 | 7 passed, 0 failed; raw terminal output in `test-output/browser-f08-playwright.txt` |
