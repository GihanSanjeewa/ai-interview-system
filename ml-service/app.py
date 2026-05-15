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
    audio = request.files["audio"]
    audio.save("temp.mp3")
    result = whisper_model.transcribe("temp.mp3")
    text = result["text"]
    segments = result.get("segments", [])
    # Uses librosa (if installed) for full ML-based audio analysis
    metrics = compute_audio_metrics(text, segments, audio_path="temp.mp3")
    return jsonify({"text": text, "metrics": metrics})


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

    prompt = f"""Analyze the following CV text and extract exactly 3-5 professional interview domains/roles this person is qualified for.
Return them as a simple comma-separated list with no extra text or explanation.

CV Text:
{text[:2000]}"""

    try:
        response_text = ask_claude(prompt, model=SMART_MODEL, max_tokens=128)
        domains = [d.strip() for d in response_text.split(",") if d.strip()]
    except Exception as e:
        print(f"Claude CV parse error: {e}")
        domains = ["Software Engineering", "General Management", "Sales"]

    return jsonify({"text": text, "domains": domains})


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
=================================================================

Return ONLY a valid JSON object with exactly these keys (no markdown, no extra text).
Use the ML-computed scores above as your primary source for the numeric fields:
{{
  "summary": "2-3 sentence overall summary in English",
  "technical_score": <integer 0-100, based on technical_accuracy ML score>,
  "communication_score": <integer 0-100, based on communication_quality ML score>,
  "confidence_score": <integer 0-100, based on confidence_level ML score>,
  "fluency_score": <integer 0-100, based on fluency ML score>,
  "speaking_speed_score": <integer 0-100, based on speaking_speed ML score>,
  "response_relevance_score": <integer 0-100, based on response_relevance ML score>,
  "performance_level": "<exactly one of: Beginner, Intermediate, Advanced>",
  "key_strengths": ["strength 1", "strength 2", "strength 3"],
  "areas_for_improvement": ["area 1", "area 2", "area 3"],
  "learning_resources": [
    {{"title": "Resource Name", "type": "Course/Book/Website/Platform", "description": "One sentence about it"}},
    {{"title": "Resource Name", "type": "Course/Book/Website/Platform", "description": "One sentence about it"}},
    {{"title": "Resource Name", "type": "Course/Book/Website/Platform", "description": "One sentence about it"}}
  ],
  "recommendations": ["Job Title 1", "Job Title 2", "Job Title 3"]
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
            "performance_level": "Intermediate",
            "key_strengths": ["Completed the interview", "Provided structured responses"],
            "areas_for_improvement": ["Continue practising technical questions", "Work on communication clarity"],
            "learning_resources": [
                {"title": "Coursera Professional Certificates", "type": "Platform", "description": "Industry-recognized courses covering technical and soft skills."},
                {"title": "LeetCode", "type": "Website", "description": "Practice coding and problem-solving challenges used in technical interviews."},
                {"title": "Toastmasters International", "type": "Organization", "description": "Develop public speaking and communication confidence."}
            ],
            "recommendations": ["Software Engineer", "Junior Developer", "Technical Analyst"]
        })


if __name__ == "__main__":
    app.run(port=8000, threaded=True)
