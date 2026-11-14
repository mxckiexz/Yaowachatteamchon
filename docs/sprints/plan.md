# BuyFlow Three-Sprint Plan

Version 1.0.

| Sprint | Goal | Features | Depends on | Completion outcome | Checkpoint |
|---|---|---|---|---|---|
| 1 | Small working slice: login, roles, create and submit a purchase request, approve or reject with a recorded reason, full history, ownership isolation. | F-01, F-02, F-03, F-04, R-01, R-02 | none | A user can log in as an employee, create and submit a request, then log in as the approver and decide it. The result is persisted and visible to both. Rules BR-01 to BR-09 and NFR-01 to NFR-06 are verified by automated tests. | Deliverable 1, 8 Nov |
| 2 | Core expansion: the request can be returned, withdrawn, edited, deleted and found. | F-05, F-06, F-07, F-08, R-03 | Sprint 1 | All Sprint 2 features complete under written contracts; list performance measured; deployed on GCP through the Lab 5 pipeline. | Deliverable 2, 29 Nov |
| 3 | Completion and hardening: high-value approval, summary report, notifications, regression and defect correction. | F-09, F-10, F-11 | Sprints 1 and 2 | All baseline requirements implemented and verified, UAT defects resolved, final release. | Progress at 29 Nov, complete by 13 Dec |

## Scope of Sprint 1

In: authentication and sessions; two roles; create a request with items; server-calculated total; submit to an approver; approver queue; approve or reject with reason; history; ownership and role checks on every protected route; seed data; README.

Out: return for revision, withdraw, edit, delete, filters (Sprint 2); second-level approval, summary, notifications (Sprint 3); Docker, CI, GCP (Lab 5).

## Why Sprint 1 is feasible

Two people, three weeks that include a midterm break. The slice has four features and one table-driven set of rules. The stack is already familiar from Labs 1 to 4.

## Dependencies between features

```
R-01 -> F-01 -> F-02 -> F-03 -> F-05, F-09, F-10, F-11
                 F-02 -> F-04 -> F-08
                 F-02 -> F-06, F-07
```

## Remaining work after Sprint 1

Sprint 2 and Sprint 3 features in the table above. Contracts for each are written before that sprint starts.
