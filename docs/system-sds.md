# PurchaseFlow System-Level Software Design Specification

Version 2.4. Version 2.1 (27 November 2026) changes the planned attachment storage to PostgreSQL and adds the F-09 endpoints. Version 2.2 (27 November 2026) adds the planned Comment entity, endpoints and permissions of F-10. Version 2.3 (27 November 2026) records the implemented F-08 dashboard endpoint and screen. Version 2.4 (27 November 2026) records F-09 as implemented.

## 1. Architecture and stack

PurchaseFlow is a modular monolith with three logical layers, run as two processes and one database.

| Layer | Technology | Responsibility |
|---|---|---|
| UI | React 18, Vite, TypeScript, Bootstrap 5 | Screens, forms, client-side hints. The UI never decides permissions. |
| API and application layer | Node.js 24, Express 4, TypeScript | Authentication, role and ownership checks, validation, business rules, status transitions. All business rules are enforced here. |
| Database | PostgreSQL, accessed through Prisma 5 | Durable data, constraints, migrations, a sequence for request numbers. |
| Tests | Vitest and Supertest (server), Vitest and Testing Library (client), Playwright with axe-core (end to end) | Automated verification. |

Why this stack: it is the stack of Labs 1 to 4, which the group specification recommends, and it matches the team's proposal. The Lab 5 starter kit targets Node.js, PostgreSQL and Prisma.

Communication: the browser calls the API with `fetch` over JSON on `/api/*`, carrying an HttpOnly session cookie. The API calls the database through Prisma. In development Vite runs on port 5173 and forwards `/api` to the API on port 3000; the API accepts state-changing requests only from the configured client origin.

Where rules are enforced: in the API only. The database adds a second safety net: unique e-mail and request number, foreign keys, and checks on quantity and price.

## 2. Data model

```
User 1 ---- * Session
User 1 ---- * PurchaseRequest   (as requester)
PurchaseRequest 1 ---- * RequestHistory
User 1 ---- * RequestHistory    (as actor)
Attachment (Sprint 2): PurchaseRequest 1 ---- * Attachment, User 1 ---- * Attachment (uploader)
Comment (Sprint 2): PurchaseRequest 1 ---- * Comment, User 1 ---- * Comment (author)
```

| Entity | Fields | Constraints and ownership |
|---|---|---|
| User | id, name, email, passwordHash, role (REQUESTER, APPROVER, ADMIN), isActive, createdAt | email unique and stored in lower case; passwordHash is a bcrypt hash |
| Session | id (random UUID), userId, expiresAt, createdAt | deleted at logout; invalid after expiresAt; invalid when the user is inactive |
| PurchaseRequest | id, requestNumber, requesterId, itemName, description, quantity, unitPriceSatang, totalSatang, reason, category (nullable), status (DRAFT, SUBMITTED, APPROVED, REJECTED, CANCELLED), rejectionReason (nullable), createdAt, updatedAt, submittedAt, decidedAt | requestNumber unique (format `PR-YYYY-NNNN` from the database sequence `request_number_seq`); requesterId is the owner; totalSatang is calculated by the server; quantity between 1 and 1000 and unitPriceSatang above 0 are CHECK constraints |
| RequestHistory | id, requestId, actorId, action (CREATED, SUBMITTED, APPROVED, REJECTED, CANCELLED), fromStatus (nullable), toStatus, comment (nullable), createdAt | append only; the API has no update or delete for it; F-06 adds the CANCELLED transition |
| Attachment (Sprint 2) | id, requestId, fileName, fileType, sizeBytes, content (bytes), uploadedById, createdAt | F-09; at most 5 per request, 1 to 5,242,880 bytes each (CHECK on sizeBytes); content is never selected by list or detail queries; only the owner of a DRAFT adds or removes |
| Comment (Sprint 2) | id, requestId, authorId, text, createdAt | planned in F-10; 1 to 1000 characters (CHECK); append only, the API has no update or delete |

Money is stored as integer satang (1 baht = 100 satang). The API sends and receives baht as decimal numbers and converts at the boundary.

Database setup: `npm --prefix server run prisma:deploy` applies the migrations under `server/prisma/migrations`. `npm --prefix server run prisma:seed` creates the demo accounts. The seed is idempotent.

Seed accounts (synthetic): `ploy@purchaseflow.test` and `nattapong@purchaseflow.test` (REQUESTER), `somchai@purchaseflow.test` and `malee@purchaseflow.test` (APPROVER), `admin@purchaseflow.test` (ADMIN). They share a local demo password from the environment variable `SEED_DEFAULT_PASSWORD`; it is a development value and not a real secret.

## 3. UI structure and conventions

| Screen | Route | Who |
|---|---|---|
| Login | `/login` | anyone |
| My requests | `/requests` | requester, approver |
| New request | `/requests/new` | requester, approver |
| Request detail (edit and submit for a draft, decision panel for an approver) | `/requests/:id` | owner, approvers (not drafts), administrator |
| Review queue | `/reviews` | approver |
| All requests (read only) | `/all-requests` | administrator |
| Users | `/admin/users` | administrator |

Shared behavior:

- The navigation bar shows the user name and role and a Logout button, and only the links the role may use. This is a convenience; the API enforces the same rules.
- Every list and detail has a loading state, an empty state and an error state.
- Forms show a message next to each invalid field. Server validation errors appear in the same place.
- Status is shown as a labelled badge (text and colour, never colour alone).
- Approve and reject show the request number, item and total before they are sent.
- Tables scroll inside their own box and the navigation bar wraps, so no page scrolls sideways at 375 pixels.

## 4. API approach

- JSON over HTTP under `/api`. Status codes: 200, 201, 204, 400 (bad JSON), 401, 403, 404, 409 (state conflict), 413 (body too large), 422 (validation or rule).
- Success bodies return the resource. Error bodies have the shape `{ "error": "message", "code": "CODE", "fields": { "field": "message" } }`; `code` and `fields` are optional.
- Money fields are baht numbers (`unitPrice`, `total`).
- Validation happens on the server for every write. The client's checks are hints.
- Errors never include stack traces, SQL or file paths. Unexpected errors return 500 with a generic message.
- A state-changing request (POST, PATCH, PUT, DELETE) must carry an `Origin` header equal to the configured client origin; otherwise 403.
- Responses carry `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy: no-referrer`, and never `X-Powered-By`.

Endpoint list (details are in the feature contracts):

| Method and path | Feature |
|---|---|
| `GET /api/health` | R-01 |
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | F-01 |
| `POST /api/requests`, `PATCH /api/requests/:id`, `POST /api/requests/:id/submit` | F-02 |
| `POST /api/requests/:id/approve`, `POST /api/requests/:id/reject` | F-03 |
| `GET /api/requests?scope=mine\|review\|all`, `GET /api/requests/:id`, `GET /api/requests/:id/history` | F-04 |
| `GET /api/dashboard`, `/dashboard` | F-08 (implemented) |
| `GET`, `POST /api/requests/:id/attachments`, `GET`, `DELETE /api/requests/:id/attachments/:attachmentId` | F-09 (implemented) |
| `GET`, `POST /api/requests/:id/comments` | F-10 (planned) |
| `GET /api/admin/users`, `PATCH /api/admin/users/:id` | F-05 |

## 5. Roles and permissions

| Operation | Anonymous | REQUESTER | APPROVER | ADMIN |
|---|---|---|---|---|
| Log in | yes | yes | yes | yes |
| Read current user, log out | 401 | yes | yes | yes |
| Create a request | 401 | yes | yes | 403 |
| Edit or submit a request | 401 | own draft only | own draft only | 404 |
| List own requests (`scope=mine`) | 401 | own | own | (none, no own requests) |
| Review queue (`scope=review`) | 401 | 403 | submitted requests of others | 403 |
| All requests (`scope=all`) | 401 | 403 | 403 | all, read only |
| Read a request and its history | 401 | own only (other: 404) | own, and every request that is not a draft (a draft of another: 404) | all |
| Approve or reject | 401 | 403 | submitted request of another user (own: 403) | 403 |
| List and download attachments (F-09) | 401 | own request (other: 404) | requests the approver may read (a draft of another: 404) | all |
| Add or delete an attachment (F-09) | 401 | own draft only (other: 404, not a draft: 409) | own draft only (other: 404, not a draft: 409) | 404 |
| Read comments (F-10, planned) | 401 | own request (other: 404) | requests the approver may read | all |
| Add a comment (F-10, planned) | 401 | own request (other: 404) | requests the approver may read (a draft of another: 404) | 403 |
| List users, change a user | 401 | 403 | 403 | yes, except one's own account (409) |

Ownership link: `PurchaseRequest.requesterId` is the owner. Owner-only operations treat everyone else as "not found". A hidden button in the UI is not authorization: every protected route checks session, role and ownership on the server.

## 6. Authentication and session

- Passwords are hashed with bcrypt, cost 12. Plaintext passwords are never stored, logged or returned.
- Login checks e-mail (case-insensitive) and password. A wrong password, an unknown e-mail and a deactivated user give the same 401 message and run one bcrypt comparison each, so timing does not reveal which e-mails exist.
- On success the server creates a Session row (random UUID, 8 hours) and sets a cookie that is HttpOnly and SameSite=Lax, and Secure in production.
- Every protected route accepts only a session id that is a UUID, looks it up in the database, and refuses an unknown or expired session or an inactive user with 401.
- `GET /api/auth/me` returns the current user. Logout deletes the Session row and clears the cookie. Logout is idempotent.

## 7. Configuration and secrets

Environment variables (see `server/.env.example`):

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/purchaseflow` |
| `PORT` | API port | `3000` |
| `CLIENT_ORIGIN` | Allowed browser origin | `http://localhost:5173` |
| `SEED_DEFAULT_PASSWORD` | Demo password for seeded accounts (local only) | `ChangeMe123!` |
| `NODE_ENV` | `production` turns on Secure cookies | `development` |

Real secrets are never committed. `.env` is ignored by Git; `.env.example` holds placeholders only. The client holds no secrets.

## 8. Planned deployment (Lab 5)

| Component | Plan |
|---|---|
| Container | One Dockerfile builds the client, then runs the API, which serves the built client and listens on `PORT`. |
| Database | Managed PostgreSQL (Cloud SQL). Data survives restarts and redeployments because no state is kept in the container. |
| Configuration | Environment variables and Secret Manager. |
| Image registry | Artifact Registry. |
| Runtime | Cloud Run. |
| Pipeline | GitHub Actions: build and test on pull requests; deploy from `main` by image digest with a smoke test. |

Design for this in Sprint 1: port from `PORT`, health route, configuration from environment, sessions in the database, no local file storage. For the same reason F-09 attachments are stored in PostgreSQL, not on disk; version 2.0 expected object storage, but the course environment has no storage bucket (F-09 contract, section 4).
