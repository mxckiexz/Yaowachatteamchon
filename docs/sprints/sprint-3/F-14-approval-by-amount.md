# Feature contract F-14: Approval by amount

Contract version 1.0, 29 November 2026. Contract only, for review before implementation. Implements FR-24 and decides the thresholds of BR-20.

Linked requirements: FR-24, BR-05, BR-12, BR-17, BR-20, BR-29, BR-42, NFR-01, NFR-02, NFR-04, NFR-05, NFR-06, NFR-07 and NFR-10. Depends on F-02 (submit and the request total) and F-13 (approval steps), and uses F-04 (visibility), F-06 (cancel), F-11 (return and resubmit), F-12 (notifications) and F-17 (reports, only in the checks of AC-332 and AC-336). The implementations of F-13 and F-17 must be in `staging` before F-14 is implemented. If F-13 changes how steps are stored, checked at submit or limited in number, or if a later feature (F-15 departments, F-16 delegation) changes who approves, this contract must be revised.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 29 November 2026 | Initial F-14 contract proposed for review. Revises F-02 AC-18 and F-13 BR-29 for larger amounts. |

## 1. Feature design

The total of a request decides how many approvals it needs. F-13 already lets the administrator set up an ordered chain of approvers. F-14 adds one rule: a request cannot be submitted unless its chain is long enough for its amount.

**BR-42:** The total of a request (BR-05) at the time it is submitted decides the approval route. The totals are compared in satang.

| Total in baht | Approvals needed | Approval steps needed at submit |
|---|---|---|
| Up to and including 10,000.00 | 1 | None. An empty chain keeps the F-03 behaviour: any approver other than the requester decides. A chain of 1 to 5 steps is also allowed |
| 10,000.01 to 100,000.00 | 2 | At least 2 |
| Above 100,000.00 | 3 | At least 3 |

- A chain longer than needed is allowed, up to the limit of F-13 (5).
- The system does not choose approvers. The administrator chooses them, as in F-13, because the application has no information about who may approve which amount.
- The rule is applied only at submit. After that, the chain and the amount cannot change, because only a draft can be edited.
- A request that was submitted before F-14 keeps its approval route. When such a request is returned and submitted again, the rule applies.
- The thresholds are fixed in the application. Changing them needs a new version of this contract.

This revises two earlier rules:

- **F-02 AC-18:** a complete draft can be submitted only when its chain also meets BR-42.
- **F-13 BR-29:** an empty chain uses the F-03 behaviour only when BR-42 needs no steps.

Out of scope: choosing approvers automatically, thresholds that a user can change, routes by category or department, delegation (F-16), a notification to the administrator that a draft needs steps, and showing the needed steps on the **New request** form before the draft is saved.

## 2. UI specification

On the detail page of a `DRAFT` whose total needs steps, its owner and the administrator see a notice in text:

`This amount needs at least {needed} approval steps. Saved steps: {saved}.`

| Case | Specification |
|---|---|
| Saved steps fewer than needed, the owner | The notice is followed by `Ask the administrator to set them before you submit.` |
| Saved steps fewer than needed, the administrator | The notice is shown inside the **Approval steps** editor. It counts saved steps, not changes that are not saved |
| Enough saved steps | Only the notice with the two numbers |
| The total needs no steps | No notice |

- The notice follows the saved request: after the draft is edited and saved, or the chain is saved, it shows the new numbers without a reload of the page.
- **Submit request** stays enabled. When the server refuses the submit for this rule, its message is shown in a `role="alert"` element, the request stays a draft and nothing typed is lost.
- The notice is not told by colour only and adds no new live region.
- Everything works with the keyboard in reading order. At 375, 768 and 1280 px there is no horizontal page scrolling.

## 3. API specification

No new route. `POST /api/requests/:id/submit` gets one new refusal:

```json
{
  "error": "This amount needs at least 2 approval steps. Ask the administrator to set them.",
  "code": "APPROVAL_STEPS_REQUIRED",
  "requiredSteps": 2,
  "configuredSteps": 1
}
```

The status is 422. The number in `error` equals `requiredSteps`. The body has no other field.

Order of checks for submit:

| Order | Condition | Response |
|---|---|---|
| 1 | Foreign `Origin` | 403 (existing) |
| 2 | No valid session | 401 (existing) |
| 3 | Not the caller's request | 404 (existing) |
| 4 | Not a draft | 409 `ILLEGAL_TRANSITION` (existing) |
| 5 | Reason or category missing | 422 `INCOMPLETE` (existing) |
| 6 | Fewer saved steps than BR-42 needs | 422 `APPROVAL_STEPS_REQUIRED` |
| 7 | A saved approver is no longer an active approver | 409 `APPROVER_IN_USE` (F-13) |

- Checks 6 and 7 are made inside the submit transaction. The transaction locks the request row first and then reads the total and the steps. A change of the draft or of its chain must wait for this lock and then check again that the request is still a draft. So a change of the amount or of the chain cannot slip in between the check and the submit: it either comes first and is seen by the check, or it is refused with the existing 409.
- A refused submit changes nothing: not the status, `submittedAt`, history, steps or notifications.
- A total sent by the client is ignored (BR-05).
- `PUT /api/requests/:id/approval-steps` is unchanged: the administrator may save a chain that is shorter than needed, because a draft may be unfinished.
- `GET /api/requests/:id` adds one field, `requiredApprovalSteps`, **only when the request is a draft**: `0` when no step is needed, otherwise `2` or `3`. List, review queue, dashboard and report responses are unchanged.

## 4. Data and migration

No schema change and no migration. The number of steps needed is calculated from the stored total and is not stored. Existing requests are not changed.

The demo data has two approver accounts. A request above 100,000.00 baht needs three different approvers who are not the requester, so it cannot be submitted until the administrator gives a third account the approver role. If an approver is the requester of a request above 10,000.00 baht, the demo data also has too few other approvers.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-321 | The needed number is 0 for 10,000.00, 2 for 10,000.01 and for 100,000.00, and 3 for 100,000.01, calculated from quantity times unit price. |
| AC-322 | A request that needs no steps is submitted with an empty chain, with the F-03 behaviour unchanged, or with a chain of any allowed length, with the F-13 behaviour. |
| AC-323 | A request that needs 2 steps is refused with 0 or 1 saved step, with exactly the stated 422 body, and nothing changes. |
| AC-324 | A request that needs 3 steps is refused with 0, 1 or 2 saved steps and accepted with 3, 4 or 5. |
| AC-325 | An accepted submit with enough steps behaves as F-13: the first step is current, the others wait, and only the first approver is notified. |
| AC-326 | The amount stored at submit counts: after the draft is raised, a chain that was long enough is refused; after it is lowered, a shorter or empty chain is accepted; a total sent by the client changes nothing. |
| AC-327 | After a return, a new submit applies the rule to the current amount. |
| AC-328 | The order of checks is as stated: another user's request gives 404, a request that is not a draft 409, and an incomplete draft `INCOMPLETE`, each before the new check; the new check comes before the F-13 approver check. |
| AC-329 | When a submit runs at the same time as a change that raises the amount or shortens the chain, the request is never submitted with fewer steps than its stored amount needs. |
| AC-330 | The administrator can save a chain that is shorter than needed on a draft. |
| AC-331 | A request that was already submitted keeps its approval route and can still be approved, rejected or returned, although its chain is shorter than the rule would need. |
| AC-332 | The detail of a draft has `requiredApprovalSteps`; the detail in other statuses and the list, review queue, dashboard and report responses do not have it and are otherwise unchanged. |
| AC-333 | In the UI the owner and the administrator see the notice with the correct numbers, it follows a saved edit and a saved chain, and there is none when no step is needed. |
| AC-334 | In the UI a refused submit shows the server message as an alert, the request stays a draft and its data is unchanged; after the administrator saves enough steps, the owner can submit. |
| AC-335 | The notice and the refusal work with the keyboard and without colour; at 375, 768 and 1280 px there is no horizontal page scrolling; axe-core reports no serious or critical violation. |
| AC-336 | After a refused submit the owner can still edit and cancel the draft, no notification exists for it, and reports and dashboard counts show it as a draft. |

## 6. Software test specification

| Test | AC | Level | Precondition and input | Expected result |
|---|---|---|---|---|
| TEST-352 | AC-321 | Unit | The four boundary totals, and totals made of several units, for example 3 × 3,333.34 = 10,000.02 | 0, 2, 2, 3; compared in satang |
| TEST-353 | AC-322 | API integration | Totals up to 10,000.00 with an empty chain and with chains of 1 and 5 | Accepted; empty chain: any other approver can decide; with a chain: F-13 |
| TEST-354 | AC-323 | API integration | A total of 10,000.01 with 0 and with 1 saved step | 422 with the exact body; status, `submittedAt`, history, steps and notification rows unchanged |
| TEST-355 | AC-324 | API integration | A total of 100,000.01 with 0 to 5 saved steps of different approvers | 0 to 2 refused with `requiredSteps` 3; 3 to 5 accepted |
| TEST-356 | AC-325 | API integration | A total that needs 2, with 2 saved steps | First step current, second waiting; one `SUBMITTED` notification, for the first approver |
| TEST-357 | AC-326 | API/security integration | Save a chain, then raise or lower the amount by editing the draft; send a `total` field in the edit and in the submit | The stored amount decides; the sent total is ignored |
| TEST-358 | AC-327 | API integration | Submit, return, raise the amount, submit | Refused until the chain is long enough |
| TEST-359 | AC-328 | API integration | Another user's request, a submitted one, an incomplete draft, and a draft with too few steps whose saved approver is inactive | 404, 409, `INCOMPLETE`, then `APPROVAL_STEPS_REQUIRED`; with enough steps, `APPROVER_IN_USE` |
| TEST-360 | AC-329 | API integration | Over many rounds, start a submit and, 0 to 40 ms later or earlier, raise the amount or shorten the chain | In every round, a submitted request has at least the steps its stored amount needs. The test must fail when the check is moved outside the locked transaction |
| TEST-361 | AC-330 | API integration | Save 0 and 1 step on a draft that needs 3 | 200 |
| TEST-362 | AC-331 | API integration | Requests stored as submitted above the thresholds with no or too few steps; approve, reject, return | Each works as before; a new submit after the return applies the rule |
| TEST-363 | AC-332 | API integration | Detail of a draft of each level and of other statuses; list, review queue, dashboard and report responses | The field only on draft detail; other response keys unchanged |
| TEST-364 | AC-333 | Browser end to end | A draft below and above 10,000.00; edit and save; the administrator saves steps | Notice and numbers as stated, without a reload |
| TEST-365 | AC-334 | Browser end to end | The owner submits a draft that needs 2 steps with none; the administrator saves 2; the owner submits again | Alert with the server message; draft kept; then submitted |
| TEST-366 | AC-335 | Browser responsive and accessibility | Keyboard only; 375, 768 and 1280 px with the notice and the alert shown; run axe | As stated |
| TEST-367 | AC-336 | API integration | After a refused submit: edit, read notifications, report and dashboard, cancel | As stated |

## 7. Definition of Done

- This contract is reviewed and approved before implementation. A later change gets a new version and a change-log entry.
- Tests are written first. The red output (against the code without the feature) and the green output are stored unchanged under `docs/sprints/sprint-3/tdd/`; a test that guards a new rule fails without the feature.
- Every AC has its test, and the server suite, client tests, type check and build pass.
- Raw server and Playwright terminal output is stored under `docs/sprints/sprint-3/test-output/`. Browser tests are run locally because CI does not run Playwright.
- The race test (TEST-360) is shown to fail when the check is not protected by the lock.
- The SRS, feature inventory, traceability matrix and System SDS agree with the implementation, and the Sprint 3 results table records every AC, test, actual result and commit.
- The implementation Pull Request closes the F-14 Issue, is reviewed and approved by Thanwarat before merge, and is merged into `staging`.
