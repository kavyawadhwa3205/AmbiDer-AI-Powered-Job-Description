import os
from dotenv import load_dotenv
import libsql_client

# Load environment variables at the very beginning
load_dotenv()

def get_db():
    url = os.getenv("TURSO_DATABASE_URL")
    auth_token = os.getenv("TURSO_AUTH_TOKEN")
    
    if url and auth_token:
        try:
            client = libsql_client.create_client_sync(url=url, auth_token=auth_token)
            client.execute("SELECT 1")
            return client
        except Exception as e:
            print(f"Warning: Turso DB connection failed ({e}). Falling back to local SQLite.")
            
    db_path = os.path.join(os.path.dirname(__file__), "app.db")
    return libsql_client.create_client_sync(url=f"file:{db_path}")

def init_db():
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

if __name__ == "__main__":
    init_db()
    print("Database tables initialized.")