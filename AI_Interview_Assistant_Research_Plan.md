# AI Interview Assistant — Research-Oriented System Architecture & AI Model Development Plan

**Project Title:** Autonomous Domain-Specific Software Engineering AI Interview & Evaluation System  
**Version:** 2.0 (Research-Oriented AI Model Development Specification)  
**Project Owner:** Gihan Sanjeewa  
**Research Area:** Artificial Intelligence / Software Engineering / Natural Language Processing / Multi-Agent Systems  

---

## 1. Executive Summary

### 1.1 System Overview
This project presents an enterprise-grade, privacy-preserving, and domain-specific AI Software Engineering Interview System. The system replaces external cloud-based commercial AI services (e.g., OpenAI GPT-4, Anthropic Claude, Google Gemini) completely with a fully autonomous local AI architecture.

By combining custom dataset engineering across 16 core software engineering sub-disciplines, parameter-efficient fine-tuning (QLoRA) of open-weights Large Language Models (Llama 3, Mistral, Phi-3), static-AST code analysis integrated with CodeBERT/StarCoder models, and an adaptive multi-agent interview framework, the system conducts realistic, multi-turn technical interviews, evaluates written and spoken responses, assesses programming challenges, and generates actionable career roadmaps.

```text
                     Candidate Interface (React + Voice + Code Editor)
                                         │
                                         ▼
                          Node.js Backend & API Gateway
                                         │
                                         ▼
                     Python FastAPI ML Multi-Agent Engine
                                         │
     ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
     ▼                   ▼                               ▼                   ▼
Interview Manager   Question Generator           Answer Evaluator    Coding Evaluator
     │                   │                               │                   │
     ▼                   ▼                               ▼                   ▼
  Ollama /            QLoRA Fine-Tuned               Sentence Transformer  AST Parser + Static Analyzer
   vLLM               LLM (Llama 3/Mistral/Phi-3)    + FAISS Vector DB    + CodeBERT / StarCoder
     │                   │                               │                   │
     └───────────────────┴───────────────┬───────────────┴───────────────────┘
                                         ▼
                             Career Recommendation Agent
                                         │
                                         ▼
                         Comprehensive Candidate Report
```

---

## 2. Research Motivation & Problem Statement

Current AI-driven interview applications suffer from fundamental architectural and domain-specific limitations:

### Problem 01: External API Dependency & Data Privacy Concerns
Most existing interview tools rely on third-party commercial cloud APIs (OpenAI API, Anthropic Claude API, Google Gemini API).
* **Limitations:** High recurring operational costs, variable API latency, potential data leakages of candidate personal identifiable information (PII), strict rate limits, and complete lack of proprietary AI model ownership.

### Problem 02: Lack of Software Engineering Specialization & Deep Technical Rigor
Generic commercial LLMs often perform superficial evaluations of candidate answers, failing to rigorously assess:
* Programming language paradigms and memory models.
* Data structure selection and Big-O space/time complexity trade-offs.
* Distributed system architecture, high-availability, and concurrency edge cases.
* AST-level code quality, static analysis warnings, and security vulnerabilities (OWASP Top 10).

### Problem 03: Static, Non-Adaptive Interview Workflows
Traditional automated systems utilize static question banks or rigid sequential scripts:
* **Traditional Systems:** `Question Bank` → `Static Question` → `Candidate Response` → `Simple Regex/Keyword Match`.
* **Proposed Adaptive Model:** `Candidate Context + Profile` → `Dynamic Question Generation` → `Candidate Response` → `Semantic & AST Evaluation` → `Adaptive Difficulty Adjustment & Targeted Follow-Up`.

---

## 3. Technology Stack

### 3.1 Web & Application Tier
* **Frontend Framework:** React.js, TypeScript, Tailwind CSS, Monaco Editor (for coding assessment), Web Audio API.
* **Backend API Gateway:** Node.js, Express.js, TypeScript, Prisma ORM, MySQL 8.0, WebSockets (for real-time streaming).

### 3.2 Machine Learning & Local AI Tier
* **Core ML Environment:** Python 3.10+, PyTorch 2.x, CUDA 12.x.
* **LLM Training & Inference:** HuggingFace Transformers, PEFT, TRL (`SFTTrainer`), bitsandbytes, Ollama, vLLM.
* **Embeddings & Vector Search:** Sentence Transformers (`bge-large-en-v1.5`), FAISS, ChromaDB.
* **Code Intelligence & Parsing:** tree-sitter, PyAST, Pylint/Flake8/ESLint/PHPStan static analyzers, CodeBERT, StarCoder.
* **Local Speech Processing:** Faster-Whisper (Speech-to-Text), Piper TTS / Coqui TTS (Text-to-Speech).

---

## 4. AI Model Training and Fine-Tuning Pipeline

### 4.1 Dataset Engineering Pipeline

To create a highly specialized software engineering interviewer model, a dedicated custom dataset is engineered across 16 primary technical domain categories.

#### 1. Dataset Domain Categories
1. **Programming Fundamentals:** Memory allocation, variables, type systems, scope, control flow.
2. **Object-Oriented Programming (OOP):** Encapsulation, inheritance, polymorphism, abstraction, composition.
3. **Data Structures and Algorithms (DSA):** Trees, graphs, dynamic programming, sorting, complexity analysis.
4. **Database Systems:** Indexing (B-Trees, Hash), ACID properties, normalization, isolation levels, NoSQL.
5. **SQL & Query Optimization:** Complex joins, query execution plans, transactions, indexing strategies.
6. **Backend Development:** Concurrency, event loops, thread pools, caching, ORM mechanisms.
7. **Frontend Development:** DOM rendering performance, virtual DOM, state management, web performance.
8. **Software Architecture:** SOLID principles, DRY, clean architecture, domain-driven design (DDD).
9. **Design Patterns:** Creational, structural, and behavioral patterns (Factory, Singleton, Observer, Strategy, etc.).
10. **REST APIs & Web Services:** HTTP methods, status codes, authentication (JWT/OAuth2), rate limiting, GraphQL.
11. **Microservices Architecture:** Service discovery, API gateways, circuit breakers, event-driven messaging (Kafka/RabbitMQ).
12. **Cloud Computing:** IaaS/PaaS/SaaS, serverless, containerization (Docker, Kubernetes), auto-scaling.
13. **DevOps & CI/CD:** Infrastructure as Code (Terraform), build pipelines, monitoring, blue-green deployments.
14. **Cyber Security:** OWASP Top 10, SQL injection, XSS, CSRF, encryption algorithms, secure coding.
15. **System Design:** Scalability, load balancing, sharding, caching strategies, CAP theorem.
16. **Software Testing and QA:** Unit testing, integration testing, TDD, mock frameworks, test coverage metrics.

#### 2. Standardized Dataset JSON Format
Every sample in the training dataset follows a strict JSON structure:

```json
{
  "question_id": "SWE_SYS_DESIGN_0042",
  "role": "Backend Engineer",
  "experience_level": "Mid-Level (3-5 Years)",
  "technology": "Distributed Systems / Redis / Kafka",
  "difficulty_level": "Hard",
  "question_type": "System Design / Adaptive Technical",
  "interview_question": "How would you design a distributed rate limiter that handles 100,000 requests per second across multiple data centers?",
  "expected_answer": "A distributed rate limiter can be implemented using the Token Bucket or Sliding Window Log algorithm stored in a Redis cluster. To handle 100k RPS across multi-regions, local in-memory batching with eventual consistency or atomic Redis Lua scripts can be utilized...",
  "evaluation_criteria": "Understanding of distributed locking, Redis memory constraints, latency trade-offs, fallback mechanics.",
  "key_concepts": ["Token Bucket", "Sliding Window Log", "Redis Cluster", "Race Conditions", "Eventual Consistency"],
  "scoring_rules": {
    "max_score": 10,
    "concept_weights": {
      "algorithm_choice": 0.3,
      "concurrency_handling": 0.3,
      "scalability": 0.2,
      "edge_cases": 0.2
    }
  }
}
```

#### 3. Dataset Engineering Lifecycle
* **Data Collection Methods:** Automated scraping of open technical documentation, vetted Q&A repositories, synthetic generation using teacher models (with human verification), and expert software architect annotations.
* **Data Cleaning:** MinHash LSH deduplication, AST syntax verification for code snippets, removing conversational noise, and fixing grammar errors.
* **Data Annotation:** Standardized tagging of role targets, experience levels, difficulty tiers, and scoring rubrics.
* **Data Augmentation:** Generating paraphrase variations of candidate answers, incorporating common candidate misinterpretations, introducing partial/flawed technical answers, and adding multi-language code implementations.
* **Dataset Splitting:** 80% Training Set, 10% Validation Set, 10% Test Set (stratified across the 16 domain categories).

---

### 4.2 Custom Interview Question Generation Model

* **Purpose:** Generate targeted, candidate-tailored technical questions and follow-ups based on real-time evaluation history.
* **Input Parameters (Candidate Context):**
  - Candidate Skills & Experience Level
  - Target Job Role (e.g., Senior Full-Stack Engineer)
  - Previous Questions Asked in Session
  - Candidate Previous Answers & Assigned Scores
  - Demonstrated Skill Strengths & Weaknesses
* **Output Format:**
  ```json
  {
    "next_interview_question": "You mentioned using Redis for rate limiting. How would you handle key eviction policies when memory reaches maximum capacity under high load?",
    "difficulty_level": "Hard",
    "topic_category": "Database Systems / Caching",
    "expected_knowledge_points": ["LRU eviction", "Volatile-LRU", "Memory fragmentation", "Redis maxmemory policy"]
  }
  ```
* **Base LLM Options:** Llama 3 (8B/70B), Mistral (7B/8x7B), Phi-3 (mini/medium).
* **Fine-Tuning Method:** QLoRA 4-bit NormalFloat (NF4) quantization, Rank $r=16$, Alpha $\alpha=32$, target modules (`q_proj`, `k_proj`, `v_proj`, `o_proj`), trained using HuggingFace Transformers, PEFT, TRL, and PyTorch.

---

### 4.3 Answer Evaluation Model

* **Purpose:** Evaluate candidate verbal or written technical responses with objective scoring and itemized feedback.
* **Evaluated Factors:** Technical correctness, depth of concept understanding, explanation completeness, communication clarity, candidate confidence indicators, missing critical concepts.
* **Input:** `Interview Question` + `Expected Knowledge Rubric` + `Candidate Answer`.
* **Output Format:**
  ```json
  {
    "technical_score": 85,
    "communication_score": 80,
    "strengths": [
      "Correctly identified Redis as the distributed state store",
      "Demonstrated accurate understanding of atomic Lua execution"
    ],
    "weaknesses": [
      "Did not address clock drift issues across multi-region deployments"
    ],
    "missing_points": [
      "NTP synchronization caveats",
      "Sliding window memory overhead compared to Token Bucket"
    ],
    "feedback": "Strong understanding of caching and concurrency primitives, but lacks detail on multi-region synchronization trade-offs.",
    "recommendation": "Proceed to distributed locks follow-up question."
  }
  ```
* **Implementation Architecture:** Hybrid intelligence pipeline combining:
  1. Dense vector embeddings via **Sentence Transformers** (`bge-large-en-v1.5`).
  2. **FAISS** semantic similarity search against indexed technical reference concepts.
  3. Contextual reasoning via fine-tuned local evaluation LLM.

---

### 4.4 Coding Interview Evaluation Model

* **Purpose:** Multi-dimensional static and dynamic evaluation of candidate code solutions.
* **Supported Programming Languages:** Python, Java, JavaScript, TypeScript, PHP.
* **Evaluation Pipeline:**

```text
               Candidate Code Submission
                          │
                          ▼
            AST Parser (tree-sitter / ast)
   (Syntax tree generation & language validation)
                          │
                          ▼
                  Static Code Analyzer
    (Pylint / Flake8 / ESLint / PHPStan integration)
                          │
                          ▼
  CodeBERT / StarCoder / Local Fine-Tuned Code LLM
   (Semantic analysis, efficiency, patterns, OWASP)
                          │
                          ▼
 Detailed Coding Assessment (Score, Big-O, Feedback)
```

* **Evaluation Dimensions:**
  - **Syntax & Execution Correctness:** AST tree construction and parsing status.
  - **Algorithmic Efficiency:** Automated estimation of Time Complexity ($O(N)$, $O(N \log N)$, $O(N^2)$) and Space Complexity ($O(1)$, $O(N)$).
  - **Code Quality & Style:** Cyclomatic complexity, naming conventions, modularity.
  - **Security & Vulnerabilities:** OWASP Top 10 detection (e.g., SQL injection, unsanitized inputs, hardcoded credentials, buffer flaws).

---

### 4.5 Adaptive Multi-Agent Architecture

The AI Interview Engine is structured into five specialized, autonomous agents that coordinate session execution:

```text
                            ┌──────────────────────────────────┐
                            │     Interview Manager Agent      │
                            └────────────────┬─────────────────┘
                                             │
           ┌─────────────────────────────────┼─────────────────────────────────┐
           ▼                                 ▼                                 ▼
┌──────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
│ Question Generator Agent │    │ Answer Evaluation Agent  │    │ Coding Evaluation Agent  │
└──────────────────────────┘    └──────────────────────────┘    └──────────────────────────┘
                                             │
                                             ▼
                                ┌──────────────────────────┐
                                │ Career Recommendation    │
                                │          Agent           │
                                └──────────────────────────┘
```

#### 1. Interview Manager Agent
* **Responsibilities:** Controls interview lifecycle, manages dynamic question queue, adapts session difficulty based on candidate score trajectory, handles timing constraints, and manages conversation context buffer.

#### 2. Question Generator Agent
* **Responsibilities:** Queries fine-tuned generation model to craft adaptive technical questions, system design prompts, and follow-up probes specific to candidate experience and prior performance.

#### 3. Answer Evaluation Agent
* **Responsibilities:** Processes candidate text/audio answers, performs dense vector similarity retrieval against knowledge base, invokes fine-tuned evaluator LLM, and produces detailed scoring metrics.

#### 4. Coding Evaluation Agent
* **Responsibilities:** Manages AST parsing, static analysis execution, security vulnerability scans, and code LLM inferences to grade coding exercise submissions.

#### 5. Career Recommendation Agent
* **Responsibilities:** Aggregates cumulative scores across domains, analyzes skill gaps against industry benchmarks, identifies target software engineering roles (e.g., Backend, DevOps, System Architect), and compiles a personalized learning roadmap.

---

### 4.6 Model Training Infrastructure & Workflow

#### Training Environment Stack
* **OS:** Linux (Ubuntu 22.04 LTS) / Windows Subsystem for Linux (WSL2).
* **Language:** Python 3.10+.
* **ML Frameworks:** PyTorch 2.x, HuggingFace `transformers`, `peft`, `bitsandbytes`, `trl` (`SFTTrainer`).
* **GPU Acceleration:** NVIDIA CUDA 12.x, cuDNN, FP16/BF16 mixed precision support.

#### End-to-End Fine-Tuning Workflow
```text
  Raw Data Collection (Expert Q&A + Scraping)
                      │
                      ▼
  Dataset Cleaning & Standard JSON Formatting (prepare_dataset.py)
                      │
                      ▼
  Tokenizer Processing & Prompt Template Formatting
                      │
                      ▼
  Base Model Loading in 4-bit NF4 Quantization (Llama 3 / Mistral / Phi-3)
                      │
                      ▼
  QLoRA Adapter Training via PyTorch & TRL (train_qlora.py)
                      │
                      ▼
  Validation Loss & Metric Evaluation (evaluate_model.py)
                      │
                      ▼
  Model Quantization & Format Conversion (GGUF / AWQ / GPTQ)
                      │
                      ▼
  Local Engine Serving (Ollama / vLLM API Endpoints)
```

---

### 4.7 Model Evaluation Framework

The system incorporates rigorous quantitative and qualitative research evaluation metrics:

#### 1. Language Model Generation Metrics
* **BLEU & ROUGE (1/2/L):** Evaluates lexical similarity between generated questions/answers and target gold-standard responses.
* **BERTScore:** Measures semantic similarity using contextual embeddings to capture domain correctness beyond literal n-gram matches.
* **Perplexity (PPL):** Measures model language fluency and domain confidence on software engineering texts.

#### 2. Technical Interview Evaluation Metrics
* **Human Evaluation Score:** Expert evaluation by senior software engineers on question naturalness, follow-up relevance, and evaluation fairness.
* **Difficulty Alignment Accuracy:** Correlation between target difficulty tier and actual question difficulty.
* **Feedback Actionability & Precision:** Precision of identified missing concepts and constructive feedback accuracy.

#### 3. Coding Evaluation Metrics
* **Pass@k Rate:** Percentage of candidate solution code submissions passing automated test suites.
* **Static Analysis Precision:** Accuracy of AST static analyzers in detecting true code quality issues vs false positives.
* **Complexity Estimation Accuracy:** Agreement between predicted Big-O bounds and empirical execution benchmarks.

---

## 5. Local Deployment Architecture

All cloud-dependent AI services are replaced with local, zero-telemetry components running within the user's infrastructure:

| Functionality | Replaced Cloud Service | Local Open-Source Replacement |
|---|---|---|
| **Large Language Model** | OpenAI GPT-4 / Claude 3 | Ollama / vLLM (Fine-Tuned Llama 3 / Mistral / Phi-3) |
| **Embeddings** | OpenAI `text-embedding-3` | Sentence Transformers (`bge-large-en-v1.5`) |
| **Vector Database** | Pinecone / Qdrant Cloud | Local FAISS / ChromaDB |
| **Speech-to-Text (STT)** | OpenAI Whisper API | Local Faster-Whisper (CUDA / CTranslate2) |
| **Text-to-Speech (TTS)** | ElevenLabs API | Piper TTS / Coqui TTS (Local ONNX Runtime) |
| **Code Intelligence** | GitHub Copilot / OpenAI API | AST Parsers + CodeBERT / StarCoder Local Models |

---

## 6. Project Folder Structure

```text
ai-interview-system/
├── frontend/                        # React + TypeScript + Monaco Editor UI
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                         # Node.js + Express API Gateway
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   └── routes/
│   ├── prisma/
│   └── package.json
│
├── database/                        # Database schemas and migration scripts
│   └── schema.sql
│
├── ml-service/                      # Python ML & Local AI Service
│   ├── models/                      # Fine-tuned model checkpoints & adapters
│   │   ├── interview_llm/           # QLoRA fine-tuned Question Generator
│   │   ├── evaluator_model/         # Fine-tuned Answer Evaluator
│   │   └── coding_model/            # CodeBERT / StarCoder code models
│   │
│   ├── dataset/                     # SWE Interview Dataset management
│   │   ├── raw/                     # Unprocessed scraped & expert Q&A
│   │   ├── processed/               # Cleaned & annotated JSON datasets
│   │   └── training/                # Split train/val/test data files
│   │
│   ├── training/                    # Model training & evaluation scripts
│   │   ├── prepare_dataset.py       # Data cleaning, formatting & splitting
│   │   ├── train_qlora.py           # QLoRA fine-tuning training script
│   │   └── evaluate_model.py        # BLEU/ROUGE/BERTScore evaluation suite
│   │
│   ├── agents/                      # Autonomous Multi-Agent Framework
│   │   ├── interview_manager_agent.py
│   │   ├── question_generator_agent.py
│   │   ├── answer_evaluation_agent.py
│   │   ├── coding_evaluation_agent.py
│   │   └── career_recommendation_agent.py
│   │
│   ├── rag_engine.py                # FAISS vector RAG implementation
│   ├── code_evaluator.py            # AST & static code analysis engine
│   ├── speech_engine.py            # Local Faster-Whisper & Piper TTS engine
│   ├── text_analyzer.py            # Spacy NLP & semantic text processing
│   ├── requirements.txt             # Inference & app dependencies
│   ├── requirements-train.txt       # PyTorch & fine-tuning dependencies
│   └── app.py                       # FastAPI REST microservice entrypoint
│
└── docker-compose.yml               # Local multi-container orchestration
```

---

## 7. Research Contributions & Academic Value

This research project delivers six primary contributions to the fields of Artificial Intelligence, Natural Language Processing, and Software Engineering Education:

1. **Domain-Specific Software Engineering Interview Dataset:** Creation of a multi-category, standardized dataset for software engineering technical questions, rubrics, and evaluation rules.
2. **Fine-Tuned Local Technical Interview LLM:** Development of open-weights LLMs fine-tuned via QLoRA specifically optimized for interviewing, follow-up generation, and technical reasoning.
3. **Adaptive Multi-Agent Interviewer Architecture:** Design of an autonomous multi-agent state machine that manages dynamic interview flows based on candidate performance trajectory.
4. **Hybrid Candidate Answer Evaluation Framework:** Development of an evaluation pipeline combining dense semantic vector embeddings with fine-tuned LLM contextual reasoning.
5. **AST-Integrated Multi-Language Coding Assessment System:** A hybrid code analysis system coupling language AST parsers, static code linting, and local code models.
6. **Privacy-Preserving Local AI Deployment Model:** A completely cloud-independent local deployment architecture guaranteeing zero-telemetry candidate privacy and zero API overhead.

---

## 8. Final System Outcome

The final system operates as a fully autonomous, privacy-preserving technical interviewer capable of conducting end-to-end software engineering interviews without external cloud dependencies. It delivers real-time voice interaction, adaptive question sequencing, multi-language coding evaluation, deep technical scoring, and career progression recommendations.
