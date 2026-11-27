# PurchaseFlow Feature Inventory

Version 2.0. Every baseline FR, BR and NFR is covered by a feature (F-xx) or a system responsibility (R-xx).

## 1. Features

| ID | Feature | Description | Requirements | Depends on | Sprint |
|---|---|---|---|---|---|
| F-01 | Authentication and session | Seeded accounts log in and out, current user, sessions expire, deactivated users are refused, protected routes reject anonymous callers. | FR-16, BR-13, NFR-01, NFR-03, NFR-13 | R-01 | 1 |
| F-02 | Create, edit and submit a purchase request | Create a DRAFT with a request number and a server-calculated total, edit it while it is a draft, submit it when the data is complete. | FR-01, FR-02, FR-03, FR-14, BR-01 to BR-06, BR-10, BR-14, BR-15, BR-18, NFR-08 | F-01 | 1 |
| F-03 | Approve or reject | An approver approves or rejects a SUBMITTED request; a rejection needs a reason; decisions are final, recorded, and never on one's own request. | FR-07, FR-08, FR-09, FR-11, FR-13, BR-07, BR-08, BR-09, BR-11, BR-17, NFR-06 | F-02 | 1 |
| F-04 | Lists, detail and history | My requests, the review queue, request detail with ordered history, visibility rules for each role. | FR-04, FR-06, FR-10, FR-11, FR-12, BR-12, NFR-02, NFR-07 | F-02 | 1 |
| F-05 | Administrator: user management | List users, activate or deactivate, set the role, read all requests; an administrator cannot change their own account. | FR-15, BR-13, BR-16 | F-01 | 1 |
| F-06 | Cancel a request | The owner cancels a DRAFT or SUBMITTED request before it is approved; the request and history remain readable after cancellation. | FR-05, BR-21, BR-11, BR-12, BR-17, NFR-01, NFR-02, NFR-06, NFR-07, NFR-10 | F-02, F-03 | 2 |
| F-07 | Search and filter | Filter lists by status, text and category while preserving each role's visibility scope. | FR-17, BR-12, NFR-01, NFR-02, NFR-04, NFR-05, NFR-07, NFR-09, NFR-10, NFR-12 | F-04 (soft dependency F-06 for CANCELLED test data) | 2 |
| F-08 | Dashboard | Counts of requests by status for the user's role, with an approver's own-request and waiting-for-review groups. | FR-18, BR-12, NFR-01, NFR-02, NFR-05, NFR-07, NFR-10 | F-04, F-07 | 2 |
| F-09 | Attachments | The owner adds and removes PDF, PNG or JPEG files on a draft; everyone who may see the request can list and download them. | FR-19, BR-12, BR-22, BR-23, NFR-01, NFR-02, NFR-04, NFR-05, NFR-07, NFR-09, NFR-10 | F-02, F-04 | 2 |
| F-10 | Comments | Requesters and approvers who may see a request write comments on it; comments cannot be changed; the administrator reads them. | FR-20, BR-12, BR-24, BR-25, NFR-01, NFR-02, NFR-04, NFR-05, NFR-07, NFR-09, NFR-10 | F-04 | 2 |
| F-11 | Return for editing | The approver sends a request back to the requester, who edits and resubmits. | FR-21 | F-03 | 2 |
| F-12 | In-app notifications | Notify on submission, decision and return. | FR-22 | F-03, F-11 | 2 |
| F-13 | Multi-step approval | A request can need several approval steps. | FR-23, BR-19 | F-03 | 3 |
| F-14 | Approval by amount | The approval route depends on the total. | FR-24, BR-20 | F-13 | 3 |
| F-15 | Departments | Users belong to departments. | FR-25 | F-05 | 3 |
| F-16 | Delegation | An approver delegates approval. | FR-26 | F-13 | 3 |
| F-17 | Reports and export | Reports and export of requests. | FR-27 | F-04 | 3 |
| F-18 | Audit log | An audit log of important actions. | FR-28 | F-05 | 3 |
| F-19 | Accessibility and responsive hardening | Fix remaining accessibility and layout problems found by tests and UAT. | NFR-05, NFR-10 | all UI | 3 |
| F-20 | Deployment preparation | Dockerfile, pipeline and cloud configuration (Lab 5). | NFR-11 | all | Lab 5 and 3 |

## 2. System responsibilities

| ID | Responsibility | Description | Requirements | Sprint |
|---|---|---|---|---|
| R-01 | Platform foundation | Database schema and migrations, reproducible seed, environment configuration, health route, README. | NFR-11 | 1 |
| R-02 | Safe handling | JSON errors without stack traces or database details, request origin check, no technology header, protective headers. | NFR-04, NFR-09 | 1 |
| R-03 | Performance measurement | A script that measures list response time with 200 requests. | NFR-12 | 2 |
| R-04 | Deployment readiness | The design keeps configuration in environment variables and data in the database; Docker, CI and cloud come in Lab 5. | NFR-11 | Lab 5 |
| R-05 | Quality checks | Security, performance smoke, concurrency smoke and regression checks. | NFR-09, NFR-12 (early), NFR-13 | 1 |
| R-06 | Accessible UI conventions | Labels, contrast, keyboard use and layout at 1280, 768 and 375 pixels. | NFR-05, NFR-10 | 1 |

## 3. Coverage gaps and approved changes

No baseline requirement is without a feature or responsibility.

| Item | Status |
|---|---|
| Sprint 2 and Sprint 3 features | Planned. Contracts are written before each sprint, not now. |
| R-04 and F-20 | Verified in Lab 5, not in Deliverable 1. |
| Approved changes | SRS 2.0 replaced the earlier BuyFlow design with the team's PurchaseFlow proposal (see the SRS change log). |
