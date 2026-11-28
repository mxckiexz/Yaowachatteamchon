# Feature contract F-03: Approve or reject a request

Contract version 2.1. Written before implementation.

Linked requirements: FR-07, FR-08, FR-09, FR-11, FR-13. Rules: BR-07, BR-08, BR-09, BR-11, BR-17. NFR-06. Depends on: F-02.

## Change log
| Version | Date | Change |
|---|---|---|
| 2.0 | Before implementation | Initial approve/reject contract. |
| 2.1 | 28 November 2026 | F-13 revision: AC-28/TEST-41 legacy any-approver behavior applies only when no approval chain is configured. |

## 1. Feature design

Behavior: an approver approves or rejects a SUBMITTED request. A rejection needs a reason. The decision is final and recorded in the request and in the history.

Workflow:
1. The approver opens a submitted request from the Review queue.
2. The approver presses Approve (optional comment), or Reject (reason required). The UI shows the request number, item and total and asks for confirmation.
3. The server checks in this order: session (401), role APPROVER (403), the request exists and the caller may see it (404; an approver never sees another user's draft), the caller is not the requester (403 `SELF_APPROVAL`), then for a rejection the reason (422 `REASON_REQUIRED`), then one conditional update that changes the status only while it is still SUBMITTED (409 otherwise).
4. In the same transaction the server writes one history entry (actor, from SUBMITTED, to the new status, comment).

Status transition table:

| From | To | Allowed in Sprint 1 |
|---|---|---|
| DRAFT | SUBMITTED | yes (F-02) |
| SUBMITTED | APPROVED | yes |
| SUBMITTED | REJECTED | yes |
| DRAFT or SUBMITTED | CANCELLED | no (Sprint 2) |
| any other pair, including APPROVED, REJECTED and CANCELLED to anything | | no |

Errors:

| Case | Status | Code |
|---|---|---|
| Caller is a requester or the administrator | 403 | `FORBIDDEN` |
| Request does not exist, or is a draft of someone else | 404 | `NOT_FOUND` |
| Caller is the requester of the request | 403 | `SELF_APPROVAL` |
| Rejection with a reason shorter than 5 characters | 422 | `REASON_REQUIRED` |
| Comment longer than 500 characters | 422 | `VALIDATION_ERROR` |
| Status is not SUBMITTED (already decided, draft, cancelled) | 409 | `ILLEGAL_TRANSITION` |

Permissions: role APPROVER, not the requester of the request. There is no assignment: any other approver can decide it (SRS D-03).

## 2. UI specification

The request detail shows, to an approver who may decide, two buttons: Approve and Reject. Reject opens a reason field with "Reason is required (at least 5 characters)". After a decision the page shows the new status badge, the rejection reason or comment and the new history entry, and the buttons disappear. Requesters and the administrator see no decision buttons. The server enforces every rule even if someone sends the call directly.

## 3. API specification

`POST /api/requests/:id/approve` request: `{ "comment": "Go ahead" }` (comment optional). Response 200: `{ "request": { ... "status": "APPROVED", "decidedAt": "..." } }`.

`POST /api/requests/:id/reject` request: `{ "reason": "Over budget this month" }`. Response 200: `{ "request": { ... "status": "REJECTED", "rejectionReason": "Over budget this month" } }`.

## 4. Data

Updates `PurchaseRequest.status`, `decidedAt`, `rejectionReason`; inserts one `RequestHistory` row with `fromStatus` SUBMITTED. The conditional update is `UPDATE ... WHERE id = ? AND status = 'SUBMITTED'`; zero rows changed means conflict.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-24 | An approver approves a SUBMITTED request of another user: 200, status APPROVED, `decidedAt` set, one history entry with actor, SUBMITTED to APPROVED and the comment. |
| AC-25 | An approver rejects with a reason of 5 or more characters: REJECTED, the reason stored in `rejectionReason` and in the history. A rejection without a reason or with fewer than 5 characters returns 422 `REASON_REQUIRED` and the status stays SUBMITTED. |
| AC-26 | A requester and the administrator calling approve or reject get 403; the request does not change. |
| AC-27 | An approver cannot approve or reject their own request: 403 `SELF_APPROVAL`; the request does not change. |
| AC-28 | For a request with no configured approval chain, another approver who is not the requester can decide a SUBMITTED request (there is no assignment). F-13 revises this for configured requests: only the current assigned approver can decide. |
| AC-29 | A decided request cannot be decided again (409). A draft of another user is not found (404). A CANCELLED request cannot be decided (409). Nothing changes. |
| AC-30 | Two simultaneous decisions on one SUBMITTED request: exactly one succeeds (200) and the other gets 409; the request has one decision and one decision history row. |
| AC-31 | The transition rule allows only DRAFT to SUBMITTED, SUBMITTED to APPROVED and SUBMITTED to REJECTED. |
| AC-32 | In the browser: the approver approves one request and rejects another with a reason; the buttons disappear after the decision; the requester sees the outcome and the reason; a requester has no decision buttons and the API refuses the call. |

## 6. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-36 | AC-24 | API integration | SUBMITTED request of a requester | Approver approves with comment "OK" | 200 APPROVED; `decidedAt` set; one new history row: actor, SUBMITTED to APPROVED, "OK" |
| TEST-37 | AC-25 | API integration | SUBMITTED request | Approver rejects with "Over budget" | 200 REJECTED; `rejectionReason` stored; one new history row with REJECTED and the reason |
| TEST-38 | AC-25 | API integration | SUBMITTED request | Reject with no reason, "abcd" (4), "    ", then "abcde" (5) | 422 `REASON_REQUIRED` and still SUBMITTED for the first three; 200 REJECTED for the last |
| TEST-39 | AC-26 | API integration | SUBMITTED request | Requester, then administrator, call approve and reject | 403 each; status SUBMITTED; no new history row |
| TEST-40 | AC-27 | API integration | An approver creates and submits their own request | The same approver approves it, then rejects it | 403 `SELF_APPROVAL` both times; still SUBMITTED |
| TEST-41 | AC-28 | API integration | SUBMITTED request with no configured chain | A second approver approves | 200 APPROVED; configured-chain behavior is covered by F-13 |
| TEST-42 | AC-29 | API integration | An APPROVED request | Approver rejects it | 409 `ILLEGAL_TRANSITION`; still APPROVED; history unchanged |
| TEST-43 | AC-29 | API integration | A DRAFT of a requester | An approver approves it | 404; still DRAFT |
| TEST-44 | AC-29 | API integration | A CANCELLED request (made in the database) | An approver approves it | 409; still CANCELLED |
| TEST-45 | AC-30 | API integration | SUBMITTED request | Approve and reject sent at the same time | One 200 and one 409; one decision history row; final status matches the 200 response |
| TEST-46 | AC-31 | Unit | All pairs of statuses | canTransition(from, to) | Only DRAFT>SUBMITTED, SUBMITTED>APPROVED, SUBMITTED>REJECTED are true |
| TEST-72 | AC-32 | UI end to end | Two submitted requests | Approver approves one and rejects another (first without a reason); the requester opens both | Buttons gone after the decision; message for the missing reason; requester sees status, reason and history |
| TEST-73 | AC-26, AC-32 | UI end to end plus API | Logged in as a requester | Open a submitted request; call approve through the API | No decision buttons; 403 |
