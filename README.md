# PurchaseFlow

Equipment purchase approval system (CPE 334 group project, theme 5: Workflow and Approval System).

A requester creates a purchase request for an item, edits it while it is a draft, and submits it. An approver approves it, or rejects it with a recorded reason. Every status change is kept in a history. An administrator manages the user accounts. All data is synthetic.

Status: Lab 5 deployment readiness is in progress (Docker, CI and deploy scripts are written and tested locally; nothing is deployed to GCP yet, see `docs/labs/lab-05/deployment.md`). Sprint 1 (Deliverable 1) remains the application baseline. Documents are in `docs/`: `srs.md`, `features.md`, `traceability.md`, `system-sds.md`, `sprints/plan.md`, `sprints/sprint-1/` (feature contracts F-01 to F-05 and Q-01, test strategy, definition of done, TDD evidence, results), `qa-defect-log.md`, `uat/uat-cases.md`.

## Stack

Node.js 24, Express, Prisma, PostgreSQL, React 18, Vite, TypeScript, Bootstrap, Vitest, Supertest, Playwright with axe-core.

## Setup (a fresh clone, 7 commands)

Requirements: Node.js 24, a running PostgreSQL, and an empty database.

```bash
createdb purchaseflow
cp server/.env.example server/.env        # then edit DATABASE_URL (and keep the demo password or change it)
npm --prefix server install
npm --prefix server run prisma:deploy
npm --prefix server run prisma:seed
npm --prefix client install
npm install                                # Playwright for the end-to-end tests
```

Run the API and the client in two terminals:

```bash
cd server && npm run dev      # http://localhost:3000
cd client && npm run dev      # http://localhost:5173
```

## Demo accounts (synthetic, created by the seed)

| E-mail | Role |
|---|---|
| ploy@purchaseflow.test | Requester |
| nattapong@purchaseflow.test | Requester |
| somchai@purchaseflow.test | Approver |
| malee@purchaseflow.test | Approver |
| admin@purchaseflow.test | Administrator |

All five share the local demo password from `SEED_DEFAULT_PASSWORD` in `server/.env` (default in `.env.example`: `ChangeMe123!`). It is not a real secret. Change it for any shared environment.

## Demo sequence (about 4 minutes)

1. Log in as `ploy@purchaseflow.test`. Press New request, fill the item, quantity and price, leave the reason empty, press Save draft.
2. Press Submit request: it is refused and names the missing reason and category. Fill them in the Edit draft form, save, and submit. The status becomes Submitted.
3. Log out. Log in as `somchai@purchaseflow.test`, open Review queue, open the request.
4. Press Reject, confirm without a reason (refused), write a reason, confirm. The status becomes Rejected.
5. Log in again as Ploy: the request shows Rejected, the reason and the history.
6. Try `/reviews` as Ploy: you are sent back to My requests, and the API answers 403.
7. Log in as `admin@purchaseflow.test`: see Users, deactivate a user, and see All requests (read only).

## Tests

```bash
npm --prefix server test       # API, security and unit tests (needs the database)
npm --prefix client test       # component and unit tests
npx playwright test            # browser tests: journeys, XSS, accessibility, three widths (starts the API and client, seeds demo accounts)
npm run test:all               # all three, one after another (the regression run)
```

If something already listens on port 3000 or 5173, stop it first: Playwright reuses a running server, which may be an old one.

`docs/sprints/sprint-1/test-strategy.md` explains which kinds of testing are covered (unit, integration, end to end, QA, UAT, UI and UX, performance, load, penetration, regression) and which are not claimed. Defects found and known limitations are in `docs/qa-defect-log.md`; UAT cases for Lab 6 are in `docs/uat/uat-cases.md`.

Environment variables are listed in `server/.env.example` and described in `docs/system-sds.md` section 7.

## Branches and workflow

`main` holds accepted releases and is the only branch that deploys. `staging` is the integration branch from Lab 5 onward: every pull request into `staging` and `main` must pass the `test-and-docker` check. `sprint-1/staging` was the Sprint 1 integration branch; it is kept unchanged as history and no new work goes into it. Each feature is built on a `feature/...`, `fix/...` or `chore/...` branch cut from `staging`, reviewed by the other student in a pull request, integrated in `staging` and then released to `main` by a release pull request. The earlier design (BuyFlow) is kept under the tag `archive/buyflow-v1`.
