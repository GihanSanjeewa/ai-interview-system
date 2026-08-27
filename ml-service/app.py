from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import re
import whisper
import pdfplumber
import spacy
import os
import json
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List, Optional
import torch
from dotenv import load_dotenv

from audio_analyzer import (
    extract_audio_features,
    compute_confidence_score,
    compute_fluency_score,
    compute_speaking_speed_score,
    get_feature_vector,
    LIBROSA_AVAILABLE,
)
from text_analyzer import (
    analyze_conversation,
    compute_communication_quality,
    compute_response_relevance,
    compute_technical_accuracy,
    FILLER_WORDS,
)
from classifier import classify_candidate_performance
from rag_engine import rag_engine
from code_evaluator import evaluate_code_solution
from tts_engine import generate_speech_audio
from model_registry import registry

# Project-owned interview intelligence.
import cv_analyzer
import interview_engine
import report_generator
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


def analyze_cv_content(raw_text: str) -> dict:
    """
    Section-aware CV analysis, delegated to `cv_analyzer`.

    The previous implementation matched flat regexes across the whole document,
    which produced sentence fragments as qualifications, substituted an invented
    degree when none was found, and computed experience as (max year - min year)
    across every date on the page. `cv_analyzer` segments the document first and
    returns empty fields plus warnings when evidence is genuinely absent.

    Legacy alias keys (`extracted_info`, `domains`) are preserved so existing
    callers keep working.
    """
    result = cv_analyzer.analyze_cv(raw_text or "")

    result["extracted_info"] = {
        "skills": result["skills"],
        "education": result["education"],
        "experience": result["experience"],
        "certifications": result["certifications"],
        "technologies": result["technologies"],
        "projects": result["projects"],
    }
    result["domains"] = result["suggestedTracks"]
    return result


@app.route("/parse_cv", methods=["POST"])
@app.route("/cv/parse", methods=["POST"])
def parse_cv():
    upload = request.files.get("file") or request.files.get("cv")
    if upload is None:
        return jsonify({"error": "No file uploaded"}), 400

    filename = upload.filename.lower()
    text = ""

    if filename.endswith(".pdf"):
        file_path = "temp_cv.pdf"
        upload.save(file_path)
        try:
            text = extract_text_from_pdf(file_path)
        except Exception as e:
            print(f"PDF extract note ({e}).")
            text = ""
    elif filename.endswith(".docx") or filename.endswith(".doc"):
        file_path = "temp_cv.docx"
        upload.save(file_path)
        try:
            text = extract_text_from_docx(file_path)
        except Exception as e:
            print(f"DOCX extract note ({e}).")
            text = ""
    else:
        file_path = "temp_cv.txt"
        upload.save(file_path)
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        except Exception:
            text = ""

    parsed_result = analyze_cv_content(text)
    return jsonify(parsed_result)


@app.route("/generate_question", methods=["POST"])
def generate_question():
    """
    Generate the next question for a candidate.

    Source order:
      1. The project's own scratch-trained Transformer LM, when a checkpoint is
         registered and it produces a well-formed question.
      2. Retrieval from the project's own labelled question dataset, ranked by
         similarity to this candidate's CV and by how askable the question is.

    There is no hardcoded question list: if the dataset is unavailable the
    endpoint reports that rather than reciting a canned question.
    """
    data = request.json or {}
    cv_text = data.get("cv_text", "") or ""
    domain = data.get("domain", "") or ""
    history = data.get("history", []) or []
    difficulty = str(data.get("difficulty", "intermediate")).lower()
    profile = data.get("profile") or {}

    active_q_model = registry.get_active_model("question_generator") or {}
    active_model_id = active_q_model.get(
        "model_id", "ai-interview-question-generator-v1.0.0")

    rag_context = rag_engine.retrieve_context(
        f"{domain} {difficulty} question", top_k=2)

    # Questions already asked must not repeat.
    asked = set()
    for turn in history:
        if isinstance(turn, dict) and str(turn.get("role", "")).lower() in (
                "ai", "assistant", "interviewer"):
            text = turn.get("text") or turn.get("content") or ""
            if text:
                asked.add(text.strip().lower())

    # --- 1. our own trained language model -----------------------------------
    prompt = f"[DOMAIN: {domain or 'Software Engineering'}] [DIFFICULTY: {difficulty}] Question:"
    own = generate_with_own_model(prompt, max_tokens=64)
    source = None
    question = None
    if own:
        candidate = own.strip().split("\n")[0].strip()
        # Only use the model's output if it is genuinely askable.
        if interview_engine.QuestionPool.quality_score(candidate) >= \
                interview_engine.QuestionPool.MIN_QUALITY and \
                candidate.strip().lower() not in asked:
            question = candidate
            source = "own_scratch_transformer"

    # --- 2. retrieval over our own dataset -----------------------------------
    retrieved_meta = {}
    if question is None:
        track = interview_engine.infer_track(profile, domain)
        domains = interview_engine.TRACKS[track]["domains"]
        level = interview_engine.DIFFICULTY_ENTRY.get(difficulty, "Intermediate")
        query = interview_engine.profile_text(profile) or cv_text or domain

        got = interview_engine.get_pool().retrieve(
            query, domains, level, k=5, exclude=asked)
        if not got:
            got = interview_engine.get_pool().retrieve(
                query, [], level, k=5, exclude=asked)
        if got:
            # Rotate through the ranked set so a longer interview does not
            # re-ask the single top match.
            pick = got[(len(asked)) % len(got)]
            question = pick.question
            source = "own_dataset_retrieval"
            retrieved_meta = {
                "domain": pick.domain,
                "difficulty": pick.difficulty,
                "quality": round(pick.quality, 2),
                "track": track,
            }

    if question is None:
        return jsonify({
            "error": "no_question_available",
            "detail": "The question dataset is empty or every candidate "
                      "question has already been asked in this session.",
            "model_id": active_model_id,
        }), 503

    return jsonify({
        "question": question,
        "source": source,
        "retrieved": retrieved_meta,
        "rag_context": rag_context,
        "model_id": active_model_id,
        "model_type": active_q_model.get("model_type", "scratch_trained"),
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
    """
    Legacy session-evaluation endpoint, now backed by the real report generator.

    Previously this returned fixed `key_strengths`, `areas_for_improvement`,
    `learning_resources` and `recommendations` regardless of the session, so
    every candidate received identical feedback. It now pairs each question with
    its answer and delegates to `report_generator`, which derives every finding
    from what the candidate actually said. The legacy response shape is
    preserved for existing callers.
    """
    data = request.json or {}
    domain = data.get("domain", "Software Engineering")
    metrics_list = data.get("metrics", []) or []
    conversation_history = data.get("conversation_history", []) or []

    # --- pair the conversation into (question, answer) turns ------------------
    pairs = []
    pending_question = None
    for turn in conversation_history:
        if not isinstance(turn, dict):
            continue
        role = str(turn.get("role", "")).lower()
        text = turn.get("text") or turn.get("content") or ""
        if role in ("ai", "assistant", "interviewer", "system"):
            pending_question = text
        elif role in ("user", "candidate", "human"):
            pairs.append((pending_question or "", text))
            pending_question = None

    # --- attach the per-answer audio metrics that were measured live ----------
    answers = []
    for i, (question, transcript) in enumerate(pairs):
        audio = metrics_list[i] if i < len(metrics_list) and \
            isinstance(metrics_list[i], dict) else None
        q = {
            "text": question,
            "ordinal": i,
            "phase": None,
            "domain": domain,
            "difficulty": None,
            "expects": None,
        }
        scored = _score_one_answer(q, transcript, audio, domain)
        duration_ms = None
        if audio and audio.get("words_per_minute") and scored.get("skipped") is False:
            wpm = float(audio["words_per_minute"])
            wc = len(transcript.split())
            if wpm > 0 and wc:
                duration_ms = int(wc / wpm * 60_000)
        answers.append({
            "question": q,
            "transcript": transcript,
            "metrics": scored,
            "durationMs": duration_ms,
            "intent": scored.get("intent"),
        })

    report = report_generator.generate_report(answers, role=domain, track=domain)

    # --- performance level from the trained audio classifier, when available --
    performance_level = report["performanceLevel"]
    feature_vectors = [m["feature_vector"] for m in metrics_list
                       if isinstance(m, dict) and "feature_vector" in m]
    if feature_vectors:
        try:
            overall_vector = np.mean(feature_vectors, axis=0).tolist()
            performance_level = classify_candidate_performance(overall_vector)
        except Exception as exc:
            print(f"audio classifier note: {exc}")

    summary = _session_summary(report, domain)

    return jsonify({
        "summary": summary,
        "technical_score": int(round(report["technical"])),
        "communication_score": int(round(report["communication"])),
        "confidence_score": int(round(report["confidence"])),
        "fluency_score": int(round(report["fluency"])),
        "speaking_speed_score": int(round(report["paceScore"])),
        "response_relevance_score": int(round(report["relevance"])),
        "overall_score": report["overallScore"],
        "performance_level": performance_level,
        "key_strengths": report["strengths"],
        "areas_for_improvement": report["weaknesses"],
        "recommendations": report["suggestions"],
        "learning_resources": report["resources"],
        "analytics": report["analytics"],
        "per_question": report["perQuestion"],
        "diagnosis": report["diagnosis"],
    })


def _session_summary(report: dict, domain: str) -> str:
    """One honest paragraph describing this specific session."""
    a = report.get("analytics") or {}
    answered = a.get("answeredCount", 0)
    total = a.get("answerCount", 0)
    if not total:
        return "No answers were recorded, so this session could not be assessed."

    parts = [
        "Answered %d of %d questions in the %s round, scoring %.0f/100 overall "
        "(%s)." % (answered, total, domain, report["overallScore"],
                   report["performanceLevel"].title())
    ]
    if report["technical"] or report["communication"]:
        parts.append(
            "Technical accuracy averaged %.0f and communication %.0f."
            % (report["technical"], report["communication"]))
    if a.get("skippedCount"):
        parts.append("%d question(s) were declined." % a["skippedCount"])
    if a.get("concreteExamples") is not None:
        parts.append("%d answer(s) included a concrete example."
                     % a["concreteExamples"])
    return " ".join(parts)


# ─── Adapter endpoints for TS BFF ─────────────────────────────────────────────

# ─── Live interview endpoints ─────────────────────────────────────────────────

@app.route("/interview/plan", methods=["POST"])
def interview_plan():
    """
    Build a personalised interview plan for one candidate.

    Questions are retrieved from the project's own labelled dataset and grounded
    in the candidate's actual CV, rather than served from a fixed list.

    Body: {profile: <cv_analyzer output or subset>, role, track, difficulty,
           total}
    """
    data = request.get_json(silent=True) or {}
    profile = data.get("profile") or {}
    if not isinstance(profile, dict):
        profile = {}

    try:
        plan = interview_engine.build_plan(
            profile=profile,
            role=str(data.get("role") or ""),
            track=str(data.get("track") or data.get("category") or ""),
            difficulty=str(data.get("difficulty") or "medium"),
            total=int(data.get("total") or 8),
        )
    except Exception as exc:
        print(f"interview/plan error: {exc}")
        return jsonify({"error": "plan_failed", "detail": str(exc)}), 500

    return jsonify(plan)


@app.route("/interview/turn", methods=["POST"])
def interview_turn():
    """
    Decide the interviewer's next move for one turn.

    This is what makes the interview conversational: the candidate's answer is
    classified (answered / declined / too shallow / asked for a repeat) and the
    interviewer responds accordingly - acknowledging, probing deeper, easing the
    difficulty, or moving on. Saying "I don't know" moves the interview forward
    instead of stalling it.

    Body: {question, answer, answerScore, history, profile, track, difficulty,
           followupsUsed, remaining}
    """
    data = request.get_json(silent=True) or {}
    question = data.get("question") or {}
    if isinstance(question, str):
        question = {"text": question}

    try:
        decision = interview_engine.decide_turn(
            question=question,
            answer=str(data.get("answer") or data.get("transcript") or ""),
            answer_score=data.get("answerScore") or data.get("metrics"),
            history=data.get("history") or [],
            profile=data.get("profile") or {},
            track=str(data.get("track") or data.get("category") or ""),
            difficulty=str(data.get("difficulty") or "medium"),
            followups_used=int(data.get("followupsUsed") or 0),
            remaining=int(data.get("remaining") if data.get("remaining")
                          is not None else 1),
        )
    except Exception as exc:
        print(f"interview/turn error: {exc}")
        # Never strand a live interview: fall back to advancing the plan.
        return jsonify({
            "action": "next",
            "say": "Thank you. Let's move on to the next question.",
            "intent": "substantive",
            "intentConfidence": 0.0,
            "intentReason": f"turn decision failed: {exc}",
            "skipped": False,
            "followup": None,
            "note": "fallback",
        })

    return jsonify(decision)


@app.route("/interview/classify_turn", methods=["POST"])
def interview_classify_turn():
    """Expose the turn-intent classifier on its own (used by tests/notebooks)."""
    data = request.get_json(silent=True) or {}
    return jsonify(interview_engine.classify_turn(
        str(data.get("text") or data.get("answer") or "")))


# ─── Scoring endpoints ────────────────────────────────────────────────────────

def _score_one_answer(
    question: Any,
    transcript: str,
    audio: Optional[Dict[str, Any]] = None,
    domain: str = "",
) -> Dict[str, Any]:
    """
    Score a single answer from its text, plus audio metrics when available.

    Text metrics (communication / relevance / technical) come from
    `text_analyzer`; delivery metrics (confidence / fluency / pace) come from the
    librosa audio analysis performed at transcription time. When no audio was
    supplied, delivery is estimated from the text alone and flagged as such
    rather than filled in with a constant.
    """
    q_text = question.get("text") if isinstance(question, dict) else str(question or "")
    q_text = q_text or ""
    text = (transcript or "").strip()
    audio = audio or {}

    # A declined question must not be scored as a wrong answer.
    intent = interview_engine.classify_turn(text)
    if intent["intent"] in ("dont_know", "silent"):
        return {
            "confidence": round(float(audio.get("confidence_score") or 0.0), 1),
            "communication": 0.0,
            "relevance": 0.0,
            "technical": 0.0,
            "fluency": round(float(audio.get("fluency_score") or 0.0), 1),
            "pace": round(float(audio.get("words_per_minute") or 0.0), 1),
            "intent": intent["intent"],
            "skipped": True,
            "audioMeasured": bool(audio),
            "notes": ["Question declined - excluded from accuracy scoring."],
        }

    domain = domain or (question.get("domain") if isinstance(question, dict) else "")
    expects = question.get("expects") if isinstance(question, dict) else None
    phase = (question.get("phase") if isinstance(question, dict) else "") or ""

    communication = compute_communication_quality(text)
    relevance = compute_response_relevance(q_text, text, expects=expects)

    # Technical accuracy is only meaningful for a question that tests technical
    # knowledge. Scoring it on "tell me about yourself" or "do you have any
    # questions for us?" measures nothing and drags the session average down —
    # a good self-introduction scored 42/100 for technical accuracy purely
    # because an introduction is not a technical exposition.
    NON_TECHNICAL_PHASES = {"greet", "behavior", "behavioural", "wrap"}
    if phase.lower() in NON_TECHNICAL_PHASES:
        technical = None
    else:
        technical = compute_technical_accuracy(
            text, domain or "Software Engineering")

    if audio:
        confidence = float(audio.get("confidence_score") or 0.0)
        fluency = float(audio.get("fluency_score") or 0.0)
        wpm = float(audio.get("words_per_minute") or 0.0)
    else:
        # No audio: derive delivery proxies from the text so the number is at
        # least grounded in this answer, and mark it as unmeasured.
        words = text.split()
        fillers = sum(1 for w in words if w.strip(".,!?").lower() in FILLER_WORDS)
        filler_rate = (fillers / len(words) * 100) if words else 0.0
        fluency = max(20.0, min(100.0, 100.0 - filler_rate * 6.0))
        confidence = max(20.0, min(100.0, communication * 0.6 + fluency * 0.4))
        wpm = 0.0

    notes: List[str] = []
    if not audio:
        notes.append("No audio was supplied; confidence and fluency are text "
                     "estimates, not acoustic measurements.")
    if len(text.split()) < 15:
        notes.append("Answer was very short, which limits every text metric.")

    if technical is None:
        notes.append("This question does not test technical knowledge, so "
                     "technical accuracy was not scored for it.")

    return {
        "confidence": round(confidence, 1),
        "communication": round(float(communication), 1),
        "relevance": round(float(relevance), 1),
        # None (not 0) so the report aggregator omits it rather than averaging
        # a zero into the session's technical accuracy.
        "technical": None if technical is None else round(float(technical), 1),
        "fluency": round(fluency, 1),
        "pace": round(wpm, 1),
        "intent": intent["intent"],
        "skipped": False,
        "audioMeasured": bool(audio),
        "notes": notes,
    }


@app.route("/score/answer", methods=["POST"])
def score_answer_v2():
    """Score one answer. Accepts optional `audio` metrics from /transcribe."""
    data = request.get_json(silent=True) or {}
    return jsonify(_score_one_answer(
        question=data.get("question") or "",
        transcript=str(data.get("transcript") or ""),
        audio=data.get("audio") or data.get("audioMetrics"),
        domain=str(data.get("domain") or ""),
    ))


@app.route("/score/session", methods=["POST"])
def score_session_v2():
    """
    Generate the full performance report from the session's real answers.

    Every score, strength, weakness, suggestion and resource is derived from
    what the candidate actually said - see `report_generator`. Answers missing
    per-answer metrics are scored here before aggregation, so a session that
    skipped live scoring still produces a genuine report.
    """
    data = request.get_json(silent=True) or {}
    raw_answers = data.get("answers") or []
    role = str(data.get("role") or "")
    track = str(data.get("track") or data.get("category") or "")

    prepared: List[Dict[str, Any]] = []
    for i, a in enumerate(raw_answers):
        if not isinstance(a, dict):
            continue
        question = a.get("question")
        if isinstance(question, str) or question is None:
            question = {
                "text": question or "",
                "ordinal": a.get("ordinal", i),
                "phase": a.get("phase"),
                "domain": a.get("domain"),
                "difficulty": a.get("difficulty"),
                "expects": a.get("expects"),
            }
        transcript = str(a.get("transcript") or "")
        metrics = a.get("metrics")
        # Backfill metrics for any answer that was not scored live.
        if not isinstance(metrics, dict) or not metrics:
            metrics = _score_one_answer(
                question=question,
                transcript=transcript,
                audio=a.get("audio") or a.get("audioMetrics"),
                domain=str(question.get("domain") or ""),
            )
        prepared.append({
            "question": question,
            "transcript": transcript,
            "metrics": metrics,
            "durationMs": a.get("durationMs") or a.get("duration_ms"),
            "intent": a.get("intent") or metrics.get("intent"),
        })

    try:
        report = report_generator.generate_report(
            answers=prepared,
            role=role,
            track=track,
            language=str(data.get("language") or "en"),
        )
    except Exception as exc:
        print(f"score/session error: {exc}")
        return jsonify({"error": "report_failed", "detail": str(exc)}), 500

    return jsonify(report)


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
