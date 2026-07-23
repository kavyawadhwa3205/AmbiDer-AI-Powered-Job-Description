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

    def tearDown(self):
        app_module._db_initialized = self.db_initialized

    def test_register_rejects_non_json_body(self):
        response = self.client.post("/api/auth/register")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "A JSON object request body is required")

    def test_register_rejects_short_password(self):
        response = self.client.post(
            "/api/auth/register",
            json={"full_name": "Test User", "email": "test@example.com", "password": "short"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "Password must be at least 12 characters")

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
            response = self.client.post("/api/auth/register", json={"payload": "x" * 100})
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
        self.assertEqual(response.get_json(), {"status": "not ready", "error": "AI service is not configured"})


if __name__ == "__main__":
    unittest.main()
