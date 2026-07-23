import os
from datetime import timedelta

import certifi
from db import get_db, init_db
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

try:
    import bcrypt
except ImportError as exc:
    raise RuntimeError("bcrypt is required for secure password storage") from exc

try:
    from groq import Groq
except ImportError:
    Groq = None

os.environ["SSL_CERT_FILE"] = certifi.where()
load_dotenv()

app = Flask(__name__)
app_environment = os.getenv("APP_ENV", "development").lower()
is_production = app_environment == "production" or bool(os.getenv("VERCEL"))
jwt_secret = os.getenv("JWT_SECRET_KEY")

if is_production and (not jwt_secret or jwt_secret == "ambider-jd-secret-2025"):
    raise RuntimeError("A unique JWT_SECRET_KEY is required in production")

app.config["JWT_SECRET_KEY"] = jwt_secret or "development-only-change-me"
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(
    hours=int(os.getenv("JWT_EXPIRY_HOURS", "8"))
)
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_REQUEST_BYTES", "1048576"))

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173"
    ).split(",")
    if origin.strip()
]
CORS(
    app,
    resources={
        r"/*": {
            "origins": cors_origins,
            "methods": ["GET", "POST", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
        }
    },
)

jwt = JWTManager(app)
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri=os.getenv("RATELIMIT_STORAGE_URI", "memory://"),
)

_db_initialized = False


@app.before_request
def ensure_db_initialized():
    global _db_initialized
    if not _db_initialized:
        init_db()
        _db_initialized = True


@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify({"error": "Request body is too large"}), 413


@app.errorhandler(429)
def rate_limit_exceeded(_error):
    return jsonify({"error": "Too many requests. Please try again later."}), 429


def get_json_payload():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None, (jsonify({"error": "A JSON object request body is required"}), 400)
    return data, None


def validate_text(data, field, maximum, required=False):
    value = data.get(field, "")
    if value is None:
        value = ""
    if not isinstance(value, str):
        return None, f"{field} must be text"
    value = value.strip()
    if required and not value:
        return None, f"{field} is required"
    if len(value) > maximum:
        return None, f"{field} must be at most {maximum} characters"
    return value, None


# Initialize Groq client if API key is provided
groq_key = os.getenv("GROQ_API_KEY")
if Groq and groq_key:
    client = Groq(api_key=groq_key)
else:
    client = None

# --- Authentication Endpoints ---


@app.route("/", methods=["GET"])
@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify(
        {
            "status": "Flask is running",
            "message": "AmbiDer API Backend is running smoothly!",
        }
    ), 200


@app.route("/ready", methods=["GET"])
@app.route("/api/ready", methods=["GET"])
def readiness_check():
    if not client:
        return jsonify(
            {"status": "not ready", "error": "AI service is not configured"}
        ), 503
    try:
        db_client = get_db()
        db_client.execute("SELECT 1")
        db_client.close()
        return jsonify({"status": "ready"}), 200
    except Exception:
        return jsonify({"status": "not ready", "error": "Database is unavailable"}), 503


@app.route("/auth/register", methods=["POST"])
@app.route("/api/auth/register", methods=["POST"])
@limiter.limit("5 per hour")
def register():
    data, error_response = get_json_payload()
    if error_response:
        return error_response

    full_name, error = validate_text(data, "full_name", 100, required=True)
    if error:
        return jsonify({"error": error}), 400
    email, error = validate_text(data, "email", 254, required=True)
    if error or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return jsonify({"error": "A valid email is required"}), 400
    password = data.get("password")
    if not isinstance(password, str) or len(password) < 12:
        return jsonify({"error": "Password must be at least 12 characters"}), 400

    hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode(
        "utf-8"
    )

    try:
        db_client = get_db()
        db_client.execute(
            "INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)",
            (full_name, email, hashed_pw),
        )
        result = db_client.execute("SELECT id FROM users WHERE email = ?", (email,))
        user_id = result.rows[0][0]
        access_token = create_access_token(identity=str(user_id))
        return jsonify(
            {
                "token": access_token,
                "user": {"id": user_id, "full_name": full_name, "email": email},
            }
        ), 201
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            return jsonify({"error": "Email already exists"}), 409
        return jsonify({"error": str(e)}), 500
    finally:
        if "db_client" in locals() and db_client:
            db_client.close()


@app.route("/auth/login", methods=["POST"])
@app.route("/api/auth/login", methods=["POST"])
@limiter.limit("10 per hour")
def login():
    data, error_response = get_json_payload()
    if error_response:
        return error_response
    email, error = validate_text(data, "email", 254, required=True)
    password = data.get("password")
    if error or not isinstance(password, str) or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        db_client = get_db()
        result = db_client.execute(
            "SELECT id, full_name, email, password FROM users WHERE email = ?", (email,)
        )
        if not result.rows:
            return jsonify({"error": "Invalid email or password"}), 401

        user = result.rows[0]
        user_id, full_name, db_email, hashed_pw = user[0], user[1], user[2], user[3]

        password_match = bcrypt.checkpw(
            password.encode("utf-8"), hashed_pw.encode("utf-8")
        )
        if password_match:
            access_token = create_access_token(identity=str(user_id))
            return jsonify(
                {
                    "token": access_token,
                    "user": {"id": user_id, "full_name": full_name, "email": db_email},
                }
            ), 200
        else:
            return jsonify({"error": "Invalid email or password"}), 401

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if "db_client" in locals() and db_client:
            db_client.close()


@app.route("/auth/me", methods=["GET"])
@app.route("/api/auth/me", methods=["GET"])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    try:
        db_client = get_db()
        result = db_client.execute(
            "SELECT id, full_name, email FROM users WHERE id = ?", (user_id,)
        )
        if result.rows:
            user = result.rows[0]
            return jsonify({"id": user[0], "full_name": user[1], "email": user[2]})
        return jsonify({"error": "User not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if "db_client" in locals() and db_client:
            db_client.close()


# --- Core App Endpoints ---


def build_prompt(
    job_title,
    industry,
    experience,
    skills,
    tone,
    company_name,
    department="",
    location="",
    reporting_to="",
    employment_type="",
    nature_of_job="",
    additional_notes="",
    reference_jds=[],
):

    # Format skills as a clear list
    skill_list = [s.strip() for s in skills.split(",") if s.strip()]
    skills_formatted = "\n".join([f"  - {s}" for s in skill_list])

    # Build reference examples if available
    examples = ""
    if reference_jds:
        examples = """
REFERENCE EXAMPLES — Study these top-rated real Job Descriptions 
from the same industry. Match their quality, structure and depth:

"""
        for i, ref in enumerate(reference_jds, 1):
            examples += f"--- EXAMPLE {i} ---\n{ref['jd_text']}\n\n"

    prompt = f"""You are a senior HR consultant with 15 years of experience.

STRICT RULES — You MUST follow these without exception:
1. The Job Description MUST be specifically for: {job_title}
2. ONLY include these skills — do not add any other skills: 
{skills_formatted}
3. Every responsibility MUST be directly relevant to {job_title} 
   in the {industry} industry
4. Do NOT add skills, tools or responsibilities that are not 
   listed in the required skills above
5. The tone MUST be: {tone}
6. Mention the company as: {company_name if company_name else "the organization"}
7. Experience level MUST match: {experience}
8. Location MUST be: {location if location else "not specified"}
9. Work mode MUST be: {nature_of_job if nature_of_job else "not specified"}
10. Reporting to: {reporting_to if reporting_to else "not specified"}

{examples}

Now write a complete professional Job Description using 
ONLY the information provided above. Do not invent 
additional skills or requirements beyond what is listed.

Job Title: {job_title}
Industry: {industry}
Department: {department if department else "Not specified"}
Company: {company_name if company_name else "Not specified"}
Location: {location if location else "Not specified"}
Work Mode: {nature_of_job if nature_of_job else "Not specified"}
Employment Type: {employment_type if employment_type else "Not specified"}
Experience Required: {experience}
Reporting To: {reporting_to if reporting_to else "Not specified"}

Required Skills (ONLY these — no additions):
{skills_formatted}

Additional Notes: {additional_notes if additional_notes else "None"}
Tone: {tone}

Write the Job Description in EXACTLY these 6 sections:

1. About the Role
   2 to 3 lines about what this role is, why it exists 
   and what the person will achieve.
   Mention work mode ({nature_of_job}) and location 
   ({location}) naturally in this section.

2. Key Responsibilities
   Exactly 8 bullet points.
   Every bullet MUST start with an action verb.
   Every bullet MUST relate directly to {job_title} 
   and ONLY use the skills listed above.
   Do NOT add responsibilities outside the scope 
   of the provided skills.

3. Required Qualifications
   Education and experience requirements that match 
   the {experience} level for a {job_title} role.
   Keep it realistic and specific.

4. Skills and Tools
   List ONLY the skills provided:
{skills_formatted}
   Do not add anything extra.

5. Good to Have
   3 to 5 optional skills that naturally complement 
   the required skills listed above.
   These must be adjacent to the provided skills — 
   not completely new domains.

6. What We Offer
   3 to 4 lines about growth, work culture and benefits.
   Mention work mode ({nature_of_job}) here as well.

FINAL CHECK BEFORE OUTPUTTING:
- Does every responsibility use only the listed skills? Yes/No
- Are there any unlisted skills added? If yes, remove them.
- Is the job title {job_title} mentioned in About the Role? 
  If not, add it.
- Output the JD only — no preamble, no explanation."""

    return prompt


@app.route("/generate", methods=["POST"])
@app.route("/api/generate", methods=["POST"])
@jwt_required()
@limiter.limit("20 per hour")
def generate_jd():
    if not client:
        return jsonify({"error": "AI service not configured"}), 503
    data, error_response = get_json_payload()
    if error_response:
        return error_response

    fields = {
        "job_title": (200, True),
        "industry": (100, False),
        "department": (100, False),
        "experience": (100, False),
        "employment_type": (100, False),
        "location": (200, False),
        "skills": (2000, True),
        "tone": (100, False),
        "company_name": (200, False),
        "nature_of_job": (100, False),
        "reporting_to": (200, False),
        "additional_notes": (5000, False),
    }
    values = {}
    for field, (maximum, required) in fields.items():
        value, error = validate_text(data, field, maximum, required)
        if error:
            return jsonify({"error": error}), 400
        values[field] = value

    job_title = values["job_title"]
    industry = values["industry"] or "IT"
    department = values["department"]
    experience = values["experience"]
    employment_type = values["employment_type"]
    location = values["location"]
    skills = values["skills"]
    tone = values["tone"]
    company_name = values["company_name"]
    nature_of_job = values["nature_of_job"]
    reporting_to = values["reporting_to"]
    additional_notes = values["additional_notes"]

    reference_jds = []
    try:
        db_client = get_db()
        result = db_client.execute(
            "SELECT jd_text FROM reference_jds WHERE industry = ? LIMIT 2", (industry,)
        )
        for row in result.rows:
            reference_jds.append({"jd_text": row[0]})
        db_client.close()
    except Exception as e:
        print("Error fetching references:", e)

    prompt = build_prompt(
        job_title=job_title,
        industry=industry,
        experience=experience,
        skills=skills,
        tone=tone,
        company_name=company_name,
        department=department,
        location=location,
        reporting_to=reporting_to,
        employment_type=employment_type,
        nature_of_job=nature_of_job,
        additional_notes=additional_notes,
        reference_jds=reference_jds,
    )

    try:
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.7,
            max_tokens=1500,
        )
        jd_text = chat_completion.choices[0].message.content
        return jsonify({"jd": jd_text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/save", methods=["POST"])
@app.route("/api/save", methods=["POST"])
@jwt_required()
def save_jd():
    data, error_response = get_json_payload()
    if error_response:
        return error_response
    job_title, error = validate_text(data, "job_title", 200, required=True)
    if error:
        return jsonify({"error": error}), 400
    jd_text, error = validate_text(data, "jd_text", 50000, required=True)
    if error:
        return jsonify({"error": error}), 400
    data["job_title"] = job_title
    data["jd_text"] = jd_text
    user_id = get_jwt_identity()
    try:
        db_client = get_db()
        db_client.execute(
            """INSERT INTO saved_jds (user_id, job_title, industry, company_name, experience, skills, tone, department, location, jd_text)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id,
                data.get("job_title", ""),
                data.get("industry", ""),
                data.get("company_name", ""),
                data.get("experience", ""),
                str(data.get("skills", "")),
                data.get("tone", ""),
                data.get("department", ""),
                data.get("location", ""),
                data.get("jd_text", ""),
            ),
        )

        # Get last insert id
        result = db_client.execute("SELECT last_insert_rowid()")
        last_id = result.rows[0][0]

        return jsonify({"id": last_id, "message": "Saved successfully"}), 201
    except Exception as e:
        print("Save error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        if "db_client" in locals() and db_client:
            db_client.close()


@app.route("/edit", methods=["POST"])
@app.route("/api/edit", methods=["POST"])
@jwt_required()
@limiter.limit("30 per hour")
def edit_jd():
    if not client:
        return jsonify({"error": "AI service not configured"}), 503
    data, error_response = get_json_payload()
    if error_response:
        return error_response
    current_jd, error = validate_text(data, "current_jd", 50000, required=True)
    if error:
        return jsonify({"error": error}), 400
    instruction, error = validate_text(data, "instruction", 1000, required=True)
    if error:
        return jsonify({"error": error}), 400

    prompt = f"""Here is the current Job Description:
{current_jd}

The user wants to make this change: {instruction}

Apply the change and return the complete updated Job Description keeping the same format and sections."""

    try:
        if not client:
            return jsonify({"error": "AI service not configured"}), 500
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.7,
            max_tokens=1500,
        )
        updated_jd = chat_completion.choices[0].message.content
        return jsonify({"jd": updated_jd})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/save/edit", methods=["POST"])
@app.route("/api/save/edit", methods=["POST"])
@jwt_required()
def save_edit():
    data, error_response = get_json_payload()
    if error_response:
        return error_response
    jd_id = data.get("jd_id")
    if not isinstance(jd_id, int) or jd_id <= 0:
        return jsonify({"error": "jd_id must be a positive integer"}), 400
    instruction, error = validate_text(data, "instruction", 1000, required=True)
    if error:
        return jsonify({"error": error}), 400
    updated_jd, error = validate_text(data, "updated_jd", 50000, required=True)
    if error:
        return jsonify({"error": error}), 400

    try:
        db_client = get_db()
        user_id = get_jwt_identity()
        owner = db_client.execute(
            "SELECT id FROM saved_jds WHERE id = ? AND user_id = ?", (jd_id, user_id)
        )
        if not owner.rows:
            return jsonify({"error": "JD not found or unauthorized"}), 404
        db_client.execute(
            "INSERT INTO jd_edits (jd_id, instruction, updated_jd) VALUES (?, ?, ?)",
            (jd_id, instruction, updated_jd),
        )
        db_client.execute(
            "UPDATE saved_jds SET jd_text = ?, is_edited = 1 WHERE id = ?",
            (updated_jd, jd_id),
        )
        return jsonify({"message": "Edit saved successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if "db_client" in locals() and db_client:
            db_client.close()


@app.route("/saved", methods=["GET"])
@app.route("/api/saved", methods=["GET"])
@jwt_required()
def get_saved_jds():
    user_id = get_jwt_identity()
    search = request.args.get("search", "")
    try:
        db_client = get_db()
        query = "SELECT id, job_title, company_name, industry, created_at, jd_text FROM saved_jds WHERE user_id = ?"
        params = [user_id]

        if search:
            query += " AND (job_title LIKE ? OR company_name LIKE ?)"
            params.append(f"%{search}%")
            params.append(f"%{search}%")

        query += " ORDER BY created_at DESC"

        result = db_client.execute(query, params)
        jds = []
        for row in result.rows:
            jds.append(
                {
                    "id": row[0],
                    "job_title": row[1],
                    "company_name": row[2],
                    "industry": row[3],
                    "created_at": row[4],
                    "jd_text": row[5],
                }
            )

        return jsonify(jds)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if "db_client" in locals() and db_client:
            db_client.close()


@app.route("/saved/<int:jd_id>", methods=["DELETE"])
@app.route("/api/saved/<int:jd_id>", methods=["DELETE"])
@jwt_required()
def delete_saved_jd(jd_id):
    user_id = get_jwt_identity()
    try:
        db_client = get_db()
        check = db_client.execute(
            "SELECT id FROM saved_jds WHERE id = ? AND user_id = ?", (jd_id, user_id)
        )
        if not check.rows:
            return jsonify({"error": "JD not found or unauthorized"}), 404

        db_client.execute("DELETE FROM jd_edits WHERE jd_id = ?", (jd_id,))
        db_client.execute("DELETE FROM saved_jds WHERE id = ?", (jd_id,))
        return jsonify({"message": "Deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if "db_client" in locals() and db_client:
            db_client.close()


@app.route("/history", methods=["GET"])
@app.route("/api/history", methods=["GET"])
@jwt_required()
def get_history():
    user_id = get_jwt_identity()
    try:
        db_client = get_db()
        jds_result = db_client.execute(
            "SELECT id, job_title, industry, created_at, jd_text, company_name FROM saved_jds WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        )

        history = []
        for jd in jds_result.rows:
            jd_id = jd[0]
            edits_result = db_client.execute(
                "SELECT instruction, updated_jd, edited_at FROM jd_edits WHERE jd_id = ? ORDER BY edited_at ASC",
                (jd_id,),
            )
            edits = [
                {"instruction": e[0], "updated_jd": e[1], "edited_at": e[2]}
                for e in edits_result.rows
            ]

            history.append(
                {
                    "id": jd_id,
                    "job_title": jd[1],
                    "industry": jd[2],
                    "company_name": jd[5],
                    "created_at": jd[3],
                    "original_jd": jd[4] if not edits else "See first edit",
                    "edits": edits,
                    "edit_count": len(edits),
                }
            )

        return jsonify(history)
    except Exception as e:
        print("History error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        if "db_client" in locals() and db_client:
            db_client.close()


@app.route("/analytics", methods=["GET"])
@app.route("/api/analytics", methods=["GET"])
@jwt_required()
def get_analytics():
    user_id = get_jwt_identity()
    try:
        db_client = get_db()
        r1 = db_client.execute(
            "SELECT COUNT(*) FROM saved_jds WHERE user_id = ?", (user_id,)
        )
        total_jds = r1.rows[0][0]

        r2 = db_client.execute(
            "SELECT industry, COUNT(*) as c FROM saved_jds WHERE user_id = ? AND industry != '' GROUP BY industry ORDER BY c DESC LIMIT 1",
            (user_id,),
        )
        most_used_industry = r2.rows[0][0] if r2.rows else "N/A"

        r3 = db_client.execute(
            "SELECT COUNT(*) FROM jd_edits e JOIN saved_jds s ON e.jd_id = s.id WHERE s.user_id = ?",
            (user_id,),
        )
        total_edits = r3.rows[0][0]

        r4 = db_client.execute(
            "SELECT COUNT(*) FROM saved_jds WHERE user_id = ? AND created_at >= date('now', '-7 days')",
            (user_id,),
        )
        jds_this_week = r4.rows[0][0]

        r5 = db_client.execute(
            "SELECT industry, COUNT(*) as count FROM saved_jds WHERE user_id = ? AND industry != '' GROUP BY industry",
            (user_id,),
        )
        industry_data = [{"industry": r[0], "count": r[1]} for r in r5.rows]

        r6 = db_client.execute(
            "SELECT job_title, COUNT(*) as count, MAX(created_at) as last_generated FROM saved_jds WHERE user_id = ? GROUP BY job_title ORDER BY count DESC LIMIT 5",
            (user_id,),
        )
        top_titles = [
            {"job_title": r[0], "count": r[1], "last_generated": r[2]} for r in r6.rows
        ]

        r7 = db_client.execute(
            "SELECT date(created_at) as date, COUNT(*) as count FROM saved_jds WHERE user_id = ? AND created_at >= date('now', '-30 days') GROUP BY date ORDER BY date ASC",
            (user_id,),
        )
        timeline_data = [{"date": r[0], "count": r[1]} for r in r7.rows]

        return jsonify(
            {
                "stats": {
                    "total_jds": total_jds,
                    "most_used_industry": most_used_industry,
                    "total_edits": total_edits,
                    "jds_this_week": jds_this_week,
                },
                "industry_data": [
                    {"name": d["industry"], "value": d["count"]} for d in industry_data
                ],
                "timeline_data": timeline_data,
                "top_titles": [
                    {
                        "title": t["job_title"],
                        "count": t["count"],
                        "last_generated": t["last_generated"],
                    }
                    for t in top_titles
                ],
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if "db_client" in locals() and db_client:
            db_client.close()


@app.route("/ats-score", methods=["POST"])
@app.route("/api/ats-score", methods=["POST"])
@jwt_required()
@limiter.limit("30 per hour")
def ats_score():
    if not client:
        return jsonify({"error": "AI service not configured"}), 503
    data, error_response = get_json_payload()
    if error_response:
        return error_response
    jd_text, error = validate_text(data, "jd_text", 50000, required=True)
    if error:
        return jsonify({"error": error}), 400
    job_title, error = validate_text(data, "job_title", 200, required=True)
    if error:
        return jsonify({"error": error}), 400
    skills = data.get("skills", [])
    if not isinstance(skills, (list, str)):
        return jsonify({"error": "skills must be a list or text"}), 400
    skills_str = ", ".join(skills) if isinstance(skills, list) else skills
    if len(skills_str) > 2000:
        return jsonify({"error": "skills must be at most 2000 characters"}), 400

    prompt = f"""You are an expert ATS (Applicant Tracking System) analyzer.
Analyze the following job description and provide an ATS score from 0-100.

Job Title: {job_title}
Skills Required: {skills_str}

Job Description:
{jd_text}

Score the JD on these criteria:
1. Keyword density and relevance (30 points)
2. Section structure (About Role, Responsibilities, Qualifications, Skills, Benefits) (25 points)  
3. Action verbs in responsibilities (20 points)
4. Clear job title and requirements (15 points)
5. Measurable outcomes and specifics (10 points)

Respond ONLY with a JSON object in this exact format, no other text:
{{"score": <number 0-100>, "breakdown": {{"keywords": <0-30>, "structure": <0-25>, "action_verbs": <0-20>, "clarity": <0-15>, "specifics": <0-10>}}, "tips": ["<tip1>", "<tip2>", "<tip3>"]}}"""

    try:
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.2,
            max_tokens=300,
        )
        response_text = chat_completion.choices[0].message.content.strip()
        # Extract JSON from response
        import json
        import re

        json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            return jsonify(result)
        else:
            return jsonify({"error": "Could not parse AI response"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=False)
