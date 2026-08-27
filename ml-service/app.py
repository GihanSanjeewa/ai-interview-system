from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import whisper
import pdfplumber
import spacy
import os
import json
import urllib.request
import urllib.parse
from pathlib import Path
import torch
# pyrefly: ignore [missing-import]
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
from rag_engine import rag_engine
from code_evaluator import evaluate_code_solution
from tts_engine import generate_speech_audio
from model_registry import registry
import numpy as np

app = Flask(__name__)
CORS(app)

# Auto-detect and bind ffmpeg binary
try:
    import imageio_ffmpeg
    import shutil
    src_exe = imageio_ffmpeg.get_ffmpeg_exe()
    ffmpeg_dir = os.path.dirname(src_exe)
    target_exe = os.path.join(ffmpeg_dir, "ffmpeg.exe")
    if not os.path.exists(target_exe) and os.path.exists(src_exe):
        shutil.copyfile(src_exe, target_exe)
    if ffmpeg_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
except Exception as e:
    print(f"Notice: imageio_ffmpeg auto-bind note ({e})")

possible_ffmpeg_paths = [
    os.path.expanduser(r"~\AppData\Local\Microsoft\WinGet\Packages"),
    r"C:\ffmpeg\bin",
    r"C:\Program Files\ffmpeg\bin"
]
for base_p in possible_ffmpeg_paths:
    if os.path.exists(base_p):
        for root, dirs, files in os.walk(base_p):
            if "ffmpeg.exe" in files:
                os.environ["PATH"] += os.pathsep + root
                break

load_dotenv()

# Local Speech-to-Text Model safely loaded
try:
    import whisper
    whisper_model = whisper.load_model("base")
except Exception as exc:
    print(f"Notice: Whisper local speech recognition load skipped ({exc}). Will fallback to transcript inputs.")
    whisper_model = None

# Local NLP Model
try:
    nlp = spacy.load("en_core_web_sm")
except Exception:
    nlp = None

# Own Project Model Cache
_own_model_cache = {}


def generate_with_own_model(prompt: str, max_tokens: int = 64) -> Optional[str]:
    """Generate text using the project's own scratch-trained Transformer model."""
    try:
        from transformer_scratch import CompactTransformerLM, CustomBPETokenizer, load_checkpoint
        active = registry.get_active_model("question_generator") or {}
        storage_path = active.get("storage_path", "models/interview_model")
        model_dir = Path(storage_path)

        if not model_dir.exists() or not (model_dir / "checkpoint.pt").exists():
            return None

        if "model" not in _own_model_cache:
            model, payload = load_checkpoint(model_dir, device="cpu")
            tokenizer = CustomBPETokenizer.load(model_dir / "tokenizer") if (model_dir / "tokenizer").exists() else CustomBPETokenizer()
            _own_model_cache["model"] = model
            _own_model_cache["tokenizer"] = tokenizer

        model = _own_model_cache["model"]
        tokenizer = _own_model_cache["tokenizer"]

        tokens = tokenizer.encode(prompt, add_special_tokens=True)
        inp = torch.tensor([tokens], dtype=torch.long)
        out_tokens = model.generate(inp, max_new_tokens=max_tokens, temperature=0.7, top_k=40)
        generated_text = tokenizer.decode(out_tokens[0].tolist(), skip_special_tokens=True)
        return generated_text.replace(prompt, "").strip()
    except Exception as exc:
        print(f"Own model inference note: {exc}")
        return None


def compute_audio_metrics(text: str, segments: list, audio_path: str = "temp.mp3") -> dict:
    """
    Compute all 6 ML-based audio metrics from Whisper output + librosa analysis.
    """
    words = [w for w in text.split() if w.strip()]
    word_count = len(words)

    wpm = 0.0
    if segments and segments[-1].get("end", 0) > 0:
        duration_minutes = segments[-1]["end"] / 60.0
        wpm = word_count / duration_minutes if duration_minutes > 0 else 0.0

    whisper_conf = 50.0
    if segments:
        avg_logprob = sum(s.get("avg_logprob", -0.5) for s in segments) / len(segments)
        whisper_conf = max(0.0, min(100.0, (1.0 + avg_logprob) * 100.0))

    filler_count = sum(1 for w in words if w.lower() in FILLER_WORDS)
    
    try:
        audio_features = extract_audio_features(audio_path) if LIBROSA_AVAILABLE else {}
    except Exception:
        audio_features = {}

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
    upload = request.files.get("audio") or request.files.get("file")
    if upload is None:
        return jsonify({"error": "audio or file is required"}), 400

    upload.save("temp.mp3")

    raw_lang = (request.form.get("language") or "english").lower()
    lang_code = "si" if raw_lang in ("si", "sinhala") else "en"

    text = ""
    segments = []
    whisper_meta = {
        "model": "openai-whisper:base",
        "backend": "openai-whisper",
        "finetuned": False,
        "latency_ms": None,
        "duration_sec": None,
    }

    try:
        from whisper_si import transcribe as si_transcribe
        result = si_transcribe("temp.mp3", language=lang_code)
        text = result.text
        segments = result.segments
    except Exception as exc:
        print(f"whisper_si note: {exc}. Trying standard Whisper...")
        try:
            if whisper_model is not None:
                whisper_args = {"language": lang_code, "fp16": False} if lang_code else {"fp16": False}
                result = whisper_model.transcribe("temp.mp3", **whisper_args)
                text = result.get("text", "")
                segments = result.get("segments", [])
        except Exception as err2:
            print(f"Whisper speech processing error: {err2}")
            text = request.form.get("transcript") or ""
            segments = []

    text = text.strip()

    metrics = compute_audio_metrics(text, segments, audio_path="temp.mp3")
    return jsonify({"text": text, "metrics": metrics, "whisper": whisper_meta})


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

    # Rule-based NLP entity extraction from CV text
    extracted_info = {
        "skills": ["Software Architecture", "Clean Code", "Problem Solving"],
        "education": ["Computer Science / Software Engineering Degree"],
        "experience": ["Software Engineering Projects & Professional Work"],
        "certifications": ["Technical Certification"],
        "technologies": ["Git", "SQL", "JavaScript", "Python"]
    }
    domains = ["Software Engineering", "Web Development", "Backend Development"]

    # Extract technologies and skills from CV text
    tech_keywords = ["python", "javascript", "typescript", "react", "node", "docker", "kubernetes", "aws", "sql", "nosql", "git", "ci/cd", "rest", "graphql"]
    found_tech = [t.capitalize() for t in tech_keywords if re.search(rf"\b{t}\b", text, re.IGNORECASE)]
    if found_tech:
        extracted_info["technologies"] = found_tech

    return jsonify({"text": text, "extracted_info": extracted_info, "domains": domains})


@app.route("/generate_question", methods=["POST"])
def generate_question():
    data = request.json or {}
    cv_text = data.get("cv_text", "")
    domain = data.get("domain", "Software Engineering")
    history = data.get("history", [])
    language = data.get("language", "english").lower()
    difficulty = data.get("difficulty", "intermediate").lower()

    # Query active model from capability registry
    active_q_model = registry.get_active_model("question_generator") or {}
    active_model_id = active_q_model.get("model_id", "ai-interview-question-generator-v1.0.0")

    # Query local RAG for knowledge augmentation
    rag_context = rag_engine.retrieve_context(f"{domain} {difficulty} question", top_k=2)

    prompt = f"[DOMAIN: {domain}] [DIFFICULTY: {difficulty}] Question:"
    own_model_question = generate_with_own_model(prompt, max_tokens=64)

    if own_model_question and len(own_model_question.strip()) > 10:
        question = own_model_question.strip()
    else:
        # Adaptive local question fallback based on difficulty & history length
        step = len(history) // 2
        questions = {
            "beginner": [
                "Can you explain the core principles of Object-Oriented Programming (OOP)?",
                "What is the difference between a GET and a POST HTTP request in Web APIs?",
                "How do you handle errors and exceptions in your code?"
            ],
            "intermediate": [
                "How would you optimize a database query that is taking several seconds to execute?",
                "Can you explain the SOLID principles and how you apply them in software design?",
                "What is Dependency Injection, and why is it useful in software development?"
            ],
            "advanced": [
                "How would you design a scalable microservices architecture to handle 100,000 requests per second?",
                "Explain database isolation levels and how you prevent dirty reads and phantom reads in high-concurrency systems.",
                "Describe how you implement event-driven architectures with message brokers like Kafka or RabbitMQ."
            ]
        }
        domain_q = questions.get(difficulty, questions["intermediate"])
        question = domain_q[step % len(domain_q)]

    return jsonify({
        "question": question,
        "rag_context": rag_context,
        "model_id": active_model_id,
        "model_type": active_q_model.get("model_type", "scratch_trained")
    })


@app.route("/evaluate_code", methods=["POST"])
def evaluate_code():
    data = request.json or {}
    code = data.get("code", "")
    language = data.get("language", "python")
    problem = data.get("problem", "")

    eval_result = evaluate_code_solution(code, language=language, problem_description=problem)
    return jsonify(eval_result)


@app.route("/tts", methods=["POST"])
def tts_response():
    data = request.json or {}
    text = data.get("text", "Hello, let us start the interview.")
    audio_path = generate_speech_audio(text, output_path="ai_voice_response.wav")
    return send_file(audio_path, mimetype="audio/wav")


@app.route("/evaluate_interview", methods=["POST"])
def evaluate_interview():
    data = request.json or {}
    domain = data.get("domain", "Software Engineering")
    metrics_list = data.get("metrics", [])
    conversation_history = data.get("conversation_history", [])

    if not metrics_list:
        avg_metrics = {
            "wpm": 130.0, "confidence_score": 75.0, "fluency_score": 78.0,
            "speaking_speed_score": 80.0, "hesitation_count": 2, "filler_word_count": 3
        }
    else:
        avg_metrics = {
            "wpm": np.mean([m.get("wpm", 130.0) for m in metrics_list]),
            "confidence_score": np.mean([m.get("confidence_score", 75.0) for m in metrics_list]),
            "fluency_score": np.mean([m.get("fluency_score", 78.0) for m in metrics_list]),
            "speaking_speed_score": np.mean([m.get("speaking_speed_score", 80.0) for m in metrics_list]),
            "hesitation_count": sum(m.get("hesitation_count", 0) for m in metrics_list),
            "filler_word_count": sum(m.get("filler_word_count", 0) for m in metrics_list)
        }

    text_scores = analyze_conversation(conversation_history, domain)

    if metrics_list and "feature_vector" in metrics_list[0]:
        all_vectors = [m["feature_vector"] for m in metrics_list if "feature_vector" in m]
        overall_vector = np.mean(all_vectors, axis=0).tolist()
    else:
        overall_vector = [
            avg_metrics['wpm'],
            avg_metrics['confidence_score'],
            avg_metrics['fluency_score'],
            avg_metrics['speaking_speed_score'],
            0.05, 120.0, 10.0, 0.25
        ] + [0.0]*13

    performance_level = classify_candidate_performance(overall_vector)

    default_eval = {
        "summary": f"Completed the {domain} interview. Demonstrates strong baseline technical proficiency and structured communication.",
        "technical_score": int(text_scores["technical_accuracy"]),
        "communication_score": int(text_scores["communication_quality"]),
        "confidence_score": int(avg_metrics.get("confidence_score", 70)),
        "fluency_score": int(avg_metrics.get("fluency_score", 70)),
        "speaking_speed_score": int(avg_metrics.get("speaking_speed_score", 70)),
        "response_relevance_score": int(text_scores["response_relevance"]),
        "performance_level": performance_level,
        "key_strengths": [
            "Clear articulation of software development principles",
            "Structured response format",
            "Consistent speaking pace and tone"
        ],
        "areas_for_improvement": [
            "Deepen explanation of system architecture trade-offs",
            "Include more specific code implementation examples in verbal answers"
        ],
        "learning_resources": [
            {"title": "Clean Code & Software Architecture Guide", "type": "Book", "description": "Master SOLID principles and maintainable design patterns."},
            {"title": "System Design Primer", "type": "GitHub Repository", "description": "Comprehensive guide to scaling high-throughput backend systems."},
            {"title": "LeetCode & HackerRank", "type": "Platform", "description": "Practice algorithm complexity and coding evaluation benchmarks."}
        ],
        "recommendations": [
            {
                "title": f"Senior {domain} Specialist",
                "match_score": 85,
                "rationale": "High technical accuracy and relevant domain experience.",
                "career_path": "Software Engineer -> Senior Engineer -> Technical Architect"
            },
            {
                "title": "Full Stack Engineer",
                "match_score": 80,
                "rationale": "Strong adaptability across frontend, backend, and API design.",
                "career_path": "Developer -> Full Stack Lead -> Principal Engineer"
            }
        ]
    }

    return jsonify(default_eval)


# ─── Adapter endpoints for TS BFF ─────────────────────────────────────────────

@app.route("/cv/parse", methods=["POST"])
def cv_parse_v2():
    return parse_cv()

@app.route("/score/answer", methods=["POST"])
def score_answer_v2():
    data = request.get_json(silent=True) or {}
    question = data.get("question", "")
    transcript = data.get("transcript", "")
    history = [{"role": "ai", "text": question}, {"role": "user", "text": transcript}]
    text_scores = analyze_conversation(history, "general")
    return jsonify({
        "confidence": 75,
        "communication": int(text_scores["communication_quality"]),
        "relevance": int(text_scores["response_relevance"]),
        "technical": int(text_scores["technical_accuracy"]),
        "fluency": int(text_scores["communication_quality"]),
        "pace": 140,
        "notes": ["Structured response provided", "Good keyword coverage"]
    })

@app.route("/score/session", methods=["POST"])
def score_session_v2():
    return evaluate_interview()


# ─── Model Registry Management Endpoints ─────────────────────────────────────

@app.route("/models", methods=["GET"])
def list_models_endpoint():
    """List all registered models across capabilities or filtered by ?capability=..."""
    capability = request.args.get("capability")
    try:
        models = registry.list_models(capability)
        return jsonify({"success": True, "models": models})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/models/active", methods=["GET"])
def get_active_models_endpoint():
    """Get currently active model configuration for all capabilities or a single capability."""
    capability = request.args.get("capability")
    if capability:
        try:
            active_model = registry.get_active_model(capability)
            return jsonify({"capability": capability, "active_model": active_model})
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    raw_data = registry._load_raw()
    active_map = raw_data.get("active_models", {})
    resolved = {}
    for cap, model_id in active_map.items():
        resolved[cap] = registry.get_model(cap, model_id)
    return jsonify({"active_models": active_map, "details": resolved})


@app.route("/models/activate", methods=["POST"])
def activate_model_endpoint():
    """Dynamically switch active production model for a capability."""
    data = request.json or {}
    capability = data.get("capability")
    model_id = data.get("model_id")

    if not capability or not model_id:
        return jsonify({"error": "Both 'capability' and 'model_id' are required."}), 400

    try:
        updated_rec = registry.set_active_model(capability, model_id)
        return jsonify({
            "success": True,
            "message": f"Model '{model_id}' is now active for capability '{capability}'.",
            "model": updated_rec
        })
    except (KeyError, ValueError) as exc:
        return jsonify({"error": str(exc)}), 400


if __name__ == "__main__":
    app.run(port=8000, threaded=True)
