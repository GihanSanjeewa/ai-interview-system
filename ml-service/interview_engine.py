"""
Interview Engine - the conversational brain of the AI Interview System.

Responsibilities
----------------
1. Build a *personalised* interview plan from the candidate's real CV profile by
   retrieving questions from the project's own labelled dataset
   (`dataset/processed/question_generator/`, 8k+ domain+difficulty tagged items).
2. Classify what the candidate actually did on each turn (answered / said they
   don't know / rambled off topic / asked for clarification / stayed silent).
3. Decide the next interviewer move - acknowledge, probe deeper, simplify,
   escalate, or move on - the way a human interviewer would.

Design constraints (project policy)
-----------------------------------
* No pretrained / external LLM weights. Every learned component here is trained
  in-process on project-owned data:
    - TF-IDF retrieval over our own question dataset
    - A LogisticRegression turn-intent classifier trained on a project-authored
      labelled corpus (see INTENT_CORPUS)
* Optional: the project's own scratch-trained Transformer LM
  (`transformer_scratch.py`) phrases follow-up probes when a checkpoint exists;
  otherwise probes are grounded deterministically in the candidate's own words.
"""
from __future__ import annotations

import json
import logging
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import numpy as np

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.pipeline import Pipeline
    SKLEARN_AVAILABLE = True
except Exception:  # pragma: no cover
    SKLEARN_AVAILABLE = False

log = logging.getLogger("interview_engine")

BASE_DIR = Path(__file__).resolve().parent
QG_DIR = BASE_DIR / "dataset" / "processed" / "question_generator"


# =============================================================================
# 1. Track definitions - MUST stay in sync with backend question-bank.ts TRACKS
# =============================================================================

# Maps a backend track id -> the dataset `domain` labels that belong to it, and
# the CV technologies that signal the candidate is on that track.
TRACKS: Dict[str, Dict[str, Any]] = {
    "software_engineering": {
        "label": "Software Engineering",
        "domains": ["OOP", "Design Patterns", "Algorithms", "Data Structures",
                    "Unit Testing", "Programming Languages", "Concurrency"],
        "signals": ["Java", "C++", "C#", "Python", "Go", "Rust", "Git", "CI/CD",
                    "Object-Oriented Programming (OOP)", "SOLID Principles",
                    "Test-Driven Development (TDD)", "Clean Code",
                    "Problem Solving"],
    },
    "web_development": {
        "label": "Web Development",
        "domains": ["Frontend Development", "REST APIs", "Security",
                    "Programming Languages"],
        "signals": ["React", "Angular", "Vue.js", "Next.js", "Node.js",
                    "Express.js", "NestJS", "TypeScript", "JavaScript",
                    "HTML/CSS", "Tailwind CSS", "GraphQL", "REST API"],
    },
    "data_science": {
        "label": "Data Science",
        "domains": ["Algorithms", "Data Structures", "SQL",
                    "Database Optimization", "Programming Languages"],
        "signals": ["Machine Learning", "PyTorch", "TensorFlow", "Python",
                    "SQL", "PostgreSQL"],
    },
    "networking": {
        "label": "Networking",
        "domains": ["Security", "Microservices", "Kubernetes", "Docker",
                    "System Design"],
        "signals": ["Linux", "Docker", "Kubernetes", "AWS", "Azure", "GCP",
                    "Cybersecurity", "Microservices"],
    },
    "ui_ux": {
        "label": "UI/UX",
        "domains": ["Frontend Development"],
        "signals": ["HTML/CSS", "Tailwind CSS", "React", "Vue.js"],
    },
    "business_analysis": {
        "label": "Business Analysis",
        "domains": ["System Design", "Unit Testing", "REST APIs"],
        "signals": ["Agile / Scrum", "API Design"],
    },
}

DEFAULT_TRACK = "software_engineering"

DIFFICULTY_ORDER = ["Beginner", "Intermediate", "Advanced"]

# Map the API's difficulty setting to the *starting* rung on the ladder.
DIFFICULTY_ENTRY = {
    "easy": "Beginner",
    "beginner": "Beginner",
    "medium": "Intermediate",
    "intermediate": "Intermediate",
    "hard": "Advanced",
    "advanced": "Advanced",
}


def resolve_track(track_id: str) -> str:
    """Accept a backend track id, a label, or a legacy alias."""
    if not track_id:
        return DEFAULT_TRACK
    key = track_id.strip().lower().replace(" ", "_").replace("-", "_")
    if key in TRACKS:
        return key
    legacy = {
        "swe": "software_engineering", "react": "web_development",
        "node": "web_development", "python": "software_engineering",
        "frontend": "web_development", "backend": "software_engineering",
        "devops": "networking", "system_design": "software_engineering",
        "ml": "data_science", "dotnet": "software_engineering",
        "hr": "business_analysis", "behavioral": "business_analysis",
        "leadership": "business_analysis", "uiux": "ui_ux", "ux": "ui_ux",
        "ba": "business_analysis", "data": "data_science",
    }
    if key in legacy:
        return legacy[key]
    for tid, meta in TRACKS.items():
        if meta["label"].lower() == track_id.strip().lower():
            return tid
    return DEFAULT_TRACK


# =============================================================================
# 2. Question pool - retrieval over the project's own labelled dataset
# =============================================================================

@dataclass
class PoolItem:
    qid: str
    question: str
    domain: str
    difficulty: str
    source: str
    quality: float


# The dataset mixes curated interview questions (ali-alkhars/interviews) with
# scraped StackExchange posts. Scraped posts are often *help-desk* questions
# ("How should I implement this requirement?") which are unusable as interview
# prompts because they reference context the candidate cannot see. These gates
# keep only self-contained, askable questions.

# Hard rejects: the question depends on context outside itself.
_CONTEXT_DEPENDENT = re.compile(
    r"\b(this|these|those|above|below|following|attached|my|mine|our|here)\b"
    r"|\b(help|advice|suggestions?)\b"
    r"|\bam\s+i\b|\bshould\s+i\b|\bcan\s+i\b|\bdo\s+i\b|\bhow\s+do\s+i\b"
    r"|\bany(one|body)\b|\bhomework\b",
    re.IGNORECASE,
)

# Openers that make a clean, self-contained interview question.
_GOOD_OPENERS = re.compile(
    r"^\s*(what\s+is|what\s+are|what'?s|what\s+does|what\s+happens|"
    r"why\s+(is|are|does|do|would|should|not)|"
    r"how\s+(does|do|would|is|are|can|to)|"
    r"when\s+(would|should|do|does)|which\b|"
    r"explain|describe|compare|define|differentiate|"
    r"tell\s+me|walk\s+me)\b",
    re.IGNORECASE,
)

# Question shapes that are especially strong in a technical interview.
_STRONG_SHAPES = re.compile(
    r"(difference\s+between|trade[\s-]?offs?|advantages?\s+and\s+disadvantages|"
    r"pros\s+and\s+cons|when\s+would\s+you|why\s+would\s+you|"
    r"how\s+does\s+.*\s+work|what\s+is\s+the\s+purpose)",
    re.IGNORECASE,
)

# Meta questions about hiring, careers, or industry opinion. They read like
# interview questions but test nothing about the candidate's skill.
_META_TOPIC = re.compile(
    r"\b(hire|hiring|recruit(er|ing|ment)?|salary|resume|cv|"
    r"interviewer|candidate|job\s+(offer|market|search)|career|"
    r"certification\s+worth|degree\s+worth|which\s+language\s+should)\b"
    r"|\b(pick|choose|select|find|evaluate)\s+(a|an|the)?\s*(good\s+)?"
    r"(software\s+|senior\s+|junior\s+)?(engineer|developer|programmer|"
    r"team|company|employer)\b",
    re.IGNORECASE,
)

# "How to X" is help-desk imperative phrasing, not how an interviewer asks.
# A real interviewer says "How do you", "How does", "How would you".
_HELPDESK_OPENER = re.compile(r"^\s*how\s+to\b", re.IGNORECASE)

_CURATED_SOURCES = ("ali-alkhars", "interviews")


class QuestionPool:
    """TF-IDF retrieval index over our own question dataset."""

    #: Minimum quality a question must reach to be asked aloud.
    MIN_QUALITY = 0.45

    def __init__(self) -> None:
        self.items: List[PoolItem] = []
        self.rejected = 0
        self._vectorizer = None
        self._matrix = None
        self._load()
        self._fit()

    # -- loading --------------------------------------------------------------
    def _load(self) -> None:
        seen: Set[str] = set()
        for split in ("train.jsonl", "validation.jsonl", "test.jsonl"):
            path = QG_DIR / split
            if not path.exists():
                continue
            with path.open(encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        rec = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    q = (rec.get("question") or "").strip()
                    src = str(rec.get("source") or "")
                    quality = self.quality_score(q, src)
                    if quality < self.MIN_QUALITY:
                        self.rejected += 1
                        continue
                    key = self._norm(q)
                    if key in seen:
                        continue
                    seen.add(key)
                    self.items.append(PoolItem(
                        qid=str(rec.get("id") or "pool-%d" % len(self.items)),
                        question=self._tidy(q),
                        domain=(rec.get("domain") or "General").strip(),
                        difficulty=(rec.get("difficulty") or "Intermediate").strip(),
                        source=src,
                        quality=quality,
                    ))
        log.info("QuestionPool: kept %d questions, rejected %d as unusable",
                 len(self.items), self.rejected)

    @staticmethod
    def _norm(q: str) -> str:
        return re.sub(r"[^a-z0-9 ]", "", q.lower()).strip()

    @staticmethod
    def _tidy(q: str) -> str:
        q = re.sub(r"\s+", " ", q).strip()
        if not q.endswith("?"):
            q += "?"
        return q[0].upper() + q[1:]

    @classmethod
    def quality_score(cls, q: str, source: str = "") -> float:
        """
        Score 0.0-1.0 for how askable a question is in a live interview.
        0.0 means "never read this aloud".
        """
        if not q:
            return 0.0
        text = q.strip()

        # --- hard structural rejects -----------------------------------------
        if not (18 <= len(text) <= 160):
            return 0.0
        if "\n" in text:
            return 0.0
        # Code dumps, URLs, markup, citation artefacts.
        if re.search(r"(https?://|```|<[a-z/][^>]*>|\{\{|\[\d+\]|\$\$|"
                     r"[{};]\s*$|::|==|\+\+|&&)", text):
            return 0.0
        # Context-dependent / help-desk phrasing.
        if _CONTEXT_DEPENDENT.search(text):
            return 0.0
        # Questions about hiring/careers rather than about the craft.
        if _META_TOPIC.search(text):
            return 0.0
        if _HELPDESK_OPENER.match(text):
            return 0.0
        # Must be a single question, not a multi-question post.
        if text.count("?") > 1:
            return 0.0
        # Reject sentences with too many capitalised runs (pasted log lines).
        if len(re.findall(r"\b[A-Z]{3,}\b", text)) > 2:
            return 0.0

        words = text.split()
        if not (4 <= len(words) <= 26):
            return 0.0

        # --- graded quality ---------------------------------------------------
        score = 0.35
        if _GOOD_OPENERS.match(text):
            score += 0.30
        elif text.endswith("?"):
            score += 0.05
        else:
            return 0.0                      # not phrased as a question at all

        if _STRONG_SHAPES.search(text):
            score += 0.20
        if any(s in source.lower() for s in _CURATED_SOURCES):
            score += 0.20                   # curated interview questions
        if 6 <= len(words) <= 18:
            score += 0.10                   # comfortable to say out loud
        return min(1.0, score)

    # -- indexing -------------------------------------------------------------
    def _fit(self) -> None:
        if not (SKLEARN_AVAILABLE and self.items):
            return
        try:
            self._vectorizer = TfidfVectorizer(
                stop_words="english", ngram_range=(1, 2),
                max_features=20000, sublinear_tf=True,
            )
            self._matrix = self._vectorizer.fit_transform(
                ["%s %s" % (i.question, i.domain) for i in self.items]
            )
        except Exception as exc:  # pragma: no cover
            log.warning("QuestionPool index failed: %s", exc)
            self._vectorizer = None

    # -- querying -------------------------------------------------------------
    def candidates(self, domains: List[str], difficulty: str) -> List[int]:
        dom = {d.lower() for d in domains}
        return [
            idx for idx, it in enumerate(self.items)
            if it.difficulty.lower() == difficulty.lower()
            and (not dom or it.domain.lower() in dom)
        ]

    def retrieve(
        self,
        profile_text: str,
        domains: List[str],
        difficulty: str,
        k: int = 5,
        exclude: Optional[Set[str]] = None,
    ) -> List[PoolItem]:
        """Top-k questions in `domains`/`difficulty` most similar to the CV."""
        exclude = exclude or set()
        pool_idx = self.candidates(domains, difficulty)
        if not pool_idx:
            pool_idx = self.candidates([], difficulty)
        if not pool_idx:
            return []

        if self._vectorizer is None or not profile_text.strip():
            sample = [self.items[i] for i in pool_idx
                      if self.items[i].question.lower() not in exclude]
            sample.sort(key=lambda it: -it.quality)
            return sample[:k]

        qvec = self._vectorizer.transform([profile_text])
        sims = cosine_similarity(qvec, self._matrix[pool_idx]).ravel()
        # Rank by CV relevance *and* askability: a perfectly relevant question
        # that reads badly out loud is worse than a clean adjacent one.
        quality = np.array([self.items[i].quality for i in pool_idx])
        ranked = 0.65 * sims + 0.35 * quality

        out: List[PoolItem] = []
        for o in np.argsort(-ranked):
            item = self.items[pool_idx[int(o)]]
            if item.question.lower() in exclude:
                continue
            out.append(item)
            if len(out) >= k:
                break
        return out


_POOL: Optional[QuestionPool] = None


def get_pool() -> QuestionPool:
    global _POOL
    if _POOL is None:
        _POOL = QuestionPool()
    return _POOL


# =============================================================================
# 3. Turn-intent classifier - trained in-process on a project-owned corpus
# =============================================================================

# Labelled seed corpus. Deliberately small and hand-authored so the model is
# fully project-owned and auditable. Labels drive interviewer behaviour.
INTENT_CORPUS: List[tuple] = [
    # -- dont_know: candidate explicitly cannot answer -> move on kindly ------
    ("i don't know", "dont_know"),
    ("i dont know", "dont_know"),
    ("i do not know", "dont_know"),
    ("i have no idea", "dont_know"),
    ("no idea", "dont_know"),
    ("sorry i don't know that", "dont_know"),
    ("i'm not sure about this one", "dont_know"),
    ("not sure", "dont_know"),
    ("i haven't worked with that", "dont_know"),
    ("i have never used that", "dont_know"),
    ("i can't answer that", "dont_know"),
    ("i cannot answer this question", "dont_know"),
    ("i don't remember", "dont_know"),
    ("i forgot", "dont_know"),
    ("pass", "dont_know"),
    ("skip this question", "dont_know"),
    ("next question please", "dont_know"),
    ("can we move on", "dont_know"),
    ("let's skip that one", "dont_know"),
    ("i am blank right now", "dont_know"),
    ("that's outside my experience", "dont_know"),
    ("never heard of it", "dont_know"),
    ("no comment", "dont_know"),
    ("i studied it but i can't recall", "dont_know"),
    ("mata therenne nathi", "dont_know"),          # Sinhala: "I don't understand"
    ("danne nathi", "dont_know"),                  # Sinhala: "don't know"
    ("mama danne nae", "dont_know"),

    # -- clarify: candidate wants the question restated -----------------------
    ("could you repeat the question", "clarify"),
    ("can you repeat that please", "clarify"),
    ("sorry could you say that again", "clarify"),
    ("what do you mean by that", "clarify"),
    ("can you rephrase the question", "clarify"),
    ("i didn't catch that", "clarify"),
    ("could you clarify what you're asking", "clarify"),
    ("do you mean in the context of production", "clarify"),
    ("are you asking about the frontend or the backend", "clarify"),
    ("sorry i missed the last part", "clarify"),
    ("one more time please", "clarify"),

    # -- substantive: a real attempt at an answer -----------------------------
    ("a rest api is stateless so every request carries its own authentication "
     "context and the server keeps no session", "substantive"),
    ("i used react hooks to manage local state and context for the theme, and "
     "moved server data into react query", "substantive"),
    ("indexes speed reads because the database can seek instead of scanning, "
     "but they cost write throughput and disk", "substantive"),
    ("in my last project i led the migration from a monolith to three services "
     "and we cut deploy time from an hour to ten minutes", "substantive"),
    ("polymorphism lets a subclass override behaviour so the caller depends on "
     "the interface rather than the concrete type", "substantive"),
    ("we handled the race condition with an optimistic lock on the version "
     "column and retried the transaction", "substantive"),
    ("first i profiled the endpoint, found an n plus one query, then batched "
     "the loads and latency dropped by eighty percent", "substantive"),
    ("docker packages the app with its dependencies into an image so the same "
     "artefact runs identically in staging and production", "substantive"),
    ("unit tests isolate one function with mocked collaborators while "
     "integration tests exercise the real database", "substantive"),
    ("i would start by clarifying the read and write volume, then decide "
     "whether we need sharding at all", "substantive"),
    ("my name is nimal and i graduated in computer science, i have been "
     "building web applications for about three years", "substantive"),
    ("the tradeoff is consistency versus availability, so under a partition "
     "you have to pick which one to give up", "substantive"),
    ("i disagreed with the design, so i wrote a short document with benchmarks "
     "and we reviewed it as a team", "substantive"),
    ("garbage collection reclaims unreachable objects, and generational "
     "collectors assume most objects die young", "substantive"),
    ("i validate accessibility with keyboard navigation and a screen reader, "
     "not just the contrast checker", "substantive"),
    ("we elicited requirements through stakeholder workshops and then wrote "
     "acceptance criteria for each user story", "substantive"),

    # -- thin: on-topic but far too shallow -> probe for depth ---------------
    ("yes", "thin"),
    ("no", "thin"),
    ("yeah i did that", "thin"),
    ("it is a framework", "thin"),
    ("for performance", "thin"),
    ("i used react", "thin"),
    ("basically the same thing", "thin"),
    ("it depends", "thin"),
    ("i think so", "thin"),
    ("that's correct", "thin"),
    ("a database", "thin"),
    ("okay", "thin"),
    ("sure", "thin"),
    ("just normal testing", "thin"),
    ("nothing much", "thin"),
    ("we used docker", "thin"),
]


class TurnIntentClassifier:
    """
    Classifies the candidate's turn into: dont_know | clarify | thin |
    substantive | silent.

    A LogisticRegression over character+word TF-IDF, trained at import time on
    INTENT_CORPUS (project-owned data, no pretrained weights). High-precision
    lexical rules run first because "I don't know" must never be misread.
    """

    DONT_KNOW_PATTERNS = [
        r"\b(i|we)\s+(really\s+)?(do\s+not|don'?t|dont|cannot|can'?t)\s+"
        r"(know|remember|recall|answer)\b",
        r"\bno\s+(idea|clue|comment)\b",
        r"\bnot\s+(sure|familiar)\b",
        r"\b(never|haven'?t|have\s+not)\s+(heard|used|worked|seen)\b",
        r"\b(skip|pass)\s*(this|that|it)?\b",
        r"\b(next|another)\s+question\b",
        r"\bmove\s+on\b",
        r"\bi'?m\s+blank\b",
        r"\bdanne\s+n(ae|athi|ee)\b",
        r"\btherenne\s+nathi\b",
    ]

    CLARIFY_PATTERNS = [
        r"\b(repeat|rephrase|say\s+that\s+again|one\s+more\s+time)\b",
        r"\bwhat\s+do\s+you\s+mean\b",
        r"\bcould\s+you\s+clarify\b",
        r"\b(didn'?t|did\s+not)\s+(catch|hear|get)\b",
        r"\bare\s+you\s+asking\b",
    ]

    def __init__(self) -> None:
        self.model = None
        self._train()

    def _train(self) -> None:
        if not SKLEARN_AVAILABLE:
            return
        texts = [t for t, _ in INTENT_CORPUS]
        labels = [l for _, l in INTENT_CORPUS]
        try:
            self.model = Pipeline([
                ("tfidf", TfidfVectorizer(
                    analyzer="char_wb", ngram_range=(2, 5),
                    sublinear_tf=True, min_df=1)),
                ("clf", LogisticRegression(
                    max_iter=1000, class_weight="balanced", C=4.0)),
            ])
            self.model.fit(texts, labels)
            log.info("TurnIntentClassifier trained on %d examples", len(texts))
        except Exception as exc:  # pragma: no cover
            log.warning("TurnIntentClassifier training failed: %s", exc)
            self.model = None

    def classify(self, text: str) -> Dict[str, Any]:
        raw = (text or "").strip()
        words = raw.split()
        low = raw.lower()

        if not raw or len(words) < 2:
            if not raw:
                return self._out("silent", 1.0, "no speech captured")
            # A single word is only a real answer if it is a term, not a filler.
            if low in {"yes", "no", "okay", "ok", "sure", "maybe", "pass",
                       "skip", "next", "nothing", "none"}:
                intent = "dont_know" if low in {"pass", "skip", "next", "none",
                                                "nothing"} else "thin"
                return self._out(intent, 0.95, "single-token response")

        for pat in self.DONT_KNOW_PATTERNS:
            if re.search(pat, low):
                return self._out("dont_know", 0.97, "lexical rule: %s" % pat)
        for pat in self.CLARIFY_PATTERNS:
            if re.search(pat, low):
                return self._out("clarify", 0.95, "lexical rule: %s" % pat)

        # A long turn with substance shouldn't be second-guessed by the model.
        if len(words) >= 35:
            return self._out("substantive", 0.9, "length >= 35 words")
        if len(words) <= 6:
            return self._out("thin", 0.85, "length <= 6 words")

        if self.model is None:
            return self._out("substantive" if len(words) >= 15 else "thin",
                             0.6, "heuristic fallback (sklearn unavailable)")

        probs = self.model.predict_proba([low])[0]
        classes = list(self.model.named_steps["clf"].classes_)
        best = int(np.argmax(probs))
        label, conf = classes[best], float(probs[best])
        # The model is trained on short exemplars; for mid-length turns trust
        # word count over a low-confidence prediction.
        if conf < 0.45:
            label = "substantive" if len(words) >= 20 else "thin"
            return self._out(label, conf, "low-confidence -> length prior")
        return self._out(label, conf, "tfidf+logreg")

    @staticmethod
    def _out(intent: str, confidence: float, reason: str) -> Dict[str, Any]:
        return {"intent": intent,
                "confidence": round(float(confidence), 3),
                "reason": reason}


_INTENT: Optional[TurnIntentClassifier] = None


def get_intent_classifier() -> TurnIntentClassifier:
    global _INTENT
    if _INTENT is None:
        _INTENT = TurnIntentClassifier()
    return _INTENT


def classify_turn(text: str) -> Dict[str, Any]:
    return get_intent_classifier().classify(text)


# =============================================================================
# 4. Interviewer speech - acknowledgements grounded in what happened
# =============================================================================

# Multiple variants per situation so the interviewer doesn't sound like a loop.
ACK_SUBSTANTIVE = [
    "Thank you, that's clear.",
    "Good - I follow your reasoning.",
    "That makes sense, thank you.",
    "Right, I see how you approached that.",
    "Understood, thanks for walking me through it.",
]

ACK_STRONG = [
    "That's a strong answer - you covered the trade-offs well.",
    "Nice, that's exactly the level of detail I was looking for.",
    "Very good. You clearly have hands-on experience there.",
]

ACK_DONT_KNOW = [
    "No problem at all - that's a fair thing not to know. Let's move on.",
    "That's completely fine. Not knowing something is a normal answer in an interview - let's try a different area.",
    "No worries, we'll leave that one. Moving to the next question.",
    "That's alright. I'd rather you say so than guess. Let's continue.",
]

ACK_DONT_KNOW_EASIER = [
    "That's fine. Let me come at it from a simpler angle.",
    "No problem - let me ask something more foundational instead.",
    "Understood. Let's step back to something closer to your experience.",
]

ACK_THIN = [
    "Okay - could you expand on that a little?",
    "I'd like a bit more detail there.",
    "Can you take me deeper into that?",
]

ACK_SILENT = [
    "I didn't catch anything there - take your time, or say 'skip' and we'll move on.",
    "I couldn't hear an answer. Would you like me to repeat the question?",
]

ACK_CLARIFY = [
    "Of course, let me repeat that.",
    "Sure - here it is again.",
    "No problem, I'll rephrase it.",
]

ACK_WRAP = [
    "That's everything from my side. Thank you for your time today.",
    "Good - that brings us to the end. Thanks for the conversation.",
]


def _pick(options: List[str], seed_text: str) -> str:
    """Deterministic-per-turn variety: same turn -> same line, different turns
    -> different lines. Avoids a random interviewer on page refresh."""
    if not options:
        return ""
    idx = abs(hash(seed_text)) % len(options)
    return options[idx]


# Templated probes, grounded in a term the candidate actually said.
PROBE_TEMPLATES = [
    "You mentioned {term} - can you give me a concrete example of that from your own work?",
    "Let's stay on {term} for a moment. What breaks first when that approach is put under load?",
    "You brought up {term}. What was the trade-off you accepted there?",
    "How would you explain {term} to a junior engineer joining your team?",
    "When would {term} be the wrong choice?",
]

GENERIC_PROBES = [
    "Can you make that concrete with an example from a project you worked on?",
    "What was the hardest part of getting that right in practice?",
    "What would you do differently if you built that again today?",
]

# Terms worth probing on, drawn from the candidate's own answer.
_STOP_TERMS = {
    "the", "and", "that", "this", "with", "from", "have", "will", "would",
    "there", "which", "when", "what", "your", "about", "because", "they",
    "them", "then", "just", "also", "some", "very", "were", "been", "into",
    "like", "than", "more", "most", "other", "such", "only", "over", "after",
    "before", "make", "made", "using", "used", "use", "work", "worked",
    "project", "projects", "thing", "things", "really", "actually", "basically",
    "something", "anything", "everything", "know", "think", "going", "want",
    "need", "good", "well", "much", "many", "time", "team", "people", "code",
}


# Technical vocabulary worth probing on. A probe must anchor on a real concept
# or product name - probing on "centralised" or "yes" makes the interviewer
# sound broken, so an unrecognised term yields no probe at all.
_PROBE_VOCAB = {
    # concepts
    "abstraction", "algorithm", "api", "architecture", "authentication",
    "authorization", "availability", "backpressure", "batching", "cache",
    "caching", "ci", "cd", "concurrency", "consistency", "containers",
    "coupling", "deadlock", "dependency", "deployment", "encapsulation",
    "encryption", "eventual", "failover", "hashing", "hydration", "idempotency",
    "index", "indexes", "indexing", "inheritance", "injection", "latency",
    "lock", "locking", "logging", "memoization", "microservices", "middleware",
    "migration", "mocking", "monitoring", "mutex", "normalisation",
    "normalization", "orm", "pagination", "partition", "partitioning",
    "pipeline", "polymorphism", "pooling", "profiling", "promise", "promises",
    "queue", "rate", "recursion", "refactoring", "replication", "rollback",
    "scaling", "schema", "serialization", "sharding", "state", "stateless",
    "throttling", "throughput", "transaction", "transactions", "validation",
    "virtualization", "webhook", "websocket", "websockets",
    # products / languages / tools
    "angular", "ansible", "aws", "azure", "bash", "css", "django", "docker",
    "elasticsearch", "express", "fastapi", "flask", "gcp", "git", "github",
    "graphql", "grpc", "html", "java", "javascript", "jenkins", "jest", "jwt",
    "kafka", "kotlin", "kubernetes", "linux", "mongodb", "mysql", "nginx",
    "node", "numpy", "oauth", "pandas", "postgres", "postgresql", "pytest",
    "python", "pytorch", "rabbitmq", "react", "redis", "redux", "rest",
    "rust", "sass", "scala", "spring", "sql", "swift", "tailwind",
    "tensorflow", "terraform", "typescript", "vue", "webpack",
}


def salient_term(answer: str) -> Optional[str]:
    """
    Pick a probe-worthy technical term from the candidate's own answer.

    Returns None when nothing in the answer is a real concept - the caller then
    falls back to a generic probe rather than saying something nonsensical.
    """
    text = answer or ""
    if len(text.split()) < 8:
        return None                       # too thin to quote back at them

    scored: List[tuple] = []
    for raw in re.findall(r"[A-Za-z][A-Za-z0-9+#.]{1,}(?:[./-][A-Za-z0-9+#]+)*", text):
        low = raw.lower().strip(".")
        base = low.rstrip("s") if low.endswith("s") else low
        if low in _STOP_TERMS or len(low) < 3:
            continue

        known = low in _PROBE_VOCAB or base in _PROBE_VOCAB
        dotted = "." in raw or "-" in raw          # node.js, ci-cd
        camel = any(c.isupper() for c in raw[1:])  # camelCase / PascalCase
        if not (known or dotted or camel):
            continue                      # not recognisably technical - skip

        score = 0
        if known:
            score += 20
        if camel:
            score += 8
        if dotted:
            score += 6
        if raw[0].isupper():
            score += 2
        scored.append((score, len(low), raw.strip(".")))

    if not scored:
        return None
    scored.sort(key=lambda x: (-x[0], -x[1], x[2]))
    return scored[0][2]


# =============================================================================
# 5. Interview planning
# =============================================================================

@dataclass
class PlannedQuestion:
    ordinal: int
    text: str
    phase: str
    domain: str
    difficulty: str
    source: str          # "opening" | "cv" | "dataset" | "behavioural" | "closing"
    expects: List[str]   # concepts a good answer should touch - used for scoring


OPENING_QUESTIONS = [
    "Good to meet you. To start, could you tell me a little about yourself and what you've been working on?",
]

CLOSING_QUESTIONS = [
    "Before we wrap up - is there anything you'd like to ask me about the role or the team?",
]

# Behavioural questions are genuinely role-agnostic, so a small curated set is
# appropriate here; they are still selected (not all asked) based on seniority.
BEHAVIOURAL_JUNIOR = [
    "Tell me about a time you got stuck on a problem. How did you get unstuck?",
    "Describe a piece of feedback you received that changed how you work.",
    "Tell me about something technical you taught yourself recently, and why.",
]

BEHAVIOURAL_SENIOR = [
    "Tell me about a technical decision you made that turned out to be wrong. What did you do next?",
    "Describe a time you disagreed with a teammate on an approach. How was it resolved?",
    "Tell me about a time you had to ship something under a hard deadline with known trade-offs.",
]


def _cv_grounded_questions(profile: Dict[str, Any], limit: int) -> List[Dict[str, str]]:
    """Questions built from what is *actually* on this candidate's CV.

    Returns [] when the CV yielded nothing - we never invent CV content.
    """
    out: List[Dict[str, str]] = []
    techs = [t for t in (profile.get("technologies") or []) if t]
    experience = [e for e in (profile.get("experience") or []) if e]
    education = [e for e in (profile.get("education") or []) if e]
    certs = [c for c in (profile.get("certifications") or []) if c]
    projects = [p for p in (profile.get("projects") or []) if p]
    years = profile.get("yearsTotal")

    if projects:
        out.append({
            "text": "I see %s on your CV. Walk me through your role in it - what "
                    "did you build, and what was the hardest technical part?"
                    % projects[0],
            "expects": "scope, ownership, technical difficulty, outcome",
        })
    if experience:
        out.append({
            "text": "Your CV lists your time as %s. What was the system you owned "
                    "there, and what would you change about it now?"
                    % experience[0],
            "expects": "ownership, architecture, hindsight, trade-offs",
        })
    if len(techs) >= 2:
        out.append({
            "text": "You list both %s and %s. Tell me about a time you had to "
                    "make them work together - what was tricky about it?"
                    % (techs[0], techs[1]),
            "expects": "integration, debugging, real project detail",
        })
    if techs:
        out.append({
            "text": "How would you rate your depth in %s, and what's the most "
                    "advanced thing you've done with it?" % techs[0],
            "expects": "self-assessment, concrete advanced usage",
        })
    if isinstance(years, (int, float)) and years >= 1:
        out.append({
            "text": "Across roughly %s years of experience, which project taught "
                    "you the most, and what was the lesson?"
                    % (int(years) if float(years).is_integer() else years),
            "expects": "reflection, growth, specific lesson",
        })
    if certs:
        out.append({
            "text": "You hold %s. How have you applied that in practice rather "
                    "than just in the exam?" % certs[0],
            "expects": "applied knowledge, practical example",
        })
    if education and not experience and not projects:
        out.append({
            "text": "You studied %s. Which module or project from it maps most "
                    "closely to the work you want to do now?" % education[0],
            "expects": "academic-to-practical mapping, motivation",
        })
    return out[:limit]


def infer_track(profile: Dict[str, Any], requested: str = "") -> str:
    """Pick the track that best fits the CV, honouring an explicit request."""
    resolved = resolve_track(requested)
    if requested and resolved != DEFAULT_TRACK:
        return resolved
    techs = {t.lower() for t in (profile.get("technologies") or [])}
    skills = {s.lower() for s in (profile.get("skills") or [])}
    have = techs | skills
    best, best_hits = DEFAULT_TRACK, -1
    for tid, meta in TRACKS.items():
        hits = sum(1 for s in meta["signals"] if s.lower() in have)
        if hits > best_hits:
            best, best_hits = tid, hits
    return best if best_hits > 0 else resolved


def profile_text(profile: Dict[str, Any]) -> str:
    """Flatten the CV profile into a retrieval query."""
    parts: List[str] = []
    for key in ("technologies", "skills", "experience", "education",
                "certifications", "projects"):
        vals = profile.get(key) or []
        if isinstance(vals, list):
            parts.extend(str(v) for v in vals)
    if profile.get("role"):
        parts.append(str(profile["role"]))
    return " ".join(parts)


def build_plan(
    profile: Dict[str, Any],
    role: str = "",
    track: str = "",
    difficulty: str = "medium",
    total: int = 8,
) -> Dict[str, Any]:
    """
    Build a personalised interview plan.

    Structure mirrors a real screening interview:
      opening (1) -> CV-grounded (up to 3) -> technical ladder (rest)
      -> behavioural (1-2) -> closing (1)
    """
    total = max(4, min(int(total or 8), 20))
    track_id = infer_track(profile, track)
    meta = TRACKS[track_id]
    entry = DIFFICULTY_ENTRY.get(str(difficulty).lower(), "Intermediate")
    query = profile_text(profile) or role or meta["label"]

    pool = get_pool()
    used: Set[str] = set()
    planned: List[PlannedQuestion] = []

    def add(text: str, phase: str, source: str, domain: str,
            diff: str, expects: str) -> None:
        key = text.strip().lower()
        if key in used:
            return
        used.add(key)
        planned.append(PlannedQuestion(
            ordinal=len(planned), text=text.strip(), phase=phase,
            domain=domain, difficulty=diff, source=source,
            expects=[e.strip() for e in expects.split(",") if e.strip()],
        ))

    # 1. Opening - always a warm, human start.
    add(OPENING_QUESTIONS[0], "greet", "opening", meta["label"], "Beginner",
        "background, motivation, recent work")

    # 2. Budget the interview so no section crowds out another.
    #    Technical depth gets the largest share, as in a real screening round.
    years = profile.get("yearsTotal") or 0
    behavioural_pool = (BEHAVIOURAL_SENIOR if float(years or 0) >= 3
                        else BEHAVIOURAL_JUNIOR)
    n_behavioural = 2 if total >= 10 else 1
    n_cv = max(1, min(3, round(total * 0.28)))   # ~a quarter of the round
    n_tech = max(1, total - 1 - n_cv - n_behavioural - 1)  # -opening -closing

    # 3. CV-grounded questions - real content only, never invented.
    cv_qs = _cv_grounded_questions(profile, limit=n_cv)
    for q in cv_qs:
        add(q["text"], "intro", "cv", meta["label"], entry, q["expects"])

    # Unused CV slots roll into technical depth rather than shortening the round.
    n_tech += n_cv - len(cv_qs)

    # 4. Technical ladder - escalating difficulty across the remaining slots.
    ladder = _difficulty_ladder(entry, n_tech)
    for i, diff in enumerate(ladder):
        got = pool.retrieve(query, meta["domains"], diff, k=6, exclude=used)
        if not got:
            got = pool.retrieve(query, [], diff, k=6, exclude=used)
        if not got:
            continue
        pick = got[i % len(got)] if len(got) > 1 else got[0]
        add(pick.question, "tech", "dataset", pick.domain, pick.difficulty,
            "%s fundamentals, practical example, trade-offs" % pick.domain)

    # 5. Behavioural.
    for i in range(n_behavioural):
        if i < len(behavioural_pool):
            add(behavioural_pool[i], "behavior", "behavioural", meta["label"],
                "Intermediate", "situation, action, result, reflection")

    # 6. Closing.
    add(CLOSING_QUESTIONS[0], "wrap", "closing", meta["label"], "Beginner",
        "engagement, curiosity about the role")

    return {
        "track": track_id,
        "trackLabel": meta["label"],
        "difficultyEntry": entry,
        "poolSize": len(pool.items),
        "cvGrounded": len(cv_qs),
        "questions": [
            {
                "ordinal": q.ordinal, "text": q.text, "phase": q.phase,
                "domain": q.domain, "difficulty": q.difficulty,
                "source": q.source, "expects": q.expects,
            }
            for q in planned
        ],
    }


def _difficulty_ladder(entry: str, n: int) -> List[str]:
    """Escalate from the entry rung upward, holding at Advanced."""
    start = DIFFICULTY_ORDER.index(entry) if entry in DIFFICULTY_ORDER else 1
    ladder: List[str] = []
    for i in range(n):
        # Move up a rung roughly every two questions.
        step = min(len(DIFFICULTY_ORDER) - 1, start + i // 2)
        ladder.append(DIFFICULTY_ORDER[step])
    return ladder


# =============================================================================
# 6. Turn decision - what the interviewer does next
# =============================================================================

def decide_turn(
    question: Dict[str, Any],
    answer: str,
    answer_score: Optional[Dict[str, Any]] = None,
    history: Optional[List[Dict[str, Any]]] = None,
    profile: Optional[Dict[str, Any]] = None,
    track: str = "",
    difficulty: str = "medium",
    followups_used: int = 0,
    remaining: int = 1,
) -> Dict[str, Any]:
    """
    Decide the interviewer's next move for one turn.

    Returns
    -------
    action        : "next" | "followup" | "repeat" | "easier" | "end"
    say           : the line the interviewer speaks before the next question
    intent        : classified candidate intent
    skipped       : True when the answer should not count against knowledge
    followup      : {text, expects} when action == "followup"
    scoreAdjust   : how the turn should be recorded
    """
    history = history or []
    profile = profile or {}
    intent_info = classify_turn(answer)
    intent = intent_info["intent"]
    q_text = str(question.get("text") or "")
    seed = "%s|%s|%d" % (q_text[:40], intent, len(history))

    tech = _num(answer_score, "technical")
    relevance = _num(answer_score, "relevance")

    # --- Candidate could not hear / wants the question again ------------------
    if intent == "clarify":
        return _turn("repeat", _pick(ACK_CLARIFY, seed), intent_info,
                     skipped=False, note="question repeated on request")

    # --- Nothing captured ----------------------------------------------------
    if intent == "silent":
        return _turn("repeat", _pick(ACK_SILENT, seed), intent_info,
                     skipped=True, note="no speech captured")

    # --- Candidate said they don't know -> acknowledge and MOVE ON ------------
    if intent == "dont_know":
        # Count the immediately preceding turn(s): this turn plus one prior gap
        # means two in a row, which is where a real interviewer eases off.
        recent_dk = sum(1 for h in history[-2:]
                        if h.get("intent") == "dont_know")
        if recent_dk >= 1 and remaining > 1:
            # Struggling: drop a rung instead of grinding them down.
            easier = _easier_question(profile, track, question, history)
            if easier:
                return _turn("easier", _pick(ACK_DONT_KNOW_EASIER, seed),
                             intent_info, skipped=True,
                             followup=easier,
                             note="two consecutive gaps - difficulty lowered")
        return _turn("next", _pick(ACK_DONT_KNOW, seed), intent_info,
                     skipped=True, note="candidate declined the question")

    # --- Answer was on topic but shallow -> one probe, then move on ----------
    if intent == "thin" and followups_used < 1 and remaining > 1:
        return _turn("followup", _pick(ACK_THIN, seed), intent_info,
                     skipped=False,
                     followup=_probe(answer, question),
                     note="answer too shallow - probing once")

    if intent == "thin":
        return _turn("next", _pick(ACK_SUBSTANTIVE, seed), intent_info,
                     skipped=False, note="shallow answer, already probed")

    # --- Substantive answer --------------------------------------------------
    strong = (tech is not None and tech >= 78) or (relevance is not None and relevance >= 82)
    if strong:
        say = _pick(ACK_STRONG, seed)
    else:
        say = _pick(ACK_SUBSTANTIVE, seed)

    # A strong answer on a technical question earns a deeper probe - that is
    # what a real interviewer does to find the ceiling.
    if strong and followups_used < 1 and remaining > 1 and \
            question.get("phase") in {"tech", "intro"}:
        return _turn("followup", say, intent_info, skipped=False,
                     followup=_probe(answer, question),
                     note="strong answer - probing for depth")

    if remaining <= 0:
        return _turn("end", _pick(ACK_WRAP, seed), intent_info, skipped=False,
                     note="plan complete")

    return _turn("next", say, intent_info, skipped=False,
                 note="answer accepted")


def _turn(action: str, say: str, intent_info: Dict[str, Any], skipped: bool,
          followup: Optional[Dict[str, Any]] = None, note: str = "") -> Dict[str, Any]:
    return {
        "action": action,
        "say": say,
        "intent": intent_info["intent"],
        "intentConfidence": intent_info["confidence"],
        "intentReason": intent_info["reason"],
        "skipped": skipped,
        "followup": followup,
        "note": note,
    }


def _probe(answer: str, question: Dict[str, Any]) -> Dict[str, Any]:
    """Build a follow-up grounded in the candidate's own words."""
    term = salient_term(answer)
    seed = "%s|%s" % (answer[:40], question.get("text", "")[:20])
    if term:
        text = _pick(PROBE_TEMPLATES, seed).format(term=term)
        expects = ["concrete example", "trade-offs", term]
    else:
        text = _pick(GENERIC_PROBES, seed)
        expects = ["concrete example", "practical detail"]
    return {
        "text": text,
        "phase": "follow",
        "domain": question.get("domain") or "General",
        "difficulty": question.get("difficulty") or "Intermediate",
        "source": "followup",
        "expects": expects,
    }


def _easier_question(
    profile: Dict[str, Any],
    track: str,
    question: Dict[str, Any],
    history: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """Retrieve a genuinely easier question in the same area."""
    current = str(question.get("difficulty") or "Intermediate")
    idx = DIFFICULTY_ORDER.index(current) if current in DIFFICULTY_ORDER else 1
    if idx == 0:
        return None
    easier = DIFFICULTY_ORDER[idx - 1]
    track_id = resolve_track(track) if track else infer_track(profile)
    domains = TRACKS[track_id]["domains"]
    asked = {str(h.get("question", "")).lower() for h in history}
    asked.add(str(question.get("text", "")).lower())
    got = get_pool().retrieve(profile_text(profile), domains, easier,
                              k=4, exclude=asked)
    if not got:
        return None
    pick = got[0]
    return {
        "text": pick.question,
        "phase": "tech",
        "domain": pick.domain,
        "difficulty": pick.difficulty,
        "source": "adaptive_easier",
        "expects": ["%s basics" % pick.domain, "clear explanation"],
    }


def _num(d: Optional[Dict[str, Any]], key: str) -> Optional[float]:
    if not isinstance(d, dict):
        return None
    val = d.get(key)
    try:
        return float(val)
    except (TypeError, ValueError):
        return None
