import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

os.environ["VERCEL"] = "1"
os.environ["APP_ENV"] = "production"
os.environ.pop("JWT_SECRET_KEY", None)
os.environ.pop("RATELIMIT_STORAGE_URI", None)

import app as app_module  # noqa: E402


class VercelColdStartTestCase(unittest.TestCase):
    def test_import_succeeds_in_production_without_secrets(self):
        self.assertIsNotNone(app_module.app)
        self.assertTrue(app_module._startup_errors)

    def test_health_check_returns_200_despite_startup_errors(self):
        app_module.app.config.update(TESTING=True)
        client = app_module.app.test_client()
        response = client.get("/api/health")
        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
