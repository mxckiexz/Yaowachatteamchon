# BuyFlow System-Level Software Design Specification

Version 1.0.

## 1. Architecture and stack

BuyFlow is a modular monolith with three logical layers. They run as two processes and one database.

| Layer | Technology | Responsibility |
|---|---|---|
| UI | React 18, Vite, TypeScript, Bootstrap 5 | Screens, forms, client-side hints. The UI never decides permissions. |
| API and application layer | Node.js 24, Express 4, TypeScript | Authentication, role and ownership checks, validation, business rules, status transitions. All business rules are enforced here. |
| Database | PostgreSQL, accessed through Prisma 5 | Durable data, constraints, migrations. |
| Tests | Vitest and Supertest (server), Vitest and Testing Library (client), Playwright (end to end) | Automated verification. |

Why this stack: it is the stack used in Labs 1 to 4, which the group specification recommends. The team already knows it, and the Lab 5 starter kit targets Node.js, PostgreSQL and Prisma.

Communication: the browser calls the API with `fetch` over JSON on `/api/*`. Requests carry an HttpOnly session cookie. The API calls the database through Prisma. In development Vite runs on port 5173 and the API on port 3000; the API allows only the configured client origin.

Where rules are enforced: in the API only. The database adds a second safety net with constraints (unique e-mail, foreign keys, check on positive quantity and price).

## 2. Data model

```
User 1 ---- * Session
User 1 ---- * PurchaseRequest (as requester)
User 1 ---- * PurchaseRequest (as approver, optional until submitted)
PurchaseRequest 1 ---- * RequestItem
PurchaseRequest 1 ---- * RequestHistory
User 1 ---- * RequestHistory (actor)
```

| Entity | Fields | Constraints and ownership |
|---|---|---|
| User | id, name, email, passwordHash, role (EMPLOYEE or APPROVER), isActive, createdAt | email unique and stored lower case; passwordHash is a bcrypt hash |
| Session | id (random UUID), userId, expiresAt, createdAt | deleted on logout; invalid after expiresAt |
| PurchaseRequest | id, requesterId, approverId (nullable), title, justification, status (DRAFT, PENDING, APPROVED, REJECTED), totalSatang, createdAt, submittedAt, decidedAt, decisionComment | requesterId is the owner; approverId must reference an active APPROVER different from requesterId (checked by the API); totalSatang is calculated by the server |
| RequestItem | id, requestId, name, quantity, unitPriceSatang | quantity between 1 and 1000; unitPriceSatang greater than 0; deleted with the request |
| RequestHistory | id, requestId, actorId, action (CREATED, SUBMITTED, APPROVED, REJECTED), fromStatus (nullable), toStatus, comment (nullable), createdAt | append only; the API has no update or delete for it |

Money is stored as integer satang (1 baht = 100 satang). The API sends and receives baht as decimal numbers and converts at the boundary.

Database setup: `npx prisma migrate deploy` applies the migration under `server/prisma/migrations`. `npm run prisma:seed` creates the demo accounts and sample requests. Seed is idempotent (running it twice gives the same data).

Seed accounts (synthetic): `somchai@buyflow.test` (APPROVER), `malee@buyflow.test` (APPROVER), `ploy@buyflow.test` (EMPLOYEE), `nattapong@buyflow.test` (EMPLOYEE). The shared demo password comes from the environment variable `SEED_DEFAULT_PASSWORD`; it is a local development value and not a real secret.

## 3. UI structure and conventions

| Screen | Route | Who |
|---|---|---|
| Login | `/login` | anyone |
| My requests | `/requests` | any logged-in user |
| New request | `/requests/new` | any logged-in user |
| Request detail | `/requests/:id` | owner, or assigned approver |
| Review queue | `/reviews` | role APPROVER |

Shared behavior:

- Navigation bar shows the user name, role and a Logout button. The Review link appears only for approvers. This is a convenience; the API enforces the same rule.
- Every list and detail has a loading state, an empty state and an error state.
- Forms show a message next to each invalid field. Server validation errors are shown in the same place.
- Status is shown as a labelled badge (text and colour, never colour alone).
- Destructive or final actions (approve, reject) show the request title and total before they are sent.

## 4. API approach

- JSON over HTTP under `/api`. Plural nouns. Status codes: 200, 201, 204, 400 (bad JSON), 401, 403, 404, 409 (state conflict), 422 (validation or rule).
- Success bodies return the resource. Error bodies have the shape `{ "error": "message", "code": "CODE", "fields": { "field": "message" } }`; `code` and `fields` are optional.
- Money fields are baht numbers (`unitPrice`, `total`).
- Validation happens on the server for every write. The client's checks are hints.
- Errors never include stack traces, SQL or file paths. Unexpected errors return 500 with a generic message.
- A state-changing request (POST, PATCH, PUT, DELETE) must carry an `Origin` header equal to the configured client origin; otherwise 403.

Endpoint list (details are in the feature contracts):

| Method and path | Feature |
|---|---|
| `GET /api/health` | R-01 |
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | F-01 |
| `GET /api/approvers` | F-02 |
| `POST /api/requests`, `POST /api/requests/:id/submit` | F-02 |
| `POST /api/requests/:id/decision` | F-03 |
| `GET /api/requests`, `GET /api/requests/:id`, `GET /api/reviews` | F-04 |

## 5. Roles and permissions

| Operation | Anonymous | EMPLOYEE | APPROVER |
|---|---|---|---|
| Log in | yes | yes | yes |
| Read current user, log out | no (401) | yes | yes |
| Create a request | no (401) | yes | yes |
| Submit own DRAFT | no (401) | yes | yes |
| List own requests | no (401) | own only | own only |
| Read a request | no (401) | own only (other: 404) | own, or assigned to them (other: 404) |
| List approvers | no (401) | yes | yes |
| Review queue | no (401) | no (403) | yes, assigned to them only |
| Approve or reject | no (401) | no (403) | only if assigned to them (otherwise 403) and not the requester (403) |

Ownership links: PurchaseRequest.requesterId is the owner; PurchaseRequest.approverId is the assigned approver. A hidden button in the UI is not authorization. Every protected route checks session, role and ownership on the server.

## 6. Authentication and session

- Passwords are hashed with bcrypt, cost 12. Plaintext passwords are never stored, logged or returned.
- Login checks e-mail (case-insensitive) and password. A wrong password and an unknown e-mail give the same 401 message and run one bcrypt comparison each, so timing does not reveal which e-mails exist.
- On success the server creates a Session row (random UUID, expires in 8 hours) and sets a cookie that is HttpOnly and SameSite=Lax, and Secure in production.
- Every protected route looks the session up in the database. A missing, unknown, expired session, or an inactive user, gives 401.
- `GET /api/auth/me` returns the current user. Logout deletes the Session row and clears the cookie. Logout is idempotent.

## 7. Configuration and secrets

Environment variables (see `server/.env.example`):

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/buyflow` |
| `PORT` | API port | `3000` |
| `CLIENT_ORIGIN` | Allowed browser origin | `http://localhost:5173` |
| `SEED_DEFAULT_PASSWORD` | Demo password for seeded accounts (local only) | `ChangeMe123!` |
| `NODE_ENV` | `production` turns on Secure cookies | `development` |

Real secrets are never committed. `.env` is ignored by Git; `.env.example` holds placeholders only. The client holds no secrets.

## 8. Planned deployment (Lab 5)

| Component | Plan |
|---|---|
| Container | One Dockerfile builds the client, then runs the API which serves the built client, listening on `PORT`. |
| Database | Managed PostgreSQL (Cloud SQL). Data survives restarts and redeployments because no state is kept in the container. |
| Configuration | Environment variables and Secret Manager. |
| Image registry | Artifact Registry. |
| Runtime | Cloud Run. |
| Pipeline | GitHub Actions: build and test on pull requests; deploy from `main` by image digest with a smoke test. |

Design for this in Sprint 1: port from `PORT`, health route, configuration from environment, sessions in the database, no local file storage.
