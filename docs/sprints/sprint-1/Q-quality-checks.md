# Quality checks contract Q-01: security, accessibility, layout, performance and regression

Contract version 2.0. Written before the tests of this contract.

Linked requirements: NFR-04, NFR-05, NFR-09, NFR-10, NFR-12 (early check), NFR-13, BR-05, BR-17. Responsibilities: R-02, R-05, R-06. Depends on: F-01 to F-05 and the UI.

## 1. Design

These are checks on the behavior of the five features, plus two small hardening rules: the API must not announce its technology (no `X-Powered-By`) and must send basic protective headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`); and a session id that is not a UUID is refused before it reaches the database.

Rules:
- User text is data. It is never part of a database query, and when it is shown the UI escapes it.
- The client cannot set server-owned fields (`status`, `requestNumber`, `requesterId`, `total`, `decidedAt`, `id`).
- A forged, malformed or oversized input produces a clean 4xx JSON error, never a 500 or a stack trace.

UI, API and data: no new screens, endpoints or tables.

## 2. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-45 | SQL metacharacters in login e-mail and password, in item name, description and reason, and in a request id never cause a 500, never log anyone in, and the text is stored and returned unchanged. |
| AC-46 | Server-owned fields sent in a create, edit, submit, approve or reject body are ignored: a created request is DRAFT, owned by the caller, with the calculated total and its own number. |
| AC-47 | Forged session cookies (random UUID, empty, very long, SQL text, null bytes) give 401 on protected routes and never 500. |
| AC-48 | A body larger than the limit gives 413 with a JSON error and no stack trace. |
| AC-49 | The session cookie is HttpOnly, SameSite=Lax, Path=/, and expires in 8 hours. |
| AC-50 | Responses do not contain `X-Powered-By` and do contain the three protective headers. |
| AC-51 | HTML or script typed into an item name, description, reason or rejection reason is displayed as text on the list, detail and queue screens and is not executed. |
| AC-52 | The login, list, new request, detail (with the decision panel), review queue and administrator screens have no serious or critical violations of the WCAG 2.1 A and AA rules checked by axe-core. |
| AC-53 | At 1280, 768 and 375 pixels width these screens have no horizontal page scrolling, and the login can be completed with the keyboard alone. |
| AC-54 | With 200 requests for one user, the median response time of the list over 20 calls is under 500 ms. (Early check of NFR-12, formally Sprint 2.) |
| AC-55 | 50 simultaneous list calls and 20 simultaneous creates all succeed, none returns a 5xx, and exactly 20 requests are stored. |
| AC-56 | One journey through the features works end to end at API level: create, edit, submit, list, review queue, approve, detail with ordered history, second decision refused, outsider gets 404, administrator reads all. |
| AC-57 | The money formatting and the estimated total of the client behave as specified (unit level). |

## 3. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-80 | AC-45 | API integration | A seeded requester | Login with `' OR '1'='1`, `admin'--`, `"; DROP TABLE "User";--`; create a request whose text contains quotes and SQL; GET detail with id `1 OR 1=1` | Logins 401; no 5xx; stored text returned unchanged; SQL ids give 404; User row count unchanged |
| TEST-81 | AC-46 | API integration | Two requesters and an approver | POST create with `status: "APPROVED"`, `requesterId`, `totalSatang`, `total`, `id`, `requestNumber`, `decidedAt`; PATCH, submit, approve and reject with extra fields | Created request is DRAFT, owned by the caller, calculated total, own number; the extra fields change nothing |
| TEST-82 | AC-47 | API integration | No valid session | Call protected routes with cookie values: random UUID, empty, 5000 characters, `' OR 1=1--`, `%00%00` | Each 401; never 500 |
| TEST-83 | AC-48 | API integration | none | POST a 200 KB JSON body to create | 413; JSON `error`; no stack |
| TEST-84 | AC-49 | API integration | Seeded user | Log in and read `Set-Cookie` | HttpOnly, SameSite=Lax, Path=/, expiry between 7h54m and 8h06m ahead |
| TEST-85 | AC-50 | API integration | none | GET health and a 401 route | No `x-powered-by`; the three protective headers are present |
| TEST-86 | AC-51 | UI end to end | Logged in as a requester and an approver | Create a request with HTML and script in item name, description and reason; reject it with HTML in the reason; open list, detail and queue | The text is visible as typed; `window.__xss` is undefined; no dialog opened |
| TEST-87 | AC-52 | UI end to end (axe-core) | Logged-in sessions of the three roles | Scan each screen with the wcag2a, wcag2aa, wcag21a and wcag21aa rule sets | No violation with impact serious or critical |
| TEST-88 | AC-53 | UI end to end | Viewports 1280, 768 and 375 pixels | Visit each screen; at 375 log in using only Tab and Enter | Document width does not exceed the viewport; login succeeds |
| TEST-89 | AC-54 | API integration (timing) | 200 requests of one user inserted directly | 20 calls to GET requests, take the median | Median under 500 ms; the measured value is printed |
| TEST-90 | AC-55 | API integration | One logged-in user | 50 parallel GET list; 20 parallel creates | All 200 and 201; exactly 20 new requests stored |
| TEST-91 | AC-56 | API integration | Seeded roles | Create, edit, submit, list, review queue, approve, detail, decide again, outsider reads, administrator lists all | Each step has the specified status; history is CREATED, SUBMITTED, APPROVED; second decision 409; outsider 404; administrator sees it |
| TEST-92 | AC-57 | Unit (client) | Values such as 261, 0.5, 1000000 and a quantity and price | formatBaht, estimateTotal | `฿261.00`, `฿0.50`, `฿1,000,000.00`; estimate is quantity times price, 0 for invalid input |
