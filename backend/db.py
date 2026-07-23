import os
import sqlite3
import tempfile

from dotenv import load_dotenv

try:
    import libsql_client
except Exception:
    libsql_client = None

load_dotenv()


class SQLiteResultSet:
    def __init__(self, rows):
        self.rows = rows


class SQLiteClientWrapper:
    def __init__(self, db_path):
        self.db_path = db_path

    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        return conn

    def execute(self, sql, params=()):
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            if (
                sql.strip()
                .upper()
                .startswith(("INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER"))
            ):
                conn.commit()
            if cursor.description:
                rows = cursor.fetchall()
            else:
                rows = []
            return SQLiteResultSet(rows)
        finally:
            conn.close()

    def close(self):
        pass


def get_db_path():
    if os.getenv("VERCEL") or not os.access(os.path.dirname(__file__) or ".", os.W_OK):
        return os.path.join(tempfile.gettempdir(), "app.db")
    return os.path.join(os.path.dirname(__file__), "app.db")


def get_db():
    url = os.getenv("TURSO_DATABASE_URL")
    auth_token = os.getenv("TURSO_AUTH_TOKEN")

    if url and auth_token and libsql_client:
        try:
            client = libsql_client.create_client_sync(url=url, auth_token=auth_token)
            client.execute("SELECT 1")
            return client
        except Exception as e:
            print(
                f"Warning: Turso DB connection failed ({e}). Falling back to local SQLite."
            )

    db_path = get_db_path()
    if libsql_client:
        try:
            return libsql_client.create_client_sync(url=f"file:{db_path}")
        except Exception as e:
            print(
                f"Warning: libsql_client file connection failed ({e}). Using sqlite3 wrapper."
            )

    return SQLiteClientWrapper(db_path)


def init_db():
    try:
        client = get_db()

        client.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """)

        client.execute("""
        CREATE TABLE IF NOT EXISTS saved_jds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            job_title TEXT NOT NULL,
            industry TEXT,
            company_name TEXT,
            experience TEXT,
            skills TEXT,
            tone TEXT,
            department TEXT,
            location TEXT,
            jd_text TEXT NOT NULL,
            is_edited INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """)

        client.execute("""
        CREATE TABLE IF NOT EXISTS reference_jds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_title TEXT,
            industry TEXT NOT NULL,
            jd_text TEXT NOT NULL,
            source TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """)

        client.execute("""
        CREATE TABLE IF NOT EXISTS jd_edits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            jd_id INTEGER NOT NULL,
            instruction TEXT NOT NULL,
            updated_jd TEXT NOT NULL,
            edited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (jd_id) REFERENCES saved_jds(id)
        )
        """)

        client.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """)
        for statement in (
            "CREATE INDEX IF NOT EXISTS idx_saved_jds_user_created ON saved_jds(user_id, created_at)",
            "CREATE INDEX IF NOT EXISTS idx_saved_jds_user_industry ON saved_jds(user_id, industry)",
            "CREATE INDEX IF NOT EXISTS idx_jd_edits_jd_id ON jd_edits(jd_id)",
            "CREATE INDEX IF NOT EXISTS idx_reference_jds_industry ON reference_jds(industry)",
        ):
            client.execute(statement)
        client.execute("INSERT OR IGNORE INTO schema_migrations (version) VALUES (1)")
        client.close()
    except Exception as e:
        print("Database initialization failed:", e)
        raise


if __name__ == "__main__":
    init_db()
    print("Database tables initialized.")
