# Feature contract F-13: Multi-step approval

Contract version 1.0, 28 November 2026. Contract only, for review before implementation. Tracks FR-23 and the F-13 Issue.

Linked requirements: FR-23, BR-12, BR-17, BR-19, BR-29, NFR-01, NFR-02, NFR-04, NFR-05, NFR-07, NFR-09 and NFR-10. Depends on F-03 decisions, F-04 visibility, F-06 cancellation, F-11 return for editing and F-12 notifications. F-14 may revise how the chain is selected by amount, but must preserve the step and history rules here.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 28 November 2026 | Initial F-13 contract proposed for review. |

## 1. Feature design

An administrator prepares an ordered approval chain for a request before it is submitted. The chain is copied to immutable approval-step rows when the request is submitted. The request then moves through the steps in order. A step can be decided only by its assigned approver; the next step is opened only after approval of the current step.

**BR-29:** An approval chain has one or more distinct active approvers, none of whom is the requester. Steps are ordered and are immutable after submission. A request can be approved only by the current step's approver. A rejection ends the chain and a return sends the request back to `DRAFT`; resubmission starts the saved chain again from step 1. An administrator may configure a chain before submission but cannot decide a request.

The existing single-step F-03 behaviour remains the one-step case. A request with multiple steps is `SUBMITTED` until every step approves it; only then does it become `APPROVED`. Approval and rejection remain recorded in request history. Cancellation and return are allowed only under their existing F-06/F-11 rules.

## 2. Configuration and UI

On a request owned by the requester or approver, an administrator can configure the chain while the request is `DRAFT`. The control is labelled **Approval steps** and contains an ordered list of selected active approvers, with **Add step**, **Move up**, **Move down** and **Remove** controls. The same approver cannot appear twice. The requester cannot be selected. Saving an invalid chain shows the server validation message and leaves the draft unchanged.

After submission, the chain is read-only. The request detail shows **Step N of M**, the assigned approver for each step, and each step's state (`Waiting`, `Current`, `Approved` or `Rejected`). The current approver sees Approve and Reject actions; other approvers see the request but no decision controls. The requester sees progress and history but cannot decide. The administrator sees the same read-only progress.

The page keeps one mounted polite `role="status"` region for success and error announcements. At 375, 768 and 1280 px the page has no horizontal document scrolling. All controls have visible labels and keyboard focus is preserved after adding, reordering, removing and deciding a step.

## 3. API specification

### Configure steps

| Method and path | Request | Success |
|---|---|---|
| `PUT /api/requests/:id/approval-steps` | `{ "approverIds": [3, 7] }` | `200 { "steps": [...] }` |
| `GET /api/requests/:id/approval-steps` | none | `200 { "steps": [...] }` |

Configuration is allowed only for the owner or an administrator while the request is `DRAFT`. The administrator may configure any draft; the requester may configure their own draft. An approver who is not the owner cannot configure it. The list rejects repeated ids, unknown/inactive users, non-approvers, the requester, an empty list and duplicate ids with `422` and a `fields.approverIds` entry. A non-visible request is `404`; a non-draft request is `409`. Saving replaces the draft configuration atomically and does not create history or notifications.

### Decide a step

The existing `POST /api/requests/:id/approve` and `/reject` routes keep their check order and response format. For a multi-step request, only the current step's assigned approver may decide. An early or unrelated approver gets `403` with code `NOT_CURRENT_APPROVER`; an already decided or terminal request keeps the existing `409`. A successful intermediate approval keeps the request `SUBMITTED`, advances the current step and creates one history row and one `APPROVED` notification for the requester only after the conditional update succeeds. The final approval changes the request to `APPROVED`.

## 4. Data and migration

Add an `ApprovalStep` table with `id`, `requestId`, `stepNumber`, `approverId`, `status`, `decidedAt`, `decisionComment` and timestamps. Add a status enum with `WAITING`, `CURRENT`, `APPROVED` and `REJECTED`. `(requestId, stepNumber)` and `(requestId, approverId)` are unique. Foreign keys restrict deleting a referenced user and cascade when a request is deleted.

The migration is additive and creates no steps for existing requests. Existing one-step requests continue to use the F-03 path; implementation must either create one step on submit from the configured chain or explicitly record the legacy one-step decision. Existing request, history and notification rows are unchanged. The migration must be tested against a database containing existing data.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-201 | An administrator can configure an ordered chain of one or more active approvers on a draft. |
| AC-202 | A requester can configure their own draft; another user and an approver who is not the owner cannot. |
| AC-203 | Duplicate, inactive, unknown, non-approver and requester ids are rejected with `422` and no data change. |
| AC-204 | Configuration is rejected for submitted, approved, rejected or cancelled requests with `409`. |
| AC-205 | Submit snapshots the configured chain and opens step 1 as `CURRENT`; later configuration cannot change it. |
| AC-206 | A request with multiple steps remains `SUBMITTED` after an intermediate approval and advances exactly one step. |
| AC-207 | Only the current assigned approver can approve or reject; other approvers receive `403 NOT_CURRENT_APPROVER`. |
| AC-208 | Each step uses a different approver and none is the requester. |
| AC-209 | Final approval changes the request to `APPROVED` only after every step is approved. |
| AC-210 | Rejection records the reason, marks the current step rejected and ends the chain with `REJECTED`. |
| AC-211 | A return resets the request to `DRAFT` under F-11 and resubmission restarts at step 1 using the saved chain. |
| AC-212 | Cancellation follows F-06 and does not create an approval-step decision. |
| AC-213 | Each successful step decision writes exactly one matching history row. |
| AC-214 | A simultaneous decision on one current step produces one success and one refusal, with one step transition. |
| AC-215 | Status, step transition, history and notification are atomic when any insert fails. |
| AC-216 | Detail and list responses expose step number, assigned approver and current state without hidden users or data. |
| AC-217 | The UI shows labelled step progress and only the current approver's decision controls. |
| AC-218 | Keyboard use, focus return, status announcements and visible labels work for configuration and decisions. |
| AC-219 | The pages have no horizontal document scrolling at 375, 768 or 1280 px and no serious or critical axe violation. |
| AC-220 | Existing F-03 single-step requests and F-06/F-11/F-12 cross-feature behaviour remain unchanged. |

## 6. Planned tests

TEST-232 to TEST-251 will map one-to-one to AC-201 to AC-220. They will include API permission and boundary tests, concurrent-step tests, rollback tests, migration checks, browser tests at the three required widths, keyboard and axe checks, and cross-feature tests for submit, approve, reject, return, cancel and notifications. Red output will be run against `staging` before implementation and raw server/Playwright output will be stored under `docs/sprints/sprint-3/`.

## 7. Definition of Done

- Every AC has one numbered test and an executed result.
- The server and client type checks, builds, unit tests and full Playwright suite pass.
- TDD red and green output is stored unchanged under `docs/sprints/sprint-3/tdd/`; raw suite output is stored under `docs/sprints/sprint-3/test-output/`.
- The migration is additive and is tested with existing data.
- SRS, feature inventory, traceability and System SDS are updated consistently.
- The implementation PR references and closes the F-13 Issue and is reviewed by Thanwarat before merge into `staging`.
