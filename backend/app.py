# ============================================================
# SIKSHA AI — PRODUCTION BACKEND ENGINE
# Gemini Chat • Premium • Files • TTS
# Flask API • CORS • Render Ready
# ============================================================

import os
import io
import mimetypes
import tempfile
import traceback
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
# ============================================================

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

TTS_MODEL = os.getenv(
    "GEMINI_TTS_MODEL",
    "gemini-3.8-flash-tts"
)

TTS_VOICE = os.getenv(
    "GEMINI_TTS_VOICE",
    "Kore"
)


# ============================================================
# FLASK
# ============================================================

app = Flask(__name__)

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": "*"
        }
    }
)

app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024


# ============================================================
# SYSTEM INSTRUCTIONS
# ============================================================

NORMAL_SYSTEM = """
You are Siksha AI, a premium Indian education-focused AI assistant.

Your primary purpose is to help students learn concepts clearly.

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

Example:

\\[
d=\\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}
\\]

For important final answers, use:

\\boxed{answer}

Do not use broken markdown around formulas.

You are Siksha AI, not ChatGPT.
"""


PREMIUM_SYSTEM = """
You are Siksha AI Premium, an advanced educational AI tutor.

You help students understand difficult concepts deeply while remaining student-friendly.

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
# HEALTH
# ============================================================

@app.get("/")
def home():

    return jsonify({
        "name": "Siksha AI",
        "status": "online",
        "message": "Siksha AI backend is running."
    })


@app.get("/api/health")
def health():

    return jsonify({
        "status": "ok",
        "service": "Siksha AI",
        "chat_model": CHAT_MODEL,
        "premium_model": PREMIUM_MODEL,
        "tts_model": TTS_MODEL
    })


# ============================================================
# HELPERS
# ============================================================

def clean_history(history):
    """
    Converts frontend history into Gemini-compatible
    conversation contents.

    Supports BOTH:
        { role: "user", content: "..." }
    and:
        { role: "user", text: "..." }
    """

    if not isinstance(history, list):
        return []

    cleaned = []

    for item in history[-30:]:

        if not isinstance(item, dict):
            continue

        role = str(
            item.get("role", "")
        ).lower().strip()

        # ----------------------------------------------------
        # SUPPORT BOTH content AND text
        # ----------------------------------------------------

        text = item.get("content")

        if not isinstance(text, str):
            text = item.get("text", "")

        if not isinstance(text, str):
            continue

        text = text.strip()

        if not text:
            continue

        # ----------------------------------------------------
        # NORMALIZE ROLE
        # ----------------------------------------------------

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


def get_response_text(response):

    try:

        text = response.text

        if isinstance(text, str) and text.strip():
            return text.strip()

    except Exception:
        pass

    return ""


def error_response(message, status=500, debug=None):

    payload = {
        "success": False,
        "error": message
    }

    # Safe diagnostic information.
    # Does NOT expose the API key.
    if debug:
        payload["debug"] = str(debug)[:1200]

    return jsonify(payload), status


def safe_exception_text(exc):

    """
    Convert an exception into useful diagnostic text
    without exposing environment secrets.
    """

    text = str(exc)

    if not text:
        text = type(exc).__name__

    # Never accidentally expose API key.
    if GEMINI_API_KEY:
        text = text.replace(
            GEMINI_API_KEY,
            "[REDACTED]"
        )

    return text[:1200]


# ============================================================
# CHAT API
# ============================================================

@app.post("/api/chat")
def chat():

    try:

        # ----------------------------------------------------
        # REQUEST
        # ----------------------------------------------------

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


        # ----------------------------------------------------
        # VALIDATE MESSAGE
        # ----------------------------------------------------

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
        # SELECT MODE
        # ----------------------------------------------------

        if mode == "premium":

            model_name = PREMIUM_MODEL

            system_instruction = PREMIUM_SYSTEM

        else:

            mode = "normal"

            model_name = CHAT_MODEL

            system_instruction = NORMAL_SYSTEM


        # ----------------------------------------------------
        # CLEAN HISTORY
        # ----------------------------------------------------

        cleaned_history = clean_history(
            history
        )


        # ----------------------------------------------------
        # CURRENT MESSAGE
        # ----------------------------------------------------

        current_message = {
            "role": "user",
            "parts": [
                {
                    "text": message
                }
            ]
        }


        # ----------------------------------------------------
        # BUILD CONTENTS
        # ----------------------------------------------------

        contents = (
            cleaned_history
            + [current_message]
        )


        # ----------------------------------------------------
        # GEMINI REQUEST
        # ----------------------------------------------------

        print("")
        print("=" * 60)
        print("SIKSHA AI CHAT REQUEST")
        print("=" * 60)
        print("Mode       :", mode)
        print("Model      :", model_name)
        print("History    :", len(cleaned_history))
        print("Message    :", message[:200])
        print("=" * 60)


        response = client.models.generate_content(

            model=model_name,

            contents=contents,

            config=types.GenerateContentConfig(

                system_instruction=system_instruction,

                temperature=0.7
            )
        )


        # ----------------------------------------------------
        # EXTRACT ANSWER
        # ----------------------------------------------------

        answer = get_response_text(
            response
        )


        if not answer:

            print(
                "[Siksha AI] Empty Gemini response."
            )

            return error_response(
                "Siksha AI did not return a text response.",
                502
            )


        print(
            "[Siksha AI] Response generated successfully."
        )


        return jsonify({

            "success": True,

            "answer": answer,

            "mode": mode,

            "model": model_name
        })


    except Exception as exc:

        print("")
        print("=" * 60)
        print("SIKSHA AI CHAT ERROR")
        print("=" * 60)
        print(
            safe_exception_text(exc)
        )
        print("=" * 60)

        traceback.print_exc()

        return error_response(

            "Siksha AI could not process your request right now.",

            500,

            debug=safe_exception_text(exc)
        )


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


        # ----------------------------------------------------
        # VALIDATION
        # ----------------------------------------------------

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


        # ----------------------------------------------------
        # TEMP FILE
        # ----------------------------------------------------

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=extension
        ) as temp_file:

            uploaded.save(
                temp_file
            )

            temp_path = temp_file.name


        # ----------------------------------------------------
        # MIME
        # ----------------------------------------------------

        mime_type = (

            uploaded.mimetype

            or mimetypes.guess_type(
                filename
            )[0]

            or "application/octet-stream"
        )


        # ----------------------------------------------------
        # UPLOAD TO GEMINI
        # ----------------------------------------------------

        gemini_file = client.files.upload(
            file=temp_path
        )


        # ----------------------------------------------------
        # PROMPT
        # ----------------------------------------------------

        if mode == "premium":

            file_instruction = f"""
You are Siksha AI Premium.

Analyze the uploaded file carefully.

Student request:

{question}

File name:

{filename}

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

        else:

            file_instruction = f"""
You are Siksha AI.

Analyze the uploaded file.

Student request:

{question}

File name:

{filename}

Explain the answer clearly and step-by-step.

If there are questions in the file, solve them.

If there are notes, explain them.

If there are formulas, preserve them correctly.

Use English, Hindi or Hinglish according to the student's language.
"""


        # ----------------------------------------------------
        # GENERATE
        # ----------------------------------------------------

        response = client.models.generate_content(

            model=(
                PREMIUM_MODEL
                if mode == "premium"
                else CHAT_MODEL
            ),

            contents=[
                gemini_file,
                file_instruction
            ],

            config=types.GenerateContentConfig(

                system_instruction=(
                    PREMIUM_SYSTEM
                    if mode == "premium"
                    else NORMAL_SYSTEM
                ),

                temperature=0.5
            )
        )


        answer = get_response_text(
            response
        )


        if not answer:

            return error_response(
                "Siksha AI could not understand the uploaded file.",
                502
            )


        return jsonify({

            "success": True,

            "answer": answer,

            "filename": filename,

            "mode": mode
        })


    except Exception as exc:

        print("")
        print("=" * 60)
        print("SIKSHA AI FILE ERROR")
        print("=" * 60)
        print(
            safe_exception_text(exc)
        )
        print("=" * 60)

        traceback.print_exc()

        return error_response(

            "Siksha AI could not process this file.",

            500,

            debug=safe_exception_text(exc)
        )


    finally:

        if temp_path:

            try:
                os.remove(temp_path)
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


        # ----------------------------------------------------
        # TTS PROMPT
        # ----------------------------------------------------

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


        # ----------------------------------------------------
        # GEMINI TTS
        # ----------------------------------------------------

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


        # ----------------------------------------------------
        # AUDIO
        # ----------------------------------------------------

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


        # ----------------------------------------------------
        # RETURN AUDIO
        # ----------------------------------------------------

        audio_stream = io.BytesIO(
            audio_bytes
        )

        audio_stream.seek(0)


        return send_file(

            audio_stream,

            mimetype=mime_type,

            as_attachment=False,

            download_name=(
                "siksha-ai-voice.wav"
            )
        )


    except Exception as exc:

        print("")
        print("=" * 60)
        print("SIKSHA AI TTS ERROR")
        print("=" * 60)
        print(
            safe_exception_text(exc)
        )
        print("=" * 60)

        traceback.print_exc()

        return error_response(

            "Siksha AI voice generation failed.",

            500,

            debug=safe_exception_text(exc)
        )


# ============================================================
# SERVER
# ============================================================

if __name__ == "__main__":

    print("")
    print("=" * 60)
    print("              SIKSHA AI BACKEND")
    print("=" * 60)
    print(
        f"Chat Model    : {CHAT_MODEL}"
    )
    print(
        f"Premium Model : {PREMIUM_MODEL}"
    )
    print(
        f"TTS Model     : {TTS_MODEL}"
    )
    print(
        f"TTS Voice     : {TTS_VOICE}"
    )
    print("=" * 60)
    print(
        "Server        : http://127.0.0.1:5000"
    )
    print(
        "Health        : http://127.0.0.1:5000/api/health"
    )
    print("=" * 60)
    print("")


    app.run(

        host="127.0.0.1",

        port=5000,

        debug=True
    )