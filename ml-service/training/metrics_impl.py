"""Real metric implementations for the interview-assistant evaluation harness.

Every function in this module computes its result from the `(prediction,
reference)` pairs it is handed. Nothing here returns a stored, sampled or
otherwise pre-baked number — if a metric cannot be computed the backend reports
`available=False` together with the reason, and the caller records `null`.

Backend policy
--------------
Each metric prefers the standard, citable third-party implementation and falls
back to a self-contained implementation only when that package is missing:

    BLEU       sacrebleu.corpus_bleu / sentence_bleu   -> builtin corpus BLEU-4
    ROUGE      rouge_score.rouge_scorer               -> builtin ROUGE-1/2/L
    BERTScore  bert_score.BERTScorer                  -> builtin greedy-cosine

The active backend is always reported back to the caller and printed in the
evaluation report, because BLEU/ROUGE/BERTScore numbers are only comparable
across papers when the implementation and its tokenisation are stated. Prefer
the third-party backends for anything that will be published; the builtins exist
so the harness still produces honest numbers on a machine where they are not
installed.
"""
from __future__ import annotations

import logging
import math
import re
from collections import Counter
from typing import Any, Sequence

log = logging.getLogger("evaluate_model.metrics")

__all__ = [
    "BleuMetric",
    "RougeMetric",
    "BertScoreMetric",
    "tokenize_13a",
    "tokenize_words",
]


# ══════════════════════════════════════════════════════════════════════════════
# Tokenisation
# ══════════════════════════════════════════════════════════════════════════════

_13A_PUNCT = re.compile(r"([\{-\~\[-\` -\&\(-\+\:-\@\/])")
_13A_COMMA_AFTER_NONDIGIT = re.compile(r"([^0-9])([\.,])")
_13A_COMMA_BEFORE_NONDIGIT = re.compile(r"([\.,])([^0-9])")
_13A_DASH_AFTER_DIGIT = re.compile(r"([0-9])(-)")


def tokenize_13a(text: str) -> list[str]:
    """Approximate the mteval-v13a tokeniser used by sacrebleu's default BLEU.

    Only used by the builtin BLEU fallback; when sacrebleu is installed its own
    tokeniser is used instead.
    """
    text = text.replace("<skipped>", "").replace("-\n", "").replace("\n", " ")
    text = (text.replace("&quot;", '"').replace("&amp;", "&")
                .replace("&lt;", "<").replace("&gt;", ">"))
    text = _13A_PUNCT.sub(r" \1 ", text)
    text = _13A_COMMA_AFTER_NONDIGIT.sub(r"\1 \2 ", text)
    text = _13A_COMMA_BEFORE_NONDIGIT.sub(r" \1 \2", text)
    text = _13A_DASH_AFTER_DIGIT.sub(r"\1 \2 ", text)
    return text.split()


_WORD = re.compile(r"[a-z0-9]+")


def tokenize_words(text: str) -> list[str]:
    """Lowercased alphanumeric tokens — the builtin ROUGE tokenisation.

    Matches `rouge_score`'s tokenizer except that it applies no Porter stemmer,
    which is why the backend name is reported alongside the score.
    """
    return _WORD.findall(text.lower())


# ══════════════════════════════════════════════════════════════════════════════
# BLEU
# ══════════════════════════════════════════════════════════════════════════════

def _ngram_counts(tokens: Sequence[str], order: int) -> Counter:
    return Counter(tuple(tokens[i:i + order]) for i in range(len(tokens) - order + 1))


def _builtin_corpus_bleu(predictions: Sequence[str], references: Sequence[str],
                         max_order: int = 4) -> float:
    """Corpus BLEU-4 with uniform weights and the standard brevity penalty.

    No smoothing, which is the correct corpus-level behaviour: a zero n-gram
    precision genuinely means the corpus shares no n-grams of that order, and
    BLEU is then 0.
    """
    matches = [0] * max_order
    totals = [0] * max_order
    pred_len = ref_len = 0

    for prediction, reference in zip(predictions, references):
        p_tokens = tokenize_13a(prediction)
        r_tokens = tokenize_13a(reference)
        pred_len += len(p_tokens)
        ref_len += len(r_tokens)
        for order in range(1, max_order + 1):
            p_counts = _ngram_counts(p_tokens, order)
            r_counts = _ngram_counts(r_tokens, order)
            totals[order - 1] += max(0, len(p_tokens) - order + 1)
            matches[order - 1] += sum(min(count, r_counts[ngram])
                                      for ngram, count in p_counts.items())

    if pred_len == 0 or any(total == 0 for total in totals):
        return 0.0
    precisions = [matches[i] / totals[i] for i in range(max_order)]
    if any(p == 0.0 for p in precisions):
        return 0.0
    log_avg = sum(math.log(p) for p in precisions) / max_order
    brevity = 1.0 if pred_len > ref_len else math.exp(1.0 - ref_len / max(pred_len, 1))
    return brevity * math.exp(log_avg)


def _builtin_sentence_bleu(prediction: str, reference: str, max_order: int = 4) -> float:
    """Sentence BLEU with Chen & Cherry method 3 ('exp') smoothing.

    Sentence-level BLEU needs smoothing or almost every short interview question
    scores exactly 0 for want of a single 4-gram. This mirrors what sacrebleu's
    `sentence_bleu` does by default so the builtin and sacrebleu backends stay
    broadly comparable.
    """
    p_tokens = tokenize_13a(prediction)
    r_tokens = tokenize_13a(reference)
    if not p_tokens or not r_tokens:
        return 0.0

    precisions: list[float] = []
    invcnt = 1
    for order in range(1, max_order + 1):
        total = max(0, len(p_tokens) - order + 1)
        if total == 0:
            precisions.append(0.0)
            continue
        p_counts = _ngram_counts(p_tokens, order)
        r_counts = _ngram_counts(r_tokens, order)
        matched = sum(min(count, r_counts[ngram]) for ngram, count in p_counts.items())
        if matched == 0:
            invcnt *= 2
            precisions.append(1.0 / (invcnt * total))
        else:
            precisions.append(matched / total)

    if any(p <= 0.0 for p in precisions):
        return 0.0
    log_avg = sum(math.log(p) for p in precisions) / max_order
    brevity = (1.0 if len(p_tokens) > len(r_tokens)
               else math.exp(1.0 - len(r_tokens) / len(p_tokens)))
    return brevity * math.exp(log_avg)


class BleuMetric:
    """Corpus and sentence BLEU. Uses sacrebleu when importable."""

    name = "bleu"

    def __init__(self, prefer_third_party: bool = True) -> None:
        self.backend = "builtin"
        self.backend_detail = "builtin corpus BLEU-4, 13a-style tokenisation"
        self.available = True
        self.reason: str | None = None
        self._sacrebleu = None

        if not prefer_third_party:
            return
        try:
            import sacrebleu

            self._sacrebleu = sacrebleu
            self.backend = "sacrebleu"
            self.backend_detail = (f"sacrebleu {sacrebleu.__version__} "
                                   f"(BLEU-4, tokenizer 13a, no smoothing at corpus level)")
        except ImportError as exc:
            log.info("sacrebleu not installed (%s) — using the builtin BLEU "
                     "implementation; `pip install sacrebleu` for citable numbers", exc)

    def sentence(self, prediction: str, reference: str) -> float:
        if self._sacrebleu is not None:
            try:
                return float(self._sacrebleu.sentence_bleu(prediction, [reference]).score) / 100.0
            except Exception as exc:  # pragma: no cover - defensive
                log.warning("sacrebleu.sentence_bleu failed (%s) — builtin fallback "
                            "for this pair", exc)
        return _builtin_sentence_bleu(prediction, reference)

    def corpus(self, predictions: Sequence[str], references: Sequence[str]) -> float | None:
        if not predictions:
            return None
        if self._sacrebleu is not None:
            try:
                return float(self._sacrebleu.corpus_bleu(
                    list(predictions), [list(references)]).score) / 100.0
            except Exception as exc:  # pragma: no cover - defensive
                log.warning("sacrebleu.corpus_bleu failed (%s) — builtin fallback", exc)
        return _builtin_corpus_bleu(predictions, references)

    def describe(self) -> dict[str, Any]:
        return {"backend": self.backend, "detail": self.backend_detail,
                "available": self.available, "reason": self.reason}


# ══════════════════════════════════════════════════════════════════════════════
# ROUGE
# ══════════════════════════════════════════════════════════════════════════════

def _f1(matched: int, pred_total: int, ref_total: int) -> float:
    if matched == 0 or pred_total == 0 or ref_total == 0:
        return 0.0
    precision = matched / pred_total
    recall = matched / ref_total
    return 2 * precision * recall / (precision + recall)


def _rouge_n(p_tokens: Sequence[str], r_tokens: Sequence[str], order: int) -> float:
    p_counts = _ngram_counts(p_tokens, order)
    r_counts = _ngram_counts(r_tokens, order)
    matched = sum(min(count, r_counts[ngram]) for ngram, count in p_counts.items())
    return _f1(matched, max(0, len(p_tokens) - order + 1), max(0, len(r_tokens) - order + 1))


def _lcs_length(a: Sequence[str], b: Sequence[str]) -> int:
    """Length of the longest common subsequence, O(len(a) * len(b)) time, O(len(b)) space."""
    if not a or not b:
        return 0
    previous = [0] * (len(b) + 1)
    for token_a in a:
        current = [0]
        for index, token_b in enumerate(b):
            if token_a == token_b:
                current.append(previous[index] + 1)
            else:
                current.append(max(current[index], previous[index + 1]))
        previous = current
    return previous[-1]


class RougeMetric:
    """ROUGE-1/2/L F-measure. Uses rouge_score (with Porter stemming) when importable."""

    name = "rouge"
    keys = ("rouge1", "rouge2", "rougeL")

    def __init__(self, prefer_third_party: bool = True) -> None:
        self.backend = "builtin"
        self.backend_detail = ("builtin ROUGE-1/2/L F1, lowercase alphanumeric "
                               "tokenisation, no stemming")
        self.available = True
        self.reason: str | None = None
        self._scorer = None

        if not prefer_third_party:
            return
        try:
            from rouge_score import rouge_scorer

            self._scorer = rouge_scorer.RougeScorer(list(self.keys), use_stemmer=True)
            self.backend = "rouge_score"
            self.backend_detail = "google-research rouge_score, use_stemmer=True, F-measure"
        except ImportError as exc:
            log.info("rouge_score not installed (%s) — using the builtin ROUGE "
                     "implementation; `pip install rouge-score` for citable numbers", exc)

    def sentence(self, prediction: str, reference: str) -> dict[str, float]:
        if self._scorer is not None:
            try:
                scores = self._scorer.score(reference, prediction)
                return {key: float(scores[key].fmeasure) for key in self.keys}
            except Exception as exc:  # pragma: no cover - defensive
                log.warning("rouge_score failed (%s) — builtin fallback for this pair", exc)

        p_tokens = tokenize_words(prediction)
        r_tokens = tokenize_words(reference)
        lcs = _lcs_length(p_tokens, r_tokens)
        return {
            "rouge1": _rouge_n(p_tokens, r_tokens, 1),
            "rouge2": _rouge_n(p_tokens, r_tokens, 2),
            "rougeL": _f1(lcs, len(p_tokens), len(r_tokens)),
        }

    def describe(self) -> dict[str, Any]:
        return {"backend": self.backend, "detail": self.backend_detail,
                "available": self.available, "reason": self.reason}


# ══════════════════════════════════════════════════════════════════════════════
# BERTScore
# ══════════════════════════════════════════════════════════════════════════════

class BertScoreMetric:
    """Contextual-embedding precision/recall/F1 (Zhang et al., 2020).

    `bert_score` is the reference implementation and the only backend whose
    numbers are directly comparable with published BERTScore results, because it
    pins the layer per model and (optionally) rescales against a baseline. The
    builtin backend computes the same greedy cosine matching from a transformers
    model's hidden states without baseline rescaling — honest, reproducible, and
    clearly labelled, but not comparable with published figures.
    """

    name = "bertscore"

    def __init__(self, model_name: str | None = None, layer: int | None = None,
                 batch_size: int = 16, device: str | None = None,
                 lang: str = "en", prefer_third_party: bool = True) -> None:
        self.available = False
        self.reason: str | None = None
        self.backend = "none"
        self.backend_detail = ""
        self.model_name = model_name
        self.layer = layer
        self.batch_size = batch_size
        self.device = device
        self.lang = lang
        self._scorer = None
        self._builtin: tuple[Any, Any] | None = None

        if prefer_third_party and self._init_bert_score():
            return
        self._init_builtin()

    # -- backends ------------------------------------------------------------

    def _init_bert_score(self) -> bool:
        try:
            import bert_score
        except ImportError as exc:
            log.info("bert_score not installed (%s) — trying the builtin "
                     "BERTScore backend", exc)
            return False
        try:
            kwargs: dict[str, Any] = {"batch_size": self.batch_size,
                                      "device": self.device, "rescale_with_baseline": False}
            if self.model_name:
                kwargs["model_type"] = self.model_name
                if self.layer is not None:
                    kwargs["num_layers"] = self.layer
            else:
                kwargs["lang"] = self.lang
            self._scorer = bert_score.BERTScorer(**kwargs)
            self.backend = "bert_score"
            self.model_name = getattr(self._scorer, "model_type", self.model_name)
            self.layer = getattr(self._scorer, "num_layers", self.layer)
            self.backend_detail = (
                f"bert_score {bert_score.__version__}, model={self.model_name}, "
                f"layer={self.layer}, rescale_with_baseline=False")
            self.available = True
            return True
        except Exception as exc:
            self.reason = f"bert_score could not be initialised: {type(exc).__name__}: {exc}"
            log.warning("%s", self.reason)
            return False

    def _init_builtin(self) -> None:
        model_name = self.model_name or "roberta-large"
        try:
            import torch
            from transformers import AutoModel, AutoTokenizer
        except ImportError as exc:
            self.reason = (f"neither bert_score nor transformers is available "
                           f"({exc}); install with `pip install bert-score`")
            log.warning("%s", self.reason)
            return
        try:
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModel.from_pretrained(model_name, output_hidden_states=True)
            model.eval()
            if self.device:
                model.to(self.device)
            self._builtin = (tokenizer, model)
            self._torch = torch
            self.backend = "builtin"
            self.model_name = model_name
            self.backend_detail = (
                f"builtin greedy-cosine BERTScore, model={model_name}, "
                f"layer={'last' if self.layer is None else self.layer}, "
                f"no IDF weighting, NO baseline rescaling — not comparable with "
                f"published BERTScore numbers")
            self.available = True
        except Exception as exc:
            self.reason = (f"could not load the BERTScore embedding model "
                           f"'{model_name}': {type(exc).__name__}: {exc}")
            log.warning("%s", self.reason)

    # -- scoring -------------------------------------------------------------

    def score(self, predictions: Sequence[str], references: Sequence[str]
              ) -> list[dict[str, float]] | None:
        """Per-sample {precision, recall, f1}, or None when unavailable."""
        if not self.available or not predictions:
            return None
        try:
            if self.backend == "bert_score":
                precision, recall, f1 = self._scorer.score(list(predictions), list(references))
                return [{"precision": float(p), "recall": float(r), "f1": float(f)}
                        for p, r, f in zip(precision, recall, f1)]
            return self._score_builtin(predictions, references)
        except Exception as exc:
            self.available = False
            self.reason = f"BERTScore failed during scoring: {type(exc).__name__}: {exc}"
            log.error("%s", self.reason)
            return None

    def _embed(self, texts: Sequence[str]):
        torch = self._torch
        tokenizer, model = self._builtin
        device = next(model.parameters()).device
        out: list[Any] = []
        for start in range(0, len(texts), self.batch_size):
            batch = list(texts[start:start + self.batch_size])
            encoded = tokenizer(batch, return_tensors="pt", padding=True,
                                truncation=True, max_length=512)
            encoded = {k: v.to(device) for k, v in encoded.items()}
            with torch.no_grad():
                outputs = model(**encoded)
            hidden = (outputs.hidden_states[self.layer] if self.layer is not None
                      else outputs.last_hidden_state)
            hidden = torch.nn.functional.normalize(hidden, dim=-1)
            mask = encoded["attention_mask"]
            for row in range(hidden.size(0)):
                length = int(mask[row].sum().item())
                # Drop the leading/trailing special tokens, as bert_score does.
                vectors = hidden[row, :length]
                if length > 2:
                    vectors = vectors[1:-1]
                out.append(vectors.cpu())
        return out

    def _score_builtin(self, predictions: Sequence[str], references: Sequence[str]
                       ) -> list[dict[str, float]]:
        torch = self._torch
        pred_vectors = self._embed(predictions)
        ref_vectors = self._embed(references)
        results: list[dict[str, float]] = []
        for cand, ref in zip(pred_vectors, ref_vectors):
            if cand.numel() == 0 or ref.numel() == 0:
                results.append({"precision": 0.0, "recall": 0.0, "f1": 0.0})
                continue
            similarity = cand @ ref.T
            precision = float(similarity.max(dim=1).values.mean())
            recall = float(similarity.max(dim=0).values.mean())
            denominator = precision + recall
            f1 = 0.0 if denominator == 0 else 2 * precision * recall / denominator
            results.append({"precision": precision, "recall": recall, "f1": f1})
        return results

    def describe(self) -> dict[str, Any]:
        return {"backend": self.backend, "detail": self.backend_detail,
                "available": self.available, "reason": self.reason,
                "model": self.model_name, "layer": self.layer}
