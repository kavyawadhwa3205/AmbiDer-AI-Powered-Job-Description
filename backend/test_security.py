import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import app as app_module


class SecurityTestCase(unittest.TestCase):
    def setUp(self):
        self.app = app_module.app
        self.app.config.update(TESTING=True)
        self.client = self.app.test_client()
        self.db_initialized = app_module._db_initialized
        app_module._db_initialized = True
        app_module.limiter.storage.reset()

    def tearDown(self):
        app_module._db_initialized = self.db_initialized

    def test_register_rejects_non_json_body(self):
        response = self.client.post("/api/auth/register")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json()["error"], "A JSON object request body is required"
        )

    def test_register_rejects_short_password(self):
        response = self.client.post(
            "/api/auth/register",
            json={
                "full_name": "Test User",
                "email": "test@example.com",
                "password": "short",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json()["error"], "Password must be at least 12 characters"
        )

    def test_generation_requires_authentication(self):
        response = self.client.post(
            "/api/generate",
            json={"job_title": "Engineer", "skills": "Python"},
        )

        self.assertEqual(response.status_code, 401)

    def test_request_too_large_returns_json_error(self):
        original_limit = self.app.config["MAX_CONTENT_LENGTH"]
        self.app.config["MAX_CONTENT_LENGTH"] = 16
        try:
            response = self.client.post(
                "/api/auth/register", json={"payload": "x" * 100}
            )
        finally:
            self.app.config["MAX_CONTENT_LENGTH"] = original_limit

        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.get_json()["error"], "Request body is too large")

    def test_readiness_does_not_expose_configuration_details(self):
        original_client = app_module.client
        app_module.client = None
        try:
            response = self.client.get("/api/ready")
        finally:
            app_module.client = original_client

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.get_json(),
            {"status": "not ready", "error": "AI service is not configured"},
        )

    def test_production_config_does_not_crash_startup(self):
        env = os.environ.copy()
        env["APP_ENV"] = "production"
        env["VERCEL"] = "1"
        env.pop("JWT_SECRET_KEY", None)
        env.pop("RATELIMIT_STORAGE_URI", None)

        script = (
            "import app; "
            "import json; "
            "client = app.app.test_client(); "
            "health = client.get('/api/health'); "
            "generate = client.post('/api/generate', json={'job_title': 'Engineer', 'skills': 'Python'}); "
            "print(json.dumps({"
            "  'health_status': health.status_code,"
            "  'generate_status': generate.status_code,"
            "  'generate_error': generate.get_json().get('error'),"
            "  'startup_errors': app._startup_errors"
            "}))"
        )
        result = subprocess.run(
            [sys.executable, "-c", script],
            cwd=str(Path(__file__).parent),
            env=env,
            capture_output=True,
            text=True,
        )
        self.assertEqual(
            result.returncode,
            0,
            msg=f"stderr: {result.stderr}\nstdout: {result.stdout}",
        )
        output = json.loads(result.stdout.strip().splitlines()[-1])
        self.assertEqual(output["health_status"], 200)
        self.assertEqual(output["generate_status"], 503)
        self.assertEqual(
            output["generate_error"],
            "Server misconfigured: missing JWT_SECRET_KEY",
        )
        self.assertTrue(output["startup_errors"])


if __name__ == "__main__":
    unittest.main()
