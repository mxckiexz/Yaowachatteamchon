# Feature contract F-08: Dashboard request counts

Contract version 1.2, 27 November 2026. This is a contract-only proposal for review before implementation. It tracks Issue #55 and implements FR-18.

Linked requirements: FR-18, BR-12, NFR-01, NFR-02, NFR-05, NFR-07 and NFR-10. Depends on F-04 for the existing visibility rules and F-07 for the list/filter navigation. No database migration is proposed.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 27 November 2026 | Initial F-08 dashboard contract proposed for review. |
| 1.1 | 27 November 2026 | Replaced the approver scope with My requests plus Waiting for review; added exact links, count/list consistency, loading/error/retry, navigation, state-change and no-request checks, and traceability requirements. |
| 1.2 | 27 November 2026 | Clarified the approver response and cards, made the no-waiting test deterministic, and added F-08 to the BR/NFR traceability rows. |

## 1. Feature design

The dashboard gives a signed-in user a count of visible purchase requests grouped by every existing request status: `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED` and `CANCELLED`. Counts are calculated by the server from the same visibility boundary used by the existing list routes; the client never receives hidden rows to count.

Role scopes:

| Role | Requests included in the counts |
|---|---|
| REQUESTER | The user's own requests only. |
| APPROVER | Two groups: **My requests**, using the `mine` scope and all five statuses; and **Waiting for review**, using the `review` scope for `SUBMITTED` requests owned by other users. |
| ADMIN | All requests, matching the existing administrator list scope. |

The dashboard is informational only. It does not change request state. Every card count must equal the number of rows returned by the list URL that the card opens. A zero count is displayed as `0`, not omitted.

## 2. UI specification

The dashboard is available at `/dashboard` after login and is linked from the main navigation for REQUESTER, APPROVER and ADMIN. The existing first screen after login does not change: `/requests` for requesters and approvers, `/admin/users` for administrators. An anonymous visit to `/dashboard` redirects to `/login`.

The page contains a heading, a short explanation of the current role scope, and labelled status cards. Requesters and administrators see five status cards. Approvers see a **My requests** group with five cards plus a **Waiting for review** card. Each card shows its label, count and an accessible link. The cards use existing status text and colour badges as a secondary cue; colour is not the only indication.

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

The server determines the scope from the session role. Requester and administrator responses contain only `counts`; approver responses contain `counts` for the approver's own requests plus `reviewWaiting` for other users' submitted requests:

```json
{
  "counts": { "DRAFT": 0, "SUBMITTED": 0, "APPROVED": 0, "REJECTED": 0, "CANCELLED": 0 },
  "reviewWaiting": 0
}
```

The route does not accept a requester id, role, status override or arbitrary filter from the client. Unknown query parameters are ignored and produce the same response as the call without them. Anonymous callers receive the existing 401 response; authenticated callers cannot request another role's counts. The response contains no request rows, names, descriptions or other hidden data.

## 4. Data and migration

No schema change or migration is needed. The route aggregates the existing `PurchaseRequest.status` values. For an approver, `counts` uses the existing `visibilityWhere`/BR-12 rule restricted to the approver's own requests, while `reviewWaiting` uses the existing `scope=review` rule for other users' `SUBMITTED` requests. The implementation must not add a second status enum or duplicate visibility logic. A later feature that changes the status lifecycle must revise this contract before the dashboard accepts the new status.

## 5.1 Card link table

| Role/group | Card | Exact link |
|---|---|---|
| REQUESTER | Each status `X` | `/requests?status=X` |
| APPROVER / My requests | Each status `X` | `/requests?status=X` |
| APPROVER / Waiting for review | Waiting count | `/reviews` |
| ADMIN | Each status `X` | `/all-requests?status=X` |

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-100 | An authenticated requester receives all five status keys and counts only their own requests. |
| AC-101 | A requester cannot influence the scope by supplying a user id, role or override parameter. |
| AC-102 | An authenticated approver receives five own-request status counts plus a `reviewWaiting` count for other users' submitted requests; private and draft-only rows are excluded from the waiting count. |
| AC-103 | An authenticated administrator receives counts for all requests, including requests from other users. |
| AC-104 | Every existing status is present with a numeric count, including zero. |
| AC-105 | Anonymous access returns 401 without counts or request data. |
| AC-106 | The endpoint returns aggregate counts only and never serializes request rows or hidden fields. |
| AC-107 | The dashboard shows five labelled cards for requester and administrator, and an approver sees those five My requests cards plus a labelled Waiting for review card; every card links to the role-appropriate list. |
| AC-108 | The dashboard is usable by keyboard and has no axe violations in its status cards and navigation. |
| AC-109 | At 375, 768 and 1280 px the page has no horizontal document overflow and all cards remain readable. |
| AC-110 | Loading, success and error states are announced through a mounted polite status region. |
| AC-111 | A count of zero is displayed as `0` and the linked filtered list can be opened without changing the count scope. |
| AC-112 | For every role and every card, the displayed number equals the number of rows in the list opened by that card's exact link. |
| AC-113 | While loading, cards show a loading state rather than `0`; on failure they show the exact message `Unable to load dashboard counts.` and a `Retry` control. A successful retry replaces the error with the counts and announces success. |
| AC-114 | The Dashboard link is visible for requester, approver and administrator; login landing paths remain unchanged, and an anonymous `/dashboard` visit redirects to `/login`. |
| AC-115 | A new user with no requests receives five zero counts. For an approver, `reviewWaiting` equals the database count of other users' SUBMITTED requests; when the controlled fixture contains none, it is `0`. |
| AC-116 | After submit, approve, reject or cancel, the corresponding source and destination counts change consistently with the list data. |

## 6. Software test specification

| Test | AC | Level | Precondition and input | Expected result |
|---|---|---|---|---|
| TEST-132 | AC-100 | API integration | Requester has requests in multiple statuses and another user's requests exist | All five keys are returned; only the requester's rows contribute. |
| TEST-133 | AC-101 | API integration | Add user-id, role and scope override query parameters | Unknown parameters are ignored; the response is byte-for-byte equivalent to the call without them. |
| TEST-134 | AC-102 | API integration | Approver owns requests in multiple statuses; other users have submitted and draft requests | `counts` includes only the approver's own rows; `reviewWaiting` includes only other users' submitted rows. |
| TEST-135 | AC-103 | API integration | Record a baseline, seed known rows, then compare the response with a Prisma `groupBy` over all requests | Administrator counts exactly equal the database `groupBy` totals for every status. |
| TEST-136 | AC-104 | API integration | Dataset has at least one zero-count status | Response contains every status key with numeric values. |
| TEST-137 | AC-105 | API integration | Call without a session | 401 with no counts or request data. |
| TEST-138 | AC-106 | API integration | Inspect requester, approver and administrator response bodies | Requester and administrator bodies contain only `counts`; the approver body contains only `counts` and `reviewWaiting`; no rows or other fields are returned. |
| TEST-139 | AC-107 | Browser end to end | Open dashboard as requester, approver and administrator | Requester/admin see five labelled cards; approver sees My requests plus Waiting for review with the correct links. |
| TEST-140 | AC-108 | Browser accessibility | Navigate with keyboard and run axe on dashboard cards/navigation | Focus order is usable and axe reports no violations. |
| TEST-141 | AC-109 | Browser responsive | Open dashboard at 375, 768 and 1280 px | No horizontal document overflow; cards remain readable. |
| TEST-142 | AC-110, AC-113 | Browser accessibility | Observe initial load, success, a forced API error and Retry | Mounted status region announces loading and success; error text and Retry appear; successful retry restores counts. |
| TEST-143 | AC-111 | Browser end to end | Use a zero-count card and open its list link | The card shows `0`; the linked list opens with the correct role scope. |
| TEST-144 | AC-112 | Browser/API cross-check | Seed known rows, read cards and open every card link | Each card number equals the number of rows in its linked list. |
| TEST-145 | AC-114 | Browser end to end | Check login landing, Dashboard navigation and anonymous `/dashboard` | Landing paths remain unchanged; Dashboard link is present for all roles; anonymous users reach login. |
| TEST-146 | AC-115 | API/browser integration | Use a new requester; for the approver, seed or clear a controlled fixture so no other user's request is SUBMITTED, then compare with a database count | The new requester's five counts are `0`; the approver's own counts are `0`; `reviewWaiting` is exactly the database count and is `0` for the empty fixture. |
| TEST-147 | AC-116 | API integration | Submit, approve, reject and cancel controlled requests | Counts move from the old status to the new status exactly once. |

## 7. Definition of Done

- This contract is reviewed and approved before implementation.
- The SRS, feature inventory, traceability matrix and System SDS link F-08 and Issue #55.
- API tests cover every role, all status keys, zero counts, anonymous access and response-data minimisation.
- Browser tests cover cards, links, keyboard use, axe, responsive widths and the live status region.
- The Sprint 2 results table records every AC, test, actual result and implementation commit.
- The implementation PR is reviewed by Aphisaimai and merged into `staging`.
- TDD red and green output is stored under `docs/sprints/sprint-2/tdd/`.
- Raw server and Playwright terminal output is stored under `docs/sprints/sprint-2/test-output/`; browser tests are run locally because CI does not run Playwright.
- The implementation PR uses `Closes #55`.
