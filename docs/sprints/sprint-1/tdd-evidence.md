# Sprint 1 TDD Evidence (red then green)

For each feature the tests were committed first against stubs or missing routes and run to see them fail. The implementation came in the next commit and the same tests then passed. The raw runs are in `docs/sprints/sprint-1/tdd/`.

| Feature | Red commit (tests only) | Red run | Green commit (implementation) | Green run |
|---|---|---|---|---|
| F-01 | `ce883e9` | 13 failed (13): TEST-01 to 10, 12, 41, 42 | `f84b260` | 13 passed (13) |
| F-02 | `debedb6` | 12 failed (12): TEST-13 to 24 | `8fcb847` | 25 passed (25, whole server suite) |
| F-03 | `f23dbc9` | 11 failed (11): TEST-25 to 34 and one extra | `da8b524` | 36 passed (36, whole server suite) |
| F-04 | `f40c501` | 7 failed (7): TEST-11, 35 to 40 | `90ed1be` | 43 passed (43, whole server suite) |

The contract and test design for all four features were committed in `f35b909`, before any test or implementation commit. Contract 1.1 of F-01 (TEST-12 uses logout) was a visible revision made in `ce883e9`, before the F-01 implementation.

## Why the tests failed in the red runs

The failure was the missing behavior, not a typing error: a missing route answered 404 where the test expected 201, 403, 409 or 422, and the stubs returned wrong values. Examples from the red runs:

```
× F-03 > TEST-30 / AC-23: a requester cannot decide their own request even with the APPROVER role
  → expected 404 to be 403
× F-03 > TEST-33 / AC-25: two simultaneous decisions produce exactly one decision
  → expected [ 404, 404 ] to deeply equal [ 200, 409 ]
× F-03 > TEST-34 / BR-01: only DRAFT to PENDING, PENDING to APPROVED and PENDING to REJECTED are allowed
  → expected [] to deeply equal [ 'DRAFT>PENDING', …(2) ]
```

After the implementation commit `da8b524` the same tests passed:

```
✓ F-03 approver decision > TEST-30 / AC-23 ...
✓ F-03 approver decision > TEST-33 / AC-25 ...
✓ F-03 status transitions (unit) > TEST-34 / BR-01 ...
Tests  36 passed (36)
```

## One test that had to be strengthened

In the first F-04 red run TEST-38 passed before any code existed, because a missing route also answers 404. A refusal test that passes for the wrong reason proves nothing, so the test was changed to first check that the owner can read the request (200) and only then that others get 404. The red run was repeated: 7 failed (7). This change is in commit `f40c501`.

## Not covered by red-green

The React screens and the component tests (CT-01 to CT-10) and the Playwright tests were written together with the UI, not before it. Their evidence is the passing run in `results.md`, not a red-green sequence.
