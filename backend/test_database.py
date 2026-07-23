import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import db


class DatabaseInitializationTestCase(unittest.TestCase):
    def test_initialization_is_idempotent_and_records_schema_version(self):
        with tempfile.TemporaryDirectory() as directory:
            client = db.SQLiteClientWrapper(str(Path(directory) / "test.db"))
            with patch.object(db, "get_db", return_value=client):
                db.init_db()
                db.init_db()

            tables = {row[0] for row in client.execute("SELECT name FROM sqlite_master WHERE type = 'table'").rows}
            indexes = {row[0] for row in client.execute("SELECT name FROM sqlite_master WHERE type = 'index'").rows}
            migration_versions = client.execute("SELECT version FROM schema_migrations").rows

        self.assertTrue({"users", "saved_jds", "reference_jds", "jd_edits", "schema_migrations"}.issubset(tables))
        self.assertTrue({"idx_saved_jds_user_created", "idx_saved_jds_user_industry", "idx_jd_edits_jd_id", "idx_reference_jds_industry"}.issubset(indexes))
        self.assertEqual(migration_versions, [(1,)])


if __name__ == "__main__":
    unittest.main()
