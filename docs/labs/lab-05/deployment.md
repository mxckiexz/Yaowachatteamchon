# Lab 5 deployment notes

Team Yaowachatteamchon, PurchaseFlow (equipment purchase approval). Version 0.1, draft written before the first cloud deployment.

Status: the Docker, compose, CI and deploy files are written and checked offline (deploy script tests, smoke test unit tests, local image build). Nothing is deployed yet. `deploy/deploy.sh` is now the portal's script (it gives the migration job its secrets and command), and the service, job and image names in `deploy/release.sh` and `.github/workflows/deploy.yml` hold the portal values for prefix `sad61263d`. **The GitHub pipeline still cannot deploy:** the first deployment has not been run by hand and the GitHub variables from the portal are not set (TO FILL; the portal links GitHub Actions only after its repository review of `main`). Every "not yet" row in section 7 stays until it has been run.

## 1. Stack and differences from the reference kit

| Item | Choice |
|---|---|
| Application | PurchaseFlow Sprint 1 release (`sprint-1-release`), then later sprints through the same pipeline |
| Runtime | Node.js 24, Express 4, TypeScript, Prisma 5, PostgreSQL 16, React 18 with Vite |
| Image | One image from the root `Dockerfile`. The API serves the built client on port 3000 |
| Cloud | Artifact Registry, Cloud Run (service and migration job), Cloud SQL for PostgreSQL, Secret Manager, GitHub Actions |
| Sign-in from GitHub | Workload Identity Federation, no JSON key |

Changes from the Lab 5 starter kit (written for TokTickIT):

| Change | Reason |
|---|---|
| Starter names renamed from `toktickit` to `purchaseflow`, then the pipeline files set to the portal values `sad61263d`; `deploy/deploy.sh` is the portal's script, and `deploy/teardown.sh` was removed | The course portal creates and names the resources, see sections 4 and 5 |
| The portal's two secrets are used, `sad61263d-admin-password` (administrator) and `sad61263d-demo-password` (requester and approver demo accounts), read as `ADMIN_PASSWORD` and `DEMO_USER_PASSWORD`; `SEED_DEFAULT_PASSWORD` is only our own name for local and own-project use | The course portal creates these secrets; the seed accepts either name and is create-only in production |
| `/api/ready` (503 when the database does not answer) and `/api/version` (running commit) added to the API | The smoke test and the guide use them. The app had neither |
| `server/src/staticSite.ts` serves the built client | One container, one port, no separate web server |
| The production seed only creates missing accounts | A later release must not undo a role change, a deactivation or a changed password. Local development still resets them |
| The seed refuses the example password and passwords under 12 characters in production | The example value is public |
| `deploy.sh` sets `CLIENT_ORIGIN` to the service URL after the first deploy | The API accepts state-changing requests only from `CLIENT_ORIGIN`. The URL is known only after the service exists |
| `npm run build` builds `src` only (`tsconfig.build.json`) | The old output went to `dist/src/index.js`, so `npm start` could not find `dist/index.js` |
| Smoke test keeps the session cookie | PurchaseFlow signs in with a cookie, the kit's app used a token |
| No `/api/categories` check | PurchaseFlow's categories are fixed in code. The smoke test checks that `/api/auth/me` answers 401 without a session |

## 2. Environment variables

No real value is in the repository. `server/.env.example` and `.env.example` hold placeholders.

| Variable | Purpose | Secret | Where the value comes from |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes | Local: `server/.env`. Cloud: Secret Manager `sad61263d-database-url`, created by the course portal |
| `PORT` | Port the API listens on | No | Cloud Run sets it. Default 3000 |
| `CLIENT_ORIGIN` | The one origin allowed to send POST, PATCH and DELETE | No | Local: `http://localhost:5173`. Cloud: the service URL, set by `deploy.sh` |
| `SEED_DEFAULT_PASSWORD` | Password of the five seeded demo accounts (our own name) | Yes | Local: any value in `server/.env`. Not used in the course environment, where the portal's `sad61263d-demo-password` and `sad61263d-admin-password` are used instead (see the two rows below) |
| `DEMO_USER_PASSWORD` | Password of the requester and approver demo accounts (the portal's name; used when `SEED_DEFAULT_PASSWORD` is not set) | Yes | Course environment: Secret Manager `sad61263d-demo-password` |
| `ADMIN_PASSWORD` | Password of the administrator account (the portal's name). With only this one set, only the administrator is seeded | Yes | Course environment: Secret Manager `sad61263d-admin-password` |
| `NODE_ENV` | `production` in the cloud and in compose: secure cookies, create-only seed | No | Dockerfile and `deploy.sh` |
| `APP_COMMIT` | Full commit SHA of the running image, shown by `/api/version` | No | Set by `release.sh` on every release and by `deploy.sh` on the first deploy |
| `STATIC_DIR` | Folder with the built client | No | Dockerfile (`/app/client/dist`). Unset locally |
| `TZ` | Time zone | No | `Asia/Bangkok`, set in the Dockerfile and `deploy.sh` |

Pipeline variables and secrets (GitHub environment `demo`): `GCP_PROJECT_ID`, `GCP_REGION`, `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`. Optional `SMOKE_EMAIL` (variable) with `SMOKE_PASSWORD` (secret) for the sign-in check; use a requester account, never the administrator.

## 3. Commands

Local, without Docker (needs PostgreSQL and `server/.env`):

| Task | Command |
|---|---|
| Install | `cd server && npm ci` and `cd client && npm ci` |
| Migrate | `cd server && npx prisma migrate deploy` |
| Seed | `cd server && npm run prisma:seed` |
| Run | `cd server && npm run dev` (port 3000) and `cd client && npm run dev` (port 5173) |
| Test | `cd server && npm test`, `cd client && npm test`, `npx playwright test` |
| Type check and build | `cd server && npm run typecheck && npm run build`, `cd client && npm run build` |

Local with Docker (builds the image Cloud Run runs):

```bash
cp .env.example .env        # then set SEED_DEFAULT_PASSWORD (12 or more characters, not the example)
docker compose up --build   # open http://localhost:3000
docker compose down -v      # stop and delete the local database
```

Deploy scripts, checked offline in CI:

```bash
bash deploy/tests/test_deploy_stub.sh
bash deploy/tests/test_release_stub.sh
python3 -m unittest discover -s deploy/tests -p 'test_smoke.py'
```

## 4. GCP resources

Course environment (created by the portal, not by this repository). Values copied from the portal's team resources tab on 2026-11-22; none of them is a secret:

| Item | Value |
|---|---|
| Project | `cpe-se-course-2026` |
| Team prefix | `sad61263d` (every resource name starts with it) |
| Region | `asia-southeast1` |
| Cloud Run service | `sad61263d`, URL `https://sad61263d-4d7hbszvwq-as.a.run.app` |
| Migration job | `sad61263d-migrate` |
| Cloud SQL instance, tier, database, user | `sad61263d-pg`, `db-f1-micro`, `sad61263d`, `sad61263d` (the user's password is not shown and not needed) |
| SQL connection name | `cpe-se-course-2026:asia-southeast1:sad61263d-pg` |
| Artifact Registry repository | `sad61263d`; image repository `asia-southeast1-docker.pkg.dev/cpe-se-course-2026/sad61263d/sad61263d` (a tag or digest is appended) |
| Runtime service account | `sad61263d-runner@cpe-se-course-2026.iam.gserviceaccount.com` |
| Deployer service account | `sad61263d-deployer@cpe-se-course-2026.iam.gserviceaccount.com`, not linked to GitHub Actions until the repository review |
| Secrets (names only) | `sad61263d-database-url` (DATABASE_URL), `sad61263d-admin-password` (ADMIN_PASSWORD), `sad61263d-demo-password` (DEMO_USER_PASSWORD). Which of them the portal already attached to the migration job is TO FILL (check with `gcloud run jobs describe`, which shows names and not values) |
| GitHub variables | TO FILL: `GCP_PROJECT_ID`, `GCP_REGION`, `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT` as the portal shows them after the repository review |

Cost: the credit is shared by all teams and the portal creates one small Cloud SQL instance per team. Do not create more. There is no teardown script in the repository (the portal says not to use the old one): ask a TA for pause or cleanup. Nobody clicks Upgrade or pays a prepayment.

## 5. First deployment (once, by hand, from Cloud Shell)

The course portal creates the resources for the team (prefix `sad61263d`). `deploy/deploy.sh` is the portal's own script for the team, adapted by us in four places only: the application name in the messages, the summary lines (our accounts instead of the kit's example administrator), a last step that sets `CLIENT_ORIGIN` and `APP_COMMIT`, and a warning with the fix command when Cloud Run's `status.url` differs from the portal URL (the service update above it uses `--set-env-vars`, which replaces every variable, and the API accepts POST, PATCH and DELETE only from `CLIENT_ORIGIN`). The script never creates Cloud SQL, secrets, service accounts, repositories or IAM bindings; the offline test `deploy/tests/test_deploy_stub.sh` asserts that.

What it does, in order: build the image for `linux/amd64`, push it tagged with the full commit SHA, set the migration job's image, secrets and command (`npx prisma migrate deploy && npm run prisma:seed`), run the job and stop if it fails, update the service, send traffic to it, then set `CLIENT_ORIGIN` and `APP_COMMIT`. It refuses any project other than `cpe-se-course-2026`, any branch other than `main`, and a tag that is not the commit at `HEAD`. `DRY_RUN=1` is the default.

```bash
git clone https://github.com/mxckiexz/Yaowachatteamchon.git && cd Yaowachatteamchon
DRY_RUN=1 bash deploy/deploy.sh --demo     # prints the commands, changes nothing
DRY_RUN=0 bash deploy/deploy.sh --demo     # the real first deployment
```

`--demo` gives the migration job the demo password secret, so the requester and approver accounts are created for UAT; without it only the administrator is seeded. The passwords stay in Secret Manager (`sad61263d-admin-password`, `sad61263d-demo-password`) and are shared privately, never in the repository or the PDF.

After this run, `.github/workflows/deploy.yml` and `deploy/release.sh` take over: they only update the image of the migration job and of the service. They rely on the job's secrets and command that this first run set.

Repository review by the portal: it expects `deploy/deploy.sh` to match the Starter Kit structure. The earlier version in this repository created the infrastructure itself and did not match, so the portal's script replaced it. `deploy/teardown.sh` was removed because the portal says not to use the old one.

## 6. Release procedure

Branches: `staging` is the integration branch from Lab 5 on (the name the Lab 5 handout and the CI trigger use). `sprint-1/staging` is the Sprint 1 integration branch; it stays as history (R-10, nothing is deleted or rewritten) and receives no new work. `main` is the only branch that deploys.

1. Open an Issue labelled `lab5` and a branch from `staging`.
2. Pull Request into `staging`. CI (`test-and-docker`) runs. The teammate reviews with a specific finding or reason.
3. Release Pull Request from `staging` into `main`. CI runs again.
4. The merge into `main` runs `deploy.yml`: CI, build and push the image tagged with the full commit SHA, migration job, Cloud Run update by image digest, smoke test.
5. The run summary shows the commit image tag.

Which commit is running: open `https://SERVICE_URL/api/version`. It returns `{"commit":"<full SHA>"}`; `release.sh` sets it with the image and `deploy.yml` fails the smoke test unless it equals the commit just released. Other ways: open the Actions run of the latest `Deploy` workflow on `main` (its summary lists the image tag, which is the full commit SHA), or compare the digest of the running revision with the Artifact Registry tags:

```bash
gcloud run services describe purchaseflow --region asia-southeast1 --format='value(spec.template.spec.containers[0].image)'
gcloud artifacts docker images list asia-southeast1-docker.pkg.dev/YOUR_PROJECT_ID/purchaseflow/purchaseflow --include-tags
```

Rollback: Actions, Deploy workflow, Run workflow on `main`, enter the full 40-character SHA of the last release that worked. Tests, build and migration are skipped. The schema is not rolled back, so migrations must stay additive.

## 7. Evidence (fill in as each step is done)

| Check | What it shows | Evidence | Commit |
|---|---|---|---|
| C-01 | A normal Pull Request runs the build and all tests, and they pass | not yet | |
| C-02 | A Pull Request from a temporary branch with one failing test cannot be merged | not yet | |
| C-03 | A fresh clone builds and runs with only `.env.example` values filled in | not yet | |
| C-04 | The workflow works on the public URL: sign in, create and submit, one rule rejection or access restriction | not yet | |
| C-05 | A record created before a restart and a redeploy is still there afterwards | not yet | |
| C-06 | A reviewed change goes from staging into main and is deployed, and the running revision matches its commit | not yet | |
