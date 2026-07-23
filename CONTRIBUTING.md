# Contributing to AmbiDer

Thank you for contributing to AmbiDer. This guide defines the expected workflow for changes to the React frontend, Flask API, database layer, and deployment configuration.

## Before you begin

- Review the [README](README.md) for the architecture, environment configuration, and API overview.
- Search existing issues and pull requests before beginning overlapping work.
- Keep changes focused. Separate refactoring, behavior changes, dependency updates, and documentation-only changes when doing so makes review clearer.
- Do not commit credentials, JWT secrets, API keys, database tokens, local SQLite databases, or generated build artifacts.
- Do not alter deployment secrets, security controls, or production configuration merely to bypass a failing check.

## Repository conventions

| Area | Location | Notes |
| --- | --- | --- |
| Browser application | `frontend/src/` | React components and CSS, built by Vite |
| API and AI integration | `backend/app.py` | Flask routes, auth, prompts, and Groq calls |
| Persistence | `backend/db.py` | Schema initialization and SQLite/libSQL connection selection |
| Vercel entry point | `api/index.py` | Exports the Flask application for serverless execution |
| Deployment | `vercel.json`, `backend/render.yaml` | Treat deployment modifications as production-impacting |

Follow existing JavaScript, JSX, Python, and CSS formatting patterns in the files you modify. Prefer the libraries and component patterns already used by the project. Avoid unrelated reformatting.

## Local setup

### Backend

From the repository root in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

Create a root `.env` file or `backend/.env` with development values:

```dotenv
JWT_SECRET_KEY=replace-with-a-long-random-development-secret
GROQ_API_KEY=your-groq-api-key

# Optional remote database
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
```

Run the API with:

```powershell
python backend/app.py
```

The application initializes its database before its first request. You can initialize it explicitly with `python backend/db.py`.

### Frontend

In a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

The Vite configuration proxies `/api` to the local Flask server at `http://127.0.0.1:5000`. Keep the API running while exercising client changes.

## Development workflow

1. Create a descriptive branch from the current upstream default branch.
2. Make the smallest complete change that addresses the issue.
3. Add or update tests when the project has appropriate coverage for the affected behavior. When no test harness exists, document the manual verification you performed in the pull request.
4. Run the relevant checks listed below.
5. Review your own diff for accidental artifacts, secrets, generated files, and unrelated edits.
6. Commit a coherent unit of work with an imperative, scoped message.
7. Push the branch to your fork and open a pull request to the upstream repository.

Examples of useful commit messages:

```text
fix: preserve saved JD ownership during edit
feat: add validation for generation inputs
docs: clarify local Turso setup
```

Do not use vague messages such as `updates`, `fix`, or `changes`.

## Verification

Run the frontend checks for all frontend changes and before submitting cross-cutting changes:

```powershell
cd frontend
npm run lint
npm run build
```

Run the backend locally for API, persistence, authentication, or deployment changes. At minimum, verify the relevant request path manually—for example: registration/login, the changed endpoint, and `/api/health`.

`backend/test_jd_quality.py` makes real Groq API calls, waits between requests, and consumes API quota. It is a manual quality-check script, not an offline test suite. Only run it when the feature under review requires LLM-output validation and `GROQ_API_KEY` is configured:

```powershell
cd backend
python test_jd_quality.py
```

If a check cannot run, state the command, reason, and alternative verification in the pull request.

## API and data changes

Changes to `backend/app.py` and `backend/db.py` require additional care:

- Preserve the `/api/*` routes used by the frontend. Root-level aliases exist as well, but new client-facing routes should be usable through `/api`.
- Require JWT authentication for operations that access or change user-owned data. Confirm that queries filter by the authenticated user where ownership applies.
- Use parameterized database queries; do not construct SQL from user-controlled strings.
- Consider the SQLite fallback and Turso/libSQL path when changing database behavior.
- The current schema is created with `CREATE TABLE IF NOT EXISTS`; there is no migration framework. Discuss backward-incompatible schema changes with maintainers before implementing them.
- Never expose `GROQ_API_KEY`, Turso credentials, or JWT secrets in browser code, responses, logs, issues, or pull requests.

## Frontend changes

- Keep API base URL use centralized through `frontend/src/config.js`.
- Preserve responsive behavior and test affected pages in a browser.
- Validate sign-in state and error states when changing protected views.
- Check both light and dark themes when changing shared UI or CSS variables.
- For output/export work, manually exercise the relevant PDF, DOCX, clipboard, or Markdown behavior.

## Fork, push, and pull request workflow

This checkout currently uses the standard fork layout:

```text
origin   → your fork: thenamakop/AmbiDer-AI-Powered-Job-Description
upstream → source:   kavyawadhwa3205/AmbiDer-AI-Powered-Job-Description
```

A normal push explicitly targeting `origin` goes to your fork, not the upstream repository:

```powershell
# Fetch the latest upstream work, then branch from its default branch.
git fetch upstream
git switch main
git pull --ff-only upstream main
git switch -c feat/short-description

# After committing your work:
git push -u origin feat/short-description
```

Then create a pull request with:

- **base repository:** `kavyawadhwa3205/AmbiDer-AI-Powered-Job-Description`
- **base branch:** the branch requested by the maintainers (normally `main`)
- **head repository:** `thenamakop/AmbiDer-AI-Powered-Job-Description`
- **head branch:** your feature or fix branch

Never push directly to `upstream` unless you have explicit maintainer permission. Confirm `git remote -v`, `git status`, and the target branch immediately before pushing.

## Pull request checklist

Include the following in each pull request:

- A concise summary of the problem and solution.
- Any user-visible, API, data, or deployment impact.
- Tests and commands run, including their results.
- Manual test steps where automated coverage is absent.
- Screenshots or recordings for meaningful UI changes.
- A note about follow-up work, known limitations, or intentionally deferred changes.

Keep pull requests reviewable. Address feedback in follow-up commits unless a maintainer asks for a different history strategy.

## Reporting issues

A useful issue includes:

- The observed behavior and expected behavior.
- Reproduction steps and the smallest input that demonstrates the problem.
- Relevant environment details (browser, operating system, Python/Node version, and deployment mode).
- Sanitized logs or screenshots—never secrets or access tokens.

## Security concerns

Do not open public issues containing sensitive data. For a security concern, contact the repository maintainers through a private channel and provide only the minimum information needed to reproduce and assess the issue.
