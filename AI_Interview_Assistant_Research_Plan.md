# AI Interview Assistant — Research-Oriented System Architecture & Implementation Plan

**AI-Powered Software Engineering Interview Agent with Local Fine-Tuned Models**  
**Version:** 1.0  
**Project Owner:** Gihan Sanjeewa  
**Research Area:** Artificial Intelligence / Software Engineering / Natural Language Processing  

---

## 1. Executive Summary

### 1.1 System Overview
This project aims to develop an AI-powered Software Engineering Interview Assistant capable of conducting realistic technical interviews without depending on external AI APIs.

The system uses locally deployed and fine-tuned AI models to:
- Analyze candidate resumes
- Generate adaptive software engineering questions
- Conduct voice-based interviews
- Evaluate technical answers
- Analyze programming solutions
- Generate skill-based reports
- Recommend suitable job roles

Unlike existing AI interview platforms that rely on commercial APIs such as OpenAI, Claude, or Gemini, this system focuses on developing a domain-specific AI interviewer using custom datasets and locally hosted models.

---

## 2. Research Motivation

Current AI interview systems have limitations:

### Problem 01: API Dependency
Most systems depend on commercial APIs (OpenAI API, Claude API, Gemini API).
**Limitations:**
- High operational cost
- Privacy concerns
- Limited customization
- No ownership of AI model

### Problem 02: Lack of Software Engineering Specialization
Existing systems mainly evaluate general communication and basic question answering. They do not deeply evaluate:
- Programming knowledge
- Debugging ability
- Software architecture understanding
- Coding practices

### Problem 03: Limited Adaptive Interviewing
- **Traditional systems:** `Question Database` → `Fixed Questions` → `Candidate Answer` → `Final Result`
- **Proposed system:** `Candidate Answer` → `AI Understanding` → `Follow-up Question` → `Skill Evaluation` → `Next Difficulty Level`

---

## 3. Proposed System Architecture

```text
                    Candidate
                        |
                        |
              React Interview Platform
                        |
                 Node.js Backend
                        |
              AI Interview Engine
                        |
 -------------------------------------------------
 |                 |                |              |
Speech          Interview       Evaluation      Recommendation
Agent           Agent            Agent           Agent
 |                 |                |              |
Whisper       Fine Tuned        BERT /         Sentence
STT           LLM               CodeBERT       Transformer
                        |
              Candidate Report Generator
                        |
              Skill Profile + Job Match
```

---

## 4. Technology Stack

### Frontend
- **Framework:** React.js, TypeScript, Tailwind CSS
- **Responsibilities:** Interview interface, Voice recording, Code editor, Dashboard, Report visualization

### Backend
- **Technology:** Node.js, Express.js, Prisma ORM, MySQL
- **Responsibilities:** Authentication, User management, Interview sessions, AI communication, Report management

### AI Layer
- **Technology:** Python, FastAPI, PyTorch, HuggingFace Transformers

---

## 5. AI Agent Architecture

The system contains multiple specialized AI agents.

### Agent 01: Interview Manager Agent
- **Purpose:** Controls the complete interview process.
- **Responsibilities:** Start interview, Select questions, Maintain conversation context, Decide next difficulty level.
- **Input:** Candidate Profile + Previous Answers + Skill Level
- **Output:** Next Interview Action
- **Model:** Fine-tuned LLM

### Agent 02: Question Generation Agent
- **Purpose:** Generate software engineering interview questions.
- **Input:** 
  - Skill: Backend Development
  - Experience: 2 Years
  - Previous Answer: Candidate Response
- **Output:**
  - Question: Explain REST API authentication methods.
  - Follow-up: How would you secure JWT tokens?
- **Model:** Llama 3 / Mistral / Phi
- **Training:** LoRA / QLoRA fine-tuning

### Agent 03: Answer Evaluation Agent
- **Purpose:** Evaluate candidate technical responses.
- **Evaluation Factors:** Correctness, Technical depth, Explanation quality, Best practices
- **Architecture:** 
  `(Question + Candidate Answer)` → `Sentence Transformer` → `Semantic Analysis` → `BERT Classifier` → `Score Generation`
- **Output:**
  - Technical Knowledge: 85%
  - Depth: 80%
  - Communication: 75%
  - Feedback: Candidate understands REST concepts but lacks security knowledge.

### Agent 04: Coding Evaluation Agent
- **Purpose:** Evaluate programming skills.
- **Supported Languages:** Java, Python, JavaScript, PHP
- **Evaluation:** Code correctness, Algorithm efficiency, Code quality, Security issues
- **Models:** CodeBERT, CodeT5, StarCoder

### Agent 05: Voice Interview Agent
- **Purpose:** Enable natural voice interviews.
- **Pipeline:** `Candidate Voice` → `Local Whisper Model` → `Text Processing` → `AI Interview Agent` → `Local TTS Model` → `AI Voice Response`
- **Models:**
  - Speech Recognition: Whisper Large-v3, Faster Whisper
  - Text-to-Speech: Piper TTS, Coqui TTS

---

## 6. AI Model Training Pipeline

### 6.1 Dataset Creation
A custom Software Engineering Interview Dataset will be created.

**Dataset Format:**
```json
{
  "question": "Explain dependency injection",
  "answer": "Dependency injection is a design pattern...",
  "topic": "Software Architecture",
  "difficulty": "Intermediate",
  "score": 8
}
```

**Dataset Categories:**
- **Programming:** Java, Python, PHP, JavaScript
- **Software Engineering:** SOLID principles, Design patterns, Architecture, Testing
- **Database:** SQL, Optimization, Transactions
- **Backend:** REST API, Security, Microservices
- **Frontend:** React, Angular, State management

### 6.2 Dataset Sources
- **Public Sources:** Stack Overflow, GitHub repositories, Technical documentation
- **Expert Generated Data:** Software engineers provide Questions, Expected answers, Evaluation scores
- **Target:** Minimum 5,000 interview samples (Research target: 10,000 - 50,000 samples)

### 6.3 Fine-Tuning Process
`Base Model (Llama 3 / Mistral)` → `Interview Dataset` → `QLoRA Training` → `Software Engineering Interview Model`

---

## 7. Knowledge Base (RAG)

The system maintains a Software Engineering knowledge base to improve question generation accuracy.
- **Storage:** FAISS, ChromaDB
- **Content:** Software Engineering Knowledge Base (Programming, Database, Architecture, Cloud, Security, Testing, DevOps)

---

## 8. Interview Workflow

1. **Candidate Registration:** Candidate provides Name, Experience, Target role, CV.
2. **Resume Analysis:** AI extracts Skills (React, Node.js, MySQL), Experience (2 Years), and assigns Recommended Interview (Backend Engineer).
3. **Interview Generation:** AI creates question distribution (e.g., Frontend 20%, Backend 40%, Database 20%, Problem Solving 20%).
4. **AI Interview:** Adaptive flow: `Easy Question` → `Candidate Answer` → `Evaluation` → `Follow-up Question` → `Advanced Question`.
5. **Final Evaluation:** Generates Technical Score (85), Coding Score (80), Communication Score (78), Overall (82%), and Career Recommendation.

---

## 9. Database Design

Main tables:
- **Users:** Stores account information.
- **Candidates:** Stores skills, experience, resume data.
- **Interviews:** Stores interview sessions, questions, answers.
- **AI_Evaluations:** Stores question, answer, model score, feedback.
- **Reports:** Stores technical score, coding score, strengths, weaknesses, recommendations.

---

## 10. Performance Evaluation

The proposed model will be evaluated using:
- **Question Generation Evaluation:** Relevance, Difficulty matching, Diversity
- **Answer Evaluation:** Accuracy, Precision, F1 Score
- **User Evaluation:** Interview realism, Satisfaction, Feedback quality

---

## 11. Research Contribution

1. A domain-specific AI interviewer model for Software Engineering.
2. A locally deployed AI interview architecture without external AI APIs.
3. Adaptive question generation based on candidate skill level.
4. Automated technical and coding evaluation.
5. Personalized career recommendations based on AI assessment.

---

## 12. Final System Outcome

The final system will act as an autonomous technical interviewer capable of evaluating software engineering candidates without relying on third-party AI APIs, featuring local fine-tuned AI models, voice capabilities, coding evaluation, skill analysis, and job recommendations.
