# Feature contract F-13: Multi-step approval

Contract version 1.1, 28 November 2026. Contract only; implementation follows review of this contract. Tracks Issue #74 and FR-23.

Linked requirements: FR-23, BR-12, BR-17, BR-19, BR-29, NFR-01, NFR-02, NFR-04, NFR-05, NFR-07, NFR-09 and NFR-10. Depends on F-03, F-04, F-06, F-11 and F-12. F-14 may select the chain by amount, and F-16 may provide delegation, but both must preserve these step, actor and history rules.

## Change log
| Version | Date | Change |
|---|---|---|
| 1.0 | 28 November 2026 | Initial contract proposed. |
| 1.1 | 28 November 2026 | Made administration the sole configurator; defined empty/legacy chains, step storage and reset, current-approver permissions, notifications, history, API checks, and cross-feature rules. |

## 1. Feature design
Only an administrator configures an ordered approval chain while a request is `DRAFT`. An empty chain means the legacy F-03 path: any eligible approver may decide a submitted request. A non-empty chain is snapshotted at submit and advances one current step at a time.

**BR-29:** A configured chain has 1–5 distinct active approvers, none the requester. Steps are ordered and fixed after submission; only the current step's approver may approve, reject or return. Rejection ends the chain. Return resets the saved chain to planned steps and resubmission starts step 1. If the current approver is deactivated or loses the approver role, F-05 refuses that change with `409 APPROVER_IN_USE` while the step is current.

F-03 AC-28/TEST-41 is revised: the unrestricted “any other approver” rule applies only when no chain is configured; a configured request requires its current assigned approver. F-11 BR-26/AC-164 is likewise revised for configured requests: only the current assigned approver may return. Competing approve/reject/return/cancel operations follow existing conditional-update rules: one transition may win; a later hidden request can be `404`, a terminal request `409`, and return followed by cancel may legitimately produce two ordered history rows ending in `CANCELLED`.

## 2. Configuration and UI
On any `DRAFT`, an administrator sees **Approval steps** with an ordered list and Add, Move up, Move down and Remove controls. Saving `[]` clears the draft chain; saving 1–5 valid ids replaces it atomically. Requesters and approvers see the configuration read-only and cannot save it. After submit, the list is read-only. The detail page shows Step N of M, assigned approver, status (`Waiting`, `Current`, `Approved`, `Rejected`), decision time and comment. Only the current approver sees decision controls; the review queue remains all submitted requests of other users, and its dashboard `reviewWaiting` count remains that same set.

The page keeps one mounted polite `role="status"` region. All controls have visible labels and keyboard focus is preserved. At 375, 768 and 1280 px there is no horizontal document scrolling (an internal table may scroll).

## 3. API specification
### Configure steps
| Method and path | Request | Success |
|---|---|---|
| `PUT /api/requests/:id/approval-steps` | `{ "approverIds": [3, 7] }` or `[]` | `200 { "steps": [...] }` |
| `GET /api/requests/:id/approval-steps` | none | `200 { "steps": [...] }` |

Checks: origin (PUT), session (401), role (ADMIN only; others 403), parse id, visibility (404), request status (`DRAFT` only, otherwise 409), then body validation (422). IDs must be an array of 0–5 integers; non-approver, inactive, unknown, duplicate or requester ids give `422 fields.approverIds`, with no change. A save creates no history or notification.

Each step response is exactly `{ id, stepNumber, approver: { id, name }, status, decidedAt, decisionComment }`; no email or hidden user data is returned.

### Decide a step
Existing origin/session/role checks run first, then request visibility (404), self-approval (403 `SELF_APPROVAL`), current-step assignment (403 `NOT_CURRENT_APPROVER` for a configured chain), body validation (422), and terminal/illegal-state checks (409). A step decision is one conditional transaction. Intermediate approval keeps request status `SUBMITTED`, marks the step `APPROVED`, opens the next step, and writes `STEP_APPROVED` history with `SUBMITTED` → `SUBMITTED`; final approval writes ordinary `APPROVED` history and changes status. Reject writes `REJECTED` history and ends the chain.

At submit, the server builds the snapshot and determines the current actor in one place. With a chain, only step 1 receives the F-12 `SUBMITTED` notification; each intermediate approval notifies the next approver using that type and the requester as actor; the requester receives `APPROVED` only on final approval. F-12 BR-27/AC-180/AC-182 are revised for this stepped behavior.

## 4. Data and migration
Add `ApprovalStep(id, requestId, stepNumber, approverId, status, decidedAt, decisionComment, createdAt, updatedAt)`. Statuses are `PLANNED`, `WAITING`, `CURRENT`, `APPROVED`, `REJECTED`; `(requestId, stepNumber)` and `(requestId, approverId)` are unique. Existing requests have no rows and therefore retain F-03 behavior. Draft configuration stores `PLANNED` rows; submit changes them atomically to `CURRENT/WAITING`; return resets them to `PLANNED` and clears decision fields; resubmit snapshots the saved chain again; cancel leaves rows unchanged.

The migration is additive, has no backfill, and must be tested with existing data. F-05 must reject deactivation or role change of a current assigned approver with `409 APPROVER_IN_USE`.

## 5. Acceptance criteria
| AC | Observable outcome |
|---|---|
| AC-201 | Administrator can configure 1–5 ordered active approvers on a draft. |
| AC-202 | Requester, approver and anonymous caller cannot configure; administrator can configure any visible draft. |
| AC-203 | Invalid array, ids, duplicates, inactive users and requester are `422 fields.approverIds`; no data changes. |
| AC-204 | Configuration of non-draft is `409`; `[]` clears a draft chain. |
| AC-205 | Submit snapshots steps; step 1 is `CURRENT`, rest `WAITING`; later edits cannot change them. |
| AC-206 | Intermediate approval keeps `SUBMITTED` and advances exactly one step. |
| AC-207 | Only current assigned approver can approve, reject or return; another approver gets `403 NOT_CURRENT_APPROVER`. |
| AC-208 | Steps are distinct and exclude requester. |
| AC-209 | Final approval changes status only after every step is approved. |
| AC-210 | Rejection records reason, marks current step rejected and ends chain. |
| AC-211 | Return resets steps to planned; resubmit starts step 1 with saved chain. |
| AC-212 | Cancel follows F-06 and does not decide a step. |
| AC-213 | Every step decision has one matching `STEP_APPROVED`, `APPROVED` or `REJECTED` history row. |
| AC-214 | Concurrent decisions produce one step transition; allowed return/cancel race outcomes are recorded. |
| AC-215 | Status, step, history and notification writes are atomic on insert failure. |
| AC-216 | Detail/list/queue/dashboard expose only exact step fields and preserve existing visibility/count rules. |
| AC-217 | UI labels progress and shows controls only to current approver. |
| AC-218 | Keyboard focus, labels and mounted status announcements work. |
| AC-219 | No horizontal page scroll at 375/768/1280 and no serious/critical axe violation. |
| AC-220 | Legacy F-03, F-06, F-11 and F-12 behavior remains unchanged when no chain is configured. |

## 6. Software test specification
| Test | AC | Level | Input | Expected |
|---|---|---|---|---|
| TEST-232 | AC-201 | API | Admin saves 1–5 approvers | 200, ordered steps |
| TEST-233 | AC-202 | API | requester/approver/anonymous save | 403/401, unchanged |
| TEST-234 | AC-203 | API | invalid arrays and ids | 422 fields, unchanged |
| TEST-235 | AC-204 | API | non-draft and `[]` | 409; draft clears |
| TEST-236 | AC-205 | API | submit configured request | step 1 current, rest waiting |
| TEST-237 | AC-206 | API | approve step 1 | submitted, step 2 current |
| TEST-238 | AC-207 | API | wrong/current approvers | 403/200 as applicable |
| TEST-239 | AC-208 | API | duplicate/requester ids | 422 |
| TEST-240 | AC-209 | API | approve final step | approved only at end |
| TEST-241 | AC-210 | API | reject current step | rejected, history reason |
| TEST-242 | AC-211 | API | return then resubmit | planned then step 1 current |
| TEST-243 | AC-212 | API | cancel configured request | cancelled, no step decision |
| TEST-244 | AC-213 | API | each decision | exactly one matching history |
| TEST-245 | AC-214 | API | concurrent decisions and return/cancel | allowed winner/outcome and history |
| TEST-246 | AC-215 | API | forced history/notification failure | 500 and full rollback |
| TEST-247 | AC-216 | API | detail/list/queue/dashboard | exact fields, no hidden data |
| TEST-248 | AC-217 | Browser | current/non-current roles | labels and controls correct |
| TEST-249 | AC-218 | Browser | keyboard configure/decide | focus and status announcements |
| TEST-250 | AC-219 | Browser | 375/768/1280 and axe | no overflow, no serious/critical axe |
| TEST-251 | AC-220 | Integration | legacy request plus F-03/F-06/F-11/F-12 | existing behavior unchanged |

## 7. Definition of Done
- Every AC has one numbered test and an executed result.
- Server/client type checks, builds, unit tests and full Playwright suite pass; raw output and TDD red/green output are stored under `docs/sprints/sprint-3/`.
- Migration is additive and tested with existing data.
- SRS, feature inventory, traceability and System SDS are updated consistently.
- Implementation PR references and closes Issue #74 and is reviewed by Aphisaimai before merge into `staging`.
