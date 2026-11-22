#!/usr/bin/env bash
# Offline checks for deploy/deploy.sh (the first manual deployment in the CPE334 course environment).
# Fake `gcloud`, `docker` and a throw-away git repository are used: no real cloud or Docker call, no cost.
#
#   bash deploy/tests/test_deploy_stub.sh      (CI runs it too)
#
# What it asserts
#   dry run (the default)   -> prints, calls neither gcloud nor docker
#   real run with --demo    -> builds for linux/amd64, pushes, gives the migration job the database, admin and demo
#                              secrets, runs it, updates the service, then sets CLIENT_ORIGIN and APP_COMMIT
#   real run without --demo -> the demo secret is not given to the job (only the administrator is seeded)
#   migration job fails     -> exit 1 and the service is never updated
#   branch other than main  -> exit 1 before any docker or gcloud call
#   wrong project           -> exit 1
#   never                   -> creates Cloud SQL, secrets, service accounts or any IAM binding (the portal owns them)
set -euo pipefail
trap 'echo "FAILED at line $LINENO of test_deploy_stub.sh" >&2' ERR
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="${SCRIPT_DIR}/../deploy.sh"
export TEST_STATE_DIR; TEST_STATE_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_STATE_DIR"' EXIT
mkdir -p "$TEST_STATE_DIR/bin" "$TEST_STATE_DIR/repo"

cat > "$TEST_STATE_DIR/bin/gcloud" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "gcloud $*" >> "$CALL_LOG"
case "${1:-} ${2:-} ${3:-} ${4:-}" in
  "artifacts docker images describe") echo "asia-southeast1-docker.pkg.dev/cpe-se-course-2026/sad61263d/sad61263d@sha256:abcdef" ;;
  "run jobs execute "*) [ "${STUB_MODE:-ok}" != job-fail ] || exit 1 ;;
esac
case "${1:-} ${2:-} ${3:-}" in
  "run services describe") for a in "$@"; do case "$a" in --format*) echo "https://sad61263d-test.a.run.app" ;; esac; done ;;
  "run jobs execute") [ "${STUB_MODE:-ok}" != job-fail ] || exit 1 ;;
esac
exit 0
STUB
cat > "$TEST_STATE_DIR/bin/docker" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "docker $*" >> "$CALL_LOG"
STUB
chmod +x "$TEST_STATE_DIR/bin/gcloud" "$TEST_STATE_DIR/bin/docker"
export PATH="$TEST_STATE_DIR/bin:$PATH"

cd "$TEST_STATE_DIR/repo"
git init -q -b main . && git config user.email t@example.test && git config user.name test
echo x > file && git add file && git commit -q -m init
SHA="$(git rev-parse HEAD)"

run() { # name, expected exit, env assignments..., then script args after --
  local name="$1" want="$2"; shift 2
  export CALL_LOG="$TEST_STATE_DIR/calls-$name.log"; : > "$CALL_LOG"
  local got=0
  env "$@" > "$TEST_STATE_DIR/out-$name.txt" 2>&1 || got=$?
  if [ "$got" -ne "$want" ]; then echo "FAIL $name: exit $got, wanted $want"; cat "$TEST_STATE_DIR/out-$name.txt"; exit 1; fi
}
calls() { cat "$TEST_STATE_DIR/calls-$1.log"; }

# 1. dry run is the default and calls nothing
run dry 0 bash "$DEPLOY_SCRIPT" --demo
[ ! -s "$TEST_STATE_DIR/calls-dry.log" ] || { echo 'FAIL dry: gcloud or docker was called'; exit 1; }
grep -q 'DRY_RUN' "$TEST_STATE_DIR/out-dry.txt"
echo 'PASS: dry run is the default and calls neither gcloud nor docker'

# 2. real run with --demo
run demo 0 DRY_RUN=0 bash "$DEPLOY_SCRIPT" --demo
calls demo | grep -q '^docker build --platform linux/amd64 --tag asia-southeast1-docker.pkg.dev/cpe-se-course-2026/sad61263d/sad61263d:'"$SHA"' \.$'
calls demo | grep -q '^docker push .*:'"$SHA"
calls demo | grep -q '^gcloud run jobs update sad61263d-migrate .*DATABASE_URL=sad61263d-database-url:latest,ADMIN_PASSWORD=sad61263d-admin-password:latest,DEMO_USER_PASSWORD=sad61263d-demo-password:latest'
calls demo | grep -q 'prisma migrate deploy && npm run prisma:seed'
calls demo | grep -q '^gcloud run jobs execute sad61263d-migrate .*--wait'
calls demo | grep -q '^gcloud run services update sad61263d --image asia-southeast1-docker.pkg.dev/cpe-se-course-2026/sad61263d/sad61263d@sha256:abcdef'
calls demo | grep -q '^gcloud run services update sad61263d --update-env-vars CLIENT_ORIGIN=https://sad61263d-test.a.run.app,APP_COMMIT='"$SHA"
# order: migration before the service
[ "$(calls demo | grep -n 'jobs execute' | cut -d: -f1)" -lt "$(calls demo | grep -n 'services update sad61263d --image' | cut -d: -f1)" ]
echo 'PASS: real run with --demo builds for amd64, migrates first, deploys, then sets CLIENT_ORIGIN and APP_COMMIT'

# 3. without --demo the demo secret is not given to the job
run nodemo 0 DRY_RUN=0 bash "$DEPLOY_SCRIPT"
if calls nodemo | grep -q 'DEMO_USER_PASSWORD'; then echo 'FAIL nodemo: demo secret given without --demo'; exit 1; fi
calls nodemo | grep -q 'ADMIN_PASSWORD=sad61263d-admin-password:latest'
echo 'PASS: without --demo only the administrator secret is given to the job'

# 4. migration failure stops before the service
run jobfail 1 DRY_RUN=0 STUB_MODE=job-fail bash "$DEPLOY_SCRIPT" --demo
if calls jobfail | grep -q '^gcloud run services update'; then echo 'FAIL jobfail: service updated after a failed migration'; exit 1; fi
echo 'PASS: a failed migration stops before the service is touched'

# 5. branch other than main
git switch -q -c feature/x
run branch 1 DRY_RUN=0 bash "$DEPLOY_SCRIPT" --demo
[ ! -s "$TEST_STATE_DIR/calls-branch.log" ] || { echo 'FAIL branch: a call was made from a non main branch'; exit 1; }
git switch -q main
echo 'PASS: refuses a branch other than main before any call'

# 6. wrong project
run project 1 DRY_RUN=0 PROJECT_ID=someone-else bash "$DEPLOY_SCRIPT" --demo
[ ! -s "$TEST_STATE_DIR/calls-project.log" ] || { echo 'FAIL project: a call was made for another project'; exit 1; }
echo 'PASS: refuses any project other than the course project'

# 7. the script never creates what the portal owns
for n in demo nodemo; do
  if calls $n | grep -Eq 'sql instances|secrets create|secrets versions|iam |add-iam-policy-binding|services enable|artifacts repositories create'; then
    echo "FAIL $n: the script created infrastructure or changed IAM"; exit 1
  fi
done
echo 'PASS: never creates Cloud SQL, secrets, service accounts, repositories or IAM bindings'
