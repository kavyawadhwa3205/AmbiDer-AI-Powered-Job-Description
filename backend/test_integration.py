import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import app as app_module
import db


class ApiIntegrationTestCase(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.database = db.SQLiteClientWrapper(
            str(Path(self.directory.name) / "test.db")
        )
        with patch.object(db, "get_db", return_value=self.database):
            db.init_db()
        self.database_patch = patch.object(
            app_module, "get_db", return_value=self.database
        )
        self.database_patch.start()
        self.previous_initialized = app_module._db_initialized
        app_module._db_initialized = True
        self.app = app_module.app
        self.original_jwt_secret = self.app.config["JWT_SECRET_KEY"]
        self.app.config.update(
            TESTING=True,
            JWT_SECRET_KEY="test-signing-key-that-is-longer-than-thirty-two-characters",
        )
        self.client = self.app.test_client()

    def tearDown(self):
        self.database_patch.stop()
        self.app.config["JWT_SECRET_KEY"] = self.original_jwt_secret
        app_module._db_initialized = self.previous_initialized
        self.directory.cleanup()

    def register(self, email):
        return self.client.post(
            "/api/auth/register",
            json={
                "full_name": "Test User",
                "email": email,
                "password": "safe-password-123",
            },
        )

    def test_register_login_and_authenticated_save(self):
        registration = self.register("first@example.com")
        self.assertEqual(registration.status_code, 201)
        token = registration.get_json()["token"]

        login = self.client.post(
            "/api/auth/login",
            json={"email": "first@example.com", "password": "safe-password-123"},
        )
        self.assertEqual(login.status_code, 200)

        saved = self.client.post(
            "/api/save",
            headers={"Authorization": f"Bearer {token}"},
            json={"job_title": "Engineer", "jd_text": "A complete job description."},
        )
        self.assertEqual(saved.status_code, 201)
        self.assertIsInstance(saved.get_json()["id"], int)

    def test_user_cannot_save_edit_for_another_users_jd(self):
        first = self.register("first@example.com").get_json()
        second = self.register("second@example.com").get_json()
        saved = self.client.post(
            "/api/save",
            headers={"Authorization": f"Bearer {first['token']}"},
            json={"job_title": "Engineer", "jd_text": "A complete job description."},
        )
        jd_id = saved.get_json()["id"]

        response = self.client.post(
            "/api/save/edit",
            headers={"Authorization": f"Bearer {second['token']}"},
            json={
                "jd_id": jd_id,
                "instruction": "Make it shorter",
                "updated_jd": "Updated text",
            },
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["error"], "JD not found or unauthorized")


if __name__ == "__main__":
    unittest.main()
