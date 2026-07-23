# AmbiDer

AmbiDer is an AI-assisted job-description workspace for recruiters and hiring teams. It generates structured job descriptions from role requirements, supports AI-guided revisions, evaluates ATS readiness, and gives authenticated users a place to save, export, search, and review their work.

The repository is a small full-stack monorepo: a React/Vite single-page application and a Flask API that is deployable as a Vercel Python serverless function.

## Contents

- [Capabilities](#capabilities)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Request and data flow](#request-and-data-flow)
- [Local development](#local-development)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Persistence](#persistence)
- [Deployment](#deployment)
- [Verification](#verification)
- [Known constraints](#known-constraints)
- [Contributing](#contributing)

## Capabilities

- Register, sign in, and restore a user session with JWT authentication.
- Generate a role-specific job description using Groq and the `llama-3.1-8b-instant` model.
- Include industry-matched reference descriptions in generation prompts when they are present in the database.
- Refine a generated description with free-form AI editing instructions and retain edit history for saved items.
- Calculate an ATS-oriented score and recommendations for a description.
- Save, search, load, delete, and review job descriptions per user.
- View user analytics and generate reports.
- Export generated descriptions to PDF and DOCX, copy text, and render Markdown in the application.
- Use preconfigured templates, light/dark appearance preferences, and browser speech recognition where supported.

## Architecture

```text
Browser
  React 19 + Vite SPA
  ├─ localStorage: JWT and theme preference
  ├─ React Router routes and component-local state
  └─ fetch('/api/...')
          │
          ▼
Vercel routing / Vite development proxy
          │
          ▼
Flask API (api/index.py → backend/app.py)
  ├─ JWT authentication
  ├─ Groq client for generation, editing, and scoring
  └─ database adapter (backend/db.py)
          │
          ├─ Turso/libSQL, when configured
          └─ SQLite fallback, otherwise
```

### Frontend

The client starts in `frontend/src/main.jsx`, which wraps `App.jsx` in `BrowserRouter`. `App.jsx` owns application-wide session, generated-description, form-prefill, and theme state; feature components receive the data and callbacks they need as props. The client reads its API base URL from `VITE_API_URL` (or the legacy `REACT_APP_API_URL`) and defaults to `/api`.

Primary application routes are:

| Route        | Component    | Responsibility                                                      |
| ------------ | ------------ | ------------------------------------------------------------------- |
| `/login`     | `LoginPage`  | Registration and sign-in                                            |
| `/`          | `InputForm`  | Collect role details and request generation                         |
| `/output`    | `OutputPage` | Render, score, enhance, save edits, copy, and export a generated JD |
| `/templates` | `Templates`  | Start from a preconfigured role template                            |
| `/saved`     | `SavedJDs`   | Search, load, and delete saved JDs                                  |
| `/history`   | `History`    | Inspect saved descriptions and their edits                          |
| `/analytics` | `Analytics`  | Visualize user-level activity                                       |
| `/reports`   | `Reports`    | Produce JD and analytics reports                                    |
| `/settings`  | `Settings`   | Present account and preference settings                             |

### Backend

`backend/app.py` configures Flask, CORS, JWT handling, and the Groq client. Database initialization runs once before the first request. API endpoints are available at both root-level paths and `/api/*` paths; the frontend uses the `/api` form.

The generation endpoint builds a constrained, structured prompt from form values. It looks up at most two reference JDs for the selected industry, calls Groq, and returns the generated Markdown. The edit and ATS-score endpoints also delegate to the configured Groq client.

### Repository layout

```text
api/
  index.py                    Vercel serverless entry point
backend/
  app.py                      Flask application, AI prompts, and API routes
  db.py                       SQLite/libSQL adapter and schema creation
  seed_reference_jds.py       Seed curated reference descriptions
  generate_reference_jds.py   Generate reference descriptions with Groq
  test_jd_quality.py          Manual, API-backed generation quality check
  requirements.txt            Backend dependency list
  render.yaml                 Optional Render service definition
frontend/
  src/
    App.jsx                   Session, routing, and shared UI state
    components/               Page and feature components
    config.js                 API base URL resolution
  public/                     Static branding assets
  package.json                Frontend scripts and dependencies
  vite.config.js              Vite and local API proxy configuration
requirements.txt              Root dependency list for Vercel Python builds
vercel.json                   Vercel build and routing configuration
CONTRIBUTING.md               Contributor workflow and quality expectations
```

## Request and data flow

1. A signed-in user submits role details in `InputForm`.
2. The frontend sends `POST /api/generate` with the role inputs. Generation may be called without a JWT, although the UI requires a session to access the workspace.
3. Flask optionally loads industry reference descriptions, creates the LLM prompt, and asks Groq to generate the JD.
4. `App.jsx` stores the result in memory, navigates to `/output`, and attempts to auto-save it with `POST /api/save`.
5. The output page can request an ATS assessment, submit AI editing instructions, record saved edits, or export the content locally.
6. Saved, history, analytics, and report pages query user-scoped endpoints using the stored JWT.

## Local development

### Prerequisites

- Python 3.10 or later
- Node.js LTS and npm
- A Groq API key for generation, editing, and ATS scoring
- Optional: a Turso database URL and auth token for persistent remote storage

### 1. Configure environment variables

Create a root `.env` file (or `backend/.env`) and set at least the following values:

```dotenv
JWT_SECRET_KEY=replace-with-a-long-random-secret
GROQ_API_KEY=your-groq-api-key

# Optional: use Turso/libSQL instead of local SQLite
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
```

Do not commit this file. Environment files and local databases are ignored by Git.

### 2. Start the backend

From the repository root on Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
python backend/app.py
```

The API listens on `http://127.0.0.1:5000`. It initializes its schema before the first request. To initialize it explicitly, run:

```powershell
python backend/db.py
```

On macOS/Linux, activate the environment with `source .venv/bin/activate`.

### 3. Start the frontend

In a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Vite proxies `/api` requests to `http://127.0.0.1:5000`, so the committed development environment file works without changing frontend configuration. Open the local URL shown by Vite.

## Configuration

| Variable             | Required                | Purpose                                                                                                          |
| -------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET_KEY`     | Yes for production      | Signs access tokens. The code has a development fallback, but it must not be relied on in deployed environments. |
| `GROQ_API_KEY`       | Yes for AI features     | Enables JD generation, AI editing, and ATS scoring.                                                              |
| `TURSO_DATABASE_URL` | Optional                | Enables a remote Turso/libSQL database.                                                                          |
| `TURSO_AUTH_TOKEN`   | Required with Turso URL | Authenticates the Turso/libSQL connection.                                                                       |
| `VITE_API_URL`       | Optional                | Browser-visible API base URL; defaults to `/api`.                                                                |
| `VERCEL`             | Platform-provided       | Causes the SQLite fallback to use the serverless temporary directory.                                            |

## API reference

All listed endpoints are also registered without the `/api` prefix. Protected endpoints require `Authorization: Bearer <token>`.

| Method   | Endpoint             | Auth     | Purpose                                                 |
| -------- | -------------------- | -------- | ------------------------------------------------------- |
| `GET`    | `/api/health`        | No       | Health response                                         |
| `POST`   | `/api/auth/register` | No       | Create a user from `full_name`, `email`, and `password` |
| `POST`   | `/api/auth/login`    | No       | Authenticate and receive a token plus user data         |
| `GET`    | `/api/auth/me`       | Required | Retrieve the authenticated user                         |
| `POST`   | `/api/generate`      | Optional | Generate a JD from role details                         |
| `POST`   | `/api/edit`          | Optional | Rewrite `current_jd` according to an `instruction`      |
| `POST`   | `/api/ats-score`     | Optional | Score a JD and return feedback                          |
| `POST`   | `/api/save`          | Required | Persist a job description                               |
| `POST`   | `/api/save/edit`     | Required | Persist an edit record and update a saved JD            |
| `GET`    | `/api/saved`         | Required | List saved JDs; accepts optional `search`               |
| `DELETE` | `/api/saved/<id>`    | Required | Delete an owned saved JD and its edit history           |
| `GET`    | `/api/history`       | Required | Retrieve saved JDs and their edit history               |
| `GET`    | `/api/analytics`     | Required | Retrieve user-scoped activity aggregates                |

Example generation request:

```bash
curl -X POST http://127.0.0.1:5000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"job_title":"Senior Backend Engineer","industry":"Technology","experience":"5+ years","skills":"Python, Flask, SQL","tone":"Professional","company_name":"Acme Corp","location":"Remote","nature_of_job":"Remote"}'
```

## Persistence

`backend/db.py` creates four tables on initialization:

- `users`: account identity and password hash.
- `saved_jds`: the current saved version of each user-owned JD and its metadata.
- `jd_edits`: edit instructions and historical revised text for a saved JD.
- `reference_jds`: industry examples inserted into generation prompts.

When Turso credentials and `libsql-client` are available, the API uses Turso. Otherwise it uses a local SQLite database at `backend/app.db`; in an unwritable or Vercel environment, it falls back to a temporary-directory database. The latter is not durable across serverless invocations or deployments, so production deployments should configure Turso or another durable database.

## Deployment

The root `vercel.json` builds both parts of the monorepo:

- `api/index.py` is deployed with `@vercel/python`, including the `backend/` package.
- `frontend/package.json` is built with `@vercel/static-build`; its `dist/` directory serves the SPA.
- Requests under `/api/*` are routed to Flask. Other requests are served from the frontend build.

Set `JWT_SECRET_KEY`, `GROQ_API_KEY`, and—if persistence is required—both Turso variables in the Vercel project environment. A `backend/render.yaml` is also present for deploying the Flask service separately to Render.

## Verification

The frontend exposes the project checks below:

```powershell
cd frontend
npm run lint
npm run build
```

`backend/test_jd_quality.py` is an API-backed exploratory script rather than an isolated automated test suite. It sends three real generation requests, sleeps between them to reduce rate limiting, and requires `GROQ_API_KEY`; run it deliberately only when you want to spend API quota:

```powershell
cd backend
python test_jd_quality.py
```

## Known constraints

This codebase is functional but has several maintainer-relevant limitations:

- The frontend stores JWTs in `localStorage`; an httpOnly-cookie approach would provide stronger XSS resistance.
- The backend permits all CORS origins and lacks rate limiting. Production deployments should restrict origins and add request protections.
- bcrypt is the intended password hashing implementation. The SHA-256 fallback exists for resilience but is not an appropriate production password-storage strategy.
- Input validation and operational error logging are minimal.
- The settings UI includes presentation-only actions that are not yet persisted through an API.
- There is no isolated backend or frontend automated test suite yet.
- No license file is currently included; confirm licensing with maintainers before redistributing or reusing the project.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for setup expectations, branch and commit guidance, verification commands, and the fork-to-pull-request workflow.
