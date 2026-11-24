# Feature contract F-06: Cancel a purchase request

Contract version 1.0. Proposed before implementation. This contract must be reviewed by Aphisaimai before code is written.

Linked requirement: FR-05. Depends on: F-02 and F-03. Existing status and history definitions are in `docs/system-sds.md`.

## 1. Feature design

Behavior: the owner of a purchase request can cancel it before it is approved. The API performs the ownership and status checks. A successful cancellation changes the status to `CANCELLED` and appends one `CANCELLED` history entry. The request data is retained and is read-only after cancellation.

Proposed decision for review: both `DRAFT` and `SUBMITTED` requests may be cancelled by their owner. `APPROVED`, `REJECTED` and already `CANCELLED` requests cannot be cancelled. The team must confirm this decision in the review before implementation.

Workflow:

1. The owner opens the detail page of an eligible request and chooses Cancel.
2. The client sends a cancel command; it does not decide whether the action is allowed.
3. The API loads the request, checks the session, owner and current status, and performs the status update and history insert in one database transaction.
4. The response contains the request with status `CANCELLED`. The detail page shows the status and no longer offers edit, submit or decision actions.

Rules:

| Rule | Definition |
|---|---|
| F06-R01 | Only the request owner may cancel the request. |
| F06-R02 | A `DRAFT` or `SUBMITTED` request may be cancelled, subject to team approval of this contract. |
| F06-R03 | `APPROVED`, `REJECTED` and `CANCELLED` requests cannot be cancelled. |
| F06-R04 | Cancellation creates exactly one append-only history row with action `CANCELLED`, the actor, the previous status and the new status. |
| F06-R05 | Cancellation does not delete or change the request's item fields, total, requester or previous history. |
| F06-R06 | An administrator cannot cancel another user's request. An approver can cancel only a request they own. |

Errors:

| Case | Status | Code |
|---|---|---|
| No session | 401 | `UNAUTHENTICATED` |
| Request does not exist or caller is not the owner | 404 | `NOT_FOUND` |
| Request is `APPROVED`, `REJECTED` or `CANCELLED` | 409 | `ILLEGAL_TRANSITION` |
| Requester tries to cancel another user's request | 404 | `NOT_FOUND` |
| Administrator tries to cancel another user's request | 404 | `NOT_FOUND` |

## 2. UI specification

On `/requests/:id`, the owner sees a Cancel button only while the status is `DRAFT` or `SUBMITTED`. The UI asks for confirmation before sending the command. After success, it shows `CANCELLED`, keeps the request details and history visible, and removes edit, submit and decision controls. The UI must display the API error if the action fails.

The UI does not rely on hiding the button for security. The API remains the source of truth for permission and status checks.

## 3. API specification

`POST /api/requests/:id/cancel` request body: none.

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

The `CANCELLED` request status and `CANCELLED` history action already exist in the Sprint 1 system design. Confirm the current Prisma enum and history model before implementation. If the current schema already contains both values, no migration is needed. If it does not, add an additive migration only and record the revision in the SRS change log; do not rewrite existing migration history.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-58 | The owner cancels an eligible request and receives `200` with status `CANCELLED`. |
| AC-59 | The cancellation creates exactly one `CANCELLED` history row with the owner as actor and the correct status transition. |
| AC-60 | The request's item fields, total, requester and earlier history remain unchanged after cancellation. |
| AC-61 | A non-owner cannot cancel the request and receives `404`; the stored request is unchanged. |
| AC-62 | An administrator cannot cancel another user's request and receives `404`. |
| AC-63 | A request in `APPROVED`, `REJECTED` or `CANCELLED` status cannot be cancelled and returns `409 ILLEGAL_TRANSITION`. |
| AC-64 | A concurrent double-cancel results in at most one successful status transition and one cancellation history row. |
| AC-65 | The UI shows the Cancel action only for eligible owned requests, asks for confirmation, and shows the resulting `CANCELLED` state. |

## 6. Software test specification

The test IDs below are planned for Sprint 2 and must be added to the Sprint 2 results table when they are executed.

| Test | AC | Level | Precondition and input | Expected result |
|---|---|---|---|---|
| TEST-93 | AC-58 | API/database integration | Owner cancels an owned `DRAFT` | `200`; status `CANCELLED`; data persisted |
| TEST-94 | AC-58 | API/database integration | Owner cancels an owned `SUBMITTED` request | `200`; status `CANCELLED`; data persisted |
| TEST-95 | AC-59, AC-60 | API/database integration | Inspect request and history before and after cancellation | Exactly one `CANCELLED` row; earlier data and history unchanged |
| TEST-96 | AC-61 | API integration | Another requester, an approver and an administrator cancel the owner's request | Each receives `404`; no data or history change |
| TEST-97 | AC-63 | API integration | Owner cancels `APPROVED`, `REJECTED` and `CANCELLED` requests | Each returns `409 ILLEGAL_TRANSITION`; no extra history row |
| TEST-98 | AC-64 | API/database integration | Two cancel commands sent at the same time | At most one succeeds; one `CANCELLED` history row exists |
| TEST-99 | AC-62 | API integration | Administrator attempts to cancel another user's request | `404`; request remains unchanged |
| TEST-100 | AC-65 | Browser end to end | Owner opens an eligible request and cancels it | Confirmation appears; status changes to `CANCELLED`; action buttons are removed |

## 7. Definition of Done

- The team confirms the proposed cancellable statuses.
- This contract is reviewed before implementation.
- Every acceptance criterion has a test ID and an executed result.
- API and database tests pass, including ownership and concurrency boundaries.
- The browser test passes for the owner journey.
- The feature branch is reviewed by Aphisaimai in a PR into `staging`.
- The merged feature is included in the Sprint 2 completion table and traceability matrix.
