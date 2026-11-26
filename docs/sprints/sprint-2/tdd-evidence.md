# Sprint 2 TDD evidence

F-06 tests were run against the merged contract baseline before the cancellation route existed, then run again after implementation. The red run used a temporary worktree at staging commit `5756480`; its output is `tdd/F-06-red.txt`. The green run used implementation commit `8d46bad`; its output is `tdd/F-06-green.txt`.

| Feature | Red baseline and result | Green implementation and result |
|---|---|---|
| F-06 | `5756480` (staging): 10 failed, 1 passed because the cancel route was absent | `8d46bad`: 11 passed |

The red failures were the expected missing-route failures for cancellation behavior. TEST-102 already passed because the existing same-origin middleware correctly rejected the foreign Origin before the missing route was reached.

F-07 tests were first run in the clean staging worktree at commit `f30ae04`; the red output is `tdd/F-07-red-run.txt`. Nine of the 18 server tests failed because the search and validation behavior was not present. After implementation and the coverage fixes, commit `fc0189f` passed all 18 server tests and all 8 browser tests. The green server output, including the performance timings, is `test-output/server-f07-vitest.txt`.
