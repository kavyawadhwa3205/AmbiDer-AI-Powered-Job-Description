import os
import tempfile
from dotenv import load_dotenv

try:
    import libsql_client
except Exception:
    libsql_client = None

# Load environment variables at the very beginning
load_dotenv()

def get_db_path():
    # On Vercel or read-only environments, write to /tmp
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
            print(f"Warning: Turso DB connection failed ({e}). Falling back to local SQLite.")
            
    db_path = get_db_path()
    if libsql_client:
        return libsql_client.create_client_sync(url=f"file:{db_path}")
    else:
        raise RuntimeError("libsql_client package is not installed")

def init_db():
    try:
        client = get_db()
        
        client.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        client.execute('''
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
        ''')
        
        client.execute('''
        CREATE TABLE IF NOT EXISTS reference_jds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_title TEXT,
            industry TEXT NOT NULL,
            jd_text TEXT NOT NULL,
            source TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        client.execute('''
        CREATE TABLE IF NOT EXISTS jd_edits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            jd_id INTEGER NOT NULL,
            instruction TEXT NOT NULL,
            updated_jd TEXT NOT NULL,
            edited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (jd_id) REFERENCES saved_jds(id)
        )
        ''')
        
        client.close()
    except Exception as e:
        print("Warning: Failed to initialize database:", e)

if __name__ == "__main__":
    init_db()
    print("Database tables initialized.")