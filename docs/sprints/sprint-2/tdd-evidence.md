# Sprint 2 TDD evidence

F-06 tests were run against the merged contract baseline before the cancellation route existed, then run again after implementation. The red run used a temporary worktree at staging commit `5756480`; its output is `tdd/F-06-red.txt`. The green run used implementation commit `8d46bad`; its output is `tdd/F-06-green.txt`.

| Feature | Red baseline and result | Green implementation and result |
|---|---|---|
| F-06 | `5756480` (staging): 10 failed, 1 passed because the cancel route was absent | `8d46bad`: 11 passed |

The red failures were the expected missing-route failures for cancellation behavior. TEST-102 already passed because the existing same-origin middleware correctly rejected the foreign Origin before the missing route was reached.

F-07 was strengthened after the first review. The original red output is kept in `tdd/F-07-red-run.txt` as history. The current test file was then run against a clean staging worktree at commit `f30ae04`: 13 of 18 tests failed and 5 existing-behaviour guards passed. The current raw output is `tdd/F-07-red-current.txt`. After implementation and the coverage fixes, commit `fc0189f` passed all 18 server tests and all 8 browser tests. The green server output, including the performance timings, is `test-output/server-f07-vitest.txt`.

F-08 red evidence is in `tdd/F-08-red.txt`: the final 9-test file failed 9/9 against the pre-implementation staging code. Green evidence is in `tdd/F-08-green.txt`; the server and client tests passed after implementation. The complete 7-test Playwright output is in `test-output/browser-f08-playwright.txt`.

F-09 tests were written before the code. The first red run, at the staging commit `5f26d9f`, is kept in `tdd/F-09-red.txt` (server: both files failed, 19 API tests and the unit file, which could not import the missing module) and `tdd/F-09-red-browser.txt` (6 of 6 failed). The API failures were 404 answers from the missing routes.

During the green run TEST-158 failed once with `ECONNRESET`. The cause was the test client: it sends `Connection: close`, and when the server answers before a 5 MB body has arrived, the connection can close while the client is still writing. With a kept-open connection, as a browser uses, the same early 401 arrived in 40 of 40 calls. TEST-155, TEST-157 and TEST-158 now send only the headers of the large upload and require an answer, which also shows more directly that the file is not read first. A browser check of an oversized upload was added to TEST-169.

The final test files were then run again against `5f26d9f` without the feature: `tdd/F-09-red-final.txt` (19 API tests failed and the unit file failed to load) and `tdd/F-09-red-browser-final.txt` (6 of 6 failed). The green results are listed in `results.md`.

F-10 tests were written before the code. The first red run, at the staging commit `7d50cdc`, is kept in `tdd/F-10-red.txt` (server: both files failed, 14 API tests with 404 answers from the missing routes, and the unit file, which could not import the missing module) and `tdd/F-10-red-browser.txt` (6 of 6 failed).

After the first green run, deliberately breaking the code showed that TEST-186 still passed when line breaks were not kept: the Playwright text matcher collapses white space. The test now reads the rendered text directly, and it failed when the line break style was removed. The final browser file was then run again against `7d50cdc` without the feature: `tdd/F-10-red-browser-final.txt` (6 of 6 failed). The server test files did not change after the first red run. The green output of the F-10 tests is `tdd/F-10-green.txt`.

Further temporary changes were each caught by the matching test: long words that do not wrap (TEST-190), no guard against a second post (TEST-188), focus not returned to the text area (TEST-189), a text area that cuts long text (TEST-188), a form shown to the administrator (TEST-187), ordering by id only (TEST-180), no role check (TEST-177) and no visibility rule (TEST-178). The source was restored after each run.

