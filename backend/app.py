# ============================================================
# SIKSHA AI — PRODUCTION BACKEND ENGINE V7
# Gemini Chat • Premium • Files • TTS
# Flask API • Strong CORS • Render Ready
#
# V7 FIXES:
# - Controlled Gemini retry system
# - Disables SDK automatic retry storm
# - Fast model fallback
# - Prevents long worker blocking
# - 503-safe response
# - Always returns a usable JSON response for chat
# - Emergency local fallback responses
# - Preserves memory/history
# - Preserves normal/premium modes
# - Preserves file solving
# - Preserves TTS
# - Removes accidental Siksha AI logo/link/image
# - Strong CORS on success AND error responses
# ============================================================

import os
import io
import mimetypes
import tempfile
import time
import traceback
import re
from pathlib import Path

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv

from google import genai
from google.genai import types


# ============================================================
# ENVIRONMENT
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY missing. Add your Gemini API key to backend/.env"
    )


# ============================================================
# GEMINI CLIENT
#
# IMPORTANT:
# Google GenAI SDK normally performs automatic retries for
# transient errors. We disable that here because Siksha AI
# has its own controlled fallback system.
# ============================================================

try:
    client = genai.Client(
        api_key=GEMINI_API_KEY,
        http_options=types.HttpOptions(
            timeout=30000,
            retry_options=types.HttpRetryOptions(
                attempts=1
            )
        )
    )
except Exception:
    # Compatibility fallback in case an older google-genai
    # package does not expose HttpRetryOptions.
    client = genai.Client(
        api_key=GEMINI_API_KEY
    )


# ============================================================
# MODELS
# ============================================================

CHAT_MODEL = os.getenv(
    "GEMINI_CHAT_MODEL",
    "gemini-3.8-flash"
)

PREMIUM_MODEL = os.getenv(
    "GEMINI_PREMIUM_MODEL",
    "gemini-3.8-flash"
)

FALLBACK_MODELS = [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash"
]

TTS_MODEL = os.getenv(
    "GEMINI_TTS_MODEL",
    "gemini-3.8-flash-tts"
)

TTS_VOICE = os.getenv(
    "GEMINI_TTS_VOICE",
    "Kore"
)


# ============================================================
# CONTROLLED RETRY SETTINGS
# ============================================================

# One attempt per model.
#
# We deliberately do NOT perform:
# 3 attempts × 4 models
#
# This prevents Render workers from being blocked for too long.

MODEL_ATTEMPTS = 1

BETWEEN_MODEL_DELAY = 0.15


# ============================================================
# FLASK
# ============================================================

app = Flask(__name__)

app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024


# ============================================================
# CORS
# ============================================================

ALLOWED_ORIGINS = [
    "https://siksha-ai.onrender.com",

    "http://localhost:5500",
    "http://127.0.0.1:5500",

    "http://localhost:3000",
    "http://127.0.0.1:3000",

    "http://localhost:5173",
    "http://127.0.0.1:5173"
]


CORS(
    app,
    resources={
        r"/api/*": {
            "origins": ALLOWED_ORIGINS,
            "methods": [
                "GET",
                "POST",
                "OPTIONS"
            ],
            "allow_headers": [
                "Content-Type",
                "Authorization"
            ],
            "supports_credentials": False
        }
    }
)


# ============================================================
# UNIVERSAL CORS SAFETY NET
# ============================================================

@app.after_request
def add_cors_headers(response):

    origin = request.headers.get("Origin")

    if origin in ALLOWED_ORIGINS:

        response.headers["Access-Control-Allow-Origin"] = origin

        response.headers["Vary"] = "Origin"

        response.headers["Access-Control-Allow-Methods"] = (
            "GET, POST, OPTIONS"
        )

        response.headers["Access-Control-Allow-Headers"] = (
            "Content-Type, Authorization"
        )

        response.headers["Access-Control-Max-Age"] = "86400"

    return response


# ============================================================
# OPTIONS HANDLER
# ============================================================

@app.route(
    "/api/<path:path>",
    methods=["OPTIONS"]
)
def api_options(path):

    response = jsonify({
        "success": True
    })

    origin = request.headers.get("Origin")

    if origin in ALLOWED_ORIGINS:

        response.headers["Access-Control-Allow-Origin"] = origin

        response.headers["Vary"] = "Origin"

        response.headers["Access-Control-Allow-Methods"] = (
            "GET, POST, OPTIONS"
        )

        response.headers["Access-Control-Allow-Headers"] = (
            "Content-Type, Authorization"
        )

        response.headers["Access-Control-Max-Age"] = "86400"

    return response, 204


# ============================================================
# RESPONSE ERROR HELPER
# ============================================================

def error_response(message, status=500, debug=None):

    payload = {
        "success": False,
        "error": message
    }

    if debug:
        payload["debug"] = str(debug)[:1500]

    return jsonify(payload), status


# ============================================================
# 413 — FILE TOO LARGE
# ============================================================

@app.errorhandler(413)
def request_too_large(error):

    return error_response(
        "Uploaded file is too large. Maximum size is 50 MB.",
        413
    )


# ============================================================
# RESPONSE CLEANER
# ============================================================

def clean_ai_response(text):

    if not isinstance(text, str):
        return ""

    cleaned = text

    # Markdown images containing logo.png
    cleaned = re.sub(
        r'!\[[^\]]*\]\([^)]*logo\.png[^)]*\)',
        '',
        cleaned,
        flags=re.IGNORECASE
    )

    # Markdown links containing logo.png
    cleaned = re.sub(
        r'\[[^\]]*\]\([^)]*logo\.png[^)]*\)',
        '',
        cleaned,
        flags=re.IGNORECASE
    )

    # Raw logo URL
    cleaned = re.sub(
        r'https?://[^\s)\]>"\']*assets/logo\.png[^\s)\]>"\']*',
        '',
        cleaned,
        flags=re.IGNORECASE
    )

    # Any HTML image pointing to logo.png
    cleaned = re.sub(
        r'<img\b[^>]*logo\.png[^>]*>',
        '',
        cleaned,
        flags=re.IGNORECASE
    )

    # Any remaining logo URL/path
    cleaned = re.sub(
        r'[^\s)\]>"\']*assets/logo\.png[^\s)\]>"\']*',
        '',
        cleaned,
        flags=re.IGNORECASE
    )

    # Remove standalone Siksha AI logo markdown
    cleaned = re.sub(
        r'^\s*\[Siksha\s+AI\]\s*$',
        '',
        cleaned,
        flags=re.IGNORECASE | re.MULTILINE
    )

    # Remove excessive blank lines
    cleaned = re.sub(
        r'\n[ \t]*\n[ \t]*\n+',
        '\n\n',
        cleaned
    )

    return cleaned.strip()


# ============================================================
# SYSTEM INSTRUCTIONS
# ============================================================

NORMAL_SYSTEM = """
You are Siksha AI, an Indian education-focused AI assistant.

Your primary purpose is to help students learn concepts clearly.

IMPORTANT OUTPUT RULE:

Never include the Siksha AI logo, logo URL, image URL,
avatar markup, HTML image, Markdown image, or Markdown link
pointing to the Siksha AI logo.

The frontend automatically displays the Siksha AI avatar.

Only provide the educational response.

LANGUAGE:

1. Understand English, Hindi and Hinglish.
2. If the student writes in Hinglish, naturally reply in Hinglish.
3. If the student writes in Hindi, reply in Hindi.
4. If the student writes in English, reply in English.
5. Do not unnecessarily use difficult English.

TEACHING STYLE:

1. Explain concepts clearly.
2. Explain step-by-step when useful.
3. Keep school explanations age-appropriate.
4. For ICSE questions, prefer ICSE-style explanations.
5. Explain WHY, not only WHAT.
6. Do not unnecessarily repeat the question.
7. Do not start every response with "Sure!" or "Of course!".
8. Be friendly, intelligent and concise.
9. Never pretend to know something you do not know.
10. If a question is ambiguous, make the most reasonable interpretation.

MATHEMATICS AND PHYSICS:

- Show formulas clearly.
- Substitute values step-by-step.
- Show units.
- Give the final answer clearly.
- Use clean mathematical notation.

CHEMISTRY:

- Explain reactions.
- Explain why reactions occur.
- Include equations when useful.

BIOLOGY:

- Use simple definitions.
- Explain processes in logical order.
- Include important keywords.

MATH FORMAT:

Use LaTeX-style notation where useful.

For important final answers, use:

\\boxed{answer}

Do not use broken markdown around formulas.

You are Siksha AI, not ChatGPT.
"""


PREMIUM_SYSTEM = """
You are Siksha AI Premium, an advanced educational AI tutor.

IMPORTANT OUTPUT RULE:

Never include the Siksha AI logo, logo URL, image URL,
avatar markup, HTML image, Markdown image, or Markdown link
pointing to the Siksha AI logo.

The frontend automatically displays the Siksha AI avatar.

Only provide the educational response.

You help students understand difficult concepts deeply
while remaining student-friendly.

LANGUAGE:

- Understand English, Hindi and Hinglish.
- Match the student's language naturally.
- If the student uses Hinglish, respond naturally in Hinglish.

TEACHING:

- Explain from first principles.
- Explain WHY, not just WHAT.
- Connect school concepts with higher-level concepts when useful.
- Provide step-by-step derivations.
- Identify common mistakes.
- Give alternative methods when useful.
- Adapt to the student's apparent level.
- Use clean mathematical notation.
- Structure longer answers with headings.
- Give examples where useful.

For academic questions, prefer:

1. Concept
2. Explanation
3. Formula / principle
4. Worked example
5. Common mistake
6. Final takeaway

Do not unnecessarily make answers extremely long.

Use LaTeX-style notation for mathematics.

Important equations may use:

\\boxed{...}

You are Siksha AI Premium, not ChatGPT.
"""


# ============================================================
# SAFE EXCEPTION TEXT
# ============================================================

def safe_exception_text(exc):

    text = str(exc)

    if not text:
        text = type(exc).__name__

    if GEMINI_API_KEY:
        text = text.replace(
            GEMINI_API_KEY,
            "[REDACTED]"
        )

    return text[:1500]


# ============================================================
# TEMPORARY GEMINI ERROR DETECTION
# ============================================================

def is_temporary_gemini_error(exc):

    text = safe_exception_text(exc).upper()

    temporary_codes = (
        "408",
        "429",
        "500",
        "502",
        "503",
        "504",
        "UNAVAILABLE",
        "RESOURCE_EXHAUSTED",
        "INTERNAL",
        "DEADLINE",
        "TIMEOUT"
    )

    return any(
        code in text
        for code in temporary_codes
    )


# ============================================================
# MODEL LIST
# ============================================================

def model_list(primary_model):

    models = []

    for model in [
        primary_model,
        *FALLBACK_MODELS
    ]:

        if model and model not in models:
            models.append(model)

    return models


# ============================================================
# CLEAN CHAT HISTORY
# ============================================================

def clean_history(history):

    if not isinstance(history, list):
        return []

    cleaned = []

    for item in history[-30:]:

        if not isinstance(item, dict):
            continue

        role = str(
            item.get("role", "")
        ).lower().strip()

        text = item.get("content")

        if not isinstance(text, str):
            text = item.get("text", "")

        if not isinstance(text, str):
            continue

        text = text.strip()

        if not text:
            continue

        if role in (
            "assistant",
            "ai",
            "model"
        ):
            gemini_role = "model"

        elif role == "user":
            gemini_role = "user"

        else:
            continue

        cleaned.append({
            "role": gemini_role,
            "parts": [
                {
                    "text": text
                }
            ]
        })

    return cleaned


# ============================================================
# GET TEXT FROM GEMINI RESPONSE
# ============================================================

def get_response_text(response):

    try:

        text = response.text

        if isinstance(text, str) and text.strip():

            return clean_ai_response(text)

    except Exception:
        pass

    return ""


# ============================================================
# LOCAL EMERGENCY RESPONSE ENGINE
#
# This is NOT intended to replace Gemini.
#
# It exists so the website can still visibly answer instead
# of returning a server crash when Gemini is temporarily down.
# ============================================================

def emergency_local_response(message):

    text = message.lower().strip()

    # --------------------------------------------------------
    # CREATOR
    # --------------------------------------------------------

    if (
        "who created you" in text
        or "who made you" in text
        or "who built you" in text
        or "creator" in text
    ):
        return (
            "I was created by ANSH RAJ."
        )

    # --------------------------------------------------------
    # GREETINGS
    # --------------------------------------------------------

    if text in (
        "hi",
        "hello",
        "hey",
        "hii",
        "hiii",
        "namaste",
        "good morning",
        "good afternoon",
        "good evening"
    ):
        return (
            "Hey! 👋 I’m Siksha AI.\n\n"
            "Ask me anything you want to learn — "
            "Physics, Chemistry, Biology, Maths, "
            "History, Geography or general questions."
        )

    # --------------------------------------------------------
    # NEWTON THIRD LAW
    # --------------------------------------------------------

    if (
        "newton" in text
        and "third law" in text
    ):
        return (
            "**Newton's Third Law of Motion** states that "
            "for every action, there is an equal and opposite reaction.\n\n"
            "For example, when you push a wall, you exert a force on the wall. "
            "The wall exerts an equal force back on you in the opposite direction.\n\n"
            "**Important:** The two forces act on two different objects."
        )

    # --------------------------------------------------------
    # NEWTON FIRST LAW
    # --------------------------------------------------------

    if (
        "newton" in text
        and "first law" in text
    ):
        return (
            "**Newton's First Law of Motion** states that an object "
            "remains at rest or continues moving with uniform velocity "
            "in a straight line unless an external unbalanced force acts on it.\n\n"
            "This is also called the **law of inertia**."
        )

    # --------------------------------------------------------
    # NEWTON SECOND LAW
    # --------------------------------------------------------

    if (
        "newton" in text
        and "second law" in text
    ):
        return (
            "**Newton's Second Law of Motion** states that the rate of "
            "change of momentum is proportional to the applied force.\n\n"
            "For constant mass:\n\n"
            "**F = ma**\n\n"
            "where F is force, m is mass and a is acceleration."
        )

    # --------------------------------------------------------
    # FORCE
    # --------------------------------------------------------

    if (
        "what is force" in text
        or text == "force"
        or "define force" in text
    ):
        return (
            "**Force** is a push or pull that can change the state "
            "of motion, direction or shape of an object.\n\n"
            "SI unit: **newton (N)**."
        )

    # --------------------------------------------------------
    # GRAVITY
    # --------------------------------------------------------

    if (
        "what is gravity" in text
        or "define gravity" in text
    ):
        return (
            "**Gravity** is the force of attraction between objects "
            "having mass.\n\n"
            "Near Earth's surface, gravity pulls objects toward the "
            "centre of Earth."
        )

    # --------------------------------------------------------
    # SPEED
    # --------------------------------------------------------

    if (
        "what is speed" in text
        or "define speed" in text
    ):
        return (
            "**Speed** is the distance travelled by an object per unit time.\n\n"
            "**Speed = Distance / Time**\n\n"
            "SI unit: **m/s**."
        )

    # --------------------------------------------------------
    # VELOCITY
    # --------------------------------------------------------

    if (
        "what is velocity" in text
        or "define velocity" in text
    ):
        return (
            "**Velocity** is the displacement of an object per unit time.\n\n"
            "Velocity is a vector quantity, so it has both magnitude and direction."
        )

    # --------------------------------------------------------
    # WORK
    # --------------------------------------------------------

    if (
        "what is work" in text
        or "define work" in text
    ):
        return (
            "In physics, **work is done when a force produces displacement "
            "in the direction of the force**.\n\n"
            "**W = F × s**\n\n"
            "SI unit: **joule (J)**."
        )

    # --------------------------------------------------------
    # ENERGY
    # --------------------------------------------------------

    if (
        "what is energy" in text
        or "define energy" in text
    ):
        return (
            "**Energy** is the capacity to do work.\n\n"
            "Its SI unit is the **joule (J)**.\n\n"
            "Common forms include kinetic energy and potential energy."
        )

    # --------------------------------------------------------
    # CELL
    # --------------------------------------------------------

    if (
        "what is cell" in text
        or "define cell" in text
    ):
        return (
            "A **cell** is the basic structural and functional unit "
            "of life.\n\n"
            "All living organisms are made up of one or more cells."
        )

    # --------------------------------------------------------
    # PHOTOSYNTHESIS
    # --------------------------------------------------------

    if "photosynthesis" in text:
        return (
            "**Photosynthesis** is the process by which green plants "
            "prepare food using carbon dioxide and water in the presence "
            "of sunlight and chlorophyll.\n\n"
            "The main product is glucose, and oxygen is released."
        )

    # --------------------------------------------------------
    # PH / ACIDS
    # --------------------------------------------------------

    if (
        "what is acid" in text
        or "define acid" in text
    ):
        return (
            "An **acid** is a substance that produces hydrogen ions "
            "(H⁺) in aqueous solution.\n\n"
            "For example, hydrochloric acid is HCl."
        )

    # --------------------------------------------------------
    # PRIME NUMBERS
    # --------------------------------------------------------

    if "prime number" in text:
        return (
            "A **prime number** is a natural number greater than 1 "
            "having exactly two positive factors: 1 and itself.\n\n"
            "Examples: **2, 3, 5, 7, 11, 13**."
        )

    # --------------------------------------------------------
    # GENERIC EMERGENCY RESPONSE
    # --------------------------------------------------------

    return (
        "I'm temporarily running in **backup mode** because the "
        "main AI service is busy right now.\n\n"
        "Your question was received successfully, but I cannot "
        "generate a full AI answer for this particular question "
        "until the AI service becomes available again.\n\n"
        "Please try the same question again in a few seconds."
    )


# ============================================================
# GEMINI CHAT — CONTROLLED FALLBACK
# ============================================================

def generate_chat_response(
    primary_model,
    contents,
    system_instruction
):

    models = model_list(primary_model)

    last_exception = None

    for index, model_name in enumerate(models):

        try:

            print("")
            print("-" * 60)
            print("Gemini controlled attempt")
            print("Model :", model_name)
            print("Attempt: 1")
            print("-" * 60)

            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction
                )
            )

            return response, model_name

        except Exception as exc:

            last_exception = exc

            print("")
            print("[Gemini error]")
            print("Model :", model_name)
            print("Error :", safe_exception_text(exc))

            if not is_temporary_gemini_error(exc):

                raise

            if index < len(models) - 1:

                print(
                    "Switching immediately to fallback model..."
                )

                time.sleep(BETWEEN_MODEL_DELAY)

                continue

    if last_exception:
        raise last_exception

    raise RuntimeError(
        "No Gemini model was available."
    )


# ============================================================
# FILE GEMINI GENERATION — CONTROLLED FALLBACK
# ============================================================

def generate_file_response(
    primary_model,
    contents,
    system_instruction
):

    models = model_list(primary_model)

    last_exception = None

    for index, model_name in enumerate(models):

        try:

            print("")
            print("-" * 60)
            print("Gemini FILE controlled attempt")
            print("Model :", model_name)
            print("Attempt: 1")
            print("-" * 60)

            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction
                )
            )

            return response, model_name

        except Exception as exc:

            last_exception = exc

            print("")
            print("[Gemini FILE error]")
            print("Model :", model_name)
            print("Error :", safe_exception_text(exc))

            if not is_temporary_gemini_error(exc):

                raise

            if index < len(models) - 1:

                print(
                    "Switching file request to fallback model..."
                )

                time.sleep(BETWEEN_MODEL_DELAY)

                continue

    if last_exception:
        raise last_exception

    raise RuntimeError(
        "No Gemini model was available for file processing."
    )


# ============================================================
# CHAT API
# ============================================================

@app.post("/api/chat")
def chat():

    try:

        data = request.get_json(
            silent=True
        )

        if not data:

            return error_response(
                "Request body is missing.",
                400
            )

        message = data.get(
            "message",
            ""
        )

        mode = str(
            data.get(
                "mode",
                "normal"
            )
        ).lower().strip()

        history = data.get(
            "history",
            []
        )

        if not isinstance(message, str):

            return error_response(
                "Message must be text.",
                400
            )

        message = message.strip()

        if not message:

            return error_response(
                "Message cannot be empty.",
                400
            )

        if len(message) > 20000:

            return error_response(
                "Message is too long.",
                400
            )

        # ----------------------------------------------------
        # FIXED CREATOR RESPONSE
        # ----------------------------------------------------

        creator_text = message.lower()

        if (
            "who created you" in creator_text
            or "who made you" in creator_text
            or "who built you" in creator_text
        ):

            return jsonify({
                "success": True,
                "answer": "I was created by ANSH RAJ.",
                "mode": mode if mode in ("normal", "premium") else "normal",
                "model": "local-creator-response"
            })

        # ----------------------------------------------------
        # MODE
        # ----------------------------------------------------

        if mode == "premium":

            primary_model = PREMIUM_MODEL
            system_instruction = PREMIUM_SYSTEM

        else:

            mode = "normal"

            primary_model = CHAT_MODEL
            system_instruction = NORMAL_SYSTEM

        # ----------------------------------------------------
        # HISTORY
        # ----------------------------------------------------

        cleaned_history = clean_history(
            history
        )

        current_message = {
            "role": "user",
            "parts": [
                {
                    "text": message
                }
            ]
        }

        contents = (
            cleaned_history
            + [current_message]
        )

        print("")
        print("=" * 60)
        print("SIKSHA AI CHAT REQUEST")
        print("=" * 60)
        print("Mode      :", mode)
        print("Primary   :", primary_model)
        print("Fallbacks :", ", ".join(FALLBACK_MODELS))
        print("History   :", len(cleaned_history))
        print("Message   :", message[:200])
        print("=" * 60)

        # ----------------------------------------------------
        # GEMINI
        # ----------------------------------------------------

        try:

            response, model_used = generate_chat_response(
                primary_model=primary_model,
                contents=contents,
                system_instruction=system_instruction
            )

            answer = get_response_text(
                response
            )

            if answer:

                print(
                    "[Siksha AI] Response generated successfully."
                )

                print(
                    "[Siksha AI] Model used:",
                    model_used
                )

                return jsonify({
                    "success": True,
                    "answer": answer,
                    "mode": mode,
                    "model": model_used
                })

            raise RuntimeError(
                "Gemini returned an empty response."
            )

        except Exception as gemini_exc:

            error_text = safe_exception_text(
                gemini_exc
            )

            print("")
            print("[Siksha AI] Gemini unavailable.")
            print(error_text)

            # ------------------------------------------------
            # EMERGENCY LOCAL RESPONSE
            # ------------------------------------------------

            fallback_answer = emergency_local_response(
                message
            )

            return jsonify({
                "success": True,
                "answer": fallback_answer,
                "mode": mode,
                "model": "local-emergency-fallback",
                "fallback": True
            })

    except Exception as exc:

        error_text = safe_exception_text(
            exc
        )

        print("")
        print("=" * 60)
        print("SIKSHA AI CHAT ERROR")
        print("=" * 60)
        print(error_text)
        print("=" * 60)

        traceback.print_exc()

        # Even an unexpected backend error gets a valid
        # response rather than crashing the frontend.

        try:

            message = ""

            data = request.get_json(
                silent=True
            )

            if isinstance(data, dict):

                message = str(
                    data.get(
                        "message",
                        ""
                    )
                )

            fallback_answer = emergency_local_response(
                message
            )

        except Exception:

            fallback_answer = (
                "Siksha AI received your question, but the "
                "AI service is temporarily busy. Please try again."
            )

        return jsonify({
            "success": True,
            "answer": fallback_answer,
            "mode": "normal",
            "model": "local-emergency-fallback",
            "fallback": True
        })


# ============================================================
# FILE SOLVER
# ============================================================

@app.post("/api/solve-file")
def solve_file():

    temp_path = None

    try:

        uploaded = request.files.get(
            "file"
        )

        question = request.form.get(
            "question",
            "Analyze this file and explain the important content clearly."
        )

        mode = request.form.get(
            "mode",
            "normal"
        ).lower().strip()

        if uploaded is None:

            return error_response(
                "No file was uploaded.",
                400
            )

        if not uploaded.filename:

            return error_response(
                "The uploaded file has no filename.",
                400
            )

        filename = uploaded.filename

        extension = Path(
            filename
        ).suffix.lower()

        allowed_extensions = {
            ".pdf",
            ".txt",
            ".md",
            ".csv",
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".py",
            ".js",
            ".html",
            ".css",
            ".json"
        }

        if extension not in allowed_extensions:

            return error_response(
                "This file type is not supported.",
                400
            )

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=extension
        ) as temp_file:

            uploaded.save(
                temp_file
            )

            temp_path = temp_file.name

        mime_type = (
            uploaded.mimetype
            or mimetypes.guess_type(
                filename
            )[0]
            or "application/octet-stream"
        )

        print("")
        print("=" * 60)
        print("SIKSHA AI FILE REQUEST")
        print("=" * 60)
        print("Filename :", filename)
        print("MIME     :", mime_type)
        print("Mode     :", mode)
        print("=" * 60)

        # ----------------------------------------------------
        # UPLOAD TO GEMINI
        # ----------------------------------------------------

        gemini_file = client.files.upload(
            file=temp_path
        )

        if mode == "premium":

            file_instruction = f"""
You are Siksha AI Premium.

Analyze the uploaded file carefully.

Student request:

{question}

File name:

{filename}

IMPORTANT:

Do not include any Siksha AI logo, logo URL, image URL,
avatar markup, Markdown image or Markdown logo link.

Give a detailed but student-friendly explanation.

If the file contains:

- questions → solve them
- notes → explain and summarize them
- mathematics → show complete calculations
- physics → show formulas, substitutions and units
- chemistry → explain equations and concepts
- biology → explain processes and definitions
- code → explain and identify errors
- an image → read and analyze visible content

Use Hinglish if the student asked in Hinglish.
"""

            file_system = PREMIUM_SYSTEM

        else:

            file_instruction = f"""
You are Siksha AI.

Analyze the uploaded file.

Student request:

{question}

File name:

{filename}

IMPORTANT:

Do not include any Siksha AI logo, logo URL, image URL,
avatar markup, Markdown image or Markdown logo link.

Explain the answer clearly and step-by-step.

If there are questions in the file, solve them.

If there are notes, explain them.

If there are formulas, preserve them correctly.

Use English, Hindi or Hinglish according to the student's language.
"""

            file_system = NORMAL_SYSTEM

        primary_model = (
            PREMIUM_MODEL
            if mode == "premium"
            else CHAT_MODEL
        )

        try:

            response, model_used = generate_file_response(
                primary_model=primary_model,
                contents=[
                    gemini_file,
                    file_instruction
                ],
                system_instruction=file_system
            )

            answer = get_response_text(
                response
            )

            if not answer:

                raise RuntimeError(
                    "Gemini returned an empty file response."
                )

            return jsonify({
                "success": True,
                "answer": answer,
                "filename": filename,
                "mode": mode,
                "model": model_used
            })

        except Exception as gemini_exc:

            print("")
            print(
                "[Siksha AI] Gemini file processing unavailable."
            )

            print(
                safe_exception_text(
                    gemini_exc
                )
            )

            # IMPORTANT:
            # We still return success=True so the frontend
            # receives a clean response rather than a CORS-
            # looking 500 error.

            return jsonify({
                "success": True,
                "answer": (
                    f"I received **{filename}**, but the AI file "
                    "analysis service is temporarily busy.\n\n"
                    "Please try the file again in a few seconds."
                ),
                "filename": filename,
                "mode": mode,
                "model": "local-file-fallback",
                "fallback": True
            })

    except Exception as exc:

        error_text = safe_exception_text(
            exc
        )

        print("")
        print("=" * 60)
        print("SIKSHA AI FILE ERROR")
        print("=" * 60)
        print(error_text)
        print("=" * 60)

        traceback.print_exc()

        return jsonify({
            "success": True,
            "answer": (
                "I received your file, but I could not process "
                "it right now. Please try again."
            ),
            "mode": "normal",
            "model": "local-file-fallback",
            "fallback": True
        })

    finally:

        if temp_path:

            try:

                os.remove(
                    temp_path
                )

            except Exception:

                pass


# ============================================================
# TEXT TO SPEECH
# ============================================================

@app.post("/api/tts")
def text_to_speech():

    try:

        data = request.get_json(
            silent=True
        )

        if not data:

            return error_response(
                "Request body is missing.",
                400
            )

        text = data.get(
            "text",
            ""
        )

        if not isinstance(text, str):

            return error_response(
                "Text must be a string.",
                400
            )

        text = text.strip()

        if not text:

            return error_response(
                "No text supplied for speech.",
                400
            )

        if len(text) > 12000:

            text = text[:12000]

        # Remove accidental logo references
        text = clean_ai_response(
            text
        )

        tts_prompt = f"""
Read the following educational response aloud.

Voice style:

- warm
- intelligent
- friendly
- natural Indian English/Hinglish feel
- female voice
- clear pronunciation
- moderate speaking speed
- suitable for a student learning with an AI tutor

Do not add extra words.

Do not summarize.

Read only the provided content.

TEXT:

{text}
"""

        response = client.models.generate_content(

            model=TTS_MODEL,

            contents=tts_prompt,

            config=types.GenerateContentConfig(

                response_modalities=[
                    "AUDIO"
                ],

                speech_config=types.SpeechConfig(

                    voice_config=types.VoiceConfig(

                        prebuilt_voice_config=(
                            types.PrebuiltVoiceConfig(
                                voice_name=TTS_VOICE
                            )
                        )
                    )
                )
            )
        )

        audio_bytes = None

        mime_type = "audio/wav"

        try:

            candidates = (
                response.candidates
                or []
            )

            for candidate in candidates:

                content = candidate.content

                if not content:
                    continue

                parts = (
                    content.parts
                    or []
                )

                for part in parts:

                    inline_data = getattr(
                        part,
                        "inline_data",
                        None
                    )

                    if inline_data:

                        audio_bytes = (
                            inline_data.data
                        )

                        if getattr(
                            inline_data,
                            "mime_type",
                            None
                        ):

                            mime_type = (
                                inline_data.mime_type
                            )

                        break

                if audio_bytes:
                    break

        except Exception:

            audio_bytes = None

        if not audio_bytes:

            return error_response(
                "Gemini TTS did not return audio.",
                502
            )

        audio_stream = io.BytesIO(
            audio_bytes
        )

        audio_stream.seek(0)

        return send_file(
            audio_stream,
            mimetype=mime_type,
            as_attachment=False,
            download_name="siksha-ai-voice.wav"
        )

    except Exception as exc:

        error_text = safe_exception_text(
            exc
        )

        print("")
        print("=" * 60)
        print("SIKSHA AI TTS ERROR")
        print("=" * 60)
        print(error_text)
        print("=" * 60)

        traceback.print_exc()

        # Return JSON so frontend can gracefully fall back
        # to browser speech synthesis.

        return error_response(
            "Siksha AI voice service is temporarily unavailable. "
            "Please use normal text mode or try voice again shortly.",
            503,
            debug=error_text
        )


# ============================================================
# HEALTH / HOME
# ============================================================

@app.get("/")
def home():

    return jsonify({
        "name": "Siksha AI",
        "status": "online",
        "message": "Siksha AI backend is running.",
        "cors": "enabled",
        "engine": "V7"
    })


@app.get("/api/health")
def health():

    return jsonify({
        "status": "ok",
        "service": "Siksha AI",
        "engine": "V7",
        "chat_model": CHAT_MODEL,
        "premium_model": PREMIUM_MODEL,
        "fallback_models": FALLBACK_MODELS,
        "tts_model": TTS_MODEL,
        "tts_voice": TTS_VOICE,
        "cors": "enabled",
        "controlled_retries": True
    })


# ============================================================
# GLOBAL EXCEPTION HANDLER
#
# Ensures unexpected Flask errors still pass through the
# normal JSON/CORS response pipeline.
# ============================================================

@app.errorhandler(Exception)
def global_exception_handler(error):

    print("")
    print("=" * 60)
    print("GLOBAL SIKSHA AI ERROR")
    print("=" * 60)

    traceback.print_exc()

    print("=" * 60)

    return error_response(
        "Siksha AI encountered a temporary server issue. "
        "Please try again.",
        500
    )


# ============================================================
# SERVER
# ============================================================

if __name__ == "__main__":

    port = int(
        os.environ.get(
            "PORT",
            5000
        )
    )

    print("")
    print("=" * 60)
    print("              SIKSHA AI BACKEND V7")
    print("=" * 60)

    print(
        f"Chat Model    : {CHAT_MODEL}"
    )

    print(
        f"Premium Model : {PREMIUM_MODEL}"
    )

    print(
        "Fallbacks     : "
        + ", ".join(FALLBACK_MODELS)
    )

    print(
        f"TTS Model     : {TTS_MODEL}"
    )

    print(
        f"TTS Voice     : {TTS_VOICE}"
    )

    print(
        "CORS          : ENABLED"
    )

    print(
        "Controlled SDK retries : ENABLED"
    )

    print(
        "Local emergency fallback : ENABLED"
    )

    print(
        f"Port          : {port}"
    )

    print("=" * 60)
    print("")

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )