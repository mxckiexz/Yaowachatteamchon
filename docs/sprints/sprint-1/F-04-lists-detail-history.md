# Feature contract F-04: Lists, detail and history

Contract version 2.0. Written before implementation.

Linked requirements: FR-04, FR-06, FR-10, FR-11, FR-12. Rules: BR-12. NFR-02, NFR-07. Depends on: F-02 (and F-03 for decision history).

## 1. Feature design

Behavior: a user sees their own requests. An approver also sees the submitted requests of others in a review queue, and can open any request that is not a draft. The administrator can list and open every request, read only. A request detail shows the data, the latest status and an ordered history. A user who may not see a request gets "not found", as if it did not exist.

Rules:
- `scope=mine` (default): requests whose requester is the caller, newest first.
- `scope=review`: requests with status SUBMITTED whose requester is not the caller, oldest submission first. Role APPROVER only (403 otherwise).
- `scope=all`: every request, newest first. Role ADMIN only (403 otherwise).
- Detail and history: the owner; every approver for a request that is not a draft; the administrator for all. Anyone else gets 404 with no private data.
- History is ordered by time ascending, then id. Each entry has actor name, action, from and to status, comment and time.

Permissions: see the System SDS section 5. Dependencies: F-01, F-02.

## 2. UI specification

`/requests`: table of the user's requests (number, item, status badge, total, created). Loading state, empty state "You have no requests yet" with a New request button, error state with a Retry button. Clicking the number opens the detail.

`/reviews` (approver): table of submitted requests of others (number, item, requester, total, submitted); empty state "Nothing is waiting for you".

`/all-requests` (administrator): the same table with the requester column, read only.

`/requests/:id`: header with number, item and status badge; requester and dates; description, quantity, unit price, total, reason, category; the rejection reason when rejected; the history timeline (time, actor, action, comment). A request that is not visible shows "Request not found".

## 3. API specification

`GET /api/requests?scope=mine|review|all` response 200: `{ "requests": [ { "id", "requestNumber", "itemName", "quantity", "total", "category", "status", "createdAt", "submittedAt", "requester": {id,name} } ] }`

`GET /api/requests/:id` response 200: `{ "request": { ...all fields of F-02..., "history": [ { "id", "action", "fromStatus", "toStatus", "comment", "createdAt", "actor": {id,name} } ] } }`. Errors 401, 404.

`GET /api/requests/:id/history` response 200: `{ "history": [ ... ] }`, same visibility as the detail.

## 4. Data

Reads `PurchaseRequest`, `RequestHistory`, `User`. No schema change. All queries filter by the caller on the server.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-33 | `scope=mine` returns only requests owned by the caller, newest first, with number, status and total. Another user's requests never appear. |
| AC-34 | `scope=review` returns the SUBMITTED requests of other users to an approver, oldest first, without drafts, decided requests and the approver's own requests. A requester or the administrator gets 403 and no data. |
| AC-35 | Detail for the owner returns every field, the rejection reason when there is one, and the history in time order. An approver can open any request that is not a draft; a draft of someone else gives 404. Another requester gets 404 and no request data. |
| AC-36 | `GET /api/requests/:id/history` returns the history in time order with the same visibility as the detail. |
| AC-37 | `scope=all` returns every request to the administrator; a requester or an approver gets 403 and no data. The administrator can read but all write routes refuse them (see F-02 and F-03). |
| AC-38 | Saved results persist: after a page reload the created, submitted and decided request is shown with the same data. |

## 6. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-51 | AC-33 | API integration | Requester A has 2 requests, requester B has 1 | GET requests as A, then as B | A sees exactly its 2, newest first, with number, status and total; B only its 1 |
| TEST-52 | AC-34 | API integration | Submitted requests of two requesters, one draft, one approved, one submitted request of the approver | GET `scope=review` as the approver | Only the submitted requests of others, oldest first |
| TEST-53 | AC-34 | API integration | Logged in as a requester, then as the administrator | GET `scope=review` | 403; no `requests` in the body |
| TEST-54 | AC-35 | API integration | A request created, submitted and approved | GET detail as the owner | Fields right; history is CREATED, SUBMITTED, APPROVED in order; for a rejected one `rejectionReason` is shown |
| TEST-55 | AC-35 | API integration | A submitted request and a draft of a requester | GET detail as an approver | 200 for the submitted one; 404 for the draft |
| TEST-56 | AC-35 | API integration | A submitted request of requester A | GET detail as requester B, with a control that A can read it | B gets 404 and no data (the control proves the 404 is a refusal) |
| TEST-57 | AC-36 | API integration | A decided request | GET history as the owner, as an approver, as another requester | Ordered entries for the first two; 404 for the third |
| TEST-58 | AC-37 | API integration | Requests of several users | GET `scope=all` as the administrator, as a requester, as an approver | All requests; 403; 403 |
| TEST-74 | AC-38 | UI end to end | A created, submitted, decided request | Reload the detail page and the list page | Same status, total, reason and history |
