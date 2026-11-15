# Quality checks contract Q-01: security, accessibility, performance and regression checks

Contract version 1.0. Written before the tests of this contract. Added after the first Sprint 1 contract set: see the SRS change log, version 1.1 (new NFR-08 and NFR-09).

Linked requirements: NFR-01, NFR-03, NFR-04, NFR-07 (early check), NFR-08, NFR-09, BR-01, BR-02. Responsibilities: R-02 (safe handling), R-05 (quality checks), R-06 (accessible UI). Depends on: F-01 to F-04.

## 1. Design

These are checks on behavior the four features already have, plus two small hardening changes found by the checks: the API must not announce its technology (no `X-Powered-By`) and must send basic protective headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`).

Rules:
- User text is data. It is never part of a database query, and when it is shown it is escaped by the UI.
- The client cannot set server-owned fields. `status`, `requesterId`, `approverId`, `totalSatang`, `decidedAt` and `id` in a request body are ignored.
- A forged, malformed or oversized input produces a clean 4xx JSON error. It never produces a 500 or a stack trace.

UI and API definitions: no new screens and no new endpoints. Data: no change.

## 2. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-35 | SQL metacharacters in login e-mail and password, in the request title, in item names and in the request id never cause an error response with status 500, never log anyone in, and the text is stored and returned unchanged. |
| AC-36 | Server-owned fields sent in a create, submit or decision body are ignored: a created request is DRAFT, owned by the caller, with no approver, and its total is the calculated one. |
| AC-37 | Forged session cookies (random id, empty, very long, SQL text) give 401 on every protected route and never 500. |
| AC-38 | A body larger than the limit gives 413 with a JSON error and no stack trace. |
| AC-39 | The session cookie is HttpOnly, SameSite=Lax, Path=/, and expires in 8 hours. |
| AC-40 | Responses do not contain `X-Powered-By` and do contain `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy: no-referrer`. |
| AC-41 | HTML or script typed into a title, an item name or a comment is displayed as text on the list, detail and review screens and is not executed. |
| AC-42 | The login, list, new request, detail (with the decision panel) and review screens have no serious or critical violations of the WCAG 2.1 A and AA rules checked by axe-core. |
| AC-43 | At 375 pixels width these screens have no horizontal scrolling, and the login can be completed with the keyboard alone. |
| AC-44 | With 200 requests for one user, the median response time of the list over 20 calls is under 500 ms. (Early check of NFR-07, formally a Sprint 2 target.) |
| AC-45 | 50 simultaneous list calls and 20 simultaneous creates all succeed, none returns a 5xx, and exactly 20 requests are stored. |
| AC-46 | One journey through all four features works end to end at API level: create, submit, list, review queue, approve, detail with ordered history, second decision refused, outsider gets 404. |
| AC-47 | The request validation function accepts and rejects each boundary value as BR-02 says (unit level). |
| AC-48 | The money formatting and the estimated total of the client behave as specified (unit level). |

## 3. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-50 | AC-35 | API integration | A seeded employee and a pending request | Login with `' OR '1'='1`, `admin'--`, `"; DROP TABLE "User";--`; create a request whose title and item name contain quotes and SQL; GET detail with id `1 OR 1=1` | Logins 401; no 5xx; stored title is returned unchanged; id with SQL gives 404; User table row count unchanged |
| TEST-51 | AC-36 | API integration | Two employees and an approver | POST create with `status: "APPROVED"`, `requesterId: <other user>`, `approverId`, `totalSatang: 1`, `id: 1`; POST submit with `status`; POST decision with `status` | Created request is DRAFT, requester is the caller, no approver, total calculated; submit and decision ignore the extra field |
| TEST-52 | AC-37 | API integration | No valid session | Call protected routes with cookie values: random UUID, empty, 5000 characters, `' OR 1=1--` | Each 401; never 500 |
| TEST-53 | AC-38 | API integration | none | POST a 200 KB JSON body to create | 413; JSON `error`; no stack |
| TEST-54 | AC-39 | API integration | Seeded user | Log in and read `Set-Cookie` | HttpOnly, SameSite=Lax, Path=/, expiry between 7h59m and 8h01m ahead |
| TEST-55 | AC-40 | API integration | none | GET health and a 401 route | No `x-powered-by`; the three protective headers are present |
| TEST-56 | AC-41 | UI end to end | Logged in as an employee and approver | Create a request with title `<img src=x onerror="window.__xss=1">`, item `<script>window.__xss=2</script>`, rejection comment with HTML; open list, detail and queue | The text is visible as typed; `window.__xss` is undefined; no dialog opened |
| TEST-57 | AC-42 | UI end to end (axe-core) | Logged-in sessions | Scan each screen with the wcag2a, wcag2aa and wcag21aa rule sets | No violation with impact serious or critical |
| TEST-58 | AC-43 | UI end to end | 375 x 667 viewport | Visit each screen; log in using only Tab and Enter | Document width does not exceed the viewport; login succeeds |
| TEST-59 | AC-44 | API integration (timing) | 200 requests of one user inserted directly | 20 calls to GET requests, take the median | Median under 500 ms; the measured value is printed |
| TEST-60 | AC-45 | API integration | One logged-in user | 50 parallel GET list; 20 parallel creates | All 200 and 201; exactly 20 new requests stored |
| TEST-61 | AC-46 | API integration | Seeded roles | Create, submit, list, review queue, approve, detail, decide again, outsider reads | Each step has the specified status; history is CREATED, SUBMITTED, APPROVED; second decision 409; outsider 404 |
| TEST-62 | AC-47 | Unit | Boundary values of title, items, quantity, price | validateRequestInput | Accepts exactly the valid boundaries and reports a message for each invalid field |
| TEST-63 | AC-48 | Unit (client) | Values such as 261, 0.5, 1000000 and item rows | formatBaht, estimateTotal | `฿261.00`, `฿0.50`, `฿1,000,000.00`; estimate sums only valid rows |
