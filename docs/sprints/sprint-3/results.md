# Sprint 3 results

## F-17 Reports and export

Implementation commit: `fde6754`. Contract: `F-17-reports-and-export.md` v1.1. Run date: 29 November 2026, on a local PostgreSQL database.

| AC | Implementation | Test | Actual result | Commit |
|---|---|---|---|---|
| AC-300 | `GET /api/reports/summary` with the BR-12 rule | TEST-331 | Passed: only the requester's rows, exact response fields | `fde6754` |
| AC-301 | Same rule for an approver | TEST-332 | Passed: own draft counted, another user's draft not | `fde6754` |
| AC-302 | Same rule for the administrator | TEST-333 | Passed: equal to a direct count and sum of all rows | `fde6754` |
| AC-303 | One group query; sums in satang | TEST-334 | Passed: all five statuses add up exactly, with rejected and cancelled in the total | `fde6754` |
| AC-304 | Status and category filters | TEST-335 | Passed | `fde6754` |
| AC-305 | Day limits with the fixed `+07:00` offset | TEST-336 | Passed at both ends of a day with the server zone set to UTC, Los Angeles and Tokyo | `fde6754` |
| AC-306 | `parseReportQuery` | TEST-337 | Passed on both routes, including a repeated parameter reported alone | `fde6754` |
| AC-307 | Session check; extra parameters ignored | TEST-338 | Passed | `fde6754` |
| AC-308 | `GET /api/reports/export.csv` | TEST-339 | Passed: headers, exact file name with the Bangkok date, line ends, order, same set as the summary | `fde6754` |
| AC-309 | CSV writer | TEST-340 | Passed: read back with a separate CSV reader in the test | `fde6754` |
| AC-310 | Formula protection | TEST-341 | Passed for `=`, `+`, `-`, `@`, tab, CR, LF and a requester name | `fde6754` |
| AC-311 | Fixed list of columns | TEST-342 | Passed: no marker text and no e-mail address | `fde6754` |
| AC-312 | Limit of 5,000 | TEST-343 | Passed: 5,000 rows exported, 5,001 refused, hidden rows not counted | `fde6754` |
| AC-313 | Read only | TEST-344 | Passed | `fde6754` |
| AC-314 | Headers set after the file is complete | TEST-345 | Passed: safe 500, no `Content-Disposition`, no part of a file | `fde6754` |
| AC-315 | Reports page and navigation link | TEST-346 | Passed in the browser for the three roles | `fde6754` |
| AC-316 | Page states | TEST-347 | Passed | `fde6754` |
| AC-317 | Export of the applied filters | TEST-348 | Passed: the downloaded file was read | `fde6754` |
| AC-318 | Labels, focus, announcements | TEST-349 | Passed with the keyboard only | `fde6754` |
| AC-319 | Responsive layout | TEST-350 | Passed at 375, 768 and 1280 px; axe found no serious or critical violation | `fde6754` |
| AC-320 | Report follows the status and BR-12 | TEST-351 | Passed after submit, return, approve, reject and cancel | `fde6754` |

Full local suites at commit `fde6754`: server 216 passed, client 17 passed, full Playwright 58 passed; type check and build of server and client passed. Raw output is in `test-output/server-f17-full-vitest.txt`, `test-output/client-f17.txt` and `test-output/browser-f17-full-playwright.txt`. CI does not run Playwright. The final F-17 server file also passed 10 times in a row and the final F-17 browser file 5 times in a row.

Checks of the tests: the code was broken on purpose 26 times, one rule at a time, and each break made at least one F-17 test fail. Server (18): no BR-12 rule, UTC days, the end day left out, repeated parameters accepted, any year, `from` after `to` accepted, no formula protection, LF not protected, requester name not protected, no quoting, no byte order mark, money without two decimals, file name with the UTC date, rows cut at 5,000 without an error, no `Cache-Control`, oldest first, a download header set before reading, and no row for requests without a category. User interface (8): export of the unapplied form, no focus back on the export button, no export announcement, the form not following the address, export enabled with no result, an earlier result kept after a filter error, no field message, and no link for the administrator. The source was restored after each run.

**Not done yet:** the manual check of the Definition of Done, opening an exported file with Thai text and a formula-like item name in a spreadsheet program. Its result, program and version will be recorded here.

Known limitations:

- CSV only; no `.xlsx` or PDF, and no charts.
- At most 5,000 requests in one export; the user narrows the filters. The summary has no limit.
- Formula protection covers the characters the contract lists. Full-width forms such as `＝` are not handled.
- Exports are not recorded (a later audit log, F-18, may add this).
- There is no schema change, so no migration check. No production deployment has been performed.
- The report page has no separate client unit tests; its behaviour is covered by the browser tests.
