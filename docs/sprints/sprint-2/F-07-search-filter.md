# Feature contract F-07: Search and filter requests

Contract version 1.2, 25 November 2026. Proposed before implementation. It must be reviewed before code is written.

Linked requirements: FR-17, BR-12, NFR-01, NFR-02, NFR-04, NFR-05, NFR-07, NFR-09, NFR-10, NFR-12. Depends on F-04, with a soft dependency on F-06 for CANCELLED test data. If F-11 adds a new request status, this contract must be revised before that status is accepted by the filter. The existing visibility rules remain the security boundary; filtering must never reveal a request that the caller could not already list.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 25 November 2026 | Initial Sprint 2 contract for server-side request search and filtering. |
| 1.1 | 25 November 2026 | Added UI and data-layer definitions, query boundary rules, NFR-09 input cases, review-scope behavior, null-field behavior and the formal NFR-12 measurement. |
| 1.2 | 25 November 2026 | Added responsive, axe-core and URL-persistence acceptance tests; clarified literal backslash and percent searches; renumbered sections. |

## 1. Feature design

Behavior: a user can narrow an existing request list by status, free-text search and category. The server applies the visibility scope first and then applies the filters. The client only displays the controls; it does not decide which records the caller may see.

The existing scopes remain unchanged:

- `mine` (default): the caller's own requests.
- `review`: submitted requests belonging to other users, for approvers only.
- `all`: all requests, for administrators only.

Workflow:

1. The user opens My requests, Review queue or All requests.
2. The user chooses zero or more filters and submits the search.
3. The client sends the scope and filter values to the API.
4. The API validates the values, applies visibility and filters in the database, and returns the same summary shape and ordering as the unfiltered list.
5. Clearing the filters returns the complete list for that scope.

## 2. UI specification

My requests and All requests show a filter toolbar above the list. It contains visible labels **Search text**, **Status** and **Category**, plus **Apply filters** and **Clear filters** buttons. The Review queue shows **Search text** and **Category** only; it does not show a status control because that scope is always SUBMITTED. Pressing Enter in Search text applies the filters; the Apply filters button does the same. Clear filters removes every filter and reloads the scope.

The selected filters are stored in the URL query string, so reload and Back restore the same result. The scope is also kept in the URL. At 375 px the controls stack vertically, each field and button uses the full available width, and the page itself does not scroll horizontally; if the table needs more width, only the table's own box scrolls horizontally. Labels are associated with their controls and an `aria-live`/`role="status"` region announces the result or empty state to a screen reader.

## 3. Filter contract

`GET /api/requests?scope=<scope>&status=<status>&q=<text>&category=<category>`

All query parameters are optional. `scope` defaults to `mine`; an empty or whitespace-only `q` is treated as absent. Search is case-insensitive and matches a substring in `requestNumber`, `itemName`, `description` or `reason`. It does not search password, session, actor or other users' hidden data.

| Parameter | Valid values | Meaning |
|---|---|---|
| `scope` | `mine`, `review`, `all` | Existing visibility scope and role checks |
| `status` | `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `CANCELLED` | Exact status match; `status=` is treated as absent |
| `category` | `EQUIPMENT`, `SOFTWARE`, `FURNITURE`, `STATIONERY`, `OTHER` | Exact category match |
| `q` | trimmed text, at most 100 characters | Case-insensitive substring search; whitespace-only is absent |

Filters combine with AND. The response remains `{ "requests": [...] }` with the existing summary fields and scope-specific ordering. The API performs filtering server-side; no unfiltered data is sent to the browser for client-side filtering. A category filter never matches a NULL category, and searching a NULL reason or category is treated as no match, not as an error.

Each parameter must occur at most once. Repeated parameters such as `status=A&status=B` return `422 VALIDATION_ERROR`. Status and category values are case-sensitive Prisma enum values; lower-case values return `422`. An empty `status` or `category` is treated as absent. A `q` of exactly 100 characters is accepted; 101 characters returns `422`.

The review scope is intrinsically `SUBMITTED` requests of other users. Therefore `scope=review&status=APPROVED` is valid and returns `200` with an empty list; the Review queue UI has no status control. The all scope remains administrator-only.

For NFR-09, `%`, `_`, `\`, `'`, `;--` and HTML in `q` are ordinary search characters. They are escaped/parameterized as data: `q=%` does not match every row unless a literal `%` occurs in the searchable fields.

## 4. Data and migration

No schema or migration change is needed. Filtering uses the existing `PurchaseRequest` columns `requestNumber`, `itemName`, `description`, `reason`, `status` and `category`; NULL reason/category values are handled as described above. The schema currently has indexes on `requesterId` and `(status, submittedAt)`, but not on the substring-search fields. A substring search therefore cannot use those indexes; this is accepted for the 200-row NFR-12 target and is measured rather than hidden.

Invalid scope, status, category or an overlong `q` returns `422 VALIDATION_ERROR` with a `fields` entry naming the invalid parameter. A caller without permission for `review` or `all` receives the existing `403 FORBIDDEN`. An anonymous caller receives `401` before any filter is processed.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-74 | The default `mine` list is unchanged when no filters are supplied. |
| AC-75 | A valid status filter returns only requests with that exact status. |
| AC-76 | A valid category filter returns only requests in that category. |
| AC-77 | `q` matches a case-insensitive substring in request number, item name, description or reason. |
| AC-78 | Status, category and text filters combine with AND. |
| AC-79 | Clearing filters returns the complete list for the selected scope. |
| AC-80 | Filtering never bypasses requester, approver or administrator visibility rules. |
| AC-81 | The review scope still contains only submitted requests of other users after filtering; `status=APPROVED` returns 200 with an empty list. |
| AC-82 | The all scope remains administrator-only and can filter every status. |
| AC-83 | Invalid scope, status, category and overlong text return `422 VALIDATION_ERROR` with fields. |
| AC-84 | Anonymous calls return `401`, and unauthorized scopes return `403`, without request data. |
| AC-85 | The response payload contains only rows visible to the caller that match all supplied filters; no hidden or unfiltered row is present. |
| AC-86 | For one user with 200 requests, after one warm-up call, the unfiltered mine list has a median of 20 calls under 500 ms on the recorded local test environment (formal NFR-12 measurement). |
| AC-87 | The UI filter controls can be used fully with the keyboard, including Enter and focus order. |
| AC-88 | Every filter and action has a visible, associated label: Search text, Status, Category, Apply filters and Clear filters. |
| AC-89 | Clear filters removes the URL parameters and restores the complete list for the current scope. |
| AC-90 | The UI shows an empty-state message when valid filters match no request and does not show a filter control for a forbidden scope. |
| AC-91 | The result count or empty state is announced to screen readers after filtering. |
| AC-92 | NFR-09 search characters (`%`, `_`, `\`, `'`, `;--` and HTML) are matched as plain characters; `q=%` does not match every row. |
| AC-93 | Repeated parameters return 422; empty status/category are absent; lower-case enum values return 422. |
| AC-94 | A 100-character `q` is accepted and a 101-character `q` returns 422. |
| AC-95 | A category filter does not match NULL category, and searching requests with NULL reason/category does not error. |
| AC-96 | `scope=review&status=APPROVED` returns 200 with an empty list, while the Review queue has no status control. |
| AC-97 | At 375, 768 and 1280 px the page has no horizontal page scrolling; only an overflowing table box may scroll horizontally. |
| AC-98 | An axe-core run on the filter toolbar reports no violations. |
| AC-99 | After applying filters, reloading the page and using Back restore the same scope, URL parameters and filtered result. |

## 6. Software test specification

The following tests are planned for Sprint 2 and must be added to the Sprint 2 results table when executed.

| Test | AC | Level | Precondition and input | Expected result |
|---|---|---|---|---|
| TEST-106 | AC-74 | API integration | Request the default mine scope with no filters | Existing complete mine list and ordering are unchanged |
| TEST-107 | AC-75 | API integration | Filter mine by each valid status | Every returned row has the requested status |
| TEST-108 | AC-76 | API integration | Filter mine by each valid category | Every returned row has the requested category |
| TEST-109 | AC-77 | API integration | Search with mixed-case fragments from request number, item name, description and reason | Matching rows are returned case-insensitively; non-matches are absent |
| TEST-110 | AC-78 | API integration | Send status, category and `q` together | Only rows matching all filters are returned |
| TEST-111 | AC-79 | API integration | Apply filters, then omit them/clear them | The complete list for the same scope returns |
| TEST-112 | AC-80 | API integration | Another requester, approver and administrator query filtered lists | No caller receives a row outside their existing visibility |
| TEST-113 | AC-81, AC-96 | API integration | Approver filters the review scope by status and text, including `status=APPROVED` | Only submitted requests of other users are returned; APPROVED gives 200 with an empty list |
| TEST-114 | AC-82 | API integration | Administrator filters the all scope across statuses | All matching requests are returned; other roles get 403 |
| TEST-115 | AC-83 | API integration | Invalid scope/status/category and 101-character `q` | 422 with `VALIDATION_ERROR` and the offending field |
| TEST-116 | AC-84 | API integration | Anonymous filtered call and unauthorized review/all scopes | 401/403 with no request data |
| TEST-117 | AC-85 | API/security integration | Seed a hidden request and inspect the response payload | Payload contains only visible rows that match the filters |
| TEST-118 | AC-86 | Performance integration | Seed 200 requests for one user; make one warm-up call, then 20 unfiltered mine-list calls and record machine/DB details | Median response time under 500 ms |
| TEST-119 | AC-87 | Browser end to end | Navigate and apply filters using keyboard only, including Enter | Focus order works and Enter applies the filter |
| TEST-120 | AC-88 | Browser end to end | Inspect the toolbar in mine, review and all scopes | Required visible labels and associated controls are present; review has no status control |
| TEST-121 | AC-89 | Browser end to end | Apply filters, then click Clear filters | URL parameters disappear and the complete scope list returns |
| TEST-122 | AC-90 | Browser end to end | Use a no-match filter and open a forbidden scope | Empty state appears; forbidden scope control is absent |
| TEST-123 | AC-91 | Browser end to end | Apply a filter and inspect the `role="status"`/`aria-live` result region | The live region contains the result count or empty-state message and is announced to screen readers |
| TEST-124 | AC-92 | API/security integration | Seed one row containing a literal `%`; search each of `%`, `_`, one `\`, `'`, `;--` and HTML, including `q=%` | Characters are treated literally; `q=%` returns only the row containing literal `%` and does not match every row |
| TEST-125 | AC-93 | API integration | Repeat status, send empty values and lower-case enum values | Repeated/lower-case values return 422; empty enum values are absent |
| TEST-126 | AC-94 | API integration | Send `q` with exactly 100 and then 101 characters | 100 is accepted; 101 returns 422 |
| TEST-127 | AC-95 | API integration | Filter category and search a DRAFT with NULL category/reason | NULL values do not match category and do not cause an error |
| TEST-128 | AC-96 | API integration | Approver requests review scope with `status=APPROVED` | 200 with an empty list; no status control is rendered in review UI |
| TEST-129 | AC-97 | Browser end to end | Run the list at 375, 768 and 1280 px and inspect document scroll width | `document.documentElement.scrollWidth` is no greater than `clientWidth`; only the table wrapper may scroll |
| TEST-130 | AC-98 | Browser accessibility | Run axe-core against the filter toolbar in mine, review and all scopes | No axe violations are reported |
| TEST-131 | AC-99 | Browser end to end | Apply filters, reload, then navigate Back | The URL parameters and filtered result are restored |

## 7. Definition of Done

- This contract is reviewed and approved before implementation.
- The SRS, feature inventory, System SDS and traceability matrix are updated with the approved decision and links to this contract.
- Every acceptance criterion has a test ID and an executed result.
- API tests cover every filter, combinations, invalid values, visibility and no-data leakage.
- API tests cover NFR-09 metacharacters, repeated parameters, enum case, empty values, exact text boundaries and NULL fields.
- The formal NFR-12 measurement is recorded with its environment and raw output.
- Browser tests cover labels, keyboard access, URL persistence, clear action, responsive widths, axe accessibility, result announcements, empty state and forbidden scopes.
- The implementation branch is reviewed in a PR into `staging`.
- The merged feature is included in the Sprint 2 completion table.
