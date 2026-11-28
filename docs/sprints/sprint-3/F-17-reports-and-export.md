# Feature contract F-17: Reports and export

Contract version 1.1, 28 November 2026. Contract only, for review before implementation. Tracks Issue #76 and implements FR-27.

Linked requirements: FR-27, BR-05, BR-12, BR-15, BR-40, BR-41, NFR-01, NFR-02, NFR-04, NFR-05, NFR-07, NFR-09 and NFR-10. Depends on F-04 (visibility), F-02 (the categories, the request total of BR-05 and the statuses of a draft and a submitted request), F-06 (the `CANCELLED` status) and F-11 (return to `DRAFT`). The statuses `APPROVED` and `REJECTED` come from F-03. F-13 does not change a request's status values, so approval steps are not part of this report. If a later feature adds a request status or a category, changes who may see a request, or adds departments (F-15) to the report, this contract must be revised.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 28 November 2026 | Initial F-17 contract proposed for review. |
| 1.1 | 28 November 2026 | After review: BR-05 is linked and F-02, F-06 and F-11 are listed as dependencies; rejected and cancelled amounts are tested explicitly; TEST-339 checks the exact file name with the Bangkok date; formula protection includes LF; TEST-345 and AC-314 exclude any part of a file; AC-320 states why a returned request leaves another approver's report. |

## 1. Feature design

A signed-in user sees a summary of purchase requests: how many there are and how much money they are for, by status and by category. The user can narrow the report by date, status and category, and download the matching requests as a CSV file.

New business rules:

- **BR-40:** A report and its export contain exactly the requests the caller may see under BR-12 that match the filters. A filter only narrows this set. No parameter widens it.
- **BR-41:** Text typed by a user that is written into an export file must not be run as a formula when the file is opened in a spreadsheet program.

Every role may use the report. Nobody sees more in a report than in the rest of the application:

| Role | The report covers |
|---|---|
| Requester | Their own requests, in every status |
| Approver | Their own requests in every status, and every request of others that is not a draft |
| Administrator | All requests (read only) |

Amounts are request totals (BR-05). The overall amount is the sum of all matching requests, in every matching status, so it includes rejected and cancelled requests. The amounts by status show each part separately.

Dates are calendar days in Thailand time (`Asia/Bangkok`, UTC+7), whatever the time zone of the server or the browser. The date filter uses the creation time of a request, because every request has one.

Out of scope: Excel (`.xlsx`) and PDF files, charts, saved or scheduled reports, e-mail delivery, departments, approval steps, descriptions, reasons, comments and attachments in the export, and a record of who exported (F-18 may add it and then revise this contract).

## 2. UI specification

Every role gets a **Reports** link in the main navigation, after **Dashboard**. The page `/reports` has the heading **Reports**.

| Element | Specification |
|---|---|
| Filters | A form with the labelled fields **From**, **To** (dates), **Status** and **Category** (each with **All**), the buttons **Apply filters** and **Clear filters**, and the note `Dates are Thailand time and use the day a request was created.` |
| Address | The applied filters are in the page address (`from`, `to`, `status`, `category`), so reload, Back and a shared link keep them. **Clear filters** removes them |
| Total line | `Requests: {count}, total {amount}`, with the amount shown as other amounts in the application |
| By status | A table with the caption **By status**, the columns **Status**, **Requests** and **Total**, and one row for each of the five statuses, also when it is zero |
| By category | A table with the caption **By category**, the same kind of columns, and one row for each of the five categories and **No category** |
| Export | An **Export CSV** button. It exports the applied filters, not changes in the form that were not applied. It is enabled only while a result with at least one request is shown and no export is running |
| Loading | `Loading report...` |
| Empty | When the count is 0: `No requests match these filters.` The tables are not shown |
| Load error | `Unable to load the report.` and a **Retry** button |
| Filter error | When the server answers 422 for the filters, each message is shown next to its field and no earlier result is shown. Values that a field can hold stay in the form, and the address is unchanged |
| Export error | The server message in a `role="alert"` element. The report stays on the page |
| Announcements | One mounted polite `role="status"` region announces the total line, or the empty message, after each load, and `Report exported` after a download |

While an export runs, **Export CSV** is disabled; afterwards the focus is on it again, also after an error. Everything works with the keyboard in reading order. After **Apply filters** and **Clear filters** the focus stays on the button that was used. At 375, 768 and 1280 px there is no horizontal page scrolling, including the navigation; a table may scroll inside its own box.

## 3. API specification

| Method and path | Success |
|---|---|
| `GET /api/reports/summary` | 200 `{ "summary": summary }` |
| `GET /api/reports/export.csv` | 200, a CSV file |

### Parameters (both routes)

| Name | Value | Effect |
|---|---|---|
| `from` | `YYYY-MM-DD` | Only requests created on or after 00:00:00.000 of that day in Bangkok |
| `to` | `YYYY-MM-DD` | Only requests created up to and including 23:59:59.999 of that day in Bangkok |
| `status` | one of the five statuses | Only that status |
| `category` | one of the five categories (BR-15) | Only that category; a request without a category does not match |

All are optional and combine with AND. As in F-07, an empty value counts as absent, and the values are case sensitive. Other parameters are ignored.

### Summary

```json
{
  "summary": {
    "count": 2,
    "total": 1500.5,
    "byStatus": [ { "status": "DRAFT", "count": 0, "total": 0 } ],
    "byCategory": [ { "category": null, "count": 0, "total": 0 } ]
  }
}
```

- The response has exactly these fields.
- `byStatus` always has five entries, in the order `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `CANCELLED`.
- `byCategory` always has six entries, in the order `EQUIPMENT`, `SOFTWARE`, `FURNITURE`, `STATIONERY`, `OTHER`, `null`.
- Money is in baht. Sums are made in satang, so they have no rounding error. The counts and totals of each list add up to `count` and `total`.

### Export file

| Part | Specification |
|---|---|
| Headers | `Content-Type: text/csv; charset=utf-8`; `Content-Disposition: attachment; filename="purchase-requests-YYYY-MM-DD.csv"` with today's date in Bangkok; `Cache-Control: no-store` |
| Encoding | UTF-8 starting with the byte order mark, so that Thai text opens correctly in spreadsheet programs |
| Lines | Each line, also the last one, ends with CR LF |
| First line | `Request number,Item name,Category,Status,Quantity,Unit price (THB),Total (THB),Requester,Created at,Submitted at,Decided at` |
| Rows | One for each matching request, newest first (`createdAt`, then `id`, both descending). With no match the file has only the first line |
| Category and status | The labels used in the application, for example `Equipment` and `Approved`. An empty field for no category |
| Quantity | A whole number |
| Money | Two decimals, no thousands separator and no currency sign, for example `1234.50` |
| Times | `YYYY-MM-DD HH:mm` in Bangkok time, or an empty field |
| Requester | The requester's name; no e-mail address |
| Quoting | A field with a comma, a double quote, CR or LF is put in double quotes, and each double quote in it is doubled |
| Formula protection (BR-41) | If the item name or the requester name starts with `=`, `+`, `-`, `@`, a tab, a CR or an LF, an apostrophe `'` is put in front, before quoting. Other fields are made by the server and are not changed |
| Size | At most 5,000 requests. With more matches the answer is an error and no file |

### Errors and order of checks

| Order | Applies to | Condition | Response |
|---|---|---|---|
| 1 | both | No valid session | 401 (existing body) |
| 2 | both | A parameter appears more than once | 422 `VALIDATION_ERROR`, with `fields` for each repeated parameter |
| 3 | both | A date that is not a real calendar date in the form `YYYY-MM-DD` with a year from 2000 to 2999, an unknown status or category, or `from` later than `to` (reported on `to`) | 422 `VALIDATION_ERROR`, with `fields` for each wrong parameter |
| 4 | export | More than 5,000 requests match | 422 `{ "error": "Too many requests to export. Narrow the filters.", "code": "EXPORT_TOO_LARGE" }` |

No role is refused, because every role has a report of what it may see. Error answers are JSON as NFR-04 requires, contain no request data, and have no `Content-Disposition`. An unexpected failure gives the existing safe 500 answer, never part of a file. A method or path that is not in the table keeps the application's existing answer.

## 4. Data and migration

No schema change and no migration. Both routes only read. They create no history, notification or other row.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-300 | A requester's summary covers only their own requests, in every status, with exactly the listed response fields. |
| AC-301 | An approver's summary covers their own requests in every status and the requests of others that are not drafts, and no draft of another user. |
| AC-302 | The administrator's summary covers all requests. |
| AC-303 | The two lists have all their entries in the stated order, with zeros where nothing matches. The overall count and amount include rejected and cancelled requests, and the counts and totals of each list add up to the overall values without rounding error. |
| AC-304 | `status` and `category` narrow the report and combine; a request without a category matches no category filter. |
| AC-305 | `from` and `to` include whole Bangkok calendar days, checked at both ends of a day, whatever the time zone of the server. |
| AC-306 | Wrong or repeated parameters give 422 with `fields` on both routes; empty values count as absent; no error answer contains request data. |
| AC-307 | Without a session both routes give 401 and no data. Extra parameters such as `scope` or `requesterId` change nothing. |
| AC-308 | The export has the stated headers, byte order mark, CR LF lines and first line, and one row for each matching visible request in the stated order: the same set as the summary. |
| AC-309 | Labels, money, times in Bangkok, empty fields and quoting of commas, double quotes and line breaks are as stated, and a CSV reader gets back the stored text, apart from the apostrophe of AC-310. |
| AC-310 | An item name or requester name that starts with `=`, `+`, `-`, `@`, a tab, a CR or an LF is written with a leading apostrophe; other text is unchanged. |
| AC-311 | The export contains no description, reason, rejection reason, comment, attachment, e-mail address or password data. |
| AC-312 | 5,000 matching requests export; 5,001 give 422 `EXPORT_TOO_LARGE` and no file; the limit counts only requests the caller may see. |
| AC-313 | The two routes change no row. |
| AC-314 | If reading the data fails, both routes give the safe 500 JSON answer, without `Content-Disposition` and without any part of a CSV file. |
| AC-315 | In the UI every role has the Reports link; the tables show the values of the API; the filters are in the address and survive reload and Back; Clear removes them. |
| AC-316 | The UI shows the loading, empty (export disabled), load error with Retry, filter error and export error states; the button is disabled during an export. |
| AC-317 | **Export CSV** downloads a file with the stated name that matches the applied filters. |
| AC-318 | The page works with the keyboard alone, every field has a label, the focus is as stated, and the result and the export are announced. |
| AC-319 | At 375, 768 and 1280 px the page has no horizontal page scrolling, and axe-core reports no serious or critical violation on the navigation and the page. |
| AC-320 | After submit, approve, reject, return and cancel the report shows the new status. A returned request is a `DRAFT` again: its owner's report shows it as a draft, and it leaves the report of another approver, because BR-12 hides the drafts of others. |

## 6. Software test specification

| Test | AC | Level | Precondition and input | Expected result |
|---|---|---|---|---|
| TEST-331 | AC-300 | API integration | A requester with requests in several statuses; another requester with their own | Only the caller's values; exact keys |
| TEST-332 | AC-301 | API integration | An approver with an own draft; another user with a draft and with submitted and decided requests | Own draft counted; the other draft not; the others counted |
| TEST-333 | AC-302 | API integration | Administrator reads the summary | The same count and total as all rows in the database |
| TEST-334 | AC-303 | API integration | Requests in all five statuses, including at least one `REJECTED` and one `CANCELLED` with their own amounts; prices such as 0.10 and 0.20; then a filter that leaves some statuses and categories empty | The overall count and amount include the rejected and cancelled requests; their rows in `byStatus` show their own amounts; both lists add up exactly to the overall values; fixed order and zeros |
| TEST-335 | AC-304 | API integration | Filter by status, by category and by both, with a request without a category | Only matching requests; no category never matches |
| TEST-336 | AC-305 | API integration | Rows created at 23:59:59.999 and 00:00 Bangkok around both ends; run with the server time zone set to UTC | Exactly the rows of the chosen Bangkok days |
| TEST-337 | AC-306 | API integration | `2026-02-30`, `1-1-2026`, `0001-01-01`, `3000-01-01`, `from` after `to`, unknown and lower-case values, repeated and empty parameters, on both routes | 422 with the right fields; empty ignored; no data |
| TEST-338 | AC-307 | API/security integration | No session; a requester adds `scope=all` and another user's `requesterId` | 401; the same result as without the extra parameters |
| TEST-339 | AC-308 | API integration | Export as each role, with and without filters, and with no match, with the clock set to a moment when the Bangkok date differs from the UTC date | `Content-Disposition` is exactly `attachment; filename="purchase-requests-YYYY-MM-DD.csv"` with the Bangkok date; the other headers, mark, line ends, first line and order; the same set as the summary |
| TEST-340 | AC-309 | API integration | Thai text, a comma, a double quote and a line break in an item name; a draft without category and dates | Parsed with a CSV reader: the stated values |
| TEST-341 | AC-310 | API/security integration | Item names starting with `=`, `+`, `-`, `@`, a tab, a CR and an LF, a requester name starting with `=`, and ordinary names. A leading tab, CR or LF is stored directly in the database, because the form trims it | Apostrophe only where stated |
| TEST-342 | AC-311 | API integration | Requests with marker text in description, reason, rejection reason, comment and attachment | No marker and no e-mail address in the file |
| TEST-343 | AC-312 | API integration | 5,000 and 5,001 matching rows of one requester, plus rows the caller cannot see | 200 with 5,000 rows; 422; hidden rows do not count |
| TEST-344 | AC-313 | API integration | Count and compare rows before and after both routes | No change |
| TEST-345 | AC-314 | API integration | Force the database read to fail on the summary and on the export | 500 with `Content-Type` JSON and the body exactly `{ "error": "Something went wrong." }`; no `Content-Disposition`; the body has no byte order mark, no CSV first line and no row |
| TEST-346 | AC-315 | Browser end to end | Each role opens Reports, filters, reloads, goes Back and clears | Link, values equal to the API, address kept |
| TEST-347 | AC-316 | Browser end to end | Delay and fail the summary, then Retry; an empty result; a wrong date in the address; fail an export | Each state as stated |
| TEST-348 | AC-317 | Browser end to end | Apply a filter, change the form without applying, export | File name; the content matches the applied filter |
| TEST-349 | AC-318 | Browser end to end | Use only the keyboard to filter, clear and export | Labels, focus and announcements |
| TEST-350 | AC-319 | Browser responsive and accessibility | 375, 768 and 1280 px with data in both tables; run axe | No page overflow; no serious or critical violation |
| TEST-351 | AC-320 | API integration | Submit, approve, reject, return and cancel, reading the report of the owner and of another approver after each | The report follows the status; after the return the owner sees one more draft and the other approver's count and amounts no longer include the request (BR-12) |

## 7. Definition of Done

- This contract is reviewed and approved before implementation. A later change gets a new version and a change-log entry.
- Tests are written first. The red output (against the code without the feature) and the green output are stored unchanged under `docs/sprints/sprint-3/tdd/`; a test that guards a new rule fails without the feature.
- Every AC has its test, and the server suite, client tests, type check and build pass.
- Raw server and Playwright terminal output is stored under `docs/sprints/sprint-3/test-output/`. Browser tests are run locally because CI does not run Playwright.
- One manual check opens an exported file with Thai text and a formula-like item name in a spreadsheet program, and the result is recorded with the program and its version.
- The SRS, feature inventory, traceability matrix and System SDS agree with the implementation, and the Sprint 3 results table records every AC, test, actual result and commit.
- The implementation Pull Request closes the F-17 Issue, is reviewed and approved by Thanwarat before merge, and is merged into `staging`.
