# Feature contract F-08: Dashboard request counts

Contract version 1.0, 27 November 2026. This is a contract-only proposal for review before implementation. It tracks Issue #55 and implements FR-18.

Linked requirements: FR-18, NFR-01, NFR-02, NFR-05, NFR-07 and NFR-10. Depends on F-04 for the existing visibility rules and F-07 for the list/filter navigation. No database migration is proposed.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 27 November 2026 | Initial F-08 dashboard contract proposed for review. |

## 1. Feature design

The dashboard gives a signed-in user a count of visible purchase requests grouped by every existing request status: `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED` and `CANCELLED`. Counts are calculated by the server from the same visibility boundary used by the existing list routes; the client never receives hidden rows to count.

Proposed role scopes:

| Role | Requests included in the counts |
|---|---|
| REQUESTER | The user's own requests only. |
| APPROVER | Requests from other users that are visible to the review queue. The current review queue exposes `SUBMITTED`; other status cards are therefore zero unless the existing role-visible scope is extended by a later approved contract. |
| ADMIN | All requests, matching the existing administrator list scope. |

The dashboard is informational only. It does not change request state and each card links to the corresponding list view with the role-appropriate scope. A zero count is displayed as `0`, not omitted.

## 2. UI specification

The dashboard is available at `/dashboard` after login and is linked from the main navigation. It contains a heading, a short explanation of the current role scope, and five labelled status cards. Each card shows the status name, count and an accessible link to the filtered request list. The cards use the existing status text and colour badges as a secondary cue; colour is not the only indication.

At 375 px the cards wrap into a single-column layout without horizontal page scrolling. At 768 px they use two columns where space allows, and at 1280 px they may use a five-card row. Keyboard users can reach the navigation, cards and links in DOM order. The page has a mounted polite status region that announces loading, success and errors without exposing request data.

## 3. API specification

`GET /api/dashboard` requires an authenticated session and returns aggregate counts only:

```json
{
  "counts": {
    "DRAFT": 0,
    "SUBMITTED": 0,
    "APPROVED": 0,
    "REJECTED": 0,
    "CANCELLED": 0
  }
}
```

The server determines the scope from the session role. The route does not accept a requester id, role, status override or arbitrary filter from the client. Anonymous callers receive the existing 401 response; authenticated callers cannot request another role's counts. The response contains no request rows, names, descriptions or other hidden data.

## 4. Data and migration

No schema change or migration is needed. The route aggregates the existing `PurchaseRequest.status` values and applies the existing requester, approver and administrator visibility rules. The implementation must not add a second status enum or duplicate visibility logic. A later feature that changes the status lifecycle must revise this contract before the dashboard accepts the new status.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-100 | An authenticated requester receives all five status keys and counts only their own requests. |
| AC-101 | A requester cannot influence the scope by supplying a user id, role or override parameter. |
| AC-102 | An authenticated approver receives counts for the current review-visible scope and does not receive another user's private or draft-only rows. |
| AC-103 | An authenticated administrator receives counts for all requests, including requests from other users. |
| AC-104 | Every existing status is present with a numeric count, including zero. |
| AC-105 | Anonymous access returns 401 without counts or request data. |
| AC-106 | The endpoint returns aggregate counts only and never serializes request rows or hidden fields. |
| AC-107 | The dashboard shows five labelled cards and links each card to the role-appropriate request list. |
| AC-108 | The dashboard is usable by keyboard and has no axe violations in its status cards and navigation. |
| AC-109 | At 375, 768 and 1280 px the page has no horizontal document overflow and all cards remain readable. |
| AC-110 | Loading, success and error states are announced through a mounted polite status region. |
| AC-111 | A count of zero is displayed as `0` and the linked filtered list can be opened without changing the count scope. |

## 6. Software test specification

| Test | AC | Level | Precondition and input | Expected result |
|---|---|---|---|---|
| TEST-132 | AC-100 | API integration | Requester has requests in multiple statuses and another user's requests exist | All five keys are returned; only the requester's rows contribute. |
| TEST-133 | AC-101 | API integration | Add user-id, role and scope override query parameters | Scope remains determined by the session; overrides are ignored or rejected as specified by the existing API convention. |
| TEST-134 | AC-102 | API integration | Approver has review-visible submitted requests and private/draft rows exist | Counts include only the review-visible rows. |
| TEST-135 | AC-103 | API integration | Administrator requests the dashboard with other users' rows present | All requests contribute to the counts. |
| TEST-136 | AC-104 | API integration | Dataset has at least one zero-count status | Response contains every status key with numeric values. |
| TEST-137 | AC-105 | API integration | Call without a session | 401 with no counts or request data. |
| TEST-138 | AC-106 | API integration | Inspect the dashboard response body | Only the counts object is present; no request rows or hidden fields are returned. |
| TEST-139 | AC-107 | Browser end to end | Open dashboard as requester, approver and administrator | Five labelled cards and role-appropriate list links are visible. |
| TEST-140 | AC-108 | Browser accessibility | Navigate with keyboard and run axe on dashboard cards/navigation | Focus order is usable and axe reports no violations. |
| TEST-141 | AC-109 | Browser responsive | Open dashboard at 375, 768 and 1280 px | No horizontal document overflow; cards remain readable. |
| TEST-142 | AC-110 | Browser accessibility | Observe initial load and a forced API error | Mounted status region announces loading and the resulting error. |
| TEST-143 | AC-111 | Browser end to end | Use a zero-count card and open its list link | The card shows `0`; the linked list opens with the correct role scope. |

## 7. Definition of Done

- This contract is reviewed and approved before implementation.
- The SRS, feature inventory, traceability matrix and System SDS link F-08 and Issue #55.
- API tests cover every role, all status keys, zero counts, anonymous access and response-data minimisation.
- Browser tests cover cards, links, keyboard use, axe, responsive widths and the live status region.
- The Sprint 2 results table records every AC, test, actual result and implementation commit.
- The implementation PR is reviewed by Aphisaimai and merged into `staging`.
