"""
Text-based ML feature extraction using spaCy and scikit-learn TF-IDF.
Computes: communication quality, response relevance, and technical accuracy.
"""

import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
    SPACY_AVAILABLE = True
except Exception:
    SPACY_AVAILABLE = False
    print("spaCy model not loaded — text ML features will use basic fallback.")


# ── Domain keyword dictionaries ───────────────────────────────────────────────
DOMAIN_KEYWORDS = {
    "Software Engineering": [
        "algorithm", "data structure", "complexity", "oop", "object oriented",
        "design pattern", "solid", "api", "rest", "microservice", "testing",
        "unit test", "agile", "scrum", "git", "version control", "debugging",
        "refactoring", "inheritance", "polymorphism", "abstraction", "encapsulation",
        "recursion", "sorting", "searching", "linked list", "binary tree"
    ],
    "Web Development": [
        "html", "css", "javascript", "react", "vue", "angular", "node", "express",
        "rest api", "http", "responsive", "frontend", "backend", "database",
        "sql", "nosql", "mongodb", "deployment", "docker", "webpack", "dom",
        "async", "promise", "fetch", "cors", "authentication", "session", "cookie"
    ],
    "Data Science": [
        "machine learning", "deep learning", "neural network", "model", "training",
        "dataset", "feature", "regression", "classification", "clustering",
        "pandas", "numpy", "scikit", "tensorflow", "pytorch", "accuracy", "precision",
        "recall", "f1", "overfitting", "underfitting", "cross validation",
        "exploratory", "visualization", "statistics", "hypothesis"
    ],
    "Networking": [
        "tcp", "ip", "protocol", "router", "switch", "firewall", "dns", "dhcp",
        "subnet", "vpn", "osi", "layer", "bandwidth", "latency", "packet",
        "network", "socket", "port", "security", "encryption", "https", "ssl"
    ],
    "UI/UX": [
        "user experience", "usability", "wireframe", "prototype", "figma",
        "design system", "accessibility", "a11y", "user research", "persona",
        "journey map", "typography", "color theory", "heuristic", "feedback",
        "iteration", "responsive", "interaction", "affordance", "cognitive"
    ],
    "Business Analysis": [
        "requirements", "stakeholder", "use case", "user story", "bpmn",
        "process", "workflow", "kpi", "roi", "feasibility", "gap analysis",
        "agile", "scrum", "documentation", "sla", "risk", "scope", "prioritization"
    ],
}

FILLER_WORDS = {
    "um", "uh", "like", "er", "ah", "hmm", "basically", "literally",
    "right", "you know", "i mean", "kind of", "sort of"
}

DISCOURSE_MARKERS = {
    "firstly", "secondly", "finally", "furthermore", "however", "therefore",
    "in addition", "moreover", "consequently", "for example", "for instance",
    "in conclusion", "to summarize", "on the other hand", "as a result"
}


# ── Communication Quality ─────────────────────────────────────────────────────

def compute_communication_quality(text: str) -> float:
    """
    Communication Quality — scored 0-100.

    ML/NLP features:
      - Vocabulary richness (type-token ratio): diverse words = better communication
      - Average sentence length: too short (no depth) or too long (unclear) both penalised
      - Discourse markers: structured, organised speech
      - Filler word rate: penalised
      - Named entity / concrete detail usage (spaCy)
    """
    if not text or len(text.strip()) < 10:
        return 20.0

    words = text.lower().split()
    word_count = len(words)
    if word_count < 5:
        return 20.0

    # Vocabulary richness — unique words / total words (ideal: 0.6-0.85)
    unique_words = set(words)
    ttr = len(unique_words) / word_count
    if ttr >= 0.80:
        vocab_score = 100.0
    elif ttr >= 0.60:
        vocab_score = 70.0 + (ttr - 0.60) * 150
    elif ttr >= 0.40:
        vocab_score = 40.0 + (ttr - 0.40) * 150
    else:
        vocab_score = max(0.0, ttr * 100)

    # Sentence structure (via spaCy or simple splitting)
    if SPACY_AVAILABLE:
        doc = nlp(text)
        sentences = list(doc.sents)
        avg_sent_len = np.mean([len(list(s)) for s in sentences]) if sentences else word_count
        # Named entities (concrete references) — shows knowledge
        entity_bonus = min(20.0, len(doc.ents) * 3.0)
    else:
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        avg_sent_len = word_count / max(len(sentences), 1)
        entity_bonus = 0.0

    # Sentence length score (ideal: 10-25 words per sentence)
    if 10 <= avg_sent_len <= 25:
        sent_score = 100.0
    elif avg_sent_len < 10:
        sent_score = max(20.0, avg_sent_len * 8)
    else:
        sent_score = max(20.0, 100.0 - (avg_sent_len - 25) * 3)

    # Discourse marker usage — indicates structured communication
    text_lower = text.lower()
    marker_count = sum(1 for m in DISCOURSE_MARKERS if m in text_lower)
    marker_score = min(100.0, 50.0 + marker_count * 15.0)

    # Filler word penalty
    filler_count = sum(1 for w in words if w in FILLER_WORDS)
    filler_rate = filler_count / word_count
    filler_penalty = min(40.0, filler_rate * 200)

    raw = (vocab_score * 0.30 + sent_score * 0.25 + marker_score * 0.25 + entity_bonus * 0.20)
    final = max(0.0, raw - filler_penalty)
    return round(float(final), 1)


# ── Response Relevance ────────────────────────────────────────────────────────

def compute_response_relevance(question: str, answer: str) -> float:
    """
    Response Relevance — scored 0-100.

    ML approach: TF-IDF cosine similarity between question and answer.
    Higher overlap in important terms = more relevant answer.
    """
    if not question or not answer:
        return 50.0

    question = question.strip()
    answer   = answer.strip()

    if len(answer.split()) < 5:
        return 20.0

    try:
        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        tfidf_matrix = vectorizer.fit_transform([question, answer])
        similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        # Raw cosine similarity is usually 0.05-0.5 for good answers; scale to 0-100
        scaled = min(100.0, similarity * 300)
        # Floor: if answer is long and coherent, assume at least 30 relevance
        if len(answer.split()) > 30:
            scaled = max(30.0, scaled)
        return round(float(scaled), 1)
    except Exception:
        return 50.0


# ── Technical Accuracy ────────────────────────────────────────────────────────

def compute_technical_accuracy(answer: str, domain: str) -> float:
    """
    Technical Accuracy — scored 0-100.

    ML/NLP approach: domain keyword density scoring.
    Counts how many domain-specific technical terms appear in the answer,
    normalised by answer length and expected keyword usage.
    """
    if not answer:
        return 30.0

    answer_lower = answer.lower()
    words = answer_lower.split()
    word_count = max(len(words), 1)

    # Find the best matching domain keyword list
    keywords = DOMAIN_KEYWORDS.get(domain, [])
    if not keywords:
        # Try partial match
        for key in DOMAIN_KEYWORDS:
            if key.lower() in domain.lower() or domain.lower() in key.lower():
                keywords = DOMAIN_KEYWORDS[key]
                break

    if not keywords:
        # Fallback: generic technical indicators
        keywords = ["because", "therefore", "however", "implement", "system",
                    "process", "method", "approach", "solution", "problem"]

    matched = [kw for kw in keywords if kw in answer_lower]
    keyword_density = len(matched) / word_count * 100  # keywords per 100 words

    # Longer answers with more keywords score higher
    length_bonus = min(15.0, (word_count / 150) * 15)

    # Scoring: 0 keywords = 20, ideal density (2-5 per 100w) = 85-100
    if keyword_density == 0:
        base = 20.0
    elif keyword_density < 1:
        base = 30.0 + keyword_density * 30
    elif keyword_density < 3:
        base = 60.0 + (keyword_density - 1) * 12.5
    elif keyword_density < 6:
        base = 85.0 + (keyword_density - 3) * 5
    else:
        base = 100.0

    final = min(100.0, base + length_bonus)
    return round(float(final), 1)


# ── Batch analysis across all Q&A turns ──────────────────────────────────────

def analyze_conversation(history: list, domain: str) -> dict:
    """
    Run all text-based ML analyses across the full interview conversation.
    history: list of {role: "assistant"|"user", content: "..."}
    Returns averaged scores for communication, relevance, and technical accuracy.
    """
    questions = [m["content"] for m in history if m.get("role") == "assistant"]
    answers   = [m["content"] for m in history if m.get("role") == "user"]

    if not answers:
        return {
            "communication_quality": 50.0,
            "response_relevance":    50.0,
            "technical_accuracy":    50.0,
            "answer_count":          0
        }

    comm_scores     = [compute_communication_quality(a) for a in answers]
    tech_scores     = [compute_technical_accuracy(a, domain) for a in answers]
    relevance_scores = []

    for i, answer in enumerate(answers):
        q = questions[i] if i < len(questions) else ""
        relevance_scores.append(compute_response_relevance(q, answer))

    return {
        "communication_quality": round(float(np.mean(comm_scores)), 1),
        "response_relevance":    round(float(np.mean(relevance_scores)), 1),
        "technical_accuracy":    round(float(np.mean(tech_scores)), 1),
        "answer_count":          len(answers),
        # Per-answer breakdown (useful for charts/notebooks)
        "per_answer": [
            {
                "communication_quality": round(comm_scores[i], 1),
                "response_relevance":    round(relevance_scores[i], 1),
                "technical_accuracy":    round(tech_scores[i], 1),
            }
            for i in range(len(answers))
        ]
    }
