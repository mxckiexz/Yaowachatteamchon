# Feature contract F-11: Return for editing

Contract version 1.0, 28 November 2026. Contract only; implementation follows after review. Tracks Issue #64 and implements FR-21.

Linked requirements: FR-21, BR-11, BR-12, BR-17, NFR-01, NFR-02, NFR-04, NFR-06, NFR-07 and NFR-10. Depends on F-02 (owner edit and resubmit), F-03 (approver decision permissions), F-04 (visibility/history), and F-06 (cancelled requests cannot be returned). If a later feature changes the editable statuses or adds another approver role, this contract must be revised.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 28 November 2026 | Initial F-11 contract proposed for review. |

## 1. Feature design

An approver can return another user's submitted request to the requester for correction. Returning is a state transition from `SUBMITTED` to `DRAFT`; it does not approve or reject the request. The requester can edit the draft and submit it again.

New business rule:

- **BR-26:** Only an approver who is not the requester may return a `SUBMITTED` request. The return reason is required, trimmed, and 5 to 500 characters. A returned request has one `RETURNED` history entry and no decision timestamp.

The administrator cannot return a request. A requester cannot return any request, including their own. `APPROVED`, `REJECTED`, `CANCELLED` and `DRAFT` requests cannot be returned.

The transition is atomic with its history insert. A concurrent approve, reject, cancel or second return results in exactly one successful transition and one history entry; the other call receives `409`.

## 2. UI specification

On a request detail page, an approver sees a **Return for editing** action only for another user's `SUBMITTED` request. The action opens a form with a labelled **Reason** textarea and **Return for editing** and **Cancel** buttons. The reason is shown before confirmation and must be 5 to 500 characters after trimming. On success the page shows the request as `DRAFT`, the return reason in history, and the owner can edit and submit it again. The requester sees no return control.

The controls are keyboard reachable in reading order. While the request is being returned, the submit button is disabled. Errors are shown in a `role="alert"` region without clearing the typed reason. After success, focus moves to the request status heading; after cancelling the form, focus returns to the action button.

## 3. API specification

| Method and path | Success |
|---|---|
| `POST /api/requests/:id/return` | `200 { "request": <updated request> }` |

The JSON body is `{ "reason": "..." }`. The server sets the actor, old status, new status and history timestamp. Clients cannot set status, requester, decision timestamps or history fields.

### Errors and order of checks

Checks run in this order:

1. Foreign `Origin` on a state-changing request: `403` existing error.
2. No valid session: `401` existing error.
3. Caller is not an approver: `403 FORBIDDEN`.
4. Request is missing, hidden, or owned by the caller: `404 NOT_FOUND`.
5. Request is not `SUBMITTED`: `409 ILLEGAL_TRANSITION`.
6. Missing, blank, shorter than 5 or longer than 500 characters: `422 VALIDATION_ERROR` with `fields.reason`.
7. A concurrent state change wins: `409 ILLEGAL_TRANSITION`; no return history is written.

The request status update and `RETURNED` history insert run in one transaction. Unexpected errors return the existing safe `500` body.

## 4. Data and migration

The `RequestStatus` enum already contains `DRAFT` and `SUBMITTED`. `HistoryAction` needs one additive enum value, `RETURNED`, and the migration must not alter existing rows. No new table is needed. The `RequestHistory.comment` field stores the return reason, as it already stores approval and rejection text.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-160 | An approver returns another user's `SUBMITTED` request with a valid reason and receives 200; the request is `DRAFT`. |
| AC-161 | The returned response contains the updated request and no client-supplied status or history fields are trusted. |
| AC-162 | A `RETURNED` history row stores the approver, `SUBMITTED` to `DRAFT`, reason and timestamp. |
| AC-163 | The owner can edit and resubmit a returned request. |
| AC-164 | Only an approver may return, and an approver cannot return their own request. |
| AC-165 | DRAFT, APPROVED, REJECTED and CANCELLED requests cannot be returned and produce 409. |
| AC-166 | Missing, blank, short and overlong reasons produce 422 with `fields.reason`; valid boundary lengths are accepted. |
| AC-167 | Hidden, missing and non-numeric request ids return 404 without request data. |
| AC-168 | Anonymous calls return 401 and a foreign Origin returns 403 before the body is processed. |
| AC-169 | Concurrent return/decision/cancel attempts allow exactly one transition and one history row. |
| AC-170 | A failed history insert rolls back the status change. |
| AC-171 | The UI shows the action only when eligible, confirms the reason, preserves errors, and moves focus as specified. |
| AC-172 | The returned request remains visible to its owner, is editable, and is not visible in the review queue until resubmitted. |

## 6. Software test specification

| Test | AC | Level | Expected result |
|---|---|---|---|
| TEST-191 | AC-160 to AC-162 | API integration | Valid return gives 200, DRAFT and one correct RETURNED history row |
| TEST-192 | AC-163 | API integration | Owner edits and submits the returned request successfully |
| TEST-193 | AC-164 | API integration | Requester, administrator and self-approver are refused; only another approver succeeds |
| TEST-194 | AC-165 | API integration | Each ineligible status returns 409 and does not add history |
| TEST-195 | AC-166 | API integration | Reason boundaries and invalid values return the specified 422/200 results |
| TEST-196 | AC-167 | API integration | Hidden, missing and non-numeric ids return 404 with no data |
| TEST-197 | AC-168 | API/security integration | Anonymous and foreign-origin calls return 401/403 before processing |
| TEST-198 | AC-169 | API integration | Concurrent return and decision/cancel produce one successful transition and one history row |
| TEST-199 | AC-170 | API integration | Forced history failure rolls back the status and leaves history unchanged |
| TEST-200 | AC-171 | Browser end to end | Eligible action, reason form, error retention, keyboard focus and success state work |
| TEST-201 | AC-172 | API and browser | Returned request is editable, owner-visible and absent from review until resubmitted |

## 7. Definition of Done

- Contract reviewed and approved before implementation; later changes get a new version and change-log entry.
- Tests are written first, with red and green output under `docs/sprints/sprint-2/tdd/`.
- Every AC has a test and an executed result; server, client, type check, build and browser tests pass.
- Raw server and Playwright output is stored under `docs/sprints/sprint-2/test-output/`.
- Migration is additive and preserves existing request and history rows.
- SRS, feature inventory, traceability and System SDS are updated together with the implementation.
- Implementation PR references and closes Issue #64 and is merged into `staging` after review.
