from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import pdfplumber
import spacy
import os
import json
import anthropic
from dotenv import load_dotenv

from audio_analyzer import (
    extract_audio_features,
    compute_confidence_score,
    compute_fluency_score,
    compute_speaking_speed_score,
    get_feature_vector,
    LIBROSA_AVAILABLE,
)
from text_analyzer import analyze_conversation, FILLER_WORDS
from classifier import classify_candidate_performance
import numpy as np

app = Flask(__name__)
CORS(app)

ffmpeg_path = r"C:\Users\PC\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin"
if os.path.exists(ffmpeg_path):
    os.environ["PATH"] += os.pathsep + ffmpeg_path

load_dotenv()

whisper_model = whisper.load_model("base")
nlp = spacy.load("en_core_web_sm")
claude = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

FAST_MODEL  = "claude-haiku-4-5-20251001"
SMART_MODEL = "claude-sonnet-4-6"


def ask_claude(prompt: str, model: str = FAST_MODEL, max_tokens: int = 1024) -> str:
    """Send a prompt to Claude and return the response text."""
    message = claude.messages.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text


def compute_audio_metrics(text: str, segments: list, audio_path: str = "temp.mp3") -> dict:
    """
    Compute all 6 ML-based audio metrics from Whisper output + librosa analysis.
    Falls back gracefully if librosa is not installed.
    """
    words = [w for w in text.split() if w.strip()]
    word_count = len(words)

    # Speaking speed — from Whisper timestamps
    wpm = 0.0
    if segments and segments[-1].get("end", 0) > 0:
        duration_minutes = segments[-1]["end"] / 60.0
        wpm = word_count / duration_minutes if duration_minutes > 0 else 0.0

    # Whisper log-prob confidence (fallback baseline)
    whisper_conf = 50.0
    if segments:
        avg_logprob = sum(s.get("avg_logprob", -0.5) for s in segments) / len(segments)
        whisper_conf = max(0.0, min(100.0, (1.0 + avg_logprob) * 100.0))

    filler_count = sum(1 for w in words if w.lower() in FILLER_WORDS)

    # librosa-based ML feature extraction
    audio_features = extract_audio_features(audio_path) if LIBROSA_AVAILABLE else {}

    confidence    = compute_confidence_score(audio_features, whisper_conf)
    fluency       = compute_fluency_score(audio_features, filler_count, word_count)
    speed_score   = compute_speaking_speed_score(wpm)

    return {
        "words_per_minute":    round(wpm, 1),
        "confidence_score":    confidence,
        "fluency_score":       fluency,
        "speaking_speed_score": speed_score,
        "word_count":          word_count,
        "filler_count":        filler_count,
        # Store raw feature vector for the performance classifier
        "feature_vector": get_feature_vector(audio_features, wpm, fluency, confidence)
    }


def average_metrics(metrics_list: list) -> dict:
    if not metrics_list:
        return {"words_per_minute": 0, "confidence_score": 50, "fluency_score": 50, "speaking_speed_score": 50}
    keys = ["words_per_minute", "confidence_score", "fluency_score", "speaking_speed_score"]
    return {k: round(sum(m.get(k, 0) for m in metrics_list) / len(metrics_list), 1) for k in keys}


def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
    return text


def extract_text_from_docx(file_path: str) -> str:
    from docx import Document
    doc = Document(file_path)
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/transcribe", methods=["POST"])
def transcribe_audio():
    # Accept either `audio` (legacy) or `file` (new TS BFF) form field.
    upload = request.files.get("audio") or request.files.get("file")
    if upload is None:
        return jsonify({"error": "audio or file is required"}), 400

    upload.save("temp.mp3")

    raw_lang = (request.form.get("language") or "english").lower()
    lang_code = "si" if raw_lang in ("si", "sinhala") else "en"

    try:
        from whisper_si import transcribe as si_transcribe  # lazy import

        result = si_transcribe("temp.mp3", language=lang_code)
        text = result.text
        segments = result.segments
        whisper_meta = {
            "model": result.model_used,
            "backend": result.backend,
            "finetuned": result.finetuned,
            "latency_ms": result.latency_ms,
            "duration_sec": result.duration_sec,
        }
    except Exception as exc:
        print(f"whisper_si pipeline failed, falling back to base: {exc}")
        whisper_args = {"language": lang_code} if lang_code else {}
        result = whisper_model.transcribe("temp.mp3", **whisper_args)
        text = result["text"]
        segments = result.get("segments", [])
        whisper_meta = {
            "model": "openai-whisper:base",
            "backend": "openai-whisper",
            "finetuned": False,
            "latency_ms": None,
            "duration_sec": None,
        }

    # Uses librosa (if installed) for full ML-based audio analysis
    metrics = compute_audio_metrics(text, segments, audio_path="temp.mp3")
    return jsonify({"text": text, "metrics": metrics, "whisper": whisper_meta})


@app.route("/whisper/info", methods=["GET"])
def whisper_info():
    """Lightweight probe — surfaces which Sinhala model the service would use."""
    try:
        from whisper_si import model_info

        return jsonify({"en": model_info("en"), "si": model_info("si")})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/parse_cv", methods=["POST"])
def parse_cv():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    filename = file.filename.lower()

    if filename.endswith(".pdf"):
        file_path = "temp_cv.pdf"
        file.save(file_path)
        try:
            text = extract_text_from_pdf(file_path)
        except Exception as e:
            return jsonify({"error": f"Failed to parse PDF: {str(e)}"}), 500
    elif filename.endswith(".docx"):
        file_path = "temp_cv.docx"
        file.save(file_path)
        try:
            text = extract_text_from_docx(file_path)
        except Exception as e:
            return jsonify({"error": f"Failed to parse DOCX: {str(e)}"}), 500
    else:
        return jsonify({"error": "Unsupported file type. Please upload a PDF or DOCX."}), 400

    prompt = f"""Analyze the following CV text and extract:
1. Skills: A list of key professional skills found in the resume.
2. Education: A list of degrees, certifications, or academic background.
3. Experience: A list of past job titles, companies, or work experience.
4. Certifications: Any professional certifications.
5. Technologies: Specific programming languages, frameworks, databases, or software tools mentioned.
6. Domains: Exactly 3-5 suitable interview categories/roles this person is qualified for. Prioritize selecting from: Software Engineering, Web Development, Data Science, Networking, UI/UX, Business Analysis.

Return your response ONLY as a valid JSON object with the following structure, with no extra markdown, preambles, or explanation:
{{
  "skills": ["Skill 1", "Skill 2"],
  "education": ["Education details"],
  "experience": ["Experience details"],
  "certifications": ["Certification details"],
  "technologies": ["Technology 1", "Technology 2"],
  "domains": ["Domain 1", "Domain 2"]
}}

CV Text:
{text[:3000]}"""

    try:
        response_text = ask_claude(prompt, model=SMART_MODEL, max_tokens=1024).strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        parsed = json.loads(response_text)
        extracted_info = {
            "skills": parsed.get("skills", []),
            "education": parsed.get("education", []),
            "experience": parsed.get("experience", []),
            "certifications": parsed.get("certifications", []),
            "technologies": parsed.get("technologies", [])
        }
        domains = parsed.get("domains", ["Software Engineering", "Web Development"])
    except Exception as e:
        print(f"Claude CV parse error: {e}")
        extracted_info = {
            "skills": ["Communication", "Problem Solving"],
            "education": ["Bachelor's Degree"],
            "experience": ["Relevant Work Experience"],
            "certifications": ["Professional Certification"],
            "technologies": ["Office", "Git"]
        }
        domains = ["Software Engineering", "General Management", "Sales"]

    return jsonify({"text": text, "extracted_info": extracted_info, "domains": domains})


@app.route("/generate_question", methods=["POST"])
def generate_question():
    data = request.json
    cv_text = data.get("cv_text", "")
    domain = data.get("domain", "")
    history = data.get("history", [])
    language = data.get("language", "english").lower()
    difficulty = data.get("difficulty", "intermediate").lower()

    lang_instruction = (
        "The interview MUST be conducted entirely in SINHALA."
        if language == "sinhala"
        else "The interview MUST be conducted entirely in ENGLISH."
    )

    difficulty_guide = {
        "beginner": "Ask foundational questions for entry-level candidates. Focus on basic concepts and simple real-world scenarios.",
        "intermediate": "Ask moderately challenging questions mixing conceptual understanding and practical application.",
        "advanced": "Ask complex, in-depth questions covering system design, edge cases, trade-offs, and senior-level thinking."
    }.get(difficulty, "Ask moderately challenging questions.")

    prompt = f"""You are an expert interviewer for the {domain} role.
{lang_instruction}
Difficulty: {difficulty.capitalize()} — {difficulty_guide}

Based on the candidate's CV and the conversation history, ask the NEXT interview question.
The question must be professional, concise, and focused on technical skills or behavioral traits relevant to {domain}.
Do NOT repeat questions already asked. Output ONLY the question — no preamble or explanation.

Candidate CV Summary:
{cv_text[:1000]}

Conversation History:
{history}"""

    fallback = (
        "ඔබේ අත්දැකීම් ගැන මට කියන්න පුළුවන්ද?"
        if language == "sinhala"
        else "Can you tell me about your most relevant experience for this role?"
    )

    try:
        question = ask_claude(prompt, model=FAST_MODEL, max_tokens=256).strip()
    except Exception as e:
        print(f"Claude question error: {e}")
        question = fallback

    return jsonify({"question": question})


@app.route("/evaluate_interview", methods=["POST"])
def evaluate_interview():
    data = request.json
    cv_text = data.get("cv_text", "")
    domain = data.get("domain", "")
    history = data.get("history", [])
    language = data.get("language", "english").lower()
    difficulty = data.get("difficulty", "intermediate").lower()
    audio_metrics_list = data.get("audio_metrics", [])

    avg_metrics = average_metrics(audio_metrics_list)

    # ── ML-based text analysis across all answers ──────────────────────────
    text_scores = analyze_conversation(history, domain)

    # ── RandomForest ML-based performance level classification ─────────────
    all_vectors = [m.get("feature_vector") for m in audio_metrics_list if m.get("feature_vector")]
    if all_vectors:
        overall_vector = list(np.mean(all_vectors, axis=0))
    else:
        # Fallback 21-dimensional feature vector
        overall_vector = [
            avg_metrics['words_per_minute'],
            avg_metrics['confidence_score'],
            avg_metrics['fluency_score'],
            avg_metrics['speaking_speed_score'],
            0.05, 120.0, 10.0, 0.25
        ] + [0.0]*13

    performance_level = classify_candidate_performance(overall_vector)

    prompt = f"""You are an expert interview evaluator. Provide a comprehensive performance evaluation.

Domain: {domain}
Interview Language: {language.capitalize()}
Difficulty Level: {difficulty.capitalize()}

Candidate CV (first 1000 chars):
{cv_text[:1000]}

Interview Transcript:
{history}

=== ML-COMPUTED SCORES (use these as ground truth for scoring) ===

Audio Analysis (librosa + Whisper):
- Speaking Speed:      {avg_metrics['words_per_minute']} WPM  (ideal: 120-160)
- Confidence Level:    {avg_metrics['confidence_score']}/100  (pitch stability + voice energy)
- Fluency Score:       {avg_metrics['fluency_score']}/100     (pause ratio + filler words)
- Speaking Pace Score: {avg_metrics['speaking_speed_score']}/100

NLP / Text Analysis (spaCy + TF-IDF):
- Communication Quality: {text_scores['communication_quality']}/100  (vocabulary, sentence structure, discourse markers)
- Response Relevance:    {text_scores['response_relevance']}/100     (TF-IDF cosine similarity: question ↔ answer)
- Technical Accuracy:    {text_scores['technical_accuracy']}/100     (domain keyword density)
- Answers analysed:      {text_scores['answer_count']}

=== ML-CLASSIFIED PERFORMANCE TIER ===
- Performance Level:    {performance_level} (determined by our RandomForestClassifier ML model)
=================================================================

Return ONLY a valid JSON object with exactly these keys (no markdown, no extra text).
Use the ML-computed scores above as your primary source for the numeric fields:
{{
  "summary": "2-3 sentence overall summary in English",
  "technical_score": {int(text_scores['technical_accuracy'])},
  "communication_score": {int(text_scores['communication_quality'])},
  "confidence_score": {int(avg_metrics['confidence_score'])},
  "fluency_score": {int(avg_metrics['fluency_score'])},
  "speaking_speed_score": {int(avg_metrics['speaking_speed_score'])},
  "response_relevance_score": {int(text_scores['response_relevance'])},
  "performance_level": "{performance_level}",
  "key_strengths": ["strength 1", "strength 2", "strength 3"],
  "areas_for_improvement": ["area 1", "area 2", "area 3"],
  "learning_resources": [
    {{"title": "Resource Name", "type": "Course/Book/Website/Platform", "description": "One sentence about it"}},
    {{"title": "Resource Name", "type": "Course/Book/Website/Platform", "description": "One sentence about it"}},
    {{"title": "Resource Name", "type": "Course/Book/Website/Platform", "description": "One sentence about it"}}
  ],
  "recommendations": [
    {{
      "title": "Suitable Job Title 1",
      "match_score": <integer 0-100, based on CV skills, technical score, and communication>,
      "rationale": "Why this candidate fits this job role specifically based on their CV skills and interview performance.",
      "career_path": "Transition or growth progression path (e.g. Junior Dev -> Mid Dev -> Senior Architect)"
    }},
    {{
      "title": "Suitable Job Title 2",
      "match_score": <integer 0-100, based on CV skills, technical score, and communication>,
      "rationale": "Why this candidate fits this job role specifically based on their CV skills and interview performance.",
      "career_path": "Transition or growth progression path (e.g. Associate Analyst -> Product Owner)"
    }}
  ]
}}"""

    try:
        res_text = ask_claude(prompt, model=SMART_MODEL, max_tokens=2048).strip()
        if "```json" in res_text:
            res_text = res_text.split("```json")[1].split("```")[0].strip()
        elif "```" in res_text:
            res_text = res_text.split("```")[1].split("```")[0].strip()

        parsed = json.loads(res_text)
        return jsonify(parsed)
    except Exception as e:
        print(f"Evaluation error: {e}")
        # Return ML-computed scores even when Claude fails
        return jsonify({
            "summary": "Interview completed. Scores computed by ML analysis.",
            "technical_score":          int(text_scores["technical_accuracy"]),
            "communication_score":      int(text_scores["communication_quality"]),
            "confidence_score":         int(avg_metrics.get("confidence_score", 65)),
            "fluency_score":            int(avg_metrics.get("fluency_score", 65)),
            "speaking_speed_score":     int(avg_metrics.get("speaking_speed_score", 65)),
            "response_relevance_score": int(text_scores["response_relevance"]),
            "performance_level": performance_level,
            "key_strengths": ["Completed the interview", "Provided structured responses"],
            "areas_for_improvement": ["Continue practising technical questions", "Work on communication clarity"],
            "learning_resources": [
                {"title": "Coursera Professional Certificates", "type": "Platform", "description": "Industry-recognized courses covering technical and soft skills."},
                {"title": "LeetCode", "type": "Website", "description": "Practice coding and problem-solving challenges used in technical interviews."},
                {"title": "Toastmasters International", "type": "Organization", "description": "Develop public speaking and communication confidence."}
            ],
            "recommendations": [
                {
                    "title": "Software Engineer",
                    "match_score": 80,
                    "rationale": "Demonstrates solid foundational coding concepts and structured thinking.",
                    "career_path": "Junior Developer -> Mid-level Software Engineer -> Tech Lead"
                },
                {
                    "title": "Technical Analyst",
                    "match_score": 75,
                    "rationale": "Structured communication style fits analytical and system documentation roles.",
                    "career_path": "Junior Analyst -> Systems Analyst -> IT Product Manager"
                }
            ]
        })


# ─── v2 contract (used by the new TypeScript BFF) ──────────────────────────

@app.route("/cv/parse", methods=["POST"])
def cv_parse_v2():
    """Adapter for the TS backend CV upload flow.
    Returns the schema described in services/api → CvParsedResult.
    """
    if "file" not in request.files:
        return jsonify({"error": "file is required"}), 400
    file = request.files["file"]
    filename = (file.filename or "").lower()

    try:
        if filename.endswith(".pdf"):
            path = "temp_cv.pdf"
            file.save(path)
            text = extract_text_from_pdf(path)
        elif filename.endswith(".docx"):
            path = "temp_cv.docx"
            file.save(path)
            text = extract_text_from_docx(path)
        else:
            return jsonify({"error": "Unsupported file type. PDF or DOCX only."}), 400
    except Exception as exc:
        return jsonify({"error": f"Failed to parse: {exc}"}), 500

    prompt = (
        "Analyze the following CV text and respond ONLY with a JSON object of:\n"
        "skills, education, experience, certifications, technologies (each a list of strings),\n"
        "years_total (integer), readiness_score (0-100), suggested_tracks (array of 3-5 tracks "
        "chosen from: react, swe, dotnet, node, hr, behavioral, leadership).\n\n"
        f"CV Text:\n{text[:4000]}"
    )

    parsed = {
        "skills": [],
        "education": [],
        "experience": [],
        "certifications": [],
        "technologies": [],
        "years_total": None,
        "readiness_score": 60,
        "suggested_tracks": ["react", "swe"],
    }
    try:
        res_text = ask_claude(prompt, model=SMART_MODEL, max_tokens=1024).strip()
        if "```json" in res_text:
            res_text = res_text.split("```json")[1].split("```")[0].strip()
        elif "```" in res_text:
            res_text = res_text.split("```")[1].split("```")[0].strip()
        parsed.update(json.loads(res_text))
    except Exception as exc:
        print(f"cv/parse claude error: {exc}")

    return jsonify({
        "skills": parsed.get("skills", []),
        "education": parsed.get("education", []),
        "experience": parsed.get("experience", []),
        "certifications": parsed.get("certifications", []),
        "technologies": parsed.get("technologies", []),
        "yearsTotal": parsed.get("years_total"),
        "readinessScore": int(parsed.get("readiness_score", 60)),
        "suggestedTracks": parsed.get("suggested_tracks", ["react", "swe"]),
        "rawText": text,
    })


@app.route("/score/answer", methods=["POST"])
def score_answer_v2():
    data = request.get_json(silent=True) or {}
    question = data.get("question", "")
    transcript = data.get("transcript", "")
    language = data.get("language", "en")

    # Use existing NLP analyzer on a single-pair "conversation".
    history = [{"role": "ai", "text": question}, {"role": "user", "text": transcript}]
    text_scores = analyze_conversation(history, "general")

    word_count = len([w for w in transcript.split() if w.strip()])
    # No audio file here — heuristic-only pace.
    pace = 145 if 50 < word_count < 350 else (90 if word_count <= 50 else 175)

    prompt = (
        "You are an interview judge. Given the question and answer, return ONLY a JSON object with:\n"
        "technical, communication, clarity, confidence, depth, pace (each 0-100 integer), and\n"
        "notes (array of up to 3 short strings).\n\n"
        f"Question: {question}\n\nAnswer: {transcript[:2000]}\n\n"
        f"Hints (use as priors, don't blindly trust): communication={int(text_scores['communication_quality'])}, "
        f"technical={int(text_scores['technical_accuracy'])}, relevance={int(text_scores['response_relevance'])}."
    )

    fallback = {
        "confidence": 70,
        "communication": int(text_scores["communication_quality"]),
        "relevance": int(text_scores["response_relevance"]),
        "technical": int(text_scores["technical_accuracy"]),
        "fluency": int(text_scores["communication_quality"]),
        "pace": pace,
        "notes": [],
    }
    try:
        res_text = ask_claude(prompt, model=FAST_MODEL, max_tokens=400).strip()
        if "```json" in res_text:
            res_text = res_text.split("```json")[1].split("```")[0].strip()
        elif "```" in res_text:
            res_text = res_text.split("```")[1].split("```")[0].strip()
        parsed = json.loads(res_text)
        for key in ("confidence", "communication", "relevance", "technical", "fluency", "pace"):
            parsed[key] = max(0, min(100, int(parsed.get(key, fallback[key]))))
        parsed["notes"] = list(parsed.get("notes", []))[:3]
        _ = language
        return jsonify(parsed)
    except Exception as exc:
        print(f"score/answer error: {exc}")
        return jsonify(fallback)


@app.route("/score/session", methods=["POST"])
def score_session_v2():
    data = request.get_json(silent=True) or {}
    answers = data.get("answers", [])
    role = data.get("role", "Software Engineer")
    language = data.get("language", "en")

    def avg(field):
        vals = [a.get("metrics", {}).get(field) for a in answers if a.get("metrics")]
        vals = [v for v in vals if isinstance(v, (int, float))]
        return int(round(sum(vals) / len(vals))) if vals else 70

    base = {
        "confidence": avg("confidence"),
        "communication": avg("communication"),
        "relevance": avg("relevance"),
        "technical": avg("technical"),
        "fluency": avg("fluency"),
        "pace": avg("pace"),
    }
    overall = int(round(sum(base.values()) / 6))
    if overall >= 80:
        performance_level = "ADVANCED"
    elif overall >= 60:
        performance_level = "INTERMEDIATE"
    else:
        performance_level = "BEGINNER"

    transcript_blob = "\n".join(
        f"Q{i + 1}: {a.get('question', '')}\nA: {(a.get('transcript') or '')[:600]}"
        for i, a in enumerate(answers[:8])
    )

    prompt = (
        f"You are evaluating a {role} mock interview. Return ONLY JSON with:\n"
        "strengths (3-5 strings), weaknesses (3-5 strings), suggestions (3-5 short actionable strings),\n"
        "resources (3-5 objects each {title, type, description}).\n\n"
        f"Per-metric averages: {base}\n"
        f"Performance level: {performance_level}\n\n"
        f"Transcript excerpt:\n{transcript_blob[:4000]}"
    )

    fallback = {
        "strengths": [
            "Structured answers with concrete examples",
            "Stayed engaged throughout the session",
            "Maintained a steady speaking pace",
        ],
        "weaknesses": [
            "Some answers skipped trade-offs and edge cases",
            "Filler words appeared in the opening minutes",
            "Closing pitch was slightly rushed",
        ],
        "suggestions": [
            "Practice 2 system-design walkthroughs this week",
            "Record a 60-second self-intro and refine it daily",
            "Pause for 2 seconds before answering hard questions",
        ],
        "resources": [
            {"title": "Designing Data-Intensive Applications", "type": "Book",
             "description": "Foundations every senior interviewer probes."},
            {"title": "STAR method playbook", "type": "Article",
             "description": "Structure behavioral answers with concrete outcomes."},
            {"title": "Toastmasters International", "type": "Community",
             "description": "Develop public speaking and communication confidence."},
        ],
    }
    try:
        res_text = ask_claude(prompt, model=FAST_MODEL, max_tokens=900).strip()
        if "```json" in res_text:
            res_text = res_text.split("```json")[1].split("```")[0].strip()
        elif "```" in res_text:
            res_text = res_text.split("```")[1].split("```")[0].strip()
        parsed = json.loads(res_text)
        fallback.update({k: parsed[k] for k in fallback.keys() if k in parsed})
    except Exception as exc:
        print(f"score/session error: {exc}")

    _ = language
    return jsonify({
        "overallScore": overall,
        **base,
        "performanceLevel": performance_level,
        "strengths": fallback["strengths"],
        "weaknesses": fallback["weaknesses"],
        "suggestions": fallback["suggestions"],
        "resources": fallback["resources"],
    })


if __name__ == "__main__":
    app.run(port=8000, threaded=True)
