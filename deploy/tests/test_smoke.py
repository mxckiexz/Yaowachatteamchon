"""Offline unit tests for deploy/smoke_test.py (the network is mocked).

Run (repo root):  python3 -m unittest discover -s deploy/tests -p 'test_smoke.py'
CI runs it too (.github/workflows/ci-docker.yml).

Covers: public checks pass and login is skipped without credentials; a DB that is not
ready fails even if HTTP answers; an open /api/auth/me fails; the session is logged out
even if a check fails; only one of the two login variables is refused.
"""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('smoke', Path(__file__).parents[1] / 'smoke_test.py')
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


class SmokeTests(unittest.TestCase):
    def response(self, base, path, data=None, cookie=None):
        return {
            '/api/health': b'{"status":"ok"}',
            '/api/ready': b'{"status":"ready","db":"connected"}',
            '/': b'<html></html>',
            '/api/auth/me': b'{"user":{"id":1}}',
            '/api/auth/logout': b'',
        }[path]

    @patch.dict('os.environ', {}, clear=True)
    def test_public_checks_pass_and_skip_optional_login(self):
        with patch.object(smoke, 'request', side_effect=self.response) as req, \
                patch.object(smoke, 'status_of', return_value=401):
            smoke.check('https://demo.test')
            self.assertEqual(req.call_count, 3)

    @patch.dict('os.environ', {}, clear=True)
    def test_db_not_ready_fails_even_when_http_responds(self):
        def disconnected(base, path, **kwargs):
            return b'{"status":"not_ready"}' if path == '/api/ready' else self.response(base, path)
        with patch.object(smoke, 'request', side_effect=disconnected), \
                patch.object(smoke, 'status_of', return_value=401), patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, '/api/ready'):
                smoke.check('https://demo.test')

    @patch.dict('os.environ', {}, clear=True)
    def test_open_auth_me_fails(self):
        with patch.object(smoke, 'request', side_effect=self.response), \
                patch.object(smoke, 'status_of', return_value=200), patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, 'auth/me'):
                smoke.check('https://demo.test')

    @patch.dict('os.environ', {'SMOKE_EMAIL': 'smoke@example.test', 'SMOKE_PASSWORD': 'test-only'}, clear=True)
    def test_session_is_logged_out_even_if_me_fails(self):
        def broken_me(base, path, data=None, cookie=None):
            if path == '/api/auth/me' and cookie:
                raise ValueError('Broken response')
            return self.response(base, path, data, cookie)
        with patch.object(smoke, 'request', side_effect=broken_me) as req, \
                patch.object(smoke, 'status_of', return_value=401), \
                patch.object(smoke, 'login_cookie', return_value='purchaseflow_session=test'):
            with self.assertRaisesRegex(RuntimeError, 'Login smoke'):
                smoke.check('https://demo.test')
            self.assertEqual(req.call_args.args[1], '/api/auth/logout')
            self.assertEqual(req.call_args.kwargs['cookie'], 'purchaseflow_session=test')

    @patch.dict('os.environ', {'SMOKE_EMAIL': 'smoke@example.test'}, clear=True)
    def test_only_one_login_variable_is_refused(self):
        with patch.object(smoke, 'request', side_effect=self.response), patch.object(smoke, 'status_of', return_value=401):
            with self.assertRaisesRegex(RuntimeError, 'both'):
                smoke.check('https://demo.test')

    def test_cookie_is_taken_from_set_cookie_without_attributes(self):
        class FakeResponse:
            headers = {'Set-Cookie': 'purchaseflow_session=abc-123; Path=/; HttpOnly; SameSite=Lax'}
            def __enter__(self): return self
            def __exit__(self, *a): return False
        with patch.object(smoke.urllib.request, 'urlopen', return_value=FakeResponse()):
            self.assertEqual(smoke.login_cookie('https://demo.test', 'a@b.test', 'x'), 'purchaseflow_session=abc-123')


if __name__ == '__main__':
    unittest.main()
