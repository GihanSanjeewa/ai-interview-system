"""
Text-based ML feature extraction using spaCy and scikit-learn TF-IDF.
Computes: communication quality, response relevance, and technical accuracy.
"""

import re
import numpy as np

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except Exception:
    SKLEARN_AVAILABLE = False
    TfidfVectorizer = None
    cosine_similarity = None

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

# Engineering vocabulary that signals technical content regardless of which
# track the question came from. Counted in addition to the per-domain list so a
# correct answer is not penalised for using adjacent terminology.
UNIVERSAL_TECHNICAL_TERMS = [
    "abstraction", "algorithm", "api", "argument", "array", "async",
    "asynchronous", "authentication", "authorization", "availability",
    "backend", "bandwidth", "batch", "branch", "buffer", "bug", "cache",
    "caching", "class", "client", "cluster", "compile", "complexity",
    "concurrency", "consistency", "container", "cookie", "coupling", "crash",
    "database", "deadlock", "debug", "dependency", "deploy", "deployment",
    "disk", "encryption", "endpoint", "environment", "error", "exception",
    "framework", "frontend", "function", "garbage collect", "hash", "header",
    "index", "indexing", "inheritance", "instance", "integration",
    "interface", "iterate", "latency", "library", "load balanc", "lock",
    "log", "memory", "method", "middleware", "migration", "mock", "module",
    "mutex", "network", "normalis", "normaliz", "object", "optimis",
    "optimiz", "orm", "package", "pagination", "parameter", "parse",
    "partition", "performance", "pipeline", "pointer", "polymorphism",
    "pool", "port", "primary key", "process", "profil", "promise",
    "protocol", "proxy", "query", "queue", "race condition", "recursion",
    "refactor", "replica", "repository", "request", "response", "rollback",
    "route", "runtime", "scalab", "scale", "scan", "schema", "scope",
    "serialis", "serializ", "server", "session", "shard", "socket", "stack",
    "state", "stateless", "storage", "stream", "string", "subclass",
    "synchronous", "table", "test", "thread", "throughput", "timeout",
    "token", "transaction", "type", "validation", "variable", "version",
    "webhook", "websocket", "write",
]

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

# ── Corpus IDF, fitted on the project's own question dataset ─────────────────
#
# Relevance was previously TF-IDF cosine similarity with the vectorizer fitted
# on just the two documents being compared. With a two-document corpus, IDF
# carries almost no information: a correct answer that explains the concept in
# different words scores 0, while an answer that merely parrots the question
# scores highly. Fitting IDF on the real question corpus fixes the weighting,
# and relevance is then measured as recall of the question's *informative*
# terms rather than raw cosine similarity.

_IDF_CACHE = {}


def _get_idf():
    """Term -> IDF weight, learned from our own question dataset."""
    if "idf" in _IDF_CACHE:
        return _IDF_CACHE["idf"]

    documents = []
    try:
        import json as _json
        from pathlib import Path as _Path
        qg_dir = _Path(__file__).resolve().parent / "dataset" / "processed" / "question_generator"
        for split in ("train.jsonl", "validation.jsonl", "test.jsonl"):
            path = qg_dir / split
            if not path.exists():
                continue
            with path.open(encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        rec = _json.loads(line)
                    except Exception:
                        continue
                    q = rec.get("question") or ""
                    a = rec.get("expected_answer") or ""
                    if q:
                        documents.append(q + " " + a)
    except Exception as exc:
        print(f"IDF corpus load note: {exc}")

    idf = {}
    if documents:
        n_docs = len(documents)
        doc_freq = {}
        for doc in documents:
            for term in set(_content_terms(doc)):
                doc_freq[term] = doc_freq.get(term, 0) + 1
        for term, df in doc_freq.items():
            idf[term] = float(np.log((n_docs + 1) / (df + 1)) + 1.0)
        _IDF_CACHE["default"] = float(np.log((n_docs + 1) / 1.0) + 1.0)
    else:
        # No corpus available: fall back to uniform weighting rather than
        # silently scoring everything 50.
        _IDF_CACHE["default"] = 1.0

    _IDF_CACHE["idf"] = idf
    return idf


_STOP = {
    "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "at",
    "for", "with", "by", "from", "as", "is", "are", "was", "were", "be",
    "been", "being", "do", "does", "did", "have", "has", "had", "will",
    "would", "can", "could", "should", "may", "might", "must", "shall",
    "this", "that", "these", "those", "it", "its", "they", "them", "their",
    "you", "your", "we", "our", "i", "my", "me", "he", "she", "his", "her",
    "what", "why", "how", "when", "where", "which", "who", "whom", "there",
    "here", "then", "than", "so", "such", "not", "no", "yes", "also", "very",
    "just", "about", "into", "over", "under", "between", "some", "any", "all",
    "more", "most", "other", "same", "own", "too", "only", "s", "t",
}


def _content_terms(text):
    """Lower-cased content words, stemmed lightly for plural/tense variation."""
    out = []
    for tok in re.findall(r"[a-z][a-z0-9+#.]{1,}", (text or "").lower()):
        tok = tok.strip(".")
        if len(tok) < 3 or tok in _STOP:
            continue
        # Light suffix normalisation so "indexes"/"indexing"/"index" match.
        for suffix in ("ing", "ies", "es", "ed", "s"):
            if len(tok) > len(suffix) + 2 and tok.endswith(suffix):
                tok = tok[: -len(suffix)]
                break
        out.append(tok)
    return out


# What each question word is asking for, and the answer markers that satisfy it.
_QUESTION_INTENT = {
    "what": r"\b(is|are|means?|refers?|defined?|definition|a\s+type|"
            r"consists?|involves?)\b",
    "why": r"\b(because|since|so\s+that|reason|due\s+to|in\s+order\s+to|"
           r"therefore|as\s+a\s+result|the\s+benefit|the\s+point)\b",
    "how": r"\b(by|through|using|first|then|step|process|works?|"
           r"you\s+would|we\s+would|the\s+way)\b",
    "when": r"\b(when|if|during|after|before|in\s+cases?|scenario|"
            r"situation|use\s+it)\b",
    "difference": r"\b(whereas|while|but|unlike|on\s+the\s+other\s+hand|"
                  r"differs?|difference|versus|vs\.?|compared)\b",
    "explain": r"\b(because|so|which\s+means|that\s+is|in\s+other\s+words|"
               r"for\s+example|works?)\b",
    "describe": r"\b(first|then|we|i|the\s+system|the\s+process)\b",
}


# ── Question typing ──────────────────────────────────────────────────────────
#
# A behavioural or introductory prompt ("tell me about yourself") shares almost
# no vocabulary with a good answer to it, and a good answer contains none of the
# definitional markers a technical question expects. Scoring both prompt types
# with the same rule gave a correct self-introduction a relevance of 0, so the
# prompt type is detected first and each type is scored on its own terms.

_PERSONAL_PROMPT = re.compile(
    r"\b(tell\s+me\s+about\s+(yourself|a\s+time|your)|"
    r"about\s+yourself|your\s+(background|experience|journey|role|career)|"
    r"walk\s+me\s+through\s+(your|a\s+project|the\s+most)|"
    r"describe\s+a\s+time|tell\s+me\s+about\s+something|"
    r"introduce\s+yourself|"
    r"a\s+time\s+(you|when\s+you)|"
    r"you'?ve\s+been\s+working|have\s+you\s+worked|"
    r"anything\s+you'?d\s+like\s+to\s+ask|"
    r"how\s+would\s+you\s+rate\s+your|"
    r"which\s+project\s+taught\s+you|"
    r"i\s+see\s+.*\s+on\s+your\s+cv|your\s+cv\s+lists)\b",
    re.IGNORECASE)

# First-person ownership: the candidate is describing their own work.
_SELF_REFERENCE = re.compile(
    r"\b(i|we|my|our|me|us)\b", re.IGNORECASE)

# Narrative structure — the shape a good behavioural answer takes.
_NARRATIVE = re.compile(
    r"\b(first|then|after\s+that|eventually|finally|so\s+i|so\s+we|"
    r"what\s+i\s+did|the\s+result|in\s+the\s+end|which\s+meant|"
    r"the\s+problem\s+was|the\s+challenge|i\s+learned|i\s+realised|"
    r"i\s+realized|looking\s+back|because)\b", re.IGNORECASE)


def _score_personal_answer(answer: str, words: list) -> float:
    """
    Relevance for an introductory or behavioural prompt.

    Such a prompt asks the candidate to talk about themselves, so relevance is
    measured by whether the answer *is* a substantive personal account: first-
    person ownership, concrete specifics, narrative structure, and enough length
    to constitute an answer.
    """
    word_count = len(words)

    # 1. First-person ownership (0-30). An answer with no "I" is not an account
    #    of the candidate's own experience.
    self_hits = len(_SELF_REFERENCE.findall(answer))
    ownership = min(30.0, self_hits * 7.0)

    # 2. Concrete specifics (0-30) — named technologies, numbers, examples.
    specifics = len(_SPECIFICITY_MARKERS.findall(answer))
    proper_nouns = len(re.findall(r"\b[A-Z][a-zA-Z.+#]{2,}", answer[1:]))
    concreteness = min(30.0, specifics * 9.0 + min(proper_nouns, 4) * 4.0)

    # 3. Narrative structure (0-20).
    narrative = min(20.0, len(_NARRATIVE.findall(answer)) * 7.0)

    # 4. Length adequacy (0-20) — a two-word reply is not an answer here.
    if word_count >= 45:
        adequacy = 20.0
    elif word_count >= 25:
        adequacy = 15.0
    elif word_count >= 12:
        adequacy = 9.0
    else:
        adequacy = max(0.0, word_count * 0.5)

    return round(min(100.0, ownership + concreteness + narrative + adequacy), 1)


def compute_response_relevance(question: str, answer: str,
                               expects=None) -> float:
    """
    Response Relevance — scored 0-100.

    The prompt type is detected first, because the two types cannot be scored
    the same way.

    **Personal / behavioural prompts** ("tell me about yourself", "describe a
    time you...") are scored on whether the answer is a substantive first-person
    account: ownership, concrete specifics, narrative structure, length.

    **Technical prompts** are scored on three measured components:
      1. Term recall  — how much of the question's *informative* vocabulary the
         answer engages with, weighted by corpus IDF so common words like
         "system" count for less than "idempotency".
      2. Intent match — whether the answer's form matches what was asked
         (a "why" question answered with causal language, a "difference"
         question answered with contrastive language).
      3. Concept coverage — how many of the question's expected concepts
         appear, when the interview plan declared them.

    `expects` is the list of expected concepts from the interview plan; it is
    optional so existing two-argument callers keep working.
    """
    question = (question or "").strip()
    answer = (answer or "").strip()

    if not answer:
        return 0.0
    if not question:
        # Nothing to be relevant *to*; judge on substance alone.
        return 50.0 if len(answer.split()) >= 15 else 25.0

    words = answer.split()
    if len(words) < 4:
        return 15.0

    # Behavioural and introductory prompts take the personal-account route.
    if _PERSONAL_PROMPT.search(question):
        return _score_personal_answer(answer, words)

    idf = _get_idf()
    default_idf = _IDF_CACHE.get("default", 1.0)

    q_terms = _content_terms(question)
    a_terms = set(_content_terms(answer))

    # --- 1. IDF-weighted term recall -----------------------------------------
    if q_terms:
        total_weight = 0.0
        hit_weight = 0.0
        for term in set(q_terms):
            w = idf.get(term, default_idf)
            total_weight += w
            if term in a_terms:
                hit_weight += w
        recall = (hit_weight / total_weight) if total_weight else 0.0
    else:
        recall = 0.0

    # Full marks well before 100% recall: a good answer explains a concept, it
    # does not echo every word of the question.
    recall_score = min(100.0, recall * 250.0)

    # --- 2. Question-intent match --------------------------------------------
    q_lower = question.lower()
    intent_keys = []
    if re.search(r"\bdifference|\bversus\b|\bvs\.?\b|\bcompare", q_lower):
        intent_keys.append("difference")
    for key in ("what", "why", "how", "when", "explain", "describe"):
        if re.search(r"\b" + key + r"\b", q_lower):
            intent_keys.append(key)

    if intent_keys:
        matched = sum(1 for k in intent_keys
                      if re.search(_QUESTION_INTENT[k], answer, re.IGNORECASE))
        # Partial credit, with a floor: failing to use the expected connective
        # is weak evidence of irrelevance, not proof of it. Without the floor a
        # correct answer phrased unusually scored zero.
        intent_score = 25.0 + 75.0 * matched / len(intent_keys)
    else:
        intent_score = 60.0        # no detectable intent marker; stay neutral

    # --- 3. Declared concept coverage ----------------------------------------
    concept_score = None
    if expects:
        covered = 0
        for concept in expects:
            concept_terms = set(_content_terms(str(concept)))
            if concept_terms and (concept_terms & a_terms):
                covered += 1
        concept_score = 100.0 * covered / len(expects)

    # --- combine -------------------------------------------------------------
    if concept_score is not None:
        score = 0.40 * recall_score + 0.25 * intent_score + 0.35 * concept_score
    else:
        score = 0.60 * recall_score + 0.40 * intent_score

    # A substantial answer should never be scored as irrelevant purely for
    # avoiding the question's exact wording — a correct explanation in different
    # words is still a correct explanation.
    #
    # This is the known limit of a lexical relevance measure: it cannot tell a
    # correct paraphrase from an off-topic answer of the same length. The floor
    # is therefore deliberately mediocre rather than generous — enough that a
    # well-phrased answer is not scored as irrelevant, not enough to make
    # relevance meaningless.
    if len(words) >= 20:
        engaged = sum(1 for term in UNIVERSAL_TECHNICAL_TERMS
                      if term in answer.lower())
        if engaged >= 3:
            score = max(score, 40.0 if intent_score >= 50.0 else 35.0)
        elif len(words) >= 30:
            score = max(score, 30.0)

    return round(float(max(0.0, min(100.0, score))), 1)


# ── Technical Accuracy ────────────────────────────────────────────────────────

# Reasoning markers: an answer that explains *why* or *how* demonstrates
# understanding, not just vocabulary recall.
_MECHANISM_MARKERS = re.compile(
    r"\b(because|since|so\s+that|which\s+means|means\s+that|this\s+causes|"
    r"results?\s+in|leads?\s+to|due\s+to|therefore|as\s+a\s+result|"
    r"the\s+reason|under\s+the\s+hood|internally|works?\s+by|that\s+way|"
    r"which\s+is\s+why|allows?\s+(you|us|it|the)|lets?\s+(you|us|it|the)|"
    r"enables?|prevents?|avoids?|ensures?|guarantees?|"
    r"instead\s+of\s+\w+ing|rather\s+than|in\s+order\s+to|"
    r"so\s+(you|we|it|the|reads?|writes?))\b", re.IGNORECASE)

_TRADEOFF_MARKERS = re.compile(
    r"\b(trade[\s-]?offs?|however|but|whereas|on\s+the\s+other\s+hand|"
    r"the\s+downside|the\s+cost|at\s+the\s+expense|in\s+exchange|"
    r"the\s+drawback|compared\s+to|versus|instead\s+of|unlike)\b",
    re.IGNORECASE)

_SPECIFICITY_MARKERS = re.compile(
    r"(\b\d+\s*(%|percent|ms|milliseconds?|seconds?|minutes?|gb|mb|kb|"
    r"requests?|users?|rows?|queries|times|x)\b"
    r"|\bO\(\s*[a-z0-9^ *+log]+\s*\)"
    r"|\bfor\s+(example|instance)\b"
    r"|\bin\s+(my|our)\s+(last|previous|current)\b)", re.IGNORECASE)

_VAGUE_MARKERS = re.compile(
    r"\b(stuff|things?|whatever|something\s+like\s+that|and\s+so\s+on|"
    r"etc\.?|you\s+know|basically\s+just|kind\s+of\s+like)\b",
    re.IGNORECASE)


def compute_technical_accuracy(answer: str, domain: str) -> float:
    """
    Technical Accuracy — scored 0-100.

    Measures four things, not keyword density:

      1. Coverage  — how many *distinct* domain concepts the answer engages.
         The previous implementation scored keyword *density* (keywords per 100
         words), which saturated at 100 for a 30-word answer containing two
         terms while penalising a thorough 200-word answer. Density rewards
         terseness; coverage rewards substance.
      2. Mechanism — does the answer explain why/how, or only name things?
      3. Trade-offs — does it acknowledge cost, not just benefit? This is the
         single strongest signal of real technical depth in interviews.
      4. Specificity — concrete numbers, complexity classes, real examples.

    Vague filler ("stuff", "things", "etc.") is penalised, and very short
    answers are capped because they cannot demonstrate depth regardless of
    which words they contain.
    """
    if not answer or not answer.strip():
        return 0.0

    answer_lower = answer.lower()
    words = answer_lower.split()
    word_count = len(words)

    if word_count < 4:
        return 10.0

    # --- resolve the domain keyword list ------------------------------------
    keywords = DOMAIN_KEYWORDS.get(domain, [])
    if not keywords and domain:
        for key in DOMAIN_KEYWORDS:
            if key.lower() in domain.lower() or domain.lower() in key.lower():
                keywords = DOMAIN_KEYWORDS[key]
                break
    if not keywords:
        # Unknown domain: pool every domain's vocabulary rather than falling
        # back to generic connective words, which measure nothing technical.
        keywords = sorted({kw for kws in DOMAIN_KEYWORDS.values() for kw in kws})

    # The per-domain lists are narrow, so a correct answer phrased in adjacent
    # vocabulary would otherwise score near zero on coverage. Cross-domain
    # engineering vocabulary always counts.
    matched = {kw for kw in keywords if kw in answer_lower}
    matched |= {kw for kw in UNIVERSAL_TECHNICAL_TERMS if kw in answer_lower}
    matched = sorted(matched)

    # --- 1. concept coverage (0-35) ------------------------------------------
    # Diminishing returns: naming more terms is not the same as understanding.
    coverage = 35.0 * (1.0 - np.exp(-0.5 * len(matched)))

    # --- 2. mechanism / explanation (0-25) ----------------------------------
    # Weighted above coverage: explaining *why* is the point of the question.
    mechanism_hits = len(_MECHANISM_MARKERS.findall(answer))
    mechanism = min(25.0, mechanism_hits * 9.0)

    # --- 3. trade-off awareness (0-22) --------------------------------------
    tradeoff_hits = len(_TRADEOFF_MARKERS.findall(answer))
    tradeoff = min(22.0, tradeoff_hits * 11.0)

    # --- 4. specificity (0-18) ----------------------------------------------
    specificity_hits = len(_SPECIFICITY_MARKERS.findall(answer))
    specificity = min(18.0, specificity_hits * 8.0)

    score = coverage + mechanism + tradeoff + specificity

    # --- penalties -----------------------------------------------------------
    vague_hits = len(_VAGUE_MARKERS.findall(answer))
    score -= min(15.0, vague_hits * 5.0)

    # Length ceiling: depth cannot be demonstrated in a sentence.
    if word_count < 12:
        score = min(score, 35.0)
    elif word_count < 25:
        score = min(score, 60.0)
    elif word_count < 40:
        score = min(score, 85.0)

    return round(float(max(0.0, min(100.0, score))), 1)


# ── Batch analysis across all Q&A turns ──────────────────────────────────────

#: Roles that identify the interviewer's turn, across every caller's schema.
_INTERVIEWER_ROLES = {"assistant", "ai", "interviewer", "system", "bot"}
#: Roles that identify the candidate's turn.
_CANDIDATE_ROLES = {"user", "candidate", "human", "me"}


def _turn_text(turn: dict) -> str:
    """Read a turn's text regardless of which key the caller used."""
    for key in ("content", "text", "message", "transcript"):
        val = turn.get(key)
        if isinstance(val, str) and val.strip():
            return val
    return ""


def analyze_conversation(history: list, domain: str) -> dict:
    """
    Run all text-based ML analyses across the full interview conversation.

    Accepts either schema used across the codebase:
      {"role": "assistant"|"ai", "content"|"text": "..."}
      {"role": "user"|"candidate", "content"|"text": "..."}

    Callers previously passed {"role": "ai", "text": ...} while this function
    only read {"role": "assistant", "content": ...}, so every conversation
    parsed as empty and the fixed 50/50/50 fallback was returned for every
    interview. Normalising both shapes here fixes that at the source.

    Returns averaged scores for communication, relevance, and technical accuracy.
    """
    history = [t for t in (history or []) if isinstance(t, dict)]
    questions = [_turn_text(m) for m in history
                 if str(m.get("role", "")).lower() in _INTERVIEWER_ROLES]
    answers = [_turn_text(m) for m in history
               if str(m.get("role", "")).lower() in _CANDIDATE_ROLES]
    questions = [q for q in questions if q]
    answers = [a for a in answers if a]

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
