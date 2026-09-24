# ============================================================
# SIKSHA AI — BACKEND ENGINE
# Gemini 3.8 • Chat • Premium • Files • TTS
# Flask API • CORS • Secure Environment Variables
# ============================================================

import os
import io
import base64
import mimetypes
import tempfile
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

client = genai.Client(api_key=GEMINI_API_KEY)


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
# FLASK APP
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
# SIKSHA AI SYSTEM INSTRUCTIONS
# ============================================================

NORMAL_SYSTEM = """
You are Siksha AI, a premium Indian education-focused AI assistant.

Your primary purpose is to help students learn concepts clearly.

IMPORTANT BEHAVIOUR:

1. Understand the student's language.
2. You can respond in:
   - English
   - Hindi
   - Hinglish
3. If the user writes Hinglish, naturally reply in Hinglish.
4. Do not unnecessarily use difficult English.
5. Explain concepts step-by-step.
6. For school questions, keep the explanation age-appropriate.
7. For mathematics and physics:
   - show formulas clearly
   - substitute values step-by-step
   - show units
   - give the final answer clearly
8. For chemistry:
   - explain reactions
   - explain why something happens
   - include equations where useful
9. For biology:
   - use simple definitions
   - explain processes in logical order
10. For ICSE questions, prefer ICSE-style explanations when the user asks.
11. Never pretend to know information you do not know.
12. If a question is ambiguous, make the most reasonable interpretation.
13. Do not unnecessarily repeat the question.
14. Do not start every response with phrases like "Sure!" or "Of course!"
15. Be friendly, intelligent and concise.
16. Encourage understanding instead of blindly giving answers.

MATH FORMAT:

Use LaTeX-style notation where useful.

Example:

\\[
d=\\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}
\\]

For important final answers use:

\\boxed{answer}

Do not use broken markdown around formulas.

You are Siksha AI, not ChatGPT.
"""


PREMIUM_SYSTEM = """
You are Siksha AI Premium, an advanced educational AI tutor.

You provide deeper explanations while remaining student-friendly.

You should:

- understand English, Hindi and Hinglish
- explain difficult concepts from first principles
- connect school concepts with higher-level concepts when useful
- provide step-by-step mathematical derivations
- identify common mistakes
- provide alternative solving methods when useful
- explain WHY, not just WHAT
- adapt explanations to the student's apparent level
- use clean mathematical notation
- structure long answers with headings
- provide examples
- provide exam-oriented tips when relevant

For academic questions:

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

Respond naturally in English, Hindi or Hinglish depending on the user's language.
"""


# ============================================================
# HEALTH CHECK
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
    Convert frontend history into a safe Gemini conversation format.
    """

    if not isinstance(history, list):
        return []

    cleaned = []

    for item in history[-30:]:

        if not isinstance(item, dict):
            continue

        role = item.get("role", "")
        text = item.get("text", "")

        if not isinstance(text, str):
            continue

        text = text.strip()

        if not text:
            continue

        if role in ("assistant", "ai"):
            gemini_role = "model"
        elif role == "user":
            gemini_role = "user"
        else:
            continue

        cleaned.append(
            types.Content(
                role=gemini_role,
                parts=[
                    types.Part.from_text(text=text)
                ]
            )
        )

    return cleaned


def get_text_from_response(response):
    """
    Safely extract text from Gemini response.
    """

    try:
        text = response.text

        if text:
            return text.strip()
    except Exception:
        pass

    return ""


def error_response(message, status=500):
    return jsonify({
        "success": False,
        "error": message
    }), status


# ============================================================
# CHAT API
# ============================================================

@app.post("/api/chat")
def chat():

    try:

        data = request.get_json(silent=True)

        if not data:
            return error_response(
                "Request body is missing.",
                400
            )

        message = data.get("message", "")
        mode = str(data.get("mode", "normal")).lower()

        history = data.get("history", [])

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
            model_name = CHAT_MODEL
            system_instruction = NORMAL_SYSTEM


        # ----------------------------------------------------
        # HISTORY
        # ----------------------------------------------------

        cleaned_history = clean_history(history)


        # ----------------------------------------------------
        # CURRENT USER MESSAGE
        # ----------------------------------------------------

        current_message = types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=message)
            ]
        )


        contents = cleaned_history + [current_message]


        # ----------------------------------------------------
        # GEMINI REQUEST
        # ----------------------------------------------------

        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
            )
        )


        answer = get_text_from_response(response)


        if not answer:
            return error_response(
                "Siksha AI did not return a text response.",
                502
            )


        return jsonify({
            "success": True,
            "answer": answer,
            "mode": mode,
            "model": model_name
        })


    except Exception as exc:

        print("\n[Siksha AI CHAT ERROR]")
        print(str(exc))

        return error_response(
            "Siksha AI could not process your request right now.",
            500
        )


# ============================================================
# FILE SOLVER
# ============================================================

@app.post("/api/solve-file")
def solve_file():

    temp_path = None

    try:

        uploaded = request.files.get("file")

        question = request.form.get(
            "question",
            "Analyze this file and explain the important content clearly."
        )

        mode = request.form.get(
            "mode",
            "normal"
        ).lower()


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

        extension = Path(filename).suffix.lower()

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
        # SAVE TEMPORARILY
        # ----------------------------------------------------

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=extension
        ) as temp_file:

            uploaded.save(temp_file)

            temp_path = temp_file.name


        # ----------------------------------------------------
        # MIME TYPE
        # ----------------------------------------------------

        mime_type = (
            uploaded.mimetype
            or mimetypes.guess_type(filename)[0]
            or "application/octet-stream"
        )


        # ----------------------------------------------------
        # UPLOAD TO GEMINI FILES API
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
- an image → read and analyze its visible content

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
        # GENERATE RESPONSE
        # ----------------------------------------------------

        response = client.models.generate_content(
            model=CHAT_MODEL if mode != "premium" else PREMIUM_MODEL,
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


        answer = get_text_from_response(response)


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

        print("\n[Siksha AI FILE ERROR]")
        print(str(exc))

        return error_response(
            "Siksha AI could not process this file.",
            500
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

        data = request.get_json(silent=True)

        if not data:
            return error_response(
                "Request body is missing.",
                400
            )

        text = data.get("text", "")

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

        # Prevent accidentally huge TTS requests.
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
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=TTS_VOICE
                        )
                    )
                )
            )
        )


        # ----------------------------------------------------
        # FIND AUDIO DATA
        # ----------------------------------------------------

        audio_bytes = None
        mime_type = "audio/wav"

        try:

            candidates = response.candidates or []

            for candidate in candidates:

                content = candidate.content

                if not content:
                    continue

                parts = content.parts or []

                for part in parts:

                    inline_data = getattr(
                        part,
                        "inline_data",
                        None
                    )

                    if inline_data:

                        audio_bytes = inline_data.data

                        if getattr(
                            inline_data,
                            "mime_type",
                            None
                        ):
                            mime_type = inline_data.mime_type

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

        audio_stream = io.BytesIO(audio_bytes)

        audio_stream.seek(0)

        return send_file(
            audio_stream,
            mimetype=mime_type,
            as_attachment=False,
            download_name="siksha-ai-voice.wav"
        )


    except Exception as exc:

        print("\n[Siksha AI TTS ERROR]")
        print(str(exc))

        return error_response(
            "Siksha AI voice generation failed.",
            500
        )


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    print("")
    print("=" * 60)
    print("        SIKSHA AI BACKEND")
    print("=" * 60)
    print(f"Chat Model    : {CHAT_MODEL}")
    print(f"Premium Model : {PREMIUM_MODEL}")
    print(f"TTS Model     : {TTS_MODEL}")
    print(f"TTS Voice     : {TTS_VOICE}")
    print("=" * 60)
    print("Server        : http://127.0.0.1:5000")
    print("Health        : http://127.0.0.1:5000/api/health")
    print("=" * 60)
    print("")

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )