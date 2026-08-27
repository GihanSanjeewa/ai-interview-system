# AI Interview Assistant

An AI-powered voice interview preparation system for Sri Lankan job seekers. Upload your CV, select a domain and difficulty, and practice mock interviews in **English or Sinhala** with real-time voice interaction and ML-based performance evaluation.

---

## What the System Does

1. **CV Analysis** — Upload a PDF or DOCX resume. A section-aware parser extracts
   your contact details, technologies, education, roles and projects, computes
   real tenure from date ranges, and ranks the six interview tracks by how much
   evidence your CV actually supports. Fields it cannot find come back empty
   with an explanation, never filled in with a guess.
2. **Adaptive Interview** — Questions are planned per candidate: retrieved from a
   labelled 8,000-question corpus by relevance to your CV, with the opening
   questions grounded in your real projects and roles. There is no fixed
   question list.
3. **A Real Conversation** — The interviewer responds to what you actually say:
   - Say *"I don't know"* → it acknowledges you and moves on, and the question
     is recorded as declined rather than scored as wrong.
   - Two gaps in a row → it drops to an easier question in the same area.
   - A shallow answer → one follow-up probe, then it moves on.
   - A strong answer → a deeper probe, grounded in a term you used.
   - *"Could you repeat that?"* → it repeats the question without consuming it.
4. **ML Evaluation** — 6 metrics from real measurement, not constants:
   - Confidence · Fluency · Speaking Speed (librosa acoustic analysis)
   - Communication · Response Relevance · Technical Accuracy (NLP)
5. **Evidence-Backed Report** — Every score, strength, weakness, suggestion and
   learning resource is derived from your session. Findings quote the
   measurement behind them ("declined 2 of 5 questions, the gaps were in
   Frontend Development"), and the report stores the full analytics so it can
   show its working.
6. **Interview History** — Review past sessions and track progress over time.

### Design principle: no fabricated output

Earlier versions of this system fell back to invented data when a component
failed — a placeholder CV, fixed answer scores, and a canned report with the
same strengths and weaknesses for every candidate. That is now removed
throughout: a component that cannot produce a real answer reports the failure so
the user is told, rather than being shown a plausible fiction.

---

## System Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Frontend        │     │  Backend              │     │  ML Service          │
│  React / Vite    │────▶│  Node.js / Express    │────▶│  Python / Flask      │
│  Port 5173       │     │  Port 5000            │     │  Port 8000           │
└─────────────────┘     └──────────┬───────────┘     └──────────┬──────────┘
                                    │                             │
                              ┌─────▼──────┐              ┌──────▼──────────┐
                              │  MySQL DB   │              │  Whisper (STT)   │
                              │  Port 3306  │              │  librosa (audio) │
                              └────────────┘              │  spaCy (NLP)     │
                                                          │  own Transformer │
                                                          └─────────────────┘
```

### ML service modules

| Module | Responsibility |
|---|---|
| `cv_analyzer.py` | Section-aware CV parsing: contact, skills, education, real tenure from date ranges, track ranking. Returns empty fields plus warnings when evidence is absent. |
| `interview_engine.py` | The interviewer's brain. Plans a CV-grounded question set from the labelled corpus, classifies each turn (answered / declined / shallow / clarify / silent), and decides the next move. |
| `report_generator.py` | Derives the report from the session: per-answer evidence, aggregation, findings traceable to measurements, resources selected by diagnosis. |
| `text_analyzer.py` | Communication, relevance and technical-accuracy scoring. Relevance routes on question type — a behavioural prompt is not scored like a technical one. |
| `audio_analyzer.py` | librosa acoustic features → vocal confidence, fluency, speaking pace. |
| `transformer_scratch.py` | The project's own decoder-only Transformer and BPE tokenizer, both trained from zero. |

### Models: trained from scratch, no pretrained weights

The question generator is this project's own Transformer, trained from random
initialisation by the nine-notebook pipeline in `ml-service/notebooks/`. No
pretrained weights, adapters, or external LLMs are used — Notebook 01 includes an
audit that fails if any weight file is found in the workspace.

Because the training corpus is small for from-scratch language modelling,
generated questions are gated on a quality check at runtime and the service falls
back to retrieval over the labelled corpus when a generated question fails. This
limitation is measured in Notebook 08 and recorded in the model card, not hidden.

### The ML pipeline notebooks

Run `ml-service/notebooks/01`–`09` in order. Each stage feeds the next through a
report file in `ml-service/reports/`, and every figure is exported to
`ml-service/reports/figures/` at 200 dpi.

| # | Notebook | Produces |
|---|---|---|
| 01 | Dataset acquisition | provenance record, SHA-256, zero-pretrained-weights audit |
| 02 | Exploratory analysis | 9 figures; the cleaning thresholds Stage 3 reads |
| 03 | Preprocessing | cleaned corpus + before/after verification of each rule |
| 04 | Validation & splitting | stratified 80/10/10, leakage tested, test split sealed |
| 05 | Tokenizer & training | custom BPE + 4 from-scratch architectures, learning curves |
| 06 | Comparison & selection | multi-criteria scorecard with sensitivity analysis |
| 07 | Specialisation | continued training at LR/5, catastrophic-forgetting check |
| 08 | Held-out evaluation | the single authorised test read, 5-criterion promotion gate |
| 09 | Export & registration | packaged model, model card, registry entry, load verification |

---

## Prerequisites

Install all of these before starting. Click the links for the official download pages.

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org) | 18 or higher | Backend + Frontend |
| [Python](https://www.python.org/downloads/) | 3.9 – 3.11 | ML Service |
| [MySQL](https://dev.mysql.com/downloads/installer/) | 8.0 or higher | Database |
| [FFmpeg](https://ffmpeg.org/download.html) | Any recent | Audio processing for Whisper |
| [Git](https://git-scm.com/downloads) | Any | Clone the repository |

### Verify installations

Open a terminal and run each of these — each should print a version number:

```bash
node --version
python --version
mysql --version
ffmpeg -version
git --version
```

> **Windows users:** If `python` is not found, try `python3`. If `ffmpeg` is not found after installing, see [FFmpeg on Windows](#ffmpeg-on-windows) below.

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/GihanSanjeewa/ai-interview-system.git
cd ai-interview-system
```

---

## Step 2 — MySQL Database Setup

### 2a. Start MySQL and open a client

```bash
# Windows (MySQL installed via installer)
mysql -u root -p
# Enter your MySQL root password when prompted
# If no password was set during install, just press Enter
```

### 2b. Create the database and all tables

Copy and paste the entire block below into the MySQL prompt:

```sql
CREATE DATABASE IF NOT EXISTS ai_interview_system;
USE ai_interview_system;

CREATE TABLE users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(100)  NOT NULL,
  email       VARCHAR(150)  NOT NULL UNIQUE,
  password    VARCHAR(255)  NOT NULL,
  role        VARCHAR(50)   DEFAULT 'user',
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cvs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT          NOT NULL,
  file_path       VARCHAR(255) NOT NULL,
  extracted_text  LONGTEXT,
  domains         TEXT,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE interviews (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT         NOT NULL,
  cv_id       INT         NOT NULL,
  type        VARCHAR(100),
  status      VARCHAR(50) DEFAULT 'pending',
  score       INT,
  language    VARCHAR(20) DEFAULT 'english',
  difficulty  VARCHAR(20) DEFAULT 'intermediate',
  created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (cv_id)   REFERENCES cvs(id)
);

CREATE TABLE reports (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  interview_id          INT  NOT NULL,
  summary               TEXT,
  technical_score       INT,
  communication_score   INT,
  recommendations       TEXT,
  confidence_score      INT,
  performance_level     VARCHAR(20),
  key_strengths         TEXT,
  areas_for_improvement TEXT,
  learning_resources    TEXT,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (interview_id) REFERENCES interviews(id)
);
```

You should see `Query OK` after each statement. Type `exit` to leave the MySQL prompt.

---

## Step 3 — Get API Keys

### Anthropic API Key (Claude AI)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Click **API Keys** → **Create Key**
4. Copy the key — it starts with `sk-ant-...`
5. Add a small amount of credits ($5 is plenty for testing)

> **Note:** This is separate from a Claude.ai subscription. You need an API key from the console.

---

## Step 4 — Backend Setup

```bash
cd backend
npm install
```

### Create the backend environment file

Create a file called `.env` inside the `backend/` folder:

```bash
# Windows
copy NUL .env

# Mac / Linux
touch .env
```

Open `backend/.env` in any text editor and paste this — **edit the values marked with ←**:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASS=                        ← your MySQL root password (leave blank if none)
DB_NAME=ai_interview_system
JWT_SECRET=change_this_to_any_long_random_string_abc123!
ML_SERVICE_URL=http://localhost:8000
```

### Create the uploads folder

```bash
# Run this from inside the backend/ folder
mkdir -p uploads/cvs
```

On Windows:
```cmd
mkdir uploads\cvs
```

---

## Step 5 — ML Service Setup

### 5a. Go to the ml-service folder

```bash
cd ../ml-service
```

### 5b. Create a Python virtual environment

```bash
python -m venv venv
```

### 5c. Activate the virtual environment

**Windows:**
```cmd
venv\Scripts\activate
```

**Mac / Linux:**
```bash
source venv/bin/activate
```

You will see `(venv)` at the start of your terminal line — this means it is active.

### 5d. Install all Python packages

```bash
pip install -r requirements.txt
```

> This installs: Flask, Whisper, librosa, spaCy, scikit-learn, Anthropic SDK, and others.
> It may take **5–10 minutes** on the first run.

### 5e. Download the spaCy language model

```bash
python -m spacy download en_core_web_sm
```

### 5f. Create the ML service environment file

Create a file called `.env` inside the `ml-service/` folder and add your Anthropic API key:

```env
ANTHROPIC_API_KEY=sk-ant-...your key here...
```

---

## Step 6 — FFmpeg Setup

Whisper needs FFmpeg to process audio files.

### Windows

1. Download the **full build** from [gyan.dev/ffmpeg/builds](https://www.gyan.dev/ffmpeg/builds/) — choose `ffmpeg-release-full.7z`
2. Extract it somewhere permanent, e.g. `C:\ffmpeg`
3. Add `C:\ffmpeg\bin` to your **System PATH**:
   - Search for **"Environment Variables"** in the Start menu
   - Under **System Variables**, select **Path** → **Edit** → **New**
   - Paste `C:\ffmpeg\bin`
   - Click OK on all windows
4. Restart your terminal and verify: `ffmpeg -version`

### Mac

```bash
brew install ffmpeg
```

### Linux (Ubuntu / Debian)

```bash
sudo apt update && sudo apt install ffmpeg
```

---

## Step 7 — Frontend Setup

```bash
cd ../frontend
npm install
```

No environment file is needed for the frontend — it talks directly to `localhost:5000` and `localhost:8000`.

---

## Step 8 — Run the Project

You need **three separate terminal windows** running at the same time.

### Terminal 1 — Backend

```bash
cd backend
node server.js
```

Expected output:
```
Server running on port 5000
Connected to the MySQL database.
```

### Terminal 2 — ML Service

```bash
cd ml-service
venv\Scripts\activate      # Windows
# source venv/bin/activate  # Mac/Linux

python app.py
```

Expected output:
```
 * Running on http://127.0.0.1:8000
 * Threaded mode: on
```

> Whisper will download the model (~145 MB) on the very first run. This is normal.

### Terminal 3 — Frontend

```bash
cd frontend
npm run dev
```

Expected output:
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

---

## Step 9 — Using the Application

Open your browser and go to: **http://localhost:5173**

### First time

1. Click **Register** and create an account
2. Log in with your new credentials

### Start an interview

1. **Upload your CV** — click "Upload & Analyze" with a PDF or DOCX file
2. **Select a domain** — the AI suggests domains based on your CV (e.g. Software Engineering)
3. **Choose difficulty** — Beginner / Intermediate / Advanced
4. **Choose language** — English or Sinhala
5. Click **Start AI Interview**

### During the interview

- Wait for the AI to ask a question (it will speak aloud)
- Click **Click to Answer**, speak your response, then click **Stop Recording**
- The system transcribes your speech and generates the next question
- Repeat until done, then click **End Session**

### After the interview

- A detailed report appears with 6 ML-computed scores
- View all past sessions at **My History** in the navigation bar

---

## Project Structure

```
ai-interview-system/
│
├── backend/                  # Node.js / Express API
│   ├── config/db.js          # MySQL connection
│   ├── controllers/          # Business logic
│   ├── middleware/           # JWT auth middleware
│   ├── routes/               # API routes
│   ├── uploads/cvs/          # Uploaded CV files (auto-created)
│   ├── server.js             # Entry point
│   ├── db-migration.sql      # Schema changes (run if upgrading)
│   └── .env                  # ← you create this
│
├── ml-service/               # Python / Flask AI service
│   ├── app.py                # Flask routes
│   ├── audio_analyzer.py     # librosa ML audio features
│   ├── text_analyzer.py      # spaCy + TF-IDF NLP features
│   ├── requirements.txt      # Python dependencies
│   └── .env                  # ← you create this
│
└── frontend/                 # React / Vite UI
    └── src/
        ├── pages/            # Login, Dashboard, Interview, Report, History
        └── context/          # Auth context
```

---

## API Reference

| Service | Endpoint | Method | Description |
|---------|----------|--------|-------------|
| Backend | `/api/auth/register` | POST | Register a new user |
| Backend | `/api/auth/login` | POST | Login and get JWT token |
| Backend | `/api/cvs/upload` | POST | Upload and analyse a CV |
| Backend | `/api/interviews/start` | POST | Start interview, get first question |
| Backend | `/api/interviews/next` | POST | Submit answer, get next question |
| Backend | `/api/interviews/complete` | POST | End interview, get full report |
| Backend | `/api/interviews/history` | GET | Get all past interviews |
| ML Service | `/transcribe` | POST | Transcribe audio + compute audio ML metrics |
| ML Service | `/parse_cv` | POST | Extract text and domains from CV |
| ML Service | `/generate_question` | POST | Generate next interview question |
| ML Service | `/evaluate_interview` | POST | Evaluate full interview with ML + AI |

---

## Troubleshooting

### "Cannot connect to MySQL database"
- Make sure MySQL is running: search for **MySQL Workbench** or **MySQL80** service in Windows Services
- Double-check `DB_USER`, `DB_PASS`, and `DB_NAME` in `backend/.env`
- Try connecting manually: `mysql -u root -p ai_interview_system`

### "ANTHROPIC_API_KEY is missing" or Claude errors
- Confirm the key is in `ml-service/.env` with no extra spaces
- Make sure it starts with `sk-ant-`
- Check your credit balance at [console.anthropic.com](https://console.anthropic.com)

### "ffmpeg not found" or Whisper audio errors
- Run `ffmpeg -version` in a **new** terminal after adding it to PATH
- On Windows, restart the terminal after editing PATH — it does not update automatically

### "Module not found" in Python
- Make sure the virtual environment is activated — you should see `(venv)` in the terminal
- Run `pip install -r requirements.txt` again

### "npm install" fails
- Make sure Node.js 18+ is installed: `node --version`
- Delete `node_modules/` and `package-lock.json`, then run `npm install` again

### Microphone not working in the browser
- The browser needs microphone permission — click **Allow** when prompted
- Use **Chrome** or **Edge** for best Web Speech API support
- Make sure no other app is using the microphone

### The interview starts but gives no next question
- Check that all three terminals are running without errors
- Check the ML service terminal for Python error messages
- Refresh the page and try again

---

## Technologies Used

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18, Vite, Framer Motion | UI |
| Backend | Node.js, Express, JWT, Multer | REST API + Auth |
| Database | MySQL 8 | User data, CVs, interview records |
| ML Service | Python, Flask | AI processing server |
| Speech-to-Text | OpenAI Whisper | Transcribe voice answers |
| Audio ML | librosa | Confidence, fluency, speaking speed |
| NLP | spaCy, scikit-learn TF-IDF | Communication quality, relevance, technical accuracy |
| AI Questions | Anthropic Claude (Haiku) | Dynamic interview question generation |
| AI Evaluation | Anthropic Claude (Sonnet) | Interview summary and recommendations |
| CV Parsing | pdfplumber, python-docx | Extract text from PDF / DOCX |

---

## License

This project is developed as an academic final year project.
