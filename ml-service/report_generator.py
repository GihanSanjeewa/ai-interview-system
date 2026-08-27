"""
Report Generator - derives the performance report from the actual session.

Everything here is computed from what the candidate really said: per-answer
metrics, the transcripts, which questions they declined, how long they spoke,
and how their scores moved across the round. Nothing is asserted from a fixed
list; if the evidence for a finding is not present, the finding is not made.

Outputs
-------
* six metric scores + overall + performance level
* strengths / weaknesses / suggestions, each traceable to a measurement
* per-question breakdown for the report UI and the notebooks
* learning resources selected from a catalogue by the *diagnosed* weakness
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

log = logging.getLogger("report_generator")

# =============================================================================
# Metric weighting
# =============================================================================

# How each metric contributes to the overall score. Technical accuracy and
# relevance dominate because they measure whether the answer was *right*;
# delivery metrics matter but cannot rescue a wrong answer.
METRIC_WEIGHTS = {
    "technical": 0.30,
    "relevance": 0.25,
    "communication": 0.20,
    "confidence": 0.13,
    "fluency": 0.12,
}

# Bands used for both wording and the performance level.
BAND_STRONG = 78.0
BAND_OK = 62.0
BAND_WEAK = 48.0

# Speaking pace, words per minute. Outside this window the delivery suffers.
PACE_IDEAL = (110.0, 160.0)


METRIC_LABELS = {
    "technical": "Technical accuracy",
    "relevance": "Answer relevance",
    "communication": "Communication clarity",
    "confidence": "Vocal confidence",
    "fluency": "Speech fluency",
    "pace": "Speaking pace",
}


# =============================================================================
# Per-answer evidence
# =============================================================================

FILLERS = {"um", "uh", "er", "ah", "hmm", "like", "basically", "actually",
           "literally", "sort", "kind", "right", "okay", "so", "well", "yeah"}

HEDGES = {"maybe", "perhaps", "possibly", "probably", "guess", "think",
          "suppose", "might", "sort of", "kind of", "not sure", "i believe"}

# Signals that the candidate gave a concrete, evidenced answer.
CONCRETE_MARKERS = re.compile(
    r"\b(for example|for instance|in my (last|previous|current)|"
    r"we (built|used|migrated|deployed|reduced|fixed|shipped)|"
    r"i (built|used|migrated|deployed|reduced|fixed|shipped|led|wrote)|"
    r"\d+\s*(%|percent|ms|seconds?|minutes?|hours?|users?|requests?|"
    r"times|x\b))",
    re.IGNORECASE)

STRUCTURE_MARKERS = re.compile(
    r"\b(first(ly)?|second(ly)?|third(ly)?|then|next|finally|"
    r"on the other hand|however|therefore|because|the trade-?off|"
    r"the downside|the benefit|in summary|to summari[sz]e)\b",
    re.IGNORECASE)


def analyse_answer(
    question: Dict[str, Any],
    transcript: str,
    metrics: Optional[Dict[str, Any]],
    duration_ms: Optional[int] = None,
    intent: Optional[str] = None,
) -> Dict[str, Any]:
    """Turn one answer into measurable evidence."""
    text = (transcript or "").strip()
    words = text.split()
    wc = len(words)
    lower = text.lower()

    filler_hits = sum(1 for w in words if w.strip(".,!?").lower() in FILLERS)
    hedge_hits = sum(1 for h in HEDGES if h in lower)
    filler_rate = (filler_hits / wc * 100) if wc else 0.0

    wpm = None
    if duration_ms and duration_ms > 2000 and wc:
        wpm = round(wc / (duration_ms / 60000.0), 1)

    # Which concepts the question expected, and how many were actually touched.
    expects = [e.lower() for e in (question.get("expects") or [])]
    covered = [e for e in expects
               if any(tok in lower for tok in re.findall(r"[a-z]{4,}", e))]

    return {
        "ordinal": question.get("ordinal"),
        "question": question.get("text"),
        "phase": question.get("phase"),
        "domain": question.get("domain"),
        "difficulty": question.get("difficulty"),
        "intent": intent,
        "skipped": intent in {"dont_know", "silent"},
        "wordCount": wc,
        "durationMs": duration_ms,
        "wpm": wpm,
        "fillerCount": filler_hits,
        "fillerRate": round(filler_rate, 1),
        "hedgeCount": hedge_hits,
        "hasConcreteExample": bool(CONCRETE_MARKERS.search(text)),
        "isStructured": len(STRUCTURE_MARKERS.findall(text)) >= 2,
        "expectedConcepts": question.get("expects") or [],
        "coveredConcepts": covered,
        "conceptCoverage": round(len(covered) / len(expects), 2) if expects else None,
        "metrics": {k: _num(metrics, k) for k in
                    ("technical", "relevance", "communication",
                     "confidence", "fluency", "pace")},
    }


def _num(d: Optional[Dict[str, Any]], key: str) -> Optional[float]:
    if not isinstance(d, dict):
        return None
    try:
        val = float(d.get(key))
    except (TypeError, ValueError):
        return None
    return val if val == val else None      # reject NaN


# =============================================================================
# Session aggregation
# =============================================================================

def _mean(values: List[Optional[float]]) -> Optional[float]:
    clean = [v for v in values if v is not None]
    return float(np.mean(clean)) if clean else None


def _trend(values: List[Optional[float]]) -> Optional[float]:
    """Least-squares slope across the session, in points per question."""
    pairs = [(i, v) for i, v in enumerate(values) if v is not None]
    if len(pairs) < 3:
        return None
    xs = np.array([p[0] for p in pairs], dtype=float)
    ys = np.array([p[1] for p in pairs], dtype=float)
    slope = float(np.polyfit(xs, ys, 1)[0])
    return round(slope, 2)


def aggregate(answers: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Aggregate per-answer evidence into session metrics.

    Declined questions are excluded from the *knowledge* metrics (technical,
    relevance) because "I don't know" measures coverage, not accuracy - but they
    are counted separately so the report can report the gap honestly.
    """
    scored = [a for a in answers if not a["skipped"]]
    skipped = [a for a in answers if a["skipped"]]

    def series(key: str, source: List[Dict[str, Any]]) -> List[Optional[float]]:
        return [a["metrics"].get(key) for a in source]

    # Knowledge metrics: answered questions only.
    technical = _mean(series("technical", scored))
    relevance = _mean(series("relevance", scored))

    # Delivery metrics: also answered questions only.
    #
    # A declined question must not drag these down. "I don't know" is three
    # words, so a word-count filter alone let it through and scored it as 0
    # communication, 0 fluency and 0 confidence — which halved every delivery
    # metric for a candidate who declined one question out of two. Declining is
    # a coverage fact, already reported as `skippedCount`; it is not evidence
    # about how the candidate speaks.
    spoke = [a for a in scored if a["wordCount"] >= 3]
    communication = _mean(series("communication", spoke))
    confidence = _mean(series("confidence", spoke))
    fluency = _mean(series("fluency", spoke))

    measured_wpm = [a["wpm"] for a in scored if a["wpm"]]
    pace_wpm = float(np.mean(measured_wpm)) if measured_wpm else None
    pace_score = _pace_score(pace_wpm) if pace_wpm is not None else \
        _mean(series("pace", spoke))

    # Coverage: how much of the round the candidate actually engaged with.
    coverage = len(scored) / len(answers) if answers else 0.0

    return {
        "answerCount": len(answers),
        "answeredCount": len(scored),
        "skippedCount": len(skipped),
        "coverage": round(coverage, 2),
        "technical": technical,
        "relevance": relevance,
        "communication": communication,
        "confidence": confidence,
        "fluency": fluency,
        "paceScore": pace_score,
        "paceWpm": round(pace_wpm, 1) if pace_wpm is not None else None,
        # Trends over answered questions only. Including a decline's zero
        # created a spurious downward slope: a session of 88, decline, 74 read
        # as "performance declined through the session" when the candidate had
        # simply skipped the middle question.
        "trends": {
            "technical": _trend(series("technical", scored)),
            "confidence": _trend(series("confidence", scored)),
            "communication": _trend(series("communication", scored)),
        },
        "totalWords": sum(a["wordCount"] for a in answers),
        # Averaged over answered questions: a three-word decline is not a
        # "short answer", and counting it as one produced findings that told the
        # candidate their answers were too brief when in fact they had declined.
        "avgWords": round(float(np.mean([a["wordCount"] for a in scored])), 1)
                    if scored else 0.0,
        "avgFillerRate": round(float(np.mean(
            [a["fillerRate"] for a in spoke])), 1) if spoke else 0.0,
        "concreteExamples": sum(1 for a in scored if a["hasConcreteExample"]),
        "structuredAnswers": sum(1 for a in scored if a["isStructured"]),
        "hedgeTotal": sum(a["hedgeCount"] for a in scored),
        "byDomain": _by_domain(scored),
        "byDifficulty": _by_difficulty(scored),
        "skippedQuestions": [
            {"ordinal": a["ordinal"], "question": a["question"],
             "domain": a["domain"], "difficulty": a["difficulty"]}
            for a in skipped
        ],
    }


def _pace_score(wpm: float) -> float:
    """Map words-per-minute onto 0-100, peaking inside the ideal window."""
    lo, hi = PACE_IDEAL
    if lo <= wpm <= hi:
        return 100.0
    if wpm < lo:
        return max(20.0, 100.0 - (lo - wpm) * 1.4)
    return max(20.0, 100.0 - (wpm - hi) * 1.1)


def _by_domain(answers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    groups: Dict[str, List[Dict[str, Any]]] = {}
    for a in answers:
        groups.setdefault(a["domain"] or "General", []).append(a)
    out = []
    for domain, items in groups.items():
        tech = _mean([i["metrics"].get("technical") for i in items])
        out.append({
            "domain": domain,
            "questions": len(items),
            "technical": round(tech, 1) if tech is not None else None,
        })
    out.sort(key=lambda r: (r["technical"] is None, r["technical"] or 0))
    return out


def _by_difficulty(answers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    order = ["Beginner", "Intermediate", "Advanced"]
    out = []
    for level in order:
        items = [a for a in answers if (a["difficulty"] or "") == level]
        if not items:
            continue
        tech = _mean([i["metrics"].get("technical") for i in items])
        out.append({
            "difficulty": level,
            "questions": len(items),
            "technical": round(tech, 1) if tech is not None else None,
        })
    return out


# =============================================================================
# Overall score & level
# =============================================================================

def overall_score(agg: Dict[str, Any]) -> float:
    """
    Weighted overall score, with a coverage penalty.

    A candidate who answered three of ten questions has not demonstrated the
    same thing as one who answered all ten at the same accuracy, so coverage
    scales the knowledge component rather than being ignored.
    """
    parts: List[Tuple[float, float]] = []
    for key, weight in METRIC_WEIGHTS.items():
        val = agg.get(key)
        if val is not None:
            parts.append((val, weight))
    if not parts:
        return 0.0

    weighted = sum(v * w for v, w in parts) / sum(w for _, w in parts)

    # Coverage penalty: full credit at >=80% engagement, tapering below.
    coverage = agg.get("coverage") or 0.0
    if coverage < 0.8:
        weighted *= 0.65 + 0.35 * (coverage / 0.8)

    return round(max(0.0, min(100.0, weighted)), 1)


def performance_level(score: float, agg: Dict[str, Any]) -> str:
    """BEGINNER / INTERMEDIATE / ADVANCED, gated on evidence, not score alone."""
    answered = agg.get("answeredCount") or 0
    # Advanced requires both a high score and enough answered questions to
    # support the claim.
    if score >= BAND_STRONG and answered >= 4:
        return "ADVANCED"
    if score >= BAND_OK and answered >= 2:
        return "INTERMEDIATE"
    return "BEGINNER"


# =============================================================================
# Findings - each traceable to a measurement
# =============================================================================

def build_findings(
    agg: Dict[str, Any],
    answers: List[Dict[str, Any]],
    role: str = "",
) -> Dict[str, List[str]]:
    """
    Strengths, weaknesses and suggestions, each earned by the evidence.

    Findings are emitted only when their triggering measurement is present, so
    an empty or minimal session yields few findings rather than generic praise.
    """
    strengths: List[str] = []
    weaknesses: List[str] = []
    suggestions: List[str] = []
    # `n` is the whole round — used for coverage statements ("declined 2 of 5").
    n = agg["answerCount"] or 1
    # `answered` is the denominator for statements about answer *quality*. Using
    # the whole round would tell a candidate who declined two of five that only
    # 1 of 5 answers carried an example, when in fact it was 1 of 3.
    answered = agg["answeredCount"] or 1

    # --- knowledge -----------------------------------------------------------
    tech = agg.get("technical")
    if tech is not None:
        if tech >= BAND_STRONG:
            strengths.append(
                "Strong technical accuracy (%.0f/100) across %d answered "
                "question%s." % (tech, agg["answeredCount"],
                                 "" if agg["answeredCount"] == 1 else "s"))
        elif tech < BAND_WEAK:
            weaknesses.append(
                "Technical accuracy averaged %.0f/100 - answers often missed "
                "the core mechanism the question was testing." % tech)
            suggestions.append(
                "Before answering, name the concept the question is about in "
                "one sentence, then explain it. This alone lifts accuracy "
                "scores because the grader can see the concept was identified.")
        elif tech < BAND_OK:
            weaknesses.append(
                "Technical accuracy averaged %.0f/100 - the ideas were broadly "
                "right but lacked precision." % tech)

    rel = agg.get("relevance")
    if rel is not None:
        if rel >= BAND_STRONG:
            strengths.append(
                "Answers stayed tightly on the question asked (relevance "
                "%.0f/100)." % rel)
        elif rel < BAND_OK:
            weaknesses.append(
                "Relevance averaged %.0f/100 - several answers drifted away "
                "from what was actually asked." % rel)
            suggestions.append(
                "Repeat the question's key noun back in your first sentence. "
                "It anchors the answer and stops the drift that cost you "
                "relevance marks here.")

    # --- coverage / declined questions ---------------------------------------
    skipped = agg["skippedCount"]
    if skipped == 0 and agg["answerCount"] >= 3:
        strengths.append(
            "Attempted every one of the %d questions - no topic was declined."
            % agg["answerCount"])
    elif skipped:
        gap_domains = sorted({q["domain"] for q in agg["skippedQuestions"]
                              if q["domain"]})
        detail = (" The gaps were in %s." % _join(gap_domains)) if gap_domains else ""
        weaknesses.append(
            "Declined %d of %d questions.%s" % (skipped, n, detail))
        if gap_domains:
            suggestions.append(
                "Close the %s gap first - it is the single largest score "
                "movement available to you, because unanswered questions cost "
                "both accuracy and coverage." % _join(gap_domains))

    # --- difficulty ceiling --------------------------------------------------
    by_diff = agg.get("byDifficulty") or []
    adv = next((d for d in by_diff if d["difficulty"] == "Advanced"), None)
    beg = next((d for d in by_diff if d["difficulty"] == "Beginner"), None)
    if adv and adv["technical"] is not None and adv["technical"] >= BAND_OK:
        strengths.append(
            "Held up on Advanced-level questions (%.0f/100 across %d of them)."
            % (adv["technical"], adv["questions"]))
    if (adv and beg and adv["technical"] is not None
            and beg["technical"] is not None
            and beg["technical"] - adv["technical"] >= 20):
        weaknesses.append(
            "Performance fell sharply with difficulty: %.0f on Beginner "
            "questions versus %.0f on Advanced ones."
            % (beg["technical"], adv["technical"]))

    # --- weakest domain ------------------------------------------------------
    by_domain = [d for d in (agg.get("byDomain") or [])
                 if d["technical"] is not None and d["questions"] >= 1]
    if len(by_domain) >= 2:
        worst, best = by_domain[0], by_domain[-1]
        if best["technical"] - worst["technical"] >= 15:
            weaknesses.append(
                "%s was the weakest area (%.0f/100) while %s was the "
                "strongest (%.0f/100)."
                % (worst["domain"], worst["technical"],
                   best["domain"], best["technical"]))
            suggestions.append(
                "Spend your next practice session on %s specifically - it is "
                "%.0f points behind your %s answers."
                % (worst["domain"], best["technical"] - worst["technical"],
                   best["domain"]))

    # --- delivery: examples & structure --------------------------------------
    concrete = agg["concreteExamples"]
    if concrete >= max(2, answered // 2):
        strengths.append(
            "Backed %d of %d answered questions with a concrete example or a "
            "real number." % (concrete, answered))
    elif concrete == 0 and answered >= 3:
        weaknesses.append(
            "No answer contained a specific example, project or measurement - "
            "every response stayed abstract.")
        suggestions.append(
            "Prepare three stories from your own work with numbers attached "
            "(what you built, what changed, by how much) and use one in every "
            "technical answer.")

    structured = agg["structuredAnswers"]
    if structured >= max(2, answered // 2):
        strengths.append(
            "Answers were well organised - %d of %d used explicit signposting "
            "or stated a trade-off." % (structured, answered))
    elif structured == 0 and answered >= 3:
        suggestions.append(
            "Structure each answer as: what it is, how it works, when it "
            "breaks. Signposted answers score higher on communication because "
            "the listener can follow the reasoning.")

    # --- delivery: length ----------------------------------------------------
    avg_words = agg["avgWords"]
    if avg_words and avg_words < 25 and answered >= 3:
        weaknesses.append(
            "Answers averaged only %.0f words - too short to demonstrate depth."
            % avg_words)
        suggestions.append(
            "Aim for 60-120 words per technical answer: a definition, a "
            "mechanism, and one example.")
    elif avg_words and avg_words > 220:
        weaknesses.append(
            "Answers averaged %.0f words - long enough that the main point got "
            "buried." % avg_words)
        suggestions.append(
            "Lead with your conclusion in one sentence, then support it. "
            "Interviewers score the first fifteen seconds heavily.")

    # --- delivery: fluency, fillers, hedging ---------------------------------
    filler_rate = agg["avgFillerRate"]
    if filler_rate <= 2.0 and agg["totalWords"] >= 60:
        strengths.append(
            "Very clean delivery - filler words were only %.1f%% of everything "
            "you said." % filler_rate)
    elif filler_rate >= 6.0:
        weaknesses.append(
            "Filler words made up %.1f%% of your speech, which reads as "
            "hesitation." % filler_rate)
        suggestions.append(
            "Replace fillers with a deliberate two-second pause. Silence "
            "sounds considered; 'um' sounds unsure.")

    hedges = agg["hedgeTotal"]
    if hedges >= max(4, answered):
        weaknesses.append(
            "Used %d hedging phrases ('I think', 'maybe', 'not sure'), which "
            "undercut otherwise sound answers." % hedges)
        suggestions.append(
            "State your answer, then flag the uncertainty separately: 'X does "
            "Y. I'm less sure about Z.' That reads as precision, not doubt.")

    conf = agg.get("confidence")
    if conf is not None and conf >= BAND_STRONG:
        strengths.append("Confident vocal delivery throughout (%.0f/100)." % conf)
    elif conf is not None and conf < BAND_WEAK:
        weaknesses.append(
            "Vocal confidence measured %.0f/100 - the audio showed low volume "
            "and frequent pausing." % conf)
        suggestions.append(
            "Record yourself answering three questions aloud and play it back. "
            "Volume and pace correct quickly once you hear them.")

    # --- delivery: pace ------------------------------------------------------
    wpm = agg.get("paceWpm")
    if wpm is not None:
        lo, hi = PACE_IDEAL
        if lo <= wpm <= hi:
            strengths.append(
                "Speaking pace was well judged at %.0f words per minute." % wpm)
        elif wpm < lo:
            weaknesses.append(
                "Spoke at %.0f words per minute - slow enough that answers "
                "lost momentum." % wpm)
            suggestions.append(
                "Practise at 120-150 words per minute. Reading a paragraph "
                "aloud against a timer calibrates this fast.")
        else:
            weaknesses.append(
                "Spoke at %.0f words per minute - fast enough that detail got "
                "lost." % wpm)
            suggestions.append(
                "Slow down and pause at each full stop. At your current pace "
                "the interviewer cannot follow the technical detail.")

    # --- trajectory ----------------------------------------------------------
    trend = (agg.get("trends") or {}).get("technical")
    if trend is not None:
        if trend >= 2.0:
            strengths.append(
                "Improved as the interview progressed (+%.1f points per "
                "question) - you settled in well." % trend)
        elif trend <= -2.5:
            weaknesses.append(
                "Performance declined through the session (%.1f points per "
                "question), suggesting stamina or nerves rather than "
                "knowledge." % trend)
            suggestions.append(
                "Practise full-length rounds rather than single questions - "
                "your accuracy dropped steadily after the opening answers.")

    if not suggestions:
        suggestions.append(
            "Run another full round at a higher difficulty - at this level the "
            "useful signal comes from questions that stretch you.")

    return {
        "strengths": _dedupe(strengths)[:6],
        "weaknesses": _dedupe(weaknesses)[:6],
        "suggestions": _dedupe(suggestions)[:6],
    }


def _join(items: List[str]) -> str:
    items = [i for i in items if i]
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return "%s and %s" % (", ".join(items[:-1]), items[-1])


def _dedupe(items: List[str]) -> List[str]:
    seen, out = set(), []
    for i in items:
        key = i.lower()[:50]
        if key in seen:
            continue
        seen.add(key)
        out.append(i)
    return out


# =============================================================================
# Learning resources - selected by diagnosis, not appended by default
# =============================================================================

# Each entry declares which diagnosed problem it addresses. A resource is only
# returned when that problem was actually measured in this session.
RESOURCE_CATALOGUE: List[Dict[str, Any]] = [
    {
        "triggers": ["low_technical"],
        "title": "Grokking Algorithms",
        "type": "Book",
        "description": "Rebuilds core data-structure and complexity intuition "
                       "from first principles - the foundation your technical "
                       "scores are missing.",
    },
    {
        "triggers": ["low_technical", "difficulty_cliff"],
        "title": "MIT 6.006 Introduction to Algorithms (open courseware)",
        "type": "Course",
        "url": "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/",
        "description": "Free lecture series that closes the gap between "
                       "knowing a term and being able to reason about it.",
    },
    {
        "triggers": ["domain_web_development"],
        "title": "MDN Web Docs - Learn web development",
        "type": "Documentation",
        "url": "https://developer.mozilla.org/en-US/docs/Learn",
        "description": "Authoritative reference for the browser, HTTP and "
                       "JavaScript semantics that web interviews probe.",
    },
    {
        "triggers": ["domain_system_design", "domain_microservices",
                     "domain_kubernetes", "domain_docker"],
        "title": "Designing Data-Intensive Applications",
        "type": "Book",
        "description": "The standard text on replication, partitioning and "
                       "consistency - directly targets the design questions "
                       "you scored lowest on.",
    },
    {
        "triggers": ["domain_sql", "domain_database_optimization"],
        "title": "Use The Index, Luke!",
        "type": "Guide",
        "url": "https://use-the-index-luke.com/",
        "description": "Practical, query-by-query explanation of indexing and "
                       "execution plans.",
    },
    {
        "triggers": ["domain_security"],
        "title": "OWASP Top Ten",
        "type": "Guide",
        "url": "https://owasp.org/www-project-top-ten/",
        "description": "The vulnerability classes security interviews expect "
                       "you to name and mitigate.",
    },
    {
        "triggers": ["domain_concurrency"],
        "title": "The Little Book of Semaphores",
        "type": "Book",
        "url": "https://greenteapress.com/wp/semaphores/",
        "description": "Free text that drills the synchronisation problems "
                       "concurrency questions are built from.",
    },
    {
        "triggers": ["domain_oop", "domain_design_patterns"],
        "title": "Refactoring Guru - Design Patterns",
        "type": "Guide",
        "url": "https://refactoring.guru/design-patterns",
        "description": "Each pattern with the problem it solves, which is the "
                       "form interview questions take.",
    },
    {
        "triggers": ["domain_unit_testing"],
        "title": "Test-Driven Development: By Example",
        "type": "Book",
        "description": "Shows the testing discipline behind the answers "
                       "interviewers are listening for.",
    },
    {
        "triggers": ["no_examples", "low_relevance"],
        "title": "The STAR method for structured answers",
        "type": "Article",
        "url": "https://www.themuse.com/advice/star-interview-method",
        "description": "Situation-Task-Action-Result: the structure that fixes "
                       "abstract, drifting answers.",
    },
    {
        "triggers": ["low_confidence", "high_fillers", "pace_issue",
                     "hedging"],
        "title": "Speak Up! - filler reduction and pacing drills",
        "type": "Practice",
        "description": "Short daily exercises for pauses, pace and vocal "
                       "steadiness - the delivery metrics that cost you marks.",
    },
    {
        "triggers": ["declined_questions"],
        "title": "Spaced-repetition flashcards for your weak domains",
        "type": "Practice",
        "description": "Build a deck from the questions you declined. "
                       "Recall practice is what converts a blank into an "
                       "answer.",
    },
    {
        "triggers": ["declining_trend"],
        "title": "Full-length mock interview rounds",
        "type": "Practice",
        "description": "Your accuracy fell across the session, which practice "
                       "on single questions will not fix.",
    },
]


def diagnose(agg: Dict[str, Any]) -> List[str]:
    """The set of problems actually measured in this session."""
    tags: List[str] = []
    tech = agg.get("technical")
    rel = agg.get("relevance")
    conf = agg.get("confidence")

    if tech is not None and tech < BAND_OK:
        tags.append("low_technical")
    if rel is not None and rel < BAND_OK:
        tags.append("low_relevance")
    if conf is not None and conf < BAND_WEAK:
        tags.append("low_confidence")
    if agg["avgFillerRate"] >= 6.0:
        tags.append("high_fillers")
    if agg["hedgeTotal"] >= max(4, agg["answeredCount"] or 1):
        tags.append("hedging")
    if agg["concreteExamples"] == 0 and (agg["answeredCount"] or 0) >= 3:
        tags.append("no_examples")
    if agg["skippedCount"]:
        tags.append("declined_questions")

    wpm = agg.get("paceWpm")
    if wpm is not None and not (PACE_IDEAL[0] <= wpm <= PACE_IDEAL[1]):
        tags.append("pace_issue")

    trend = (agg.get("trends") or {}).get("technical")
    if trend is not None and trend <= -2.5:
        tags.append("declining_trend")

    by_diff = agg.get("byDifficulty") or []
    adv = next((d for d in by_diff if d["difficulty"] == "Advanced"), None)
    beg = next((d for d in by_diff if d["difficulty"] == "Beginner"), None)
    if (adv and beg and adv["technical"] is not None
            and beg["technical"] is not None
            and beg["technical"] - adv["technical"] >= 20):
        tags.append("difficulty_cliff")

    # The weakest domains, including those the candidate declined entirely.
    weak_domains = [d["domain"] for d in (agg.get("byDomain") or [])
                    if d["technical"] is not None and d["technical"] < BAND_OK]
    weak_domains += [q["domain"] for q in agg["skippedQuestions"] if q["domain"]]
    for domain in weak_domains:
        tags.append("domain_" + re.sub(r"[^a-z0-9]+", "_", domain.lower()).strip("_"))

    return _dedupe(tags)


def select_resources(tags: List[str], limit: int = 5) -> List[Dict[str, Any]]:
    """Resources whose trigger matches a diagnosed problem, most-matched first."""
    tag_set = set(tags)
    scored: List[Tuple[int, Dict[str, Any]]] = []
    for res in RESOURCE_CATALOGUE:
        hits = len(tag_set & set(res["triggers"]))
        if hits:
            scored.append((hits, res))
    scored.sort(key=lambda x: -x[0])
    out = []
    for _, res in scored[:limit]:
        item = {k: v for k, v in res.items() if k != "triggers"}
        out.append(item)
    return out


# =============================================================================
# Public entry point
# =============================================================================

def generate_report(
    answers: List[Dict[str, Any]],
    role: str = "",
    track: str = "",
    language: str = "en",
) -> Dict[str, Any]:
    """
    Build the full report from the session's real answers.

    Parameters
    ----------
    answers : list of dicts, each with
        question   : {text, ordinal, phase, domain, difficulty, expects}
        transcript : what the candidate said
        metrics    : per-answer scores from the ML scorers (may be partial)
        durationMs : how long they spoke (optional, enables real WPM)
        intent     : turn intent from interview_engine (optional)
    """
    if not answers:
        return _empty_report()

    evidence = [
        analyse_answer(
            question=a.get("question") if isinstance(a.get("question"), dict)
            else {"text": a.get("question"), "ordinal": i,
                  "phase": a.get("phase"), "domain": a.get("domain"),
                  "difficulty": a.get("difficulty"),
                  "expects": a.get("expects")},
            transcript=a.get("transcript") or "",
            metrics=a.get("metrics"),
            duration_ms=a.get("durationMs"),
            intent=a.get("intent"),
        )
        for i, a in enumerate(answers)
    ]

    agg = aggregate(evidence)
    score = overall_score(agg)
    level = performance_level(score, agg)
    findings = build_findings(agg, evidence, role)
    tags = diagnose(agg)
    resources = select_resources(tags)

    def out(key: str, default: float = 0.0) -> float:
        val = agg.get(key)
        return round(val, 1) if val is not None else default

    return {
        "overallScore": score,
        "performanceLevel": level,
        "technical": out("technical"),
        "relevance": out("relevance"),
        "communication": out("communication"),
        "confidence": out("confidence"),
        "fluency": out("fluency"),
        "pace": round(agg["paceWpm"], 1) if agg.get("paceWpm") is not None
                else out("paceScore"),
        "paceScore": out("paceScore"),
        "paceWpm": agg.get("paceWpm"),
        "strengths": findings["strengths"],
        "weaknesses": findings["weaknesses"],
        "suggestions": findings["suggestions"],
        "resources": resources,
        "diagnosis": tags,
        # Everything the report UI and the notebooks need to show the working.
        "analytics": {
            "answerCount": agg["answerCount"],
            "answeredCount": agg["answeredCount"],
            "skippedCount": agg["skippedCount"],
            "coverage": agg["coverage"],
            "avgWords": agg["avgWords"],
            "totalWords": agg["totalWords"],
            "avgFillerRate": agg["avgFillerRate"],
            "concreteExamples": agg["concreteExamples"],
            "structuredAnswers": agg["structuredAnswers"],
            "hedgeTotal": agg["hedgeTotal"],
            "trends": agg["trends"],
            "byDomain": agg["byDomain"],
            "byDifficulty": agg["byDifficulty"],
            "skippedQuestions": agg["skippedQuestions"],
        },
        "perQuestion": [
            {
                "ordinal": e["ordinal"],
                "question": e["question"],
                "phase": e["phase"],
                "domain": e["domain"],
                "difficulty": e["difficulty"],
                "intent": e["intent"],
                "skipped": e["skipped"],
                "wordCount": e["wordCount"],
                "wpm": e["wpm"],
                "fillerRate": e["fillerRate"],
                "hasConcreteExample": e["hasConcreteExample"],
                "isStructured": e["isStructured"],
                "conceptCoverage": e["conceptCoverage"],
                "metrics": e["metrics"],
            }
            for e in evidence
        ],
    }


def _empty_report() -> Dict[str, Any]:
    return {
        "overallScore": 0.0,
        "performanceLevel": "BEGINNER",
        "technical": 0.0, "relevance": 0.0, "communication": 0.0,
        "confidence": 0.0, "fluency": 0.0, "pace": 0.0, "paceScore": 0.0,
        "paceWpm": None,
        "strengths": [],
        "weaknesses": ["No answers were recorded, so nothing could be assessed."],
        "suggestions": ["Start a new interview and answer at least three "
                        "questions so the report has something to measure."],
        "resources": [],
        "diagnosis": [],
        "analytics": {"answerCount": 0, "answeredCount": 0, "skippedCount": 0,
                      "coverage": 0.0},
        "perQuestion": [],
    }
