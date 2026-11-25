# Feature contract F-07: Search and filter requests

Contract version 1.0, 25 November 2026. Proposed before implementation. It must be reviewed before code is written.

Linked requirements: FR-17, BR-12, NFR-02, NFR-07, NFR-12. Depends on F-04. The existing visibility rules remain the security boundary; filtering must never reveal a request that the caller could not already list.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 25 November 2026 | Initial Sprint 2 contract for server-side request search and filtering. |

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

## 2. Filter contract

`GET /api/requests?scope=<scope>&status=<status>&q=<text>&category=<category>`

All query parameters are optional. `scope` defaults to `mine`; an empty or whitespace-only `q` is treated as absent. Search is case-insensitive and matches a substring in `requestNumber`, `itemName`, `description` or `reason`. It does not search password, session, actor or other users' hidden data.

| Parameter | Valid values | Meaning |
|---|---|---|
| `scope` | `mine`, `review`, `all` | Existing visibility scope and role checks |
| `status` | `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `CANCELLED` | Exact status match |
| `category` | `EQUIPMENT`, `SOFTWARE`, `FURNITURE`, `STATIONERY`, `OTHER` | Exact category match |
| `q` | trimmed text, at most 100 characters | Case-insensitive substring search |

Filters combine with AND. The response remains `{ "requests": [...] }` with the existing summary fields and scope-specific ordering. The API performs filtering server-side; no unfiltered data is sent to the browser for client-side filtering.

Invalid scope, status, category or an overlong `q` returns `422 VALIDATION_ERROR` with a `fields` entry naming the invalid parameter. A caller without permission for `review` or `all` receives the existing `403 FORBIDDEN`. An anonymous caller receives `401` before any filter is processed.

## 3. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-74 | The default `mine` list is unchanged when no filters are supplied. |
| AC-75 | A valid status filter returns only requests with that exact status. |
| AC-76 | A valid category filter returns only requests in that category. |
| AC-77 | `q` matches a case-insensitive substring in request number, item name, description or reason. |
| AC-78 | Status, category and text filters combine with AND. |
| AC-79 | Clearing filters returns the complete list for the selected scope. |
| AC-80 | Filtering never bypasses requester, approver or administrator visibility rules. |
| AC-81 | The review scope still contains only submitted requests of other users after filtering. |
| AC-82 | The all scope remains administrator-only and can filter every status. |
| AC-83 | Invalid scope, status, category and overlong text return `422 VALIDATION_ERROR` with fields. |
| AC-84 | Anonymous calls return `401`, and unauthorized scopes return `403`, without request data. |
| AC-85 | The API filters in the database and returns no hidden/unfiltered records to the client. |
| AC-86 | A list of 200 requests with a representative filter has a median response time under 500 ms on the local test machine (formal NFR-12 measurement). |
| AC-87 | The UI exposes accessible status, category and text controls, shows the filtered result, and provides a clear-filters action. |
| AC-88 | The UI shows an empty-state message when valid filters match no request and does not show a filter control for a forbidden scope. |

## 4. Software test specification

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
| TEST-113 | AC-81 | API integration | Approver filters the review scope by status and text | Only submitted requests of other users are returned |
| TEST-114 | AC-82 | API integration | Administrator filters the all scope across statuses | All matching requests are returned; other roles get 403 |
| TEST-115 | AC-83 | API integration | Invalid scope/status/category and 101-character `q` | 422 with `VALIDATION_ERROR` and the offending field |
| TEST-116 | AC-84 | API integration | Anonymous filtered call and unauthorized review/all scopes | 401/403 with no request data |
| TEST-117 | AC-85 | API/security integration | Seed a hidden request and inspect the response payload | Hidden rows and unfiltered records are never sent |
| TEST-118 | AC-86 | Performance integration | 200 requests and 20 representative filtered list calls | Median response time under 500 ms |
| TEST-119 | AC-87 | Browser end to end | Use status/category/text controls and clear filters | Controls are keyboard accessible and results update correctly |
| TEST-120 | AC-88 | Browser end to end | Use a no-match filter and open a forbidden scope | Empty state appears; forbidden scope control is absent |

## 5. Definition of Done

- This contract is reviewed and approved before implementation.
- The SRS, feature inventory, System SDS and traceability matrix are updated with the approved decision and links to this contract.
- Every acceptance criterion has a test ID and an executed result.
- API tests cover every filter, combinations, invalid values, visibility and no-data leakage.
- The formal NFR-12 measurement is recorded with its environment and raw output.
- Browser tests cover the controls, clear action, keyboard access, empty state and forbidden scopes.
- The implementation branch is reviewed in a PR into `staging`.
- The merged feature is included in the Sprint 2 completion table.
