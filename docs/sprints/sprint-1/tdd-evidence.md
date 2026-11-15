# Sprint 1 TDD Evidence (red then green)

For each feature the tests were committed first against stubs or missing routes and run to see them fail. The implementation came in the next commit and the same tests then passed. The raw runs are in `docs/sprints/sprint-1/tdd/`.

| Feature | Red commit (tests only) | Red run | Green commit (implementation) | Green run |
|---|---|---|---|---|
| F-01 | `f519953` | 14 failed (14): TEST-01 to 11, 13 to 15 | `4686d52` | 14 passed (14) |
| F-02 | `6442ac8` | 20 failed (20): TEST-16 to 34 | `d001caa` | 34 passed (34, whole server suite) |
| F-03 | `1e78fc3` | 10 failed of 11: TEST-36 to 45 | `488c16f` | 45 passed (45, whole server suite) |
| F-04 | `39ec261` | 8 failed (8): TEST-51 to 58 | `fcc3f36` | 53 passed (53, whole server suite) |
| F-05 | `fbb7501` | 8 failed (8): TEST-61 to 67 and TEST-12 | `7bbccde` | 61 passed (61, whole server suite) |

The contract and test design of all features (SRS 2.0, SDS, plan, contracts F-01 to F-05 and Q-01) were committed in `3830959`, before any test or implementation commit of version 2.0.

## Why the tests failed in the red runs

The failure was the missing behavior, not a typing error: a missing route answered 404 where the test expected 201, 403, 409 or 422, and the stubs returned wrong values. Examples:

```
× F-02 create > TEST-16 / AC-13: creates a DRAFT with a request number; the server calculates the total ...
× F-03 approve and reject > TEST-40 / AC-27: an approver cannot approve or reject their own request
× F-05 administrator, user management > TEST-66 / AC-42: the administrator cannot change their own account
```

## Two things that were corrected on the way

1. **A defect found by a test in the red phase.** TEST-20 was extended in `6442ac8` to create a request with both maxima together (1000 items at 1,000,000 baht, 100,000,000,000 satang). The first schema stored the total in a 32-bit integer, which cannot hold that value. The migration `total_bigint` (in `d001caa`) fixed it. The earlier design (kept in `archive/buyflow-v1`) had the same latent defect and never tested the maxima together.
2. **A test that passed for the wrong reason.** In the first F-03 red run TEST-43 (an approver cannot see another user's draft) passed before the route existed, because a missing route also answers 404. A control was added (the approver can approve a submitted request) and the red run was repeated (10 failed). TEST-46, the unit test of the transition rule, passed in the red run because the rule was already written for F-02's submit; it is a characterization test, not red-green evidence.

## Quality checks (Q-01)

The security, accessibility, layout, speed and regression checks were written after the five features, from the contract `Q-quality-checks.md` (committed first in `3830959`). All of them passed on the first run (`e9ddb88`, `1900d6b`), because the earlier design had already produced and fixed the same findings (forged cookie value, technology header, tables wider than a phone screen) and these rules were built in. They are checks that the behavior is right, not red-green evidence.

## Not covered by red-green

The React screens, the component tests (CT-01 to CT-12) and the browser tests were written together with the UI, not before it. Their evidence is the passing run in `results.md`.
