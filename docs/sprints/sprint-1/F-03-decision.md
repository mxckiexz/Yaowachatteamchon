# Feature contract F-03: Approver decision

Contract version 1.0. Written before implementation.

Linked requirements: FR-06. Rules: BR-01, BR-04, BR-05, BR-06, BR-07, BR-08. Depends on: F-02.

## 1. Feature design

Behavior: the approver assigned to a PENDING request approves or rejects it. A rejection needs a reason. The decision is final and recorded in the request and in the history.

Workflow:
1. Approver opens a request from the Review queue.
2. Approver presses Approve, or presses Reject and writes a reason.
3. The UI shows the title and total and asks for confirmation.
4. Server checks in this order: session (401), role APPROVER (403), the request exists (404), the caller is not the requester (403 `SELF_APPROVAL`), the caller is the assigned approver (403 `NOT_ASSIGNED`), the decision value and reason (422), then performs one conditional update that changes the status only if it is still PENDING (409 otherwise).
5. In the same transaction the server writes one history entry with actor, from status PENDING, to status, comment.

Status transition table (BR-01):

| From | To | Allowed |
|---|---|---|
| DRAFT | PENDING | yes (F-02 submit) |
| PENDING | APPROVED | yes (decision) |
| PENDING | REJECTED | yes (decision) |
| any other pair, including APPROVED or REJECTED to anything | | no |

Errors:

| Case | Status | Code |
|---|---|---|
| Caller is an EMPLOYEE | 403 | `FORBIDDEN` |
| Request does not exist | 404 | `NOT_FOUND` |
| Caller is the requester | 403 | `SELF_APPROVAL` |
| Caller is an approver but not the assigned one | 403 | `NOT_ASSIGNED` |
| Decision is not APPROVED or REJECTED | 422 | `VALIDATION_ERROR` |
| Rejection with a comment shorter than 5 characters | 422 | `REASON_REQUIRED` |
| Status is not PENDING (already decided, or still DRAFT) | 409 | `ILLEGAL_TRANSITION` |

Permissions: role APPROVER, assigned to the request, and not its requester. An approval comment is optional, up to 500 characters.

## 2. UI specification

Review queue `/reviews` lists PENDING requests assigned to the user (title, requester, total, submitted time). Opening one shows items, justification and history, and two buttons: Approve and Reject. Reject opens a reason field with the message "Reason is required (at least 5 characters)". After a decision the page shows the new status badge, the decision comment and the new history entry, and the buttons disappear. The server still enforces every rule if someone sends the call directly.

## 3. API specification

`POST /api/requests/:id/decision`

Request: `{ "decision": "REJECTED", "comment": "Over budget this month" }`

Response 200: `{ "request": { "id": 12, "status": "REJECTED", "decidedAt": "...", "decisionComment": "Over budget this month", ... } }`

## 4. Data

Updates `PurchaseRequest.status`, `decidedAt`, `decisionComment`; inserts one `RequestHistory` row with `fromStatus` PENDING. The conditional update is `UPDATE ... WHERE id = ? AND status = 'PENDING'`; zero rows changed means conflict.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-19 | The assigned approver approves a PENDING request: 200, status APPROVED, decidedAt set. |
| AC-20 | The assigned approver rejects with a reason of 5 or more characters: REJECTED and the comment stored. A rejection without a reason, or with fewer than 5 characters, returns 422 `REASON_REQUIRED` and the status stays PENDING. |
| AC-21 | An EMPLOYEE calling the decision route gets 403; the request does not change. |
| AC-22 | An approver who is not the assigned approver gets 403 `NOT_ASSIGNED`; the request does not change. |
| AC-23 | The requester cannot decide their own request, even if their role is APPROVER: 403 `SELF_APPROVAL`; the request does not change. |
| AC-24 | A decided request cannot be decided again (409), and a DRAFT cannot be decided (409). Nothing changes. |
| AC-25 | Two simultaneous decisions on one PENDING request: exactly one succeeds (200) and the other gets 409; the request has one decision and one decision history row. |
| AC-26 | Each decision writes exactly one history row with actor, from PENDING, to the new status, and the comment. |
| AC-32 | In the browser: the approver sees the queue, approves one and rejects another with a reason; the buttons disappear after the decision; an employee has no Review link and gets no data from the review routes. |

## 6. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-25 | AC-19, AC-26 | API integration | PENDING request assigned to approver A | A approves with comment "OK" | 200 APPROVED; decidedAt set; history has exactly one new row: actor A, PENDING to APPROVED, comment "OK" |
| TEST-26 | AC-20, AC-26 | API integration | PENDING assigned to A | A rejects with "Over budget" | 200 REJECTED; decisionComment stored; one new history row with REJECTED |
| TEST-27 | AC-20 | API integration | PENDING assigned to A | Reject with no comment, with "abcd" (4 characters), with "abcde" (5 characters) | 422 `REASON_REQUIRED` and still PENDING; 422 and PENDING; 200 REJECTED |
| TEST-28 | AC-21 | API integration | PENDING request; logged in as an EMPLOYEE | POST decision APPROVED | 403; status PENDING; no new history row |
| TEST-29 | AC-22 | API integration | PENDING assigned to A; logged in as approver B | POST decision APPROVED | 403 `NOT_ASSIGNED`; status PENDING |
| TEST-30 | AC-23 | API integration | PENDING request whose requester and assigned approver are the same APPROVER user (created in the database directly) | That user approves | 403 `SELF_APPROVAL`; status PENDING |
| TEST-31 | AC-24 | API integration | An APPROVED request | A rejects it | 409 `ILLEGAL_TRANSITION`; still APPROVED; history unchanged |
| TEST-32 | AC-24 | API integration | A DRAFT request | An approver decides it | 409 or 403 without changing the status; status remains DRAFT |
| TEST-33 | AC-25 | API integration | PENDING assigned to A | Two decisions (APPROVED and REJECTED) sent at the same time | One 200 and one 409; one decision history row; final status matches the 200 response |
| TEST-34 | AC-19 to AC-24 | Unit | All pairs of statuses | canTransition(from, to) | Only DRAFT to PENDING, PENDING to APPROVED, PENDING to REJECTED return true |
| TEST-48 | AC-32 | UI end to end | One submitted request assigned to the approver | Log in as approver, approve; submit and reject another with a reason; check the requester's view | Queue shows requests; badges change; buttons gone; requester sees the decision and comment |
| TEST-49 | AC-32, AC-21 | UI end to end plus API | Logged in as an employee | Look for the Review link; open `/reviews`; call `GET /api/reviews` and the decision route from the page | No Review link; redirected or shown no data; API returns 403 |
