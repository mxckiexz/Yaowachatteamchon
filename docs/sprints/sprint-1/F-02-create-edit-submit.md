# Feature contract F-02: Create, edit and submit a purchase request

Contract version 2.1. Written before implementation.

## Change log

| Version | Date | Change |
|---|---|---|
| 2.0 | Before implementation | Initial create, edit and submit contract. |
| 2.1 | 29 November 2026 | F-14 revision of AC-18: a complete draft can be submitted only when its approval chain also meets BR-42 (specified and tested by F-14, TEST-354 and TEST-355). |

Linked requirements: FR-01, FR-02, FR-03, FR-14. Rules: BR-01 to BR-06, BR-10, BR-14, BR-15, BR-18. NFR-08. Depends on: F-01.

## 1. Feature design

Behavior: a requester or approver creates a purchase request for one item. The server validates it, gives it a request number, calculates the total, and stores it as a DRAFT with a CREATED history entry. The owner may edit the draft. When the data is complete the owner submits it: the status becomes SUBMITTED and a SUBMITTED history entry is written.

Workflow:
1. The user opens New request, fills the form and presses Save draft.
2. The server validates (BR-01 to BR-04, BR-15), takes the next number from the database sequence (`PR-YYYY-NNNN`), calculates the total, stores the request, and writes the CREATED history entry in one transaction.
3. The owner may change the fields of the draft with Edit; the total is recalculated and the number stays the same.
4. The owner presses Submit. The server checks: owner, status DRAFT, complete data (BR-06). Then it sets SUBMITTED and `submittedAt` and writes the SUBMITTED history entry in one transaction.

Validation:

| Field | Rule |
|---|---|
| itemName | required, 1 to 100 characters after trimming |
| description | required, 1 to 1000 characters after trimming |
| quantity | whole number 1 to 1000 |
| unitPrice | number above 0, at most 1,000,000, at most 2 decimals |
| reason | optional in a draft, at most 500 characters; required to submit |
| category | optional in a draft; one of EQUIPMENT, SOFTWARE, FURNITURE, STATIONERY, OTHER; required to submit |
| total, status, requestNumber, requesterId | ignored if sent; owned by the server |

Errors:

| Case | Status | Code |
|---|---|---|
| Validation fails | 422 | `VALIDATION_ERROR` with `fields` |
| Reason or category missing at submit | 422 | `INCOMPLETE` with `fields` naming the missing ones |
| Request not found, or not owned by the caller (any role) | 404 | `NOT_FOUND` |
| Edit when the status is not DRAFT | 409 | `NOT_EDITABLE` |
| Submit when the status is not DRAFT | 409 | `ILLEGAL_TRANSITION` |
| The caller is an administrator | 403 | `FORBIDDEN` (create) |

Permissions: REQUESTER and APPROVER create. Only the owner edits or submits; for everyone else, including the administrator and approvers, the request is "not found". Dependencies: F-01 session.

## 2. UI specification

Screen `/requests/new`: Item name, Description, Quantity, Unit price, Reason, Category (list), a read-only "Estimated total" that updates while typing (a hint only; the server decides), a Save draft button. Field errors appear beside each field, including server errors. After saving, go to the request detail.

Request detail of a DRAFT for the owner: an Edit form with the same fields and a Submit button. If the data is incomplete the server's message names the missing fields. After submit the page shows SUBMITTED.

## 3. API specification

`POST /api/requests` request: `{ "itemName": "Laser printer", "description": "Office printer for floor 2", "quantity": 2, "unitPrice": 4500.5, "reason": "Old one broke", "category": "EQUIPMENT" }`

Response 201: `{ "request": { "id": 12, "requestNumber": "PR-2026-0007", "itemName": "...", "description": "...", "quantity": 2, "unitPrice": 4500.5, "total": 9001, "reason": "...", "category": "EQUIPMENT", "status": "DRAFT", "rejectionReason": null, "requester": { "id": 3, "name": "Ploy" }, "createdAt": "...", "updatedAt": "...", "submittedAt": null, "decidedAt": null } }`

`PATCH /api/requests/:id` request: any of the fields above (the rules apply to the merged result). Response 200: `{ "request": { ... } }`. Errors as in section 1.

`POST /api/requests/:id/submit` request: none. Response 200: `{ "request": { ... "status": "SUBMITTED" } }`.

## 4. Data

`PurchaseRequest`, `RequestHistory` and the sequence `request_number_seq` as in the System SDS section 2. CHECK constraints: quantity 1 to 1000, unitPriceSatang above 0, totalSatang not negative. Unique constraint on requestNumber.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-13 | A valid request is stored with status DRAFT and a request number of the form `PR-YYYY-NNNN`. The total equals quantity times unit price calculated by the server; a total sent by the client is ignored. A CREATED history entry exists. |
| AC-14 | Invalid input returns 422 with a message for each invalid field and stores nothing. Boundaries: item name empty fails, 100 characters pass, 101 fail; description empty fails; quantity 0, 1001 and 1.5 fail, 1 and 1000 pass; price 0, 1,000,000.01 and 10.505 fail, 0.01 and 1,000,000 pass; a category outside the list fails; a reason of 501 characters fails. |
| AC-15 | Request numbers are unique: 20 simultaneous creates give 20 different numbers, all of the right form. |
| AC-16 | The owner edits a DRAFT: the fields change, the total is recalculated, the request number and the status stay. The same validation applies. |
| AC-17 | Editing a request that is SUBMITTED, APPROVED, REJECTED or CANCELLED returns 409 `NOT_EDITABLE` and changes nothing. Anyone who is not the owner (another requester, an approver, the administrator) gets 404 and changes nothing. |
| AC-18 | The owner submits a complete DRAFT: 200, status SUBMITTED, `submittedAt` set, a SUBMITTED history entry exists. For a total that needs approval steps (BR-42, F-14), the chain must also be long enough. |
| AC-19 | Submitting a draft without a reason or without a category returns 422 `INCOMPLETE` naming the missing fields, and the request stays a DRAFT. |
| AC-20 | Submitting a request that is not a DRAFT returns 409 `ILLEGAL_TRANSITION`. Someone who is not the owner gets 404. Nothing changes. |
| AC-21 | Editing or submitting one user's request never changes the stored data of another user's request. |
| AC-22 | A requester and an approver can create requests; the administrator gets 403 and nothing is stored. |
| AC-23 | In the browser: the form shows an estimated total and field errors, saves a draft, the owner edits it, and submits it; an incomplete draft is refused with a message. |

## 6. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-16 | AC-13 | API integration | Logged-in requester; quantity 2, price 100.50, client `total: 1` | POST requests | 201; DRAFT; number matches `PR-\d{4}-\d{4}`; total 201; stored 20100 satang; one CREATED history row |
| TEST-17 | AC-13 | Unit | Quantity and price in satang | calculateTotalSatang | Exact product; 0.1 baht times 3 gives 30 satang |
| TEST-18 | AC-14 | API integration | Empty and 101-character item name; empty description | POST requests | 422 with `fields.itemName` or `fields.description`; nothing stored; 100 characters pass |
| TEST-19 | AC-14 | API integration | Quantity 0, 1001, 1.5, 1, 1000 | POST requests | Failures 422; 1 and 1000 give 201 |
| TEST-20 | AC-14 | API integration | Price 0, -1, 10.505, 1000000.01, 0.01, 1000000 | POST requests | Failures 422; 0.01 and 1000000 give 201 |
| TEST-21 | AC-14 | API integration | Category `FOOD`, `equipment`, a valid one; reason of 501 characters | POST requests | 422 for the invalid ones; 201 for the valid category |
| TEST-22 | AC-15 | API integration | 20 simultaneous creates | POST requests in parallel | 20 distinct request numbers, all of the right form |
| TEST-23 | AC-16 | API integration | Own DRAFT | PATCH quantity, price and item name | 200; total recalculated; number and status unchanged; invalid values give 422 |
| TEST-24 | AC-17 | API integration | Requests in SUBMITTED, APPROVED, REJECTED (and CANCELLED made in the database) | PATCH each as the owner | 409 `NOT_EDITABLE`; data unchanged |
| TEST-25 | AC-17 | API integration | A DRAFT of requester A | PATCH as requester B, as an approver, as the administrator | Each 404; data unchanged |
| TEST-26 | AC-18 | API integration | Complete own DRAFT | POST submit | 200 SUBMITTED; `submittedAt` set; history is CREATED then SUBMITTED |
| TEST-27 | AC-19 | API integration | DRAFT without reason; DRAFT without category | POST submit | 422 `INCOMPLETE` with the field names; still DRAFT |
| TEST-28 | AC-20 | API integration | A SUBMITTED request | POST submit again | 409 `ILLEGAL_TRANSITION`; history unchanged |
| TEST-29 | AC-20 | API integration | A DRAFT of requester A | POST submit as requester B and as an approver | Each 404; still DRAFT |
| TEST-30 | AC-21 | API integration | Requests of A and B | A edits and submits their own | B's row (all fields, updatedAt, history) is identical before and after |
| TEST-31 | AC-22 | API integration | Logged-in administrator | POST requests | 403; nothing stored |
| TEST-32 | AC-22 | API integration | Logged-in approver | POST requests | 201 DRAFT owned by the approver |
| TEST-33 | AC-13, AC-14 | Unit | Values 250.5, "12", 10.505, "abc" | bahtToSatang | 25050; 1200; invalid; invalid |
| TEST-34 | AC-14 | Unit | Boundary values of every field | validateRequestInput | Accepts exactly the valid boundaries; names every invalid field; trims text; never reads a total |
| TEST-71 | AC-23 | UI end to end | Logged in as a requester | Fill the form, see the estimate, save, edit, try to submit without a reason, add it, submit | Estimate updates; field errors shown; the incomplete submit is refused with a message; the detail shows DRAFT, then SUBMITTED |
