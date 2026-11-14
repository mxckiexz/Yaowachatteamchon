# BuyFlow Feature Inventory

Version 1.0. Every baseline FR, BR and NFR is covered by a feature (F-xx) or a system responsibility (R-xx).

## 1. Features

| ID | Feature | Description | Requirements | Depends on | Sprint |
|---|---|---|---|---|---|
| F-01 | Authentication and session | Seeded accounts log in and out, current user is retrievable, sessions expire, protected routes reject anonymous callers. | FR-01, NFR-01, NFR-02, NFR-03 | R-01 | 1 |
| F-02 | Create and submit a purchase request | Create a DRAFT with items and a server-calculated total; submit it to a chosen approver. | FR-02, FR-03, BR-01, BR-02, BR-04, BR-05, BR-09 | F-01 | 1 |
| F-03 | Approver decision | The assigned approver approves or rejects a PENDING request; decisions are final and recorded. | FR-06, BR-01, BR-04, BR-05, BR-06, BR-07, BR-08 | F-02 | 1 |
| F-04 | Request lists, detail and history | Requester list and detail, approver queue and detail, history timeline, ownership isolation. | FR-04, FR-05, FR-07, BR-03, BR-08 | F-02 | 1 |
| F-05 | Return for revision and resubmit | Approver returns a request with a reason; requester edits and resubmits. | FR-08, BR-10 | F-03 | 2 |
| F-06 | Withdraw a request | Owner withdraws a PENDING request before a decision. | FR-09, BR-01 | F-02 | 2 |
| F-07 | Edit or delete a draft | Owner edits or deletes a DRAFT. | FR-10, BR-09 | F-02 | 2 |
| F-08 | Filter and search | Filter lists by status and by title text. | FR-11, NFR-07 | F-04 | 2 |
| F-09 | Two-level approval for high-value requests | Total above 50,000 baht needs a second approver. | FR-12, BR-11 | F-03 | 3 |
| F-10 | Decision summary report | Counts by outcome, approved amount, average decision time per date range. | FR-13 | F-03 | 3 |
| F-11 | In-app notifications | Notify on assignment, decision and return. | FR-14 | F-03, F-05 | 3 |

## 2. System responsibilities

| ID | Responsibility | Description | Requirements | Sprint |
|---|---|---|---|---|
| R-01 | Platform foundation | Database schema, migrations, reproducible seed, environment configuration, health route. | NFR-05, NFR-06 | 1 |
| R-02 | Safe error handling | JSON errors without stack traces or database details, request origin check. | NFR-04 | 1 |
| R-03 | Performance check | Script that measures list response time with 200 requests. | NFR-07 | 2 |
| R-04 | Deployment readiness | Dockerfile, CI and cloud deployment (Lab 5). The design in Sprint 1 only keeps configuration in environment variables. | NFR-06 | Lab 5 |

## 3. Coverage gaps and approved changes

No baseline requirement is without a feature or responsibility.

| Item | Status |
|---|---|
| Sprint 2 and Sprint 3 features | Planned. Contracts are written before each sprint, not now. |
| R-04 | Verified in Lab 5, not in Deliverable 1. |
| Approved changes | None yet. |
