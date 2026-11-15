# PurchaseFlow Three-Sprint Plan

Version 2.0. Based on the sprint lists of the team's proposal; the choices where the proposal disagreed with itself are in the SRS (D-05).

| Sprint | Goal | Features | Depends on | Completion outcome | Checkpoint |
|---|---|---|---|---|---|
| 1 | A small working slice: login, three roles, create, edit and submit a purchase request, approve or reject with a recorded reason, history, visibility rules, minimal user administration. | F-01, F-02, F-03, F-04, F-05, R-01, R-02, R-05, R-06 | none | A requester creates, edits and submits a request; an approver decides it; the administrator manages users. Everything is stored in the database, visible after a reload, and protected by role and ownership checks on the server. Rules BR-01 to BR-18 and NFR-01 to NFR-11, NFR-13 are verified by automated tests. | Deliverable 1, 8 Nov |
| 2 | Core expansion: cancel, return for editing, search and filter, dashboard, attachments, comments, in-app notifications. | F-06 to F-12, R-03 | Sprint 1 | All Sprint 2 features complete under written contracts; list performance measured; deployed on GCP through the Lab 5 pipeline. | Deliverable 2, 29 Nov |
| 3 | Completion and hardening: multi-step approval, approval by amount, departments, delegation, reports and export, audit log, accessibility and responsive hardening, deployment preparation. | F-13 to F-20 | Sprints 1 and 2 | All baseline requirements implemented and verified, UAT defects resolved, final release. | Progress at 29 Nov, complete by 13 Dec |

## Scope of Sprint 1

In: authentication and sessions; roles REQUESTER, APPROVER, ADMIN; create, edit and submit a request with a request number and a server-calculated total; approve and reject with a reason; history; lists, queue and detail with visibility rules; user list, activation and role change; seed data; README.

Out: cancel, attachments, comments, search and filter, dashboard, notifications (Sprint 2); multi-step approval, amount routes, departments, delegation, reports, audit log (Sprint 3); Docker, CI and GCP (Lab 5).

## Why Sprint 1 is feasible

Two people, three weeks that include a midterm break. The slice has five small features and a table of rules. The stack is already familiar from Labs 1 to 4.

## Dependencies between features

```
R-01 -> F-01 -> F-02 -> F-03 -> F-06, F-11, F-13
                 F-02 -> F-04 -> F-07, F-08, F-10, F-17
                 F-02 -> F-09
        F-01 -> F-05 -> F-15, F-18
        F-03 -> F-11 -> F-12
        F-13 -> F-14, F-16
```

## Remaining work after Sprint 1

Sprint 2 and Sprint 3 features in the table above. Contracts for each are written before that sprint starts.
