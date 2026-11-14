# Feature contract F-04: Request lists, detail and history

Contract version 1.0. Written before implementation.

Linked requirements: FR-04, FR-05, FR-07. Rules: BR-03, BR-08. Depends on: F-02.

## 1. Feature design

Behavior: a user sees only their own requests. An approver also sees the PENDING requests assigned to them in a separate queue. A request detail shows the items, total, status, decision and an ordered history. A user who may not see a request gets "not found", as if it did not exist.

Rules:
- List "my requests": requests where the caller is the requester, newest first.
- Queue: PENDING requests where the caller is the assigned approver, oldest submitted first. Callers with role EMPLOYEE get 403.
- Detail: allowed for the requester and for the assigned approver. Anyone else gets 404 with no private data. An approver who was not assigned is "anyone else".
- History is ordered by time ascending, then id. It contains actor name, action, from and to status, comment and time.

Permissions: see the System SDS section 5. Dependencies: F-01, F-02, and F-03 for the decision history.

## 2. UI specification

`/requests`: table of the user's requests (title, status badge, total, created). Loading state, empty state "You have no requests yet" with a New request button, error state with a Retry button. Clicking a title opens the detail.

`/requests/:id`: header with title, status badge and total; justification; items table; decision comment when decided; history timeline (time, actor, action, comment). A request that is not visible shows "Request not found".

`/reviews`: table of PENDING requests assigned to the user; empty state "Nothing is waiting for you".

## 3. API specification

`GET /api/requests` Response 200: `{ "requests": [ { "id", "title", "status", "total", "createdAt", "approver": {id,name} or null } ] }`

`GET /api/requests/:id` Response 200: `{ "request": { id, title, justification, status, total, items: [...], requester: {id,name}, approver: {id,name} or null, createdAt, submittedAt, decidedAt, decisionComment, history: [ { id, action, fromStatus, toStatus, comment, createdAt, actor: {id,name} } ] } }`. Errors 401, 404.

`GET /api/reviews` Response 200: `{ "requests": [ { "id", "title", "status", "total", "submittedAt", "requester": {id,name} } ] }`. Errors 401, 403.

## 4. Data

Reads `PurchaseRequest`, `RequestItem`, `RequestHistory`, `User`. No schema change. All queries filter by the caller on the server.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-27 | The list returns only requests owned by the caller, newest first, with status and total. Another user's requests never appear. |
| AC-28 | Detail for the owner returns items, total, decision fields and the history in time order. |
| AC-29 | The assigned approver can read the detail of a request assigned to them. A user who is neither the owner nor the assigned approver (including another approver) gets 404 and no request data. |
| AC-30 | The review queue returns the caller's assigned PENDING requests only. An EMPLOYEE gets 403 with no data. |
| AC-31 | Saved results persist: after a page reload the created, submitted and decided request is shown with the same data. |

## 6. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-35 | AC-27 | API integration | User A has 2 requests, user B has 1 | GET requests as A, then as B | A sees exactly its 2, newest first; B sees only its 1; no cross-over |
| TEST-36 | AC-28 | API integration | A request that was created, submitted and approved | GET detail as owner | Items and total right; decision fields set; history is CREATED, SUBMITTED, APPROVED in order |
| TEST-37 | AC-29 | API integration | PENDING request assigned to approver A | GET detail as A | 200 with the request |
| TEST-38 | AC-29 | API integration | Request owned by U1 and assigned to A | GET detail as employee U2, as approver B (not assigned) | Both 404; the body has no title or items |
| TEST-39 | AC-30 | API integration | PENDING requests assigned to A and to B, and one DRAFT | GET reviews as A | Only A's PENDING request |
| TEST-40 | AC-30 | API integration | Logged in as an employee | GET reviews | 403; body has no requests |
| TEST-47 | AC-31 | UI end to end | A created, submitted, decided request | Reload the detail page and the list page | Same status, total, items and history |
