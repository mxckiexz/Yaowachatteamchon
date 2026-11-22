# Answer Part 0: Team and Evidence Index

Source of the Lab 5 PDF. Items marked TO FILL are not done yet and must be completed from real runs before the PDF is submitted. Nothing here is claimed before it has happened.

| Item | Value |
|---|---|
| Team and topic | Yaowachatteamchon, PurchaseFlow, equipment purchase approval (TO FILL: team number, section) |
| Student 1 | Thanwarat Chanthana, 67070501025, GitHub Thanwarat1303 |
| Student 2 | Aphisaimai, 67070501077, GitHub mxckiexz |
| Repository (public) | https://github.com/mxckiexz/Yaowachatteamchon |
| Submitted tag or commit | TO FILL: the release commit on main after the release pull request |
| Public URL | https://sad61263d-4d7hbszvwq-as.a.run.app (answers application-not-deployed until the first release) |
| Commit served by the URL | TO FILL: the commit shown by /api/version |
| Platform | CPE334 course portal (team prefix sad61263d), Cloud Run, Cloud SQL for PostgreSQL, Secret Manager, GitHub Actions |

## Contributions

| Item | Link | Author | Reviewer | Result |
|---|---|---|---|---|
| Issues for Lab 5 steps 1 to 9 | #31 to #39 | mxckiexz | not applicable | open until each step has its evidence |
| Pull request 40: Docker, CI, deploy scripts, cloud-ready API | https://github.com/mxckiexz/Yaowachatteamchon/pull/40 | mxckiexz | Thanwarat1303 | requested two changes (503 test, paid resource gate), then two documentation corrections, approved and merged into staging on 2026-11-21 |
| Pull request for the seed fix and portal notes | TO FILL | mxckiexz | TO FILL | open |

Both students take part: one writes and runs, the other reviews with specific findings and merges. The review of pull request 40 changed the code (a test for the database failure case, a gate before any paid resource) and the documents (student ID, README status).

AI use: an AI coding agent wrote the Docker, CI, deploy script and test files and the first drafts of the documents. Aphisaimai directed it and ran the commands, and Thanwarat reviewed the pull request. No password, connection string or key was pasted into the agent.

## Evidence index

| Rubric part | Artifact or link | IDs or version | Verification result |
|---|---|---|---|
| 1. CI and quality gate | Pull request 40 and its Actions run https://github.com/mxckiexz/Yaowachatteamchon/actions/runs/44921225727 | C-01, commit c9c9e88 | passed |
| 1. CI and quality gate | Failing pull request from a temporary branch | C-02 | TO FILL: not done, needs the main ruleset |
| 2. Docker and configuration | Dockerfile, .dockerignore, fresh clone run | C-03, commit 8ebc83b | passed locally |
| 3. GCP deployment and persistence | Public URL, data before and after restart and redeploy | C-04, C-05 | TO FILL: not done |
| 4. Release pipeline | Issue, pull request into staging, release pull request, deploy run, running commit | C-06 | TO FILL: not done |

# Answer Part 1: CI and Quality Gate

## C-01: a normal pull request runs the build and the tests and they pass

Workflow file: https://github.com/mxckiexz/Yaowachatteamchon/blob/staging/.github/workflows/ci-docker.yml. It runs on every pull request into main and staging. The job name is test-and-docker.

Pull request 40 (https://github.com/mxckiexz/Yaowachatteamchon/pull/40) ran it three times, all passed: runs 44900674399 (f87bdd3), 44920338360 (5412eda) and 44921225727 (c9c9e88).

Test summary of run 44921225727, taken from its log:

| Step | Result |
|---|---|
| Deploy script checks without GCP | 7 scenarios passed, 8 smoke test unit tests OK |
| Backend: typecheck, build, migrate, seed, Vitest | 17 files, 94 tests passed |
| Frontend: Vitest and production build | 3 files, 14 tests passed |
| Production Docker image build | passed (the job succeeded) |

## C-02: a pull request from a temporary branch with one failing test cannot be merged

TO FILL. Needs the ruleset on main (pull request required, test-and-docker required, branch up to date). Evidence: the pull request link, the failed check, the disabled merge button.

## Required check setting for main

TO FILL: screenshot of the ruleset.

# Answer Part 2: Docker and Reproducible Configuration

Files: Dockerfile (three stages, non-root user node, API and built client on port 3000), .dockerignore, docker-compose.yml, server/.env.example, .env.example, docs/labs/lab-05/deployment.md (environment variable table, no secret committed).

## C-03: a fresh clone builds and runs with only .env.example values

Run on 2026-11-21 from a new clone of the public repository at commit 8ebc83bb2852694b854c331c8dbcb239c7a9bb4f, with .env.example copied to .env without any edit:

<pre>
$ git clone --branch chore/lab5-deploy-readiness https://github.com/mxckiexz/Yaowachatteamchon.git repo
$ cp .env.example .env
$ APP_PORT=3001 docker compose up -d --build
$ curl http://localhost:3001/api/health
{"status":"ok"}
$ curl http://localhost:3001/api/ready
{"status":"ready","db":"connected"}
$ curl -o /dev/null -w '%{http_code} %{content_type}' http://localhost:3001/
200 text/html; charset=UTF-8
sign in as ploy@purchaseflow.test: signed in, role REQUESTER
$ docker compose ps
app Up, db Up (healthy), migrate Exited (0)
</pre>

Full output: docs/labs/lab-05/evidence/c03-fresh-clone.txt. Port 3001 was used because port 3000 was taken on that computer. /api/version shows unknown locally because the commit is set only by the release pipeline.

# Answer Part 3: GCP Deployment and Persistence

TO FILL: not done. The course portal creates the resources under prefix sad61263d. Needed here:

| Check | Evidence still to collect |
|---|---|
| Public URL | The URL and the commit it serves (/api/version) |
| C-04 | Screenshots with the URL visible: sign in, create and submit a request, one rule rejection or access restriction |
| UI, API and database | /api/ready on the live URL |
| GCP service and database | Console screenshot of the Cloud Run service and Cloud SQL instance (no secret visible) |
| C-05 | A record created before a restart and a redeploy, shown again after |

# Answer Part 4: Repeatable Release Pipeline

TO FILL: not done. Needed here:

| Check | Evidence still to collect |
|---|---|
| C-06 | One labelled change from Issue to pull request into staging with a specific review, the release pull request into main, CI, the deploy run, and /api/version equal to the release commit |
| Release procedure | docs/labs/lab-05/deployment.md, section 6 |
