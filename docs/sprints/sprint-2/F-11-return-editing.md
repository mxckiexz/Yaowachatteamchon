# Feature contract F-11: Return for editing

Contract version 1.1, 28 November 2026. Contract only; implementation follows after review. Tracks Issue #64 and implements FR-21.

Linked requirements: FR-21, BR-11, BR-12, BR-17, NFR-01, NFR-02, NFR-04, NFR-06, NFR-07 and NFR-10. Depends on F-02 (owner edit and resubmit), F-03 (approver decision permissions), F-04 (visibility/history), and F-06 (cancelled requests cannot be returned). If a later feature changes the editable statuses or adds another approver role, this contract must be revised.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 28 November 2026 | Initial F-11 contract proposed for review. |
| 1.1 | 28 November 2026 | Clarified visibility after return, race outcomes, baseline links, UI accessibility and cross-feature behavior after review. |

## 1. Feature design

An approver can return another user's submitted request to the requester for correction. Returning is a state transition from `SUBMITTED` to `DRAFT`; it does not approve or reject the request. The requester can edit the draft and submit it again.

New business rule:

- **BR-26:** Only an approver who is not the requester may return a `SUBMITTED` request. The return reason is required, trimmed, and 5 to 500 characters. A returned request has one `RETURNED` history entry and no decision timestamp.

The administrator cannot return a request. A requester cannot return any request, including their own. `APPROVED`, `REJECTED`, `CANCELLED` and `DRAFT` requests cannot be returned.

An approver's own request is visible under BR-12, but the return route deliberately answers `404 NOT_FOUND` for it, rather than the `403 SELF_APPROVAL` used by approve and reject. This keeps the return operation owner-scoped like editing and prevents the approver from changing their own lifecycle through a different action.

The transition is atomic with its history insert. Against a concurrent return, approve or reject, exactly one call succeeds and the other receives `404` or `409`, depending on whether it reads before or after the request becomes a hidden draft. Against cancel, either the second call receives `404` or `409`, or return and cancel both commit as two valid history transitions, ending in `CANCELLED`.

## 2. UI specification

On a request detail page, an approver sees a **Return for editing** action only for another user's `SUBMITTED` request. The action opens a form with a labelled **Reason** textarea and **Confirm return** and **Keep submitted** buttons. The reason is shown before confirmation and must be 5 to 500 characters after trimming. On success the approver is sent to the review queue, which announces `{request number} was returned to the requester.` and moves focus to the page heading; the 200 body is the last time that approver receives the request. The requester sees no return control.

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
5. A visible request in `APPROVED`, `REJECTED` or `CANCELLED` is not returnable: `409 ILLEGAL_TRANSITION`. A `DRAFT` is hidden from an approver and therefore returns `404`.
6. Missing, blank, shorter than 5 or longer than 500 characters: `422 VALIDATION_ERROR` with `fields.reason`.
7. A concurrent state change wins: `409 ILLEGAL_TRANSITION`; no return history is written.

The request status update and `RETURNED` history insert run in one transaction. A malformed JSON body is handled by the existing parser before session checks and may return `400`; a foreign Origin is still rejected first. Unexpected errors return the existing safe `500` body.

## 4. Data and migration

The `RequestStatus` enum already contains `DRAFT` and `SUBMITTED`. `HistoryAction` needs one additive enum value, `RETURNED`, and the migration must not alter existing rows. No new table is needed. The `RequestHistory.comment` field stores the return reason, as it already stores approval and rejection text. On return, `submittedAt` and `decidedAt` are set to `null`; a later submit sets a new `submittedAt` for queue ordering.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-160 | An approver returns another user's `SUBMITTED` request with a valid reason and receives 200; the request is `DRAFT`. |
| AC-161 | The returned response contains the updated request and no client-supplied status or history fields are trusted. |
| AC-162 | A `RETURNED` history row stores the approver, `SUBMITTED` to `DRAFT`, reason and timestamp. |
| AC-163 | The owner can edit and resubmit a returned request. |
| AC-164 | Only an approver may return, and an approver cannot return their own request. |
| AC-165 | A visible APPROVED, REJECTED or CANCELLED request cannot be returned and produces 409; a DRAFT is hidden from the approver and produces 404. |
| AC-166 | Missing, blank, short and overlong reasons produce 422 with `fields.reason`; valid boundary lengths are accepted. |
| AC-167 | Hidden, missing and non-numeric request ids return 404 without request data. |
| AC-168 | Anonymous calls return the existing 401 behavior, malformed JSON may return 400 before session handling, and a foreign Origin returns 403 before the body is processed. |
| AC-169 | Concurrent return with return/approve/reject allows one success and a second 404 or 409; return with cancel allows either a refused second call or two valid transitions ending in CANCELLED with consistent history. |
| AC-170 | A failed history insert rolls back the status change. |
| AC-171 | The UI shows the action only when eligible, uses **Confirm return** and **Keep submitted**, preserves errors, announces success, and moves focus as specified. |
| AC-172 | The returned request remains visible to its owner, is editable, and is not visible in the review queue until resubmitted; the approver receives 404 when trying to read it after return. |
| AC-173 | The dashboard counts and review count move consistently after return; the owner can add/remove attachments again and can cancel the returned draft. |
| AC-174 | At 375, 768 and 1280 px the page has no horizontal scrolling, including the return reason form. |
| AC-175 | The return section has no serious or critical axe-core violation. |
| AC-176 | The UI announces the successful return and displays the return reason as text, never HTML. |
| AC-177 | The status lifecycle documentation and transition guard include the SUBMITTED-to-DRAFT return without weakening the existing three decision transitions. |
| AC-178 | The contract and Definition of Done identify Aphisaimai as the required reviewer before merge. |
| AC-179 | A reason containing U+0000 is rejected with 422 and no history is written. |

## 6. Software test specification

| Test | AC | Level | Expected result |
|---|---|---|---|
| TEST-191 | AC-160 to AC-162 | API integration | Valid return gives 200, DRAFT and one correct RETURNED history row |
| TEST-192 | AC-163 | API integration | Owner edits and submits the returned request successfully |
| TEST-193 | AC-164 | API integration | Requester, administrator and self-approver are refused; only another approver succeeds |
| TEST-194 | AC-165 | API integration | APPROVED, REJECTED and CANCELLED return 409; a DRAFT returns 404; no extra history is written |
| TEST-195 | AC-166 | API integration | Reason boundaries and invalid values return the specified 422/200 results |
| TEST-196 | AC-167 | API integration | Hidden, missing and non-numeric ids return 404 with no data |
| TEST-197 | AC-168 | API/security integration | Anonymous, malformed JSON and foreign-origin calls return the specified 401/400/403 results |
| TEST-198 | AC-169 | API integration | Concurrent return/decision and return/cancel produce only the contract-allowed outcomes and consistent history |
| TEST-199 | AC-170 | API integration | Forced history failure rolls back the status and leaves history unchanged |
| TEST-200 | AC-171 | Browser end to end | Eligible action, clear confirmation labels, reason form, error retention, keyboard focus and success announcement work |
| TEST-201 | AC-172 | API and browser | Returned request is editable and owner-visible, absent from review, and 404 to the approver after return |
| TEST-202 | AC-173 | API and browser | Dashboard/review counts, attachments and cancel behavior are correct after return |
| TEST-203 | AC-174 | Browser responsive | No horizontal page scroll at 375, 768 and 1280 px |
| TEST-204 | AC-175 | Browser accessibility | axe-core reports no serious or critical violation |
| TEST-205 | AC-176 | Browser security/accessibility | Success is announced and the reason is rendered as text with no HTML execution |
| TEST-206 | AC-177 | API/unit | Transition guard and lifecycle documentation agree with the new return transition |
| TEST-207 | AC-178 | Documentation review | Aphisaimai is named as required reviewer before merge |
| TEST-208 | AC-179 | API integration | U+0000 reason returns 422 and does not create history |

## 7. Definition of Done

- Contract reviewed and approved before implementation; later changes get a new version and change-log entry.
- Tests are written first, with red and green output under `docs/sprints/sprint-2/tdd/`.
- Every AC has a test and an executed result; server, client, type check, build and browser tests pass.
- Raw server and Playwright output is stored under `docs/sprints/sprint-2/test-output/`.
- Migration is additive and preserves existing request and history rows.
- SRS, feature inventory, traceability and System SDS are updated together with the implementation.
- Implementation PR references and closes Issue #64, is approved by Aphisaimai, and is merged into `staging` after review.
