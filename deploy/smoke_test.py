"""Public deployment checks. Credentials and cookies are never printed.

WHAT THIS SCRIPT DOES
    Called by .github/workflows/deploy.yml after a deployment:
        python3 deploy/smoke_test.py SERVICE_URL
    It checks the live service and exits non-zero (failing the workflow) if any
    check fails. Each public check is retried up to 5 times, 3 seconds apart, to
    tolerate Cloud Run cold starts.

    Checks (in order)
      1. GET /api/health   -> {"status": "ok"}
      2. GET /api/ready    -> {"status": "ready", "db": "connected"}  (proves the DB works)
      3. GET /             -> HTML page (the built React app is served)
      4. GET /api/auth/me without a session -> 401 (the API is up and protected)
      5. OPTIONAL login test -> login, /api/auth/me, logout. Runs only if BOTH
         env vars SMOKE_EMAIL and SMOKE_PASSWORD are set (set both or neither).
         PurchaseFlow signs in with a session cookie, so the script keeps the cookie
         from the login response. Use a requester account, never the administrator.
         The session is always logged out, even if a check fails.

IMPORTANT
    Uses only the Python standard library (no pip install needed).
    The check is read-only: it creates no request. Logging in only adds a session row.
    Offline unit tests: deploy/tests/test_smoke.py
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request


# --- HTTP helpers ---------------------------------------------------------------
# request() returns the response body (bytes) and raises on HTTP errors / timeouts.
# State-changing calls send Origin = the service URL, because the API accepts only its own origin.
def request(base, path, data=None, cookie=None):
    headers = {}
    if data is not None:
        headers['Content-Type'] = 'application/json'
        headers['Origin'] = base
    if cookie:
        headers['Cookie'] = cookie
    req = urllib.request.Request(base + path, headers=headers,
        data=json.dumps(data).encode() if data is not None else None)
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


def status_of(base, path):
    """HTTP status of a GET without any session (an HTTP error status is returned, not raised)."""
    try:
        with urllib.request.urlopen(base + path, timeout=30) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code


def login_cookie(base, email, password):
    """Sign in and return the session cookie as 'name=value'. Never print it."""
    req = urllib.request.Request(base + '/api/auth/login',
        data=json.dumps({'email': email, 'password': password}).encode(),
        headers={'Content-Type': 'application/json', 'Origin': base})
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = response.headers.get('Set-Cookie', '')
    cookie = raw.split(';', 1)[0]
    if '=' not in cookie:
        raise ValueError('No session cookie')
    return cookie


def with_retries(path, test):
    # Retry: a cold Cloud Run instance may need a few seconds to start.
    for attempt in range(5):
        try:
            if not test():
                raise ValueError('Unexpected response')
            return
        except (urllib.error.URLError, TimeoutError, ValueError):
            if attempt == 4:
                raise RuntimeError('Smoke check failed: ' + path) from None
            time.sleep(3)


def check(base):
    # --- Public checks --------------------------------------------------------
    for path, predicate in (
        ('/api/health', lambda b: json.loads(b).get('status') == 'ok'),
        ('/api/ready', lambda b: json.loads(b).get('db') == 'connected'),
        ('/', lambda b: b'<html' in b.lower()),
    ):
        with_retries(path, lambda path=path, predicate=predicate: predicate(request(base, path)))
        print('PASS ' + path)
    with_retries('/api/auth/me (anonymous)', lambda: status_of(base, '/api/auth/me') == 401)
    print('PASS /api/auth/me is protected (401 without a session)')

    # --- Optional login check (only when both credentials are provided) -------
    email, password = os.getenv('SMOKE_EMAIL'), os.getenv('SMOKE_PASSWORD')
    if bool(email) != bool(password):
        raise RuntimeError('Set both SMOKE_EMAIL and SMOKE_PASSWORD, or neither.')
    if not email:
        print('SKIP login: optional smoke credentials not configured')
        return
    cookie = None
    try:
        cookie = login_cookie(base, email, password)
        request(base, '/api/auth/me', cookie=cookie)
        print('PASS login and authenticated /api/auth/me')
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError):
        raise RuntimeError('Login smoke check failed') from None
    finally:
        # Always end the session, even when a check above failed.
        if cookie:
            request(base, '/api/auth/logout', data={}, cookie=cookie)
            print('PASS logout')


# --- Entry point ----------------------------------------------------------------
if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 deploy/smoke_test.py SERVICE_URL')
    check(sys.argv[1].rstrip('/'))
