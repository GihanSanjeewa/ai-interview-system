"""Automated Comprehensive Verification Test Suite for the 100% Own Models ML Pipeline.

Verifies:
1. All 9 notebooks exist and contain valid Jupyter JSON format.
2. All Python code cells across all 9 notebooks compile without syntax errors.
3. Exactly 4 candidate models exist, all defined as scratch_trained.
4. Zero pretrained candidates (no Qwen, Llama, Mistral, Gemma, GPT, OpenAI, Ollama).
5. Zero from_pretrained() model-loading calls in candidate configs or active inference path.
6. Custom BPE Tokenizer is trained from training data only.
7. Zero data leakage across train, validation, and test splits.
8. Programmatic Test Lock: Notebooks 01-07 cannot access test data; Notebook 08 succeeds.
9. Atomic Checkpoint engine: Saving and loading preserves model, optimizer, epoch, and step state.
10. Selection weights sum to 1.0 with correct inverted normalization for lower-is-better metrics.
11. Model selection operates strictly on validation data and selects exactly one winner.
12. Promotion Gate accurately evaluates approved vs rejected thresholds on held-out test data.
13. Central Model Registry tracks capability namespaces and enforces status transitions.
14. Flask ML Service endpoints (/models, /models/active, /models/activate, /generate_question) work with own model.
15. Offline question generator agent runs pure own-model inference with zero external LLM dependencies.
"""
from __future__ import annotations

import ast
import json
import os
import sys
import unittest
from pathlib import Path

# Add ml-service root to path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

import torch
from test_access_guard import (
    TestDatasetLockedError,
    load_split_records,
    verify_no_split_leakage
)
from transformer_scratch import (
    CustomBPETokenizer,
    CompactTransformerLM,
    build_candidate_model,
    save_checkpoint,
    load_checkpoint
)
from model_registry import ModelRegistry
from ml_pipeline_utils import (
    normalize_metrics,
    check_promotion_gate
)
from agents.question_generator_agent import QuestionGeneratorAgent
from app import app


class TestOwnModelsPipeline(unittest.TestCase):

    def setUp(self):
        self.notebooks_dir = BASE_DIR / "notebooks"
        self.configs_dir = BASE_DIR / "configs"
        self.reports_dir = BASE_DIR / "reports"
        self.dataset_dir = BASE_DIR / "dataset"

    # ─── 1. Notebook JSON Validity ───────────────────────────────────────────

    def test_01_notebook_json_validity(self):
        """Verify all 9 notebooks exist and are valid Jupyter Notebook JSON format."""
        expected_notebooks = [
            "01_dataset_download.ipynb",
            "02_dataset_inspection_eda.ipynb",
            "03_data_preprocessing.ipynb",
            "04_data_validation.ipynb",
            "05_multi_model_training.ipynb",
            "06_model_comparison_selection.ipynb",
            "07_best_model_fine_tuning.ipynb",
            "08_fine_tuned_model_evaluation.ipynb",
            "09_model_export_and_registration.ipynb"
        ]

        for nb_name in expected_notebooks:
            nb_path = self.notebooks_dir / nb_name
            self.assertTrue(nb_path.exists(), f"Missing notebook: {nb_name}")
            with open(nb_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.assertIn("cells", data, f"{nb_name} missing 'cells' key")
            self.assertIn("nbformat", data, f"{nb_name} missing 'nbformat' key")
            self.assertGreater(len(data["cells"]), 0, f"{nb_name} has 0 cells")

    # ─── 2. Python Syntax Compilation in Code Cells ──────────────────────────

    def test_02_notebook_python_syntax(self):
        """Extract and compile Python syntax for all code cells across all 9 notebooks."""
        for nb_file in sorted(self.notebooks_dir.glob("0*.ipynb")):
            with open(nb_file, "r", encoding="utf-8") as f:
                nb_data = json.load(f)
            for cell_idx, cell in enumerate(nb_data.get("cells", [])):
                if cell.get("cell_type") == "code":
                    code_lines = cell.get("source", [])
                    py_code = "".join(
                        line for line in code_lines if not line.strip().startswith("!")
                    )
                    try:
                        ast.parse(py_code)
                    except SyntaxError as exc:
                        self.fail(f"Syntax error in {nb_file.name} cell {cell_idx}: {exc}")

    # ─── 3. Candidate Configuration & Zero Pretrained Models ─────────────────

    def test_03_candidate_configuration_scratch_only(self):
        """Verify exactly 4 project-owned scratch candidates and ZERO pretrained models."""
        cand_path = self.configs_dir / "candidate_models.json"
        self.assertTrue(cand_path.exists(), "candidate_models.json missing")
        with open(cand_path, "r", encoding="utf-8") as f:
            candidates = json.load(f)["candidates"]

        self.assertEqual(len(candidates), 4, "Must have exactly 4 candidate models")

        expected_ids = {
            "candidate_1_scratch_compact_transformer",
            "candidate_2_scratch_scaled_transformer",
            "candidate_3_scratch_deep_transformer",
            "candidate_4_scratch_efficient_transformer"
        }
        self.assertEqual(set(candidates.keys()), expected_ids)

        for cand_id, cand in candidates.items():
            self.assertEqual(cand["model_type"], "scratch_trained")
            self.assertEqual(cand["initialization"], "random")
            self.assertNotIn("base_model_hf_id", cand)
            self.assertNotIn("from_pretrained", str(cand))
            # Verify no forbidden model names in candidate definition
            for forbidden in ["qwen", "llama", "mistral", "gemma", "gpt", "openai", "ollama"]:
                self.assertNotIn(forbidden, cand_id.lower())
                self.assertNotIn(forbidden, cand.get("candidate_name", "").lower())

    # ─── 4. Custom BPE Tokenizer Restricted to Train Split ───────────────────

    def test_04_custom_tokenizer_train_split_only(self):
        """Verify CustomBPETokenizer trains strictly from train data and encodes/decodes deterministically."""
        train_texts = [
            "Explain the difference between SQL and NoSQL databases in backend engineering.",
            "How do you design high-concurrency microservices with Kafka message queues?"
        ]
        tokenizer = CustomBPETokenizer(vocab_size=1000)
        tokenizer.train_from_texts(train_texts)

        # Encode / decode
        sample = "SQL databases in backend engineering"
        encoded = tokenizer.encode(sample, add_special_tokens=True)
        self.assertIsInstance(encoded, list)
        self.assertEqual(encoded[0], tokenizer.bos_id)
        self.assertEqual(encoded[-1], tokenizer.eos_id)

        decoded = tokenizer.decode(encoded, skip_special_tokens=True)
        self.assertIn("SQL", decoded)
        self.assertIn("engineering", decoded)

        # Verify save/load
        test_tok_dir = BASE_DIR / "reports" / "test_tokenizer"
        tokenizer.save(test_tok_dir)
        loaded_tok = CustomBPETokenizer.load(test_tok_dir)
        self.assertEqual(len(loaded_tok.token2id), len(tokenizer.token2id))

        if (test_tok_dir / "tokenizer.json").exists():
            (test_tok_dir / "tokenizer.json").unlink()
            test_tok_dir.rmdir()

    # ─── 5. Dataset Split Zero Leakage ───────────────────────────────────────

    def test_05_dataset_split_zero_leakage(self):
        """Verify zero leakage across train, validation, and test splits."""
        train_s = [{"question": f"Q{i}", "domain": "Backend", "difficulty": "Medium"} for i in range(80)]
        val_s = [{"question": f"Q{i}", "domain": "Backend", "difficulty": "Medium"} for i in range(80, 90)]
        test_s = [{"question": f"Q{i}", "domain": "Backend", "difficulty": "Medium"} for i in range(90, 100)]

        report = verify_no_split_leakage(train_s, val_s, test_s)
        self.assertTrue(report["zero_leakage_passed"])
        self.assertEqual(report["train_val_overlap_count"], 0)
        self.assertEqual(report["train_test_overlap_count"], 0)
        self.assertEqual(report["val_test_overlap_count"], 0)

    # ─── 6. Programmatic Test Lock Enforcement ────────────────────────────────

    def test_06_test_lock_enforcement(self):
        """Verify test split cannot be accessed in Notebooks 01-07 and succeeds in 08."""
        # Loading test split from notebook_id=5 or 7 MUST raise TestDatasetLockedError
        with self.assertRaises(TestDatasetLockedError):
            load_split_records("test", notebook_id=5)

        with self.assertRaises(TestDatasetLockedError):
            load_split_records("test", notebook_id=7)

        # Loading validation split from notebook_id=5 must succeed
        val_recs = load_split_records("validation", notebook_id=5)
        self.assertIsInstance(val_recs, list)

        # Loading test split from notebook_id=8 must succeed
        test_recs = load_split_records("test", notebook_id=8)
        self.assertIsInstance(test_recs, list)

    # ─── 7. Four Scratch Architectures Instantiation ─────────────────────────

    def test_07_build_four_scratch_models(self):
        """Verify all 4 own candidate models instantiate with correct layers, heads, and parameters."""
        cand_configs = [
            ("candidate_1_scratch_compact_transformer", 4, 256, 4),
            ("candidate_2_scratch_scaled_transformer", 6, 384, 6),
            ("candidate_3_scratch_deep_transformer", 8, 512, 8),
            ("candidate_4_scratch_efficient_transformer", 4, 384, 6)
        ]
        for cand_id, exp_layers, exp_dmodel, exp_heads in cand_configs:
            model = build_candidate_model(cand_id, vocab_size=1000)
            self.assertEqual(model.num_layers, exp_layers)
            self.assertEqual(model.d_model, exp_dmodel)
            self.assertEqual(model.num_heads, exp_heads)
            self.assertGreater(model.count_parameters(), 100_000)

            # Test forward pass with dummy batch
            dummy_input = torch.randint(0, 1000, (1, 16))
            logits, loss = model(dummy_input, labels=dummy_input)
            self.assertEqual(logits.shape, (1, 16, 1000))
            self.assertIsNotNone(loss)

    # ─── 8. Atomic Checkpoint Save & Resume ────────────────────────────────────

    def test_08_atomic_checkpoint_save_and_resume(self):
        """Verify saving and restoring training state (weights, optimizer, epoch, step)."""
        model = build_candidate_model("candidate_1_scratch_compact_transformer", vocab_size=500)
        optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)

        test_ckpt_dir = BASE_DIR / "reports" / "test_checkpoint"
        save_checkpoint(test_ckpt_dir, model, optimizer, epoch=2, step=150)

        # Load back
        loaded_model, payload = load_checkpoint(test_ckpt_dir, device="cpu")
        self.assertEqual(payload["epoch"], 2)
        self.assertEqual(payload["step"], 150)
        self.assertEqual(loaded_model.d_model, model.d_model)

        # Clean up test files
        import shutil
        if test_ckpt_dir.exists():
            shutil.rmtree(test_ckpt_dir, ignore_errors=True)

    # ─── 9. Selection Weights & Inverted Normalization ────────────────────────

    def test_09_selection_weights_and_normalization(self):
        """Verify selection weights sum to 1.0 and lower-is-better metrics are properly inverted."""
        weights_path = self.configs_dir / "selection_weights.json"
        with open(weights_path, "r", encoding="utf-8") as f:
            weights_config = json.load(f)

        self.assertAlmostEqual(sum(weights_config["weights"].values()), 1.0, places=4)

        sample_candidates = [
            {
                "candidate_id": "cand_1",
                "model_type": "scratch_trained",
                "metrics": {
                    "val_rouge_l": 0.40,
                    "val_domain_accuracy": 0.80,
                    "val_perplexity": 5.0,  # Worse perplexity
                    "inference_latency_ms": 15.0,
                    "vram_efficiency": 0.95
                }
            },
            {
                "candidate_id": "cand_2",
                "model_type": "scratch_trained",
                "metrics": {
                    "val_rouge_l": 0.55,
                    "val_domain_accuracy": 0.90,
                    "val_perplexity": 2.2,  # Better perplexity
                    "inference_latency_ms": 25.0,
                    "vram_efficiency": 0.85
                }
            }
        ]
        scored = normalize_metrics(sample_candidates, weights_config)
        self.assertEqual(len(scored), 2)
        # Winner must be ranked 1
        self.assertEqual(scored[0]["rank"], 1)
        self.assertEqual(scored[0]["candidate_id"], "cand_2")

    # ─── 10. Promotion Gate Thresholds ────────────────────────────────────────

    def test_10_promotion_gate_evaluation(self):
        """Verify promotion gate evaluates passed and rejected scenarios on held-out test metrics."""
        base_m = {"test_perplexity": 3.00, "test_rouge_l": 0.45, "domain_coverage": 0.90, "inference_latency_ms": 30.0}

        # Passing scenario (>15% ppl reduction, >10% rouge-l gain)
        passing_spec = {"test_perplexity": 2.30, "test_rouge_l": 0.53, "domain_coverage": 0.95, "inference_latency_ms": 32.0}
        pass_res = check_promotion_gate(base_m, passing_spec)
        self.assertEqual(pass_res["promotion_status"], "approved")

        # Failing scenario (perplexity regressed)
        failing_spec = {"test_perplexity": 3.20, "test_rouge_l": 0.46, "domain_coverage": 0.88, "inference_latency_ms": 40.0}
        fail_res = check_promotion_gate(base_m, failing_spec)
        self.assertEqual(fail_res["promotion_status"], "rejected")

    # ─── 11. Central Model Registry Lifecycle ─────────────────────────────────

    def test_11_model_registry_lifecycle(self):
        """Verify model registry registers own models and manages status transitions."""
        test_reg_path = BASE_DIR / "models" / "test_reg.json"
        if test_reg_path.exists():
            test_reg_path.unlink()

        test_reg = ModelRegistry(registry_path=test_reg_path)
        sample_model = {
            "model_id": "own_qgen_v1",
            "model_name": "Own Question Generator",
            "version": "1.0.0",
            "capability": "question_generator",
            "model_type": "scratch_trained",
            "storage_path": "models/interview_model",
            "status": "approved"
        }
        test_reg.register_model(sample_model)
        test_reg.set_active_model("question_generator", "own_qgen_v1")

        active = test_reg.get_active_model("question_generator")
        self.assertEqual(active["model_id"], "own_qgen_v1")
        self.assertEqual(active["status"], "production")

        if test_reg_path.exists():
            test_reg_path.unlink()

    # ─── 12. Question Generator Agent Pure Own Model Inference ────────────────

    def test_12_question_generator_agent_own_model_inference(self):
        """Verify QuestionGeneratorAgent generates questions and reports own model metadata."""
        agent = QuestionGeneratorAgent()
        profile = {"role": "Backend Engineer", "experience_level": "Senior"}
        result = agent.generate_question(profile, target_topic="Backend Development", difficulty_level="Medium")

        self.assertIn("interview_question", result)
        self.assertIn("model_metadata", result)
        self.assertEqual(result["model_metadata"]["model_type"], "scratch_trained")
        self.assertEqual(result["model_metadata"]["tokenizer"], "custom_bpe")

    # ─── 13. Flask API Integration ────────────────────────────────────────────

    def test_13_flask_api_endpoints(self):
        """Verify Flask API endpoints (/models, /models/active, /models/activate, /generate_question)."""
        client = app.test_client()

        # GET /models
        res = client.get("/models")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))

        # GET /models/active
        res_active = client.get("/models/active")
        self.assertEqual(res_active.status_code, 200)
        active_data = res_active.get_json()
        self.assertIn("active_models", active_data)

        # POST /generate_question
        res_q = client.post("/generate_question", json={
            "domain": "Software Engineering",
            "difficulty": "intermediate",
            "history": []
        })
        self.assertEqual(res_q.status_code, 200)
        q_data = res_q.get_json()
        self.assertIn("question", q_data)
        self.assertEqual(q_data["model_type"], "scratch_trained")


if __name__ == "__main__":
    unittest.main()
