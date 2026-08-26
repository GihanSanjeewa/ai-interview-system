"""Self-check for the evaluation harness's metric layer.

Proves that BLEU and ROUGE respond to the content of the (prediction, reference)
pair rather than returning stored values, and that both the third-party and the
builtin backends satisfy the invariants a correct implementation must satisfy.
Needs no model, no GPU and no network.

    python training/verify_metrics.py

The `near > related > unrelated` ordering is asserted only for the stemmed
rouge_score backend: the builtin fallback does not stem, so it scores
"threads"/"thread" as a miss and can rank a morphological paraphrase below an
unrelated sentence that happens to share stopwords. That is a known limitation
of the fallback, which is why the active backend is recorded in every report.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from metrics_impl import BleuMetric, RougeMetric

CASES = [
    ("identical",
     "What is the difference between a process and a thread?",
     "What is the difference between a process and a thread?"),
    ("near",
     "What is the difference between a process and a thread in an OS?",
     "What is the difference between a process and a thread?"),
    ("related",
     "Explain how threads differ from processes.",
     "What is the difference between a process and a thread?"),
    ("unrelated",
     "Kubernetes schedules pods onto nodes using a control loop.",
     "What is the difference between a process and a thread?"),
    ("empty",
     "",
     "What is the difference between a process and a thread?"),
]

for label, third_party in (("third-party (sacrebleu/rouge_score)", True),
                           ("builtin", False)):
    bleu = BleuMetric(prefer_third_party=third_party)
    rouge = RougeMetric(prefer_third_party=third_party)
    print("=" * 92)
    print(f"BACKENDS [{label}]")
    print(f"  bleu : {bleu.backend_detail}")
    print(f"  rouge: {rouge.backend_detail}")
    print("-" * 92)
    print(f"{'case':<12}{'sentBLEU':>10}{'ROUGE-1':>10}{'ROUGE-2':>10}{'ROUGE-L':>10}")
    preds, refs = [], []
    for name, prediction, reference in CASES:
        b = bleu.sentence(prediction, reference)
        r = rouge.sentence(prediction, reference)
        preds.append(prediction)
        refs.append(reference)
        print(f"{name:<12}{b:>10.4f}{r['rouge1']:>10.4f}{r['rouge2']:>10.4f}{r['rougeL']:>10.4f}")
    print("-" * 92)
    print(f"corpus BLEU over all 5 cases          : {bleu.corpus(preds, refs):.6f}")
    print(f"corpus BLEU, predictions == references: "
          f"{bleu.corpus(refs, refs):.6f}   (must be 1.0)")
    print()

# Invariants that must hold regardless of backend.
print("=" * 92)
print("INVARIANT CHECKS")
print("-" * 92)
failures = []
for third_party in (True, False):
    tag = "third-party" if third_party else "builtin"
    bleu = BleuMetric(prefer_third_party=third_party)
    rouge = RougeMetric(prefer_third_party=third_party)
    text = CASES[0][2]

    checks = [
        (f"[{tag}] identical -> sentence BLEU == 1", abs(bleu.sentence(text, text) - 1.0) < 1e-6),
        (f"[{tag}] identical -> corpus BLEU == 1", abs(bleu.corpus([text], [text]) - 1.0) < 1e-6),
        (f"[{tag}] identical -> ROUGE-1/2/L == 1",
         all(abs(v - 1.0) < 1e-6 for v in rouge.sentence(text, text).values())),
        (f"[{tag}] unrelated -> ROUGE-2 == 0",
         rouge.sentence(CASES[3][1], CASES[3][2])["rouge2"] == 0.0),
        (f"[{tag}] empty pred -> all zero",
         bleu.sentence("", text) == 0.0
         and all(v == 0.0 for v in rouge.sentence("", text).values())),
        (f"[{tag}] near paraphrase scores above unrelated (ROUGE-1)",
         rouge.sentence(CASES[1][1], CASES[1][2])["rouge1"]
         > rouge.sentence(CASES[3][1], CASES[3][2])["rouge1"]),
    ]
    if rouge.backend == "rouge_score":
        # Only the stemmed backend can see threads/thread as a match.
        checks.append(
            (f"[{tag}] near > related > unrelated (ROUGE-1)",
             rouge.sentence(CASES[1][1], CASES[1][2])["rouge1"]
             > rouge.sentence(CASES[2][1], CASES[2][2])["rouge1"]
             > rouge.sentence(CASES[3][1], CASES[3][2])["rouge1"]))
    for name, ok in checks:
        print(f"  {'PASS' if ok else 'FAIL'}  {name}")
        if not ok:
            failures.append(name)

print("-" * 92)
print(f"{len(failures)} failure(s)" if failures else "all invariants hold")
sys.exit(1 if failures else 0)
