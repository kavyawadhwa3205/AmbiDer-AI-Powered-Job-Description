import os
import sys

# Add backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import app as flask_app

app = flask_app.app

# Vercel needs the app object at module level
# Do not call app.run() here
