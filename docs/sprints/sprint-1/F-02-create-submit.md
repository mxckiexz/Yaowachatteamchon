# Feature contract F-02: Create and submit a purchase request

Contract version 1.0. Written before implementation.

Linked requirements: FR-02, FR-03. Rules: BR-01, BR-02, BR-04, BR-05, BR-09. Depends on: F-01.

## 1. Feature design

Behavior: a logged-in user creates a purchase request with a title, a justification and items. The server validates it, calculates the total and stores it as DRAFT with a CREATED history entry. The owner then submits it to one approver. The status becomes PENDING and a SUBMITTED history entry is written.

Workflow:
1. User opens New request, fills the form, adds one or more item rows, presses Save draft.
2. Server validates (BR-02), converts baht to satang, calculates the total from items, stores request and items, writes history CREATED.
3. The owner opens the request, picks an approver from the list, presses Submit.
4. Server checks: owner, status DRAFT, approver valid (BR-04, BR-05). Then sets PENDING, approverId, submittedAt and writes history SUBMITTED, in one transaction.

Business rules and validation:

| Field | Rule |
|---|---|
| title | required, 3 to 120 characters after trimming |
| justification | optional, up to 1000 characters |
| items | at least 1, at most 50 |
| item name | required, 1 to 100 characters |
| quantity | whole number 1 to 1000 |
| unitPrice | number greater than 0, at most 1,000,000, at most 2 decimals |
| total | ignored if sent; calculated by the server |
| approver | an active user with role APPROVER, not the requester |

Errors:

| Case | Status | Code |
|---|---|---|
| Validation fails | 422 | `VALIDATION_ERROR` with `fields` |
| Request not found, or not owned by the caller | 404 | `NOT_FOUND` |
| Submit when the status is not DRAFT | 409 | `ILLEGAL_TRANSITION` |
| Approver equals the requester | 422 | `SELF_REVIEW` |
| Approver unknown, inactive or not an approver | 422 | `INVALID_APPROVER` |

Permissions: any authenticated user may create. Only the owner may submit. Dependencies: F-01 session.

## 2. UI specification

Screen `/requests/new`: Title, Justification, an items table (Item, Quantity, Unit price, a Remove button per row, an Add item button), a read-only "Estimated total" that updates as the user types (a hint only; the server decides), a Save draft button. Field errors appear beside each field, including server errors. After saving, go to the request detail.

Request detail for the owner of a DRAFT: an approver drop-down (from `GET /api/approvers`) and a Submit button. After submit the page shows status PENDING and the approver's name.

## 3. API specification

`POST /api/requests`

Request: `{ "title": "Printer paper", "justification": "Stock is empty", "items": [ { "name": "A4 paper box", "quantity": 4, "unitPrice": 250.5 } ] }`

Response 201: `{ "request": { "id": 12, "title": "...", "justification": "...", "status": "DRAFT", "total": 1002, "items": [ { "id": 1, "name": "A4 paper box", "quantity": 4, "unitPrice": 250.5 } ], "requester": { "id": 3, "name": "Ploy" }, "approver": null, "createdAt": "...", "submittedAt": null, "decidedAt": null, "decisionComment": null } }`

`POST /api/requests/:id/submit`

Request: `{ "approverId": 1 }`. Response 200: `{ "request": { ... "status": "PENDING", "approver": { "id": 1, "name": "Somchai" } } }`. Errors as in section 1.

`GET /api/approvers`

Response 200: `{ "approvers": [ { "id": 1, "name": "Somchai" } ] }`. Lists active users with role APPROVER except the caller.

## 4. Data

Tables `PurchaseRequest`, `RequestItem`, `RequestHistory` as in the System SDS section 2, created by the migration `init`. Constraints: `quantity` between 1 and 1000 and `unitPriceSatang` greater than 0 are CHECK constraints; foreign keys from items and history to the request.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-11 | A valid request is stored with status DRAFT. Its total equals the sum of quantity times unit price calculated by the server; a total sent by the client is ignored. A CREATED history entry exists. |
| AC-12 | Invalid input returns 422 with a message for each invalid field and stores nothing. Boundaries: title of 2 characters fails and 3 passes; quantity 0 and 1001 fail, 1 and 1000 pass; price 0 and 1,000,000.01 and 10.505 fail, 0.01 and 1,000,000 pass; no items fails. |
| AC-13 | The owner submits a DRAFT to a valid approver: 200, status PENDING, approver set, a SUBMITTED history entry exists. |
| AC-14 | Submitting with the requester as approver returns 422 `SELF_REVIEW`; the request stays DRAFT. |
| AC-15 | Submitting to an EMPLOYEE, an inactive approver, or an unknown id returns 422 `INVALID_APPROVER`; the request stays DRAFT. |
| AC-16 | A user who is not the owner gets 404 when submitting. Submitting a request that is not DRAFT returns 409 `ILLEGAL_TRANSITION` and changes nothing. |
| AC-17 | `GET /api/approvers` returns the active approvers except the caller. |
| AC-18 | In the browser: the form adds and removes item rows, shows an estimated total, shows field errors, saves a draft, and the owner can submit it to an approver. |

## 6. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-13 | AC-11 | API integration | Logged in as employee; two items (2 x 100.50 and 3 x 20) and a client `total: 1` | POST requests | 201; status DRAFT; total 261; stored row has 26100 satang; one CREATED history row |
| TEST-14 | AC-11 | Unit | Item list | calculateTotalSatang | Sum of quantity times price in satang; 0.1 x 3 gives 30 satang exactly |
| TEST-15 | AC-12 | API integration | Title of 2 characters, then 3, then empty | POST requests | 422 with `fields.title`; 201; 422; no row stored for failures |
| TEST-16 | AC-12 | API integration | Quantity 0, 1001, 1, 1000, 1.5; no items | POST requests | Failures 422 with `fields`; boundary passes 201 |
| TEST-17 | AC-12 | API integration | Price 0, -1, 10.505, 1000000.01, 0.01, 1000000 | POST requests | Failures 422; 0.01 and 1000000 pass 201 |
| TEST-18 | AC-13 | API integration | Own DRAFT; active approver | POST submit | 200 PENDING; approver set; history has CREATED then SUBMITTED |
| TEST-19 | AC-14 | API integration | Approver user owns a DRAFT | POST submit with own id | 422 `SELF_REVIEW`; status still DRAFT |
| TEST-20 | AC-15 | API integration | Own DRAFT | Submit to an employee id, an inactive approver, id 999999 | Each 422 `INVALID_APPROVER`; still DRAFT |
| TEST-21 | AC-16 | API integration | A DRAFT owned by another user | POST submit as a different user | 404; status unchanged |
| TEST-22 | AC-16 | API integration | A PENDING request | POST submit again | 409 `ILLEGAL_TRANSITION`; approver and history unchanged |
| TEST-23 | AC-17 | API integration | Two active approvers, one inactive approver, one employee | GET approvers as an approver | Only the other active approver; no self, no inactive, no employee |
| TEST-24 | AC-11, AC-12 | Unit | Values 250.5, "12", 10.505, "abc" | bahtToSatang | 25050; 1200; invalid; invalid |
| TEST-46 | AC-18 | UI end to end | Logged in as employee | Fill the form with two rows, see the estimate, remove a row, save, choose approver, submit | Estimate updates; detail shows DRAFT then PENDING with the approver's name |
