# BuyFlow Test Strategy (Sprint 1)

The ten kinds of testing that are usually listed for a web product, and what this project does with each one. "Automated" means a test that runs by command and is in the results table. Nothing here is marked done unless a test or document exists for it.

| # | Kind | What it checks | In Sprint 1 | Where |
|---|---|---|---|---|
| 1 | Unit test | One piece of logic alone, for example the total calculation | Automated | TEST-08, 14, 24, 34, 62, 63 |
| 2 | Integration test | Several parts together: API, rules and the real PostgreSQL database | Automated | TEST-01 to 07, 09 to 13, 15 to 33, 35 to 42, 50 to 55, 60, 61 |
| 3 | End-to-end test | A person's journey in a real browser against the real API and database | Automated | TEST-45 to 49, 56 to 58 |
| 4 | QA | Overall quality: the Definition of Done is checked against evidence and defects are logged | Document and process | `definition-of-done.md`, `results.md`, `qa-defect-log.md` |
| 5 | UAT | Real users try the system against their goals | Prepared, not executed | `docs/uat/uat-cases.md`. Executed in Lab 6 by another team, so no result is claimed now |
| 6 | UI/UX test | Readable, usable, accessible screens | Partly automated | Accessibility rules and keyboard and narrow-screen checks (TEST-57, 58). "Looks good" is a human judgement and is not automated |
| 7 | Performance test | Speed of one user's requests | Automated smoke check | TEST-59 (list of 200 requests, median under 500 ms) |
| 8 | Load test | Many users at once, for example 500 | Not done. A small concurrency smoke test exists (TEST-60). A real load test needs a load tool and a deployed system, and the course lists it as out of scope for Lab 5 | `qa-defect-log.md` known limitations |
| 9 | Penetration test | An attack from outside to find security holes | Automated security checks only. This is not a professional penetration test | TEST-50 to 55, 56 |
| 10 | Regression test | New work did not break old behavior | Automated | Whole suites run on every release (`npm run test:all`) and one end-to-end journey across all four features (TEST-61) |

## How regression is run

`npm run test:all` in the repository root runs the server, client and browser suites in one go. A Sprint 1 change is accepted only when all three pass. The results script (`node scripts/run-sprint1-results.mjs`) records the counts and the commit.

## What is deliberately not claimed

- No real load test with hundreds of users, and no throughput numbers.
- No professional penetration test. Rate limiting of login attempts and a full set of security headers are not part of Sprint 1 and are listed as known limitations.
- No UAT results. UAT needs people who did not build the system.
- No test of "does it look nice". Only objective checks (automated accessibility rules, narrow screen, keyboard) are automated.
