# Sprint 3 TDD evidence

## F-17 Reports and export

TEST-331 to TEST-351 were written from the contract before the feature code, run without the feature (all failed), and then the feature was written.

In the first run with the feature, 15 of 16 server tests passed and TEST-351 got a 500. The cause was in the tests: TEST-345 used a spy on a Prisma model, and restoring that spy left the method undefined for the next test. A separate short probe confirmed this. TEST-345 now swaps the method and puts the original back itself, and it checks that reading works again afterwards. The five browser tests passed in their first run.

Breaking the code on purpose then showed that TEST-337 did not notice when the rule for repeated parameters was removed, because a repeated value was still refused as a wrong value. A case with a repeated parameter and other wrong values was added: only the repeated one may be reported. A literal byte order mark character that had been written into `reportCsv.ts` was also replaced by the visible escape `\uFEFF`.

Because server tests changed after the first red run, both red runs were repeated with the final test files in a separate worktree of `staging` (`ab1efd8`) with only those two files added: `tdd/F-17-red-server.txt` (16 of 16 failed) and `tdd/F-17-red-browser.txt` (5 of 5 failed). These files replace the earlier red output. F-17 has no migration, so the red run used the same local database.
