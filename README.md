# BuyFlow

Purchase request and approval system for a small company. CPE 334 group project, theme 5: Workflow and Approval System.

An employee records a purchase request with items, sends it to one approver, and the approver approves or rejects it with a recorded reason. Every request keeps a history. All data is synthetic.

Status: Sprint 1 (Deliverable 1). Documents are in `docs/`: `srs.md`, `features.md`, `traceability.md`, `system-sds.md`, `sprints/plan.md`, `sprints/sprint-1/` (feature contracts F-01 to F-04, definition of done, TDD evidence, results).

## Stack

Node.js 24, Express, Prisma, PostgreSQL, React 18, Vite, TypeScript, Bootstrap, Vitest, Supertest, Playwright.

## Setup (a fresh clone, 8 commands)

Requirements: Node.js 24, a running PostgreSQL, and an empty database.

```bash
createdb buyflow
cp server/.env.example server/.env        # then edit DATABASE_URL (and keep the demo password or change it)
cd server && npm install && npx prisma migrate deploy && npm run prisma:seed
cd ../client && npm install
cd .. && npm install                       # Playwright for the end-to-end tests
```

Run the API and the client in two terminals:

```bash
cd server && npm run dev      # http://localhost:3000
cd client && npm run dev      # http://localhost:5173
```

## Demo accounts (synthetic, created by the seed)

| E-mail | Role |
|---|---|
| somchai@buyflow.test | Approver |
| malee@buyflow.test | Approver |
| ploy@buyflow.test | Employee |
| nattapong@buyflow.test | Employee |

All four share the local demo password from `SEED_DEFAULT_PASSWORD` in `server/.env` (default in `.env.example`: `ChangeMe123!`). It is not a real secret. Change it for any shared environment.

## Demo sequence (about 3 minutes)

1. Log in as `ploy@buyflow.test`. Press New request, add two items, watch the estimate, press Save draft.
2. On the detail page choose Somchai as approver and press Submit. Status becomes Pending approval.
3. Log out. Log in as `somchai@buyflow.test`, open Review queue, open the request.
4. Press Reject, confirm without a reason (refused), write a reason, confirm. Status becomes Rejected.
5. Log in again as Ploy: the request shows Rejected, the comment and the history.
6. Try `/reviews` as Ploy: you are sent back to My requests, and the API answers 403.

## Tests

```bash
cd server && npm test          # API and unit tests (needs the database)
cd client && npm test          # component tests
npx playwright test            # end-to-end tests (starts the API and client, seeds demo accounts)
```

Environment variables are listed in `server/.env.example` and described in `docs/system-sds.md` section 7.

## Branches and workflow

`main` holds accepted releases. `sprint-1/staging` is the Sprint 1 integration branch. Each feature is built on a `feature/...` branch from staging, reviewed by the other student in a pull request, integrated in staging and then released to `main`.
