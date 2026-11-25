# Feature contract F-06: Cancel a purchase request

Contract version 1.1, 25 November 2026. Version 1.0 was reviewed in PR #48; this revision records the confirmed decision and the requested boundary and cross-feature checks. It must be reviewed before implementation.

Linked requirements: FR-05, BR-11, BR-12, BR-17, BR-21, NFR-01, NFR-02, NFR-06, NFR-07, NFR-10. Depends on F-02 and F-03. The proposed BR-21 is recorded in the SRS: only the request owner may cancel a request.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 25 November 2026 | Initial contract proposed in PR #48. |
| 1.1 | 25 November 2026 | Confirmed DRAFT/SUBMITTED decision; aligned errors with the existing API; added decision-race, atomicity, same-origin, boundary and cross-feature checks; documented existing CANCELLED enums and baseline updates. |

## 1. Feature design

Behavior: the owner of a purchase request can cancel it before it is approved. The API performs the ownership and status checks. A successful cancellation changes the status to `CANCELLED` and appends one `CANCELLED` history entry. The request data is retained and is read-only after cancellation.

Confirmed decision: both `DRAFT` and `SUBMITTED` requests may be cancelled by their owner. `APPROVED`, `REJECTED` and already `CANCELLED` requests cannot be cancelled. This is the team's confirmed interpretation of FR-05.

Workflow:

1. The owner opens the detail page of an eligible request and chooses Cancel.
2. The client sends a cancel command; it does not decide whether the action is allowed.
3. The API loads the request, checks the session, owner and current status, and performs the status update and history insert in one database transaction.
4. The response contains the request with status `CANCELLED`. The detail page shows the status and no longer offers edit, submit or decision actions.

Rules:

| Rule | Definition |
|---|---|
| F06-R01 / BR-21 | Only the request owner may cancel the request. |
| F06-R02 | A `DRAFT` or `SUBMITTED` request may be cancelled by its owner. |
| F06-R03 | `APPROVED`, `REJECTED` and `CANCELLED` requests cannot be cancelled. |
| F06-R04 | Cancellation creates exactly one append-only history row with action `CANCELLED`, the actor, the previous status and the new status. |
| F06-R05 | Cancellation does not delete or change the request's item fields, total, requester or previous history. |
| F06-R06 | An administrator cannot cancel another user's request. An approver can cancel only a request they own. |
| F06-R07 | A decision and a cancellation racing on one `SUBMITTED` request produce exactly one successful transition and one history row. |
| F06-R08 | The status update and history insert are atomic; if either write fails, neither change is committed. |

Errors:

| Case | Status | Response |
|---|---:|---|
| No session | 401 | `{ "error": "Authentication required." }` with no `code` and no request data |
| Non-numeric id or request not found/not visible to caller | 404 | `NOT_FOUND` where the existing API supplies that code; no request data |
| Request is `APPROVED`, `REJECTED` or `CANCELLED` | 409 | `ILLEGAL_TRANSITION` |
| Requester, approver or administrator tries to cancel another user's request | 404 | `NOT_FOUND`; no request data |
| Invalid origin on the state-changing POST | 403 | existing same-origin error response |

## 2. UI specification

On `/requests/:id`, the owner sees a Cancel button only while the status is `DRAFT` or `SUBMITTED`. The UI asks for confirmation before sending the command. After success, it shows `CANCELLED`, keeps the request details and history visible, and removes edit, submit and decision controls. The UI displays the API error if the action fails.

The UI does not rely on hiding the button for security. The API remains the source of truth for permission and status checks. A non-owner and an owner viewing an ineligible status must not see the Cancel button.

## 3. API specification

`POST /api/requests/:id/cancel` request body: none. The endpoint is protected by the application's `requireSameOrigin` middleware as all state-changing requests.

Response `200`:

```json
{
  "request": {
    "id": 12,
    "requestNumber": "PR-2026-0007",
    "status": "CANCELLED",
    "requesterId": 3,
    "updatedAt": "..."
  }
}
```

The server ignores any client-supplied status, actor, requester, timestamps or history fields. The command is atomic: either the status update and history row are both committed, or neither is committed.

## 4. Data and migration

No migration is needed for F-06. `CANCELLED` already exists in both the Prisma `RequestStatus` enum and the `HistoryAction` enum, and the existing history model already supports the required append-only entry. The later-`CANCELLED` wording in `docs/system-sds.md` and the SRS status lifecycle must be updated to record that the action is now implemented by F-06; existing migration history must not be rewritten.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-58 | The owner cancels an eligible `DRAFT` request and receives `200` with status `CANCELLED`. |
| AC-59 | The owner cancels an eligible `SUBMITTED` request and receives `200` with status `CANCELLED`. |
| AC-60 | Cancellation creates exactly one `CANCELLED` history row with the owner as actor and the correct status transition. |
| AC-61 | The request's item fields, total, requester and earlier history remain unchanged after cancellation. |
| AC-62 | A non-owner, including another requester or approver, cannot cancel the request and receives `404`; the stored request is unchanged. |
| AC-63 | An administrator cannot cancel another user's request and receives `404`. |
| AC-64 | A request in `APPROVED`, `REJECTED` or `CANCELLED` status cannot be cancelled and returns `409 ILLEGAL_TRANSITION`. |
| AC-65 | Two concurrent cancel commands result in at most one successful status transition and one cancellation history row. |
| AC-66 | A concurrent approve or reject and cancel on one `SUBMITTED` request result in exactly one successful transition and one matching history row. |
| AC-67 | If the history insert fails, the request status remains unchanged and no partial cancellation is visible. |
| AC-68 | A non-numeric id returns `404`, and a request without a session returns `401` with no request data. |
| AC-69 | A state-changing request from another origin is refused by `requireSameOrigin`. |
| AC-70 | After cancellation, edit and submit return `409`, approve and reject return `409`, the request is absent from the approver queue, and the owner can still read it as `CANCELLED`. |
| AC-71 | The owner sees Cancel only for an owned `DRAFT` or `SUBMITTED` request and must confirm before the request is sent. |
| AC-72 | A non-owner and an owner viewing an ineligible status do not see the Cancel button. |
| AC-73 | The cancelled request remains visible to the owner with its details and ordered history, but edit, submit and decision controls are removed. |

## 6. Software test specification

The test IDs below are planned for Sprint 2 and must be added to the Sprint 2 results table when executed.

| Test | AC | Level | Precondition and input | Expected result |
|---|---|---|---|---|
| TEST-93 | AC-58 | API/database integration | Owner cancels an owned `DRAFT` | `200`; status `CANCELLED`; data persisted |
| TEST-94 | AC-59 | API/database integration | Owner cancels an owned `SUBMITTED` request | `200`; status `CANCELLED`; data persisted |
| TEST-95 | AC-60, AC-61 | API/database integration | Inspect request and history before and after cancellation | Exactly one `CANCELLED` row; earlier data and history unchanged |
| TEST-96 | AC-62, AC-63 | API integration | Another requester, an approver and an administrator cancel the owner's request | Each receives `404`; no data or history change |
| TEST-97 | AC-64 | API integration | Owner cancels `APPROVED`, `REJECTED` and `CANCELLED` requests | Each returns `409 ILLEGAL_TRANSITION`; no extra history row |
| TEST-98 | AC-65 | API/database integration | Two cancel commands sent at the same time | At most one succeeds; one `CANCELLED` history row exists |
| TEST-99 | AC-66 | API/database integration | Approve or reject and cancel sent simultaneously for one `SUBMITTED` request | Exactly one succeeds; one matching history row exists |
| TEST-100 | AC-67 | API/database integration | Force the history insert to fail during cancellation | Status and history remain unchanged; no partial cancellation |
| TEST-101 | AC-68 | API integration | Call `/api/requests/abc/cancel` and call the endpoint without a session | Non-numeric id is `404`; anonymous call is `401` with no request data |
| TEST-102 | AC-69 | API integration | Send the cancel POST with an origin different from `CLIENT_ORIGIN` | `403`; request and history unchanged |
| TEST-103 | AC-70 | API integration | Cancel, then attempt edit, submit, approve and reject; inspect queue and owner detail | All forbidden transitions return `409`; absent from queue; owner still reads `CANCELLED` |
| TEST-104 | AC-71, AC-73 | Browser end to end | Owner opens an eligible request, clicks Cancel and confirms | Button is shown; confirmation appears; status and history update; edit/submit/decision controls disappear |
| TEST-105 | AC-72 | Browser end to end | Non-owner opens the request, and owner opens an ineligible request | Cancel button is not shown in either case |

## 7. Definition of Done

- The team confirms the cancellable statuses (confirmed in review).
- This contract is reviewed before implementation.
- The SRS, feature inventory, System SDS and traceability matrix are updated with the confirmed decision and links to this contract.
- Every acceptance criterion has a test ID and an executed result.
- API and database tests pass, including ownership, same-origin, atomicity and decision-concurrency boundaries.
- The browser tests pass for the owner and negative UI journeys.
- The feature branch is reviewed by Aphisaimai in a PR into `staging`.
- The merged feature is included in the Sprint 2 completion table and traceability matrix.
