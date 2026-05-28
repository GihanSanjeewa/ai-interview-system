# Inverview AI — Enterprise Architecture & Implementation Plan

> AI-Powered Voice Interview Assistance and Job Recommendation Platform
> Version 1.0 · Owner: Gihan Sanjeewa (KG/BSCSD/16/05)

This document upgrades the academic proposal into a production-grade SaaS blueprint
that is **incrementally achievable from the current monorepo** (Node/Express backend +
Flask ML service + React/Vite frontend + MySQL). Each section calls out what already
exists so you can ship it as a roadmap, not a rewrite.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [High-Level System Architecture](#2-high-level-system-architecture)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Backend Architecture (BFF + Domain Services)](#4-backend-architecture-bff--domain-services)
5. [ML / AI Microservices](#5-ml--ai-microservices)
6. [Database Design](#6-database-design)
7. [API Design (REST + WebSocket + gRPC)](#7-api-design)
8. [Real-Time Communication](#8-real-time-communication)
9. [Authentication & Authorization](#9-authentication--authorization)
10. [Security](#10-security)
11. [DevOps, Deployment, Monitoring](#11-devops-deployment-monitoring)
12. [Folder Structures](#12-folder-structures)
13. [Development Roadmap](#13-development-roadmap)
14. [Third-Party Services & Cost](#14-third-party-services--cost)
15. [Scaling Strategy](#15-scaling-strategy)
16. [Risks & Mitigations](#16-risks--mitigations)

---

## 1. Executive Summary

### What we are building

A multi-tenant SaaS that lets candidates run **voice-first mock interviews** with a
human-like AI persona ("Aria"), receive a **6-metric performance report**, and get
**AI job recommendations** grounded in their CV + interview transcript.

### Architectural style

A pragmatic **modular monolith → service split** progression:

- **Phase 1 (MVP, weeks 1–10):** modular monolith (Node.js BFF) + one Python ML
  service. Already 70% in place.
- **Phase 2 (production, weeks 11–20):** split high-load concerns (speech, NLP,
  recommendation) into independently deployable services behind an API gateway.
- **Phase 3 (scale):** event-driven backbone (BullMQ → Kafka), Kubernetes, read
  replicas, CDN-cached reports.

We deliberately avoid full microservices on day 1 — it would slow your thesis by
months and add infrastructure you cannot operate alone.

### Key product loops

| Loop                | Trigger                | Output                        | SLA target |
| ------------------- | ---------------------- | ----------------------------- | ---------- |
| **CV → tracks**     | Upload PDF/DOCX        | Skill matrix + suggested mocks | < 6 s      |
| **Mock interview**  | Start session          | Live AI Q/A + transcript      | < 1.5 s round-trip |
| **Scoring**         | End session            | 6-metric report PDF           | < 30 s     |
| **Job match**       | Post-report or weekly  | Ranked roles + skill gaps     | async      |

---

## 2. High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT TIER                                     │
│  Web (React/Vite, TS)   ·   Mobile (future React Native)   ·   Admin SPA     │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │  HTTPS / WSS (TLS 1.3)
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     EDGE / CDN  ( Cloudflare or Azure Front Door )           │
│   · WAF · DDoS · Bot mitigation · Static asset cache · Image opt · Rate lim. │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY  ( NGINX / Kong )                       │
│   · Auth pass-through (JWT verify) · Routing · Per-route quotas · mTLS to    │
│     internal services · OpenAPI contract enforcement                         │
└──────────┬──────────────┬──────────────┬──────────────┬─────────────────────┘
           ▼              ▼              ▼              ▼
   ┌──────────────┐ ┌────────────┐ ┌─────────────┐ ┌──────────────┐
   │  BFF / API   │ │ Realtime   │ │  Webhooks   │ │   Admin BFF  │
   │ (Node TS)    │ │ (Socket.IO │ │ (Stripe,    │ │  (Node TS)   │
   │  Express +   │ │  + WebRTC  │ │  email)     │ │              │
   │  Prisma)     │ │  signaling)│ │             │ │              │
   └─────┬────┬───┘ └─────┬──────┘ └────┬────────┘ └───────┬──────┘
         │    │           │             │                  │
         │    │           ▼             │                  │
         │    │   ┌───────────────┐     │                  │
         │    │   │ MEDIA SERVER  │     │                  │
         │    │   │  (mediasoup / │     │                  │
         │    │   │  LiveKit SFU) │     │                  │
         │    │   └──────┬────────┘     │                  │
         │    │          │              │                  │
         │    │          ▼              │                  │
         │    │   ┌─────────────────────────────────┐      │
         │    └──►│        EVENT BUS                │◄─────┘
         │        │   Redis Streams → Kafka (later) │
         │        └──┬──────┬──────┬─────────────┬──┘
         │           │      │      │             │
         ▼           ▼      ▼      ▼             ▼
   ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────┐ ┌─────────────┐
   │ MYSQL   │ │ Redis    │ │ Object  │ │ Speech Svc   │ │ NLP Score   │
   │ Primary │ │ cache +  │ │ Storage │ │ (Whisper +   │ │ Svc (Claude │
   │ + Read  │ │ sessions │ │ S3/Blob │ │ Deepgram)    │ │ + spaCy)    │
   │ Replicas│ │ + queues │ │         │ │ Python/FastAPI│ │ Python/FAPI │
   └─────────┘ └──────────┘ └─────────┘ └──────────────┘ └─────────────┘
                                                ▲              ▲
                                                │              │
                                          ┌─────┴──────────────┴────┐
                                          │ Emotion / Vision Svc    │
                                          │ (OpenCV + MediaPipe)    │
                                          └─────────────────────────┘
                                          ┌─────────────────────────┐
                                          │ Job Recommender Svc     │
                                          │ (scikit-learn + FAISS)  │
                                          └─────────────────────────┘
```

### Why this shape

- **Single API gateway** lets you keep auth + rate-limit logic in one place even
  while internals are split.
- **Event bus** decouples scoring/recommendation from the request path so the
  user never waits on Whisper for the page to load.
- **Media server** (SFU) is what makes interviewing scale past 10 concurrent
  users; the BFF only handles signaling.
- **MySQL** stays as the source of truth (your proposal + current code).
  Vector search lives in **FAISS** or **pgvector-style sidecar**, not in MySQL.

---

## 3. Frontend Architecture

### Current state

You already have a premium React/Vite frontend (built last session) covering
landing, auth, dashboard, interview room, history, reports, profile, subscription.
This section formalizes it into the enterprise target.

### Stack (locked in)

| Layer          | Choice                                | Why                                |
| -------------- | ------------------------------------- | ---------------------------------- |
| Framework      | React 19 + Vite + TypeScript          | DX + fast HMR; type safety         |
| Styling        | Tailwind v4 + custom design tokens    | Already wired                      |
| UI primitives  | Custom ShadCN-style components        | Already built (Button, Card, etc.) |
| Animation      | Framer Motion                         | Already wired                      |
| State (UI)     | Zustand                               | Light, no Redux ceremony           |
| State (server) | TanStack Query (React Query v5)       | Cache, retry, optimistic           |
| HTTP           | Axios + interceptors                  | Refresh-token retry logic          |
| Forms          | React Hook Form + Zod                 | Schema reuse with backend          |
| Routing        | React Router 7                        | Already wired                      |
| Realtime       | Socket.IO client + WebRTC adapter     | For interview room                 |
| Charts         | Recharts (or keep custom SVG)         | Drop-in for analytics              |
| i18n           | `i18next` + `react-i18next`           | English + Sinhala                  |
| Testing        | Vitest + React Testing Library + Playwright | unit, integration, E2E       |

### Frontend layers

```
src/
├── app/                      # Bootstrap: router, providers, error boundary
├── routes/                   # Route definitions only (lazy-loaded)
├── pages/                    # Page components (compose features)
├── features/                 # Domain modules (one folder per bounded context)
│   ├── auth/
│   ├── cv/
│   ├── interview/
│   ├── reports/
│   ├── jobs/
│   └── billing/
├── widgets/                  # Cross-feature compositions (sidebar, navbar)
├── components/ui/            # Design system primitives
├── lib/                      # Pure helpers (no React imports)
├── api/                      # Generated typed clients (OpenAPI → ts)
│   └── generated/
├── hooks/                    # Reusable hooks
├── store/                    # Zustand slices
├── i18n/
│   ├── en/
│   └── si/                   # Sinhala translations
├── types/                    # Shared TS types
└── styles/                   # Tokens + global CSS
```

### Cross-cutting concerns

- **Type-safe API**: generate TS clients from backend OpenAPI spec (`openapi-typescript` + `openapi-fetch`).
- **Realtime hook**: `useInterviewChannel(sessionId)` returns `{ aiState, transcript, sendAnswer, end }` backed by Socket.IO.
- **Auth guard**: `<ProtectedRoute roles={['user']}>` + silent refresh via cookie + axios interceptor.
- **Suspense + skeletons**: every async page uses Suspense; skeletons reuse the design system.
- **Theming**: CSS custom properties tied to `.dark`/`.light` root class (already done).
- **Accessibility**: ARIA on interview controls, keyboard shortcuts (`m` mute, `c` camera, `space` next), reduced-motion respected.
- **Error boundary**: root + per-feature; reports to Sentry.
- **Feature flags**: `growthbook-react` (or Unleash) for gradual ML rollouts.

### Mobile responsiveness contract

- Breakpoints: `sm: 640`, `md: 768`, `lg: 1024`, `xl: 1280` (Tailwind defaults).
- Interview Room degrades to **stacked layout** on `<lg`; AI tile dominates,
  user PIP collapses to bottom-right corner; controls dock to bottom safe-area.

---

## 4. Backend Architecture (BFF + Domain Services)

### Current state

- `backend/` is plain JS Express 5 with `controllers/`, `routes/`, `middleware/`,
  using `mysql2` directly. Works, but no layering or types.

### Target: Clean Architecture in TypeScript

```
backend/
├── src/
│   ├── main.ts                       # Composition root, DI container
│   ├── http/                         # HTTP transport (Express adapters)
│   │   ├── server.ts
│   │   ├── routes/
│   │   ├── middlewares/
│   │   └── openapi.ts                # Spec served at /api/docs
│   ├── ws/                           # Socket.IO transport
│   │   └── interview.gateway.ts
│   ├── modules/                      # Bounded contexts (DDD)
│   │   ├── identity/
│   │   │   ├── domain/               # Entities, value objects, events
│   │   │   ├── application/          # Use-cases (commands/queries)
│   │   │   ├── infrastructure/       # Prisma repos, password hashing
│   │   │   └── presentation/         # DTOs, validators (Zod)
│   │   ├── cv/
│   │   ├── interview/                # Interview lifecycle, Q/A
│   │   ├── scoring/                  # Report generation
│   │   ├── jobs/                     # Recommendations
│   │   ├── billing/                  # Stripe + subscription state
│   │   └── notification/             # Email, push, in-app
│   ├── shared/
│   │   ├── kernel/                   # Result type, Either, base classes
│   │   ├── events/                   # Domain event bus
│   │   ├── errors/
│   │   └── logger/                   # Pino + correlation IDs
│   ├── infrastructure/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── redis/
│   │   ├── storage/                  # S3 / Azure Blob client
│   │   ├── queues/                   # BullMQ wrappers
│   │   ├── grpc/                     # Stubs for ML services
│   │   └── http-clients/             # Typed clients for external APIs
│   └── workers/                      # BullMQ workers (separate process)
│       ├── cv-analyzer.worker.ts
│       ├── transcription.worker.ts
│       ├── scoring.worker.ts
│       └── recommendation.worker.ts
├── prisma/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── Dockerfile
└── package.json
```

### Layer rules

| Layer            | May depend on                  | Must not depend on        |
| ---------------- | ------------------------------ | ------------------------- |
| `domain/`        | Nothing                        | HTTP, DB, frameworks      |
| `application/`   | `domain/`, shared kernel       | Express, Prisma directly  |
| `infrastructure/`| `application/`, `domain/`      | Other modules' internals  |
| `presentation/`  | `application/`                 | `infrastructure/`         |

### Key patterns

- **Repository pattern** — `interface IInterviewRepository`, Prisma impl injected.
- **Command/Query separation** — write paths emit events, read paths use projections.
- **Domain events** — `InterviewCompleted` triggers scoring + notification asynchronously.
- **Outbox pattern** — domain events written in same DB tx, relay process pushes to bus (prevents lost events).
- **Idempotency keys** on payment + Stripe webhooks.
- **Result<T, E>** instead of exceptions for expected failures.

### Why not full NestJS?

You can use Nest if you want — it bakes most of this in. But your existing
Express baseline + `awilix` (DI) + `zod` keeps the learning curve flat and the
deploy artifact ~3× smaller.

### Event flow example: "candidate ends interview"

```
[HTTP]  POST /interviews/:id/end
   │
   ▼
[App ] EndInterviewCommand → InterviewAggregate.end()
   │
   ├── persists InterviewCompleted event in outbox (same tx as status update)
   │
   ▼
[Outbox relay] → Redis Streams (topic: interview.completed)
                    │
       ┌────────────┼─────────────┬──────────────┐
       ▼            ▼             ▼              ▼
   scoring.worker  recommendation worker  notification worker  analytics
       │
       ├── calls speech-svc (Whisper) for any pending audio
       ├── calls nlp-svc for per-answer evaluation
       ├── aggregates 6-metric score
       └── writes Report + emits ReportGenerated event
```

---

## 5. ML / AI Microservices

Each service is a small **FastAPI** (or Flask + uvicorn) app, deployed as its own
container, with **gRPC** (or HTTP) between BFF and the service. Heavy models are
**preloaded at boot** — never on the request path.

### 5.1 Speech Service (`speech-svc`)

| Concern              | Choice                                              |
| -------------------- | --------------------------------------------------- |
| Engine               | `faster-whisper` (CTranslate2) on GPU; CPU fallback |
| Streaming option     | Deepgram WebSocket (paid) for low-latency live STT  |
| Sinhala              | Whisper `large-v3` handles it; fine-tune later      |
| Endpoints            | `POST /transcribe` (file), `WS /stream` (live)      |
| Cache key            | `sha256(audio)` → 7-day TTL                         |
| Output schema        | `{ text, language, confidence, words[ {t, w, conf} ] }` |

> Current ML service already imports `openai-whisper`. Swap to `faster-whisper`
> (4–10× faster, same model files).

### 5.2 NLP / Scoring Service (`nlp-svc`)

| Concern               | Choice                                                       |
| --------------------- | ------------------------------------------------------------ |
| Models                | spaCy `en_core_web_trf`, Sentence-Transformers `all-mpnet-base-v2`, Anthropic Claude (judge) |
| Pipeline              | Per-answer: relevance (cosine vs question), keyword coverage, grammar (LanguageTool), depth (LLM judge), pace (WPM) |
| Aggregation           | 6 metrics: technical, communication, clarity, confidence, depth, pace |
| Calibration           | Z-scored against rolling 1k-answer distribution per role     |
| Endpoints             | `POST /score/answer`, `POST /score/session`                  |
| Output                | Per-metric 0–100 + strengths/weaknesses + 3 suggestions      |

### 5.3 CV Parser Service (`cv-svc`)

| Concern    | Choice                                              |
| ---------- | --------------------------------------------------- |
| Extraction | `pdfplumber` (PDF) + `python-docx` (DOCX); OCR fallback (`pytesseract`) for scanned PDFs |
| NER        | spaCy custom NER trained on resume corpus           |
| Skills KB  | ESCO + manual SL-tech skill list                    |
| Output     | `{ skills[], roles[], years_total, education[], certs[], readiness_score, suggested_tracks[] }` |

### 5.4 Emotion / Vision Service (`vision-svc`)

> Phase-2. Not required for MVP.

| Concern    | Choice                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------- |
| Pipeline   | MediaPipe Face Mesh → head pose + gaze; OpenCV pre-processing; FER+ for expression              |
| Privacy    | **Per-frame inference on-device via TensorFlow.js where possible**; server-side optional        |
| Output     | Time-series JSON: `{ eyeContact, smile, confidence, headStability }`                            |

### 5.5 Job Recommender Service (`reco-svc`)

| Concern       | Choice                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------- |
| Candidate emb | Sentence-Transformers on (skills + interview transcript + report)                        |
| Job index     | FAISS HNSW index over scraped/curated SL+global job postings                             |
| Re-ranker     | LightGBM trained on `(candidate, job, hired?)` synthetic + collected signals             |
| Output        | Top-10 jobs + per-job match reasons + skill-gap list                                     |
| Refresh       | Index rebuilt nightly; user embedding recomputed on each new report                      |

### Contracts between BFF and ML services

Use **gRPC + Protobuf** in Phase 2, plain HTTP+JSON in Phase 1.

```proto
service NlpScore {
  rpc ScoreAnswer(ScoreAnswerRequest) returns (ScoreAnswerResponse);
  rpc ScoreSession(SessionRequest) returns (SessionReport);
}
```

### Model serving infra

- **Inference**: each service uses a single `asyncio` event loop with a small
  pool of workers; CPU/GPU pinning via Docker `--gpus` for whisper/embeddings.
- **Cold-start**: avoid scale-to-zero on the speech path (cold loads = ~30s).
- **Caching**: Redis for per-(question, answer-hash) score; saves 60%+ at scale.
- **Observability**: every inference emits `model_name`, `latency_ms`, `tokens`, `cost`.

---

## 6. Database Design

### Primary store: MySQL 8 (RDS / Azure Database for MySQL)

Why MySQL and not Postgres? You already use it, your hosting is cheaper, and
you do not need PG-only features at MVP. If you later need pgvector, run a
**dedicated vector store** (Pinecone or self-hosted Qdrant) — don't migrate
your OLTP store for it.

### Schema (Prisma-style, normalized)

> The existing `schema.sql` covers 5 tables; this expands to enterprise scope.

```prisma
model User {
  id            String   @id @default(uuid()) @db.Char(36)
  email         String   @unique
  emailVerified DateTime?
  passwordHash  String?
  fullName      String
  avatarUrl     String?
  locale        String   @default("en")
  role          Role     @default(USER)
  status        UserStatus @default(ACTIVE)
  plan          Plan     @default(FREE)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  lastLoginAt   DateTime?

  oauthAccounts  OAuthAccount[]
  cvs            Cv[]
  interviews     Interview[]
  reports        Report[]
  subscriptions  Subscription[]
  refreshTokens  RefreshToken[]
  notifications  Notification[]
  auditLogs      AuditLog[]

  @@index([email])
  @@index([role, status])
}

enum Role { USER ADMIN RECRUITER }
enum UserStatus { ACTIVE SUSPENDED DELETED }
enum Plan { FREE PRO TEAM }

model OAuthAccount {
  id         String @id @default(uuid())
  userId     String
  provider   String   // google | github | linkedin
  providerId String
  user       User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerId])
}

model RefreshToken {
  id          String   @id @default(uuid())
  userId      String
  tokenHash   String   @unique
  expiresAt   DateTime
  revokedAt   DateTime?
  userAgent   String?
  ip          String?
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, expiresAt])
}

model Cv {
  id              String   @id @default(uuid())
  userId          String
  fileKey         String              // S3 key
  mimeType        String
  pageCount       Int?
  rawText         String? @db.LongText
  parsed          Json?               // {skills, education, ...}
  readinessScore  Int?
  suggestedTracks Json?
  status          CvStatus @default(PENDING)
  errorMessage    String?
  createdAt       DateTime @default(now())
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, createdAt])
}

enum CvStatus { PENDING PARSED FAILED }

model Interview {
  id           String   @id @default(uuid())
  userId       String
  cvId         String?
  role         String              // "Senior React Engineer"
  category     String              // "react"
  language     String              // "en" | "si"
  difficulty   String              // beginner | intermediate | advanced
  persona      String              // aria | marcus | kenji
  plannedSec   Int
  startedAt    DateTime?
  endedAt      DateTime?
  status       InterviewStatus @default(PENDING)
  abortReason  String?

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cv           Cv?      @relation(fields: [cvId], references: [id])
  questions    Question[]
  events       InterviewEvent[]
  report       Report?

  createdAt    DateTime @default(now())
  @@index([userId, status])
  @@index([userId, createdAt])
}

enum InterviewStatus { PENDING LIVE COMPLETED ABORTED FAILED }

model Question {
  id           String   @id @default(uuid())
  interviewId  String
  ordinal      Int
  text         String   @db.Text
  phase        String              // greet | tech | behavior ...
  askedAt      DateTime
  answer       Answer?
  interview    Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  @@unique([interviewId, ordinal])
}

model Answer {
  id            String   @id @default(uuid())
  questionId    String   @unique
  audioKey      String?             // S3 key
  transcript    String?  @db.LongText
  wordTimings   Json?
  durationMs    Int?
  metrics       Json?               // per-answer metrics
  scoredAt      DateTime?
  question      Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
}

model InterviewEvent {
  id            String   @id @default(uuid())
  interviewId   String
  type          String              // 'mic_muted', 'speaker_speaking', 'phase_change'
  payload       Json?
  occurredAt    DateTime @default(now())
  interview     Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  @@index([interviewId, occurredAt])
}

model Report {
  id                 String   @id @default(uuid())
  interviewId        String   @unique
  userId             String
  overallScore       Int
  technical          Int
  communication      Int
  clarity            Int
  confidence         Int
  depth              Int
  pace               Int
  strengths          Json
  weaknesses         Json
  suggestions        Json
  pdfKey             String?
  generatedAt        DateTime @default(now())
  interview          Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  user               User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobMatches         JobMatch[]
  @@index([userId, generatedAt])
}

model JobMatch {
  id           String   @id @default(uuid())
  reportId     String
  jobId        String
  matchScore   Float
  reasonJson   Json
  skillGaps    Json
  createdAt    DateTime @default(now())
  report       Report   @relation(fields: [reportId], references: [id], onDelete: Cascade)
  job          Job      @relation(fields: [jobId], references: [id])
  @@index([reportId, matchScore])
}

model Job {
  id           String   @id @default(uuid())
  externalId   String?  @unique
  title        String
  company      String
  location     String?
  remote       Boolean  @default(false)
  seniority    String?
  description  String   @db.LongText
  skills       Json
  postedAt     DateTime?
  sourceUrl    String?
  embedding    Bytes?              // serialized FAISS vector ref
  @@index([title])
}

model Subscription {
  id                 String   @id @default(uuid())
  userId             String
  plan               Plan
  status             String              // active | canceled | past_due
  stripeSubId        String?  @unique
  currentPeriodEnd   DateTime?
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  invoices           Invoice[]
}

model Invoice {
  id             String   @id @default(uuid())
  subscriptionId String
  amountCents    Int
  currency       String
  status         String
  hostedUrl      String?
  paidAt         DateTime?
  subscription   Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
}

model Notification {
  id        String   @id @default(uuid())
  userId    String
  type      String
  title     String
  body      String?
  link      String?
  readAt    DateTime?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, readAt])
}

model AuditLog {
  id         String   @id @default(uuid())
  userId     String?
  actor      String              // user | system | admin
  action     String              // 'cv.uploaded'
  entity     String              // 'cv'
  entityId   String?
  ip         String?
  userAgent  String?
  metadata   Json?
  createdAt  DateTime @default(now())
  user       User?    @relation(fields: [userId], references: [id])
  @@index([entity, entityId])
  @@index([userId, createdAt])
}

model OutboxEvent {
  id            String   @id @default(uuid())
  aggregate     String              // 'interview'
  aggregateId   String
  type          String              // 'interview.completed'
  payload       Json
  publishedAt   DateTime?
  createdAt     DateTime @default(now())
  @@index([publishedAt, createdAt])
}
```

### ER overview

```
User 1───* Cv
User 1───* Interview ──1 Cv (optional)
Interview 1───* Question 1───1 Answer
Interview 1───1 Report 1───* JobMatch ──* Job
User 1───* Subscription 1───* Invoice
User 1───* RefreshToken
User 1───* AuditLog
* ─────── OutboxEvent  (write-side; not user-facing)
```

### Auxiliary stores

| Store          | Purpose                                                    |
| -------------- | ---------------------------------------------------------- |
| **Redis**      | Sessions, rate-limit counters, BullMQ queues, hot caches   |
| **S3 / Blob**  | CV files, audio chunks, generated PDFs, recordings         |
| **FAISS / Qdrant** | Job + candidate vectors                                |
| **ClickHouse** (later) | Analytics events for dashboards / cohorts           |

### Migration & backups

- Prisma migrations on every deploy via a one-off `migrate` job.
- Nightly logical backup (mysqldump → encrypted to cold storage).
- Point-in-time recovery enabled on managed RDS / Azure DB.
- Quarterly **restore drill** — restore to staging and assert checksum.

---

## 7. API Design

### Style

- **REST + JSON** for CRUD and most flows.
- **WebSocket (Socket.IO)** for the interview channel (low-latency events).
- **WebRTC** for the actual audio/video media plane.
- **gRPC** between BFF and ML services (Phase 2).
- All public endpoints versioned: `/v1/...`.
- Errors follow [RFC 7807 Problem+JSON](https://www.rfc-editor.org/rfc/rfc7807):
  `{ type, title, status, detail, instance, errors[] }`.

### Key REST endpoints (illustrative subset)

```
POST   /v1/auth/register
POST   /v1/auth/login
POST   /v1/auth/refresh
POST   /v1/auth/logout
GET    /v1/auth/me
POST   /v1/auth/oauth/{provider}/callback

POST   /v1/cvs                          # multipart upload
GET    /v1/cvs                          # list mine
GET    /v1/cvs/{id}
DELETE /v1/cvs/{id}

POST   /v1/interviews                   # create + return room handle
GET    /v1/interviews                   # paginated history
GET    /v1/interviews/{id}
POST   /v1/interviews/{id}/start
POST   /v1/interviews/{id}/answers      # upload audio chunk
POST   /v1/interviews/{id}/end

GET    /v1/reports/{interviewId}
GET    /v1/reports/{interviewId}/pdf    # signed redirect to S3

GET    /v1/jobs/recommendations
GET    /v1/jobs/{id}

POST   /v1/billing/checkout-session
POST   /v1/billing/portal-session
POST   /v1/billing/webhook              # Stripe webhook

# Admin
GET    /v1/admin/users
PATCH  /v1/admin/users/{id}
GET    /v1/admin/metrics
```

### OpenAPI source of truth

- Spec generated from Zod schemas via `@asteasolutions/zod-to-openapi`.
- Frontend client generated from the spec → zero drift.
- Spec served at `/api/docs` (Swagger UI behind admin auth in production).

### Pagination + filtering

- Cursor-based: `?cursor=<opaque>&limit=20`.
- Sort: `?sort=-createdAt,score`.
- Filters as query params with Zod-validated shape.

### Idempotency

- `POST` endpoints that may be retried accept `Idempotency-Key` header (stored in Redis 24h).

### Rate limits (per IP + per user)

| Endpoint group         | Anonymous     | Authenticated         |
| ---------------------- | ------------- | --------------------- |
| `auth/*`               | 5/min         | 20/min                |
| `interviews/start`     | —             | 10/hr Free, 200/hr Pro|
| `cvs` upload           | —             | 20/day                |
| Everything else        | 60/min        | 300/min               |

---

## 8. Real-Time Communication

### Two planes

- **Signaling + app events**: Socket.IO (rooms = `interview:{id}`).
- **Media (audio/video)**: WebRTC via an SFU.

```
Browser ──WS──> Socket.IO ──> Interview room state machine
Browser ──RTP/SRTP──> mediasoup / LiveKit SFU ──RTP──> recording bucket
                                              │
                                              └─chunks──> speech-svc
```

### Why an SFU not P2P

- 1-to-many fan-out for future "interviewer + observer" mode.
- Server-side recording without a second media stream from the client.
- Better firewall traversal (TURN included).

### Recommended SFU

- **LiveKit Cloud** for fastest path (managed, free tier good for thesis).
- Or self-hosted **mediasoup** if you need full control.

### Events on the WS channel

```ts
// Server → client
type ServerEvent =
  | { t: 'phase', phase: 'greet'|'tech'|...; index: number }
  | { t: 'question', id: string; text: string; ordinal: number }
  | { t: 'ai_state', state: 'speaking'|'thinking'|'listening' }
  | { t: 'transcript_partial', text: string }
  | { t: 'transcript_final', who: 'ai'|'user'; text: string }
  | { t: 'metric_update', metrics: PartialMetrics }
  | { t: 'ended', reportPending: boolean };

// Client → server
type ClientEvent =
  | { t: 'ready' }
  | { t: 'mic', on: boolean }
  | { t: 'camera', on: boolean }
  | { t: 'next' }
  | { t: 'end' };
```

### Reliability

- Heartbeat every 15s; reconnect with `last_event_id` to replay missed events.
- Server-authoritative state: the client never decides the next question.
- Audio chunks buffered to S3 first, then transcribed — never lost on disconnect.

---

## 9. Authentication & Authorization

### Tokens

| Token            | Storage          | TTL    | Purpose                |
| ---------------- | ---------------- | ------ | ---------------------- |
| Access JWT       | Memory (JS)      | 15 min | API calls              |
| Refresh token    | **httpOnly Secure SameSite=Strict cookie** | 30 days | Rotate access |
| WS auth          | One-shot token via `/auth/ws-ticket` | 60 s | Socket.IO handshake |
| Email verify     | One-shot, hashed in DB | 24 h | Verification link |
| Password reset   | One-shot, hashed | 15 min | Reset link            |

### Rotation

- Refresh tokens are **rotated** on every use; old token revoked.
- Reuse of a revoked refresh token → revoke entire family + force re-login (token theft signal).

### OAuth

- Google, GitHub, LinkedIn via `passport.js` (or directly).
- New OAuth user without email match → ask once: link to existing account or create new.
- Always store hashed `providerId`, never the raw access token from the OAuth provider.

### RBAC

```
USER       → own resources only
RECRUITER  → own resources + read-only on candidates who opted-in
ADMIN      → everything, gated by audit log
```

- Implemented as a tiny `casl`-based ability builder.
- Enforced at the **application layer** (in use-cases), not just route guards — so background workers honor it too.

### MFA (Phase 2)

- TOTP (Google Authenticator) via `otplib`.
- Required for admins; optional for users.

---

## 10. Security

### Application

- **OWASP Top 10** baseline: parameterized queries (Prisma), output encoding (React), CSRF tokens for cookie-auth state-changing POSTs.
- **Helmet** + strict CSP (`default-src 'self'; connect-src 'self' wss://...`).
- **Rate limiting** at gateway + per-route (`express-rate-limit` + Redis).
- **File upload validation**: magic-byte sniffing, MIME allow-list, max 10 MB, AV scan via ClamAV sidecar before processing.
- **Audio uploads**: pre-signed S3 PUT URLs so the file never touches your servers.

### Data

- TLS 1.3 everywhere (LetsEncrypt or managed).
- Encryption at rest on RDS + S3 (provider-managed KMS).
- PII minimization: store only what we use; auto-delete recordings after 30 days unless user opts in.
- GDPR/CCPA: `GET /v1/me/export` and `DELETE /v1/me` (soft-delete + queue 30-day purge).
- Secrets in **AWS Secrets Manager / Azure Key Vault**, never in `.env` in production.

### Auth

- bcrypt (cost 12) for passwords; pepper from KMS.
- JWT signed with **RS256** (rotateable keys via JWKS endpoint).
- Lockout: 5 failed logins → 15-min cooldown (Redis counter).

### Logging & audit

- Every state-changing action writes an `AuditLog` row.
- Logs scrub PII; correlation ID propagates from gateway through workers.
- Separate "security" log stream with longer retention.

---

## 11. DevOps, Deployment, Monitoring

### Environments

| Env     | Purpose            | Promotion gate                |
| ------- | ------------------ | ----------------------------- |
| `local` | dev laptops        | —                             |
| `dev`   | shared dev cluster | merge to `main`               |
| `staging` | UAT + perf       | green CI + manual approval    |
| `prod`  | customers          | tag-release + change ticket   |

### CI/CD

- **GitHub Actions** pipelines per service:
  1. Lint + typecheck
  2. Unit tests
  3. Build container, sign with `cosign`
  4. Push to GHCR
  5. Trivy + Snyk scan
  6. Deploy to env via Helm / `kubectl apply`
  7. Smoke test
  8. Synthetics check

### Containerization

- One Dockerfile per service.
- Multi-stage builds; final image based on `node:20-alpine` or `python:3.11-slim`.
- Non-root user, read-only filesystem, no shell in prod images.

### Orchestration

- Phase 1: **Docker Compose** on a single VPS (cost ~$20/mo).
- Phase 2: **Kubernetes** — EKS / AKS, or DigitalOcean K8s for budget.
  - HPA on CPU + custom metric (queue depth) for workers.
  - PodDisruptionBudgets for the SFU and gateway.
  - NetworkPolicies isolating ML services.

### Infrastructure as Code

- **Terraform** modules for: VPC, RDS, ElastiCache, S3, EKS, CloudFront, Secrets Manager.
- Per-env `tfvars`; state in S3 + DynamoDB lock.

### Observability

| Concern  | Tool                                                                   |
| -------- | ---------------------------------------------------------------------- |
| Metrics  | Prometheus + Grafana (RED + USE dashboards per service)                |
| Logs     | Loki (or ELK if existing infra), with `correlationId` everywhere       |
| Traces   | OpenTelemetry → Tempo / Jaeger; trace BFF → ML services end-to-end     |
| Errors   | Sentry (frontend + backend)                                            |
| Uptime   | UptimeRobot or BetterStack for synthetics                              |
| Cost     | Per-route cost label → Grafana dashboard for LLM/STT spend             |

### SLOs (target)

| Service           | Latency p95         | Availability    |
| ----------------- | ------------------- | --------------- |
| API GET           | < 300 ms            | 99.9%           |
| API POST          | < 600 ms            | 99.9%           |
| WS event RTT      | < 250 ms            | 99.5%           |
| Whisper transcribe| < 2× audio length  | 99.0%           |
| PDF generation    | < 30 s              | 99.0%           |

---

## 12. Folder Structures

> Frontend is detailed in §3. Backend in §4. Below: ML services + repo root.

### Repo root (monorepo using `pnpm` workspaces + `turbo`)

```
ai-interview-system/
├── apps/
│   ├── web/                    # current frontend
│   ├── admin/                  # admin SPA (Phase 2)
│   └── docs/                   # OpenAPI + Storybook
├── services/
│   ├── api/                    # BFF (Node TS)
│   ├── speech-svc/             # Python
│   ├── nlp-svc/                # Python
│   ├── cv-svc/                 # Python
│   ├── vision-svc/             # Python (Phase 2)
│   └── reco-svc/               # Python
├── packages/
│   ├── ui/                     # shared design system (extract later)
│   ├── types/                  # shared TS types from OpenAPI
│   ├── eslint-config/
│   └── tsconfig/
├── infra/
│   ├── terraform/
│   ├── helm/                   # charts per service
│   ├── docker/                 # compose files for local
│   └── k8s/                    # raw manifests if not Helm
├── ops/
│   ├── runbooks/               # how-to for on-call
│   └── dashboards/             # Grafana JSON
├── .github/workflows/
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

### `services/speech-svc/` (template all ML services follow)

```
speech-svc/
├── app/
│   ├── main.py                # FastAPI entrypoint
│   ├── api/                   # routers
│   ├── core/                  # config, logging, security
│   ├── models/                # pydantic schemas
│   ├── services/              # business logic (transcribe, etc.)
│   ├── inference/             # model wrappers
│   ├── caching/
│   └── observability/         # otel, prometheus exporter
├── tests/
│   ├── unit/
│   └── integration/
├── ml-assets/                 # downloaded model files (gitignored)
├── pyproject.toml
├── Dockerfile
└── README.md
```

---

## 13. Development Roadmap

> Mapped against your proposal's 22-week plan, but reshaped into shippable
> increments so you can demo every 2 weeks.

| Week | Milestone                                                                          | Demo                                                |
| ---- | ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1–2  | TS conversion of `backend/` + Prisma + new schema migration                        | `npx prisma studio` shows new schema; old endpoints work |
| 3–4  | Auth v2: refresh tokens, OAuth (Google), Zod DTOs, OpenAPI spec                    | Generated TS client used by frontend                |
| 5    | Object storage (S3 / Azure Blob) + pre-signed CV uploads                           | Upload directly to S3 from browser                  |
| 6–7  | CV service v1 (Whisper-free): PDF/DOCX → skills + tracks                           | Upload CV → dashboard shows skill matrix            |
| 8–9  | Interview state machine + Socket.IO room + question delivery from server           | Live mock works end-to-end without scoring          |
| 10   | Speech service: chunked audio → text                                               | Live transcript in interview room                   |
| 11–12| NLP scoring v1 + outbox + BullMQ scoring worker                                    | Real 6-metric report on Reports page                |
| 13   | PDF report generation (puppeteer) + signed download                                | Download a real PDF                                 |
| 14   | Job recommender v1 (FAISS over curated job index)                                  | Job matches on report page                          |
| 15   | Sinhala STT path + i18n + Sinhala UI strings                                       | Conduct interview in Sinhala                        |
| 16   | Billing: Stripe Checkout + webhook + plan gates                                    | Upgrade to Pro, hit Free limit                      |
| 17   | Admin SPA + metrics dashboard                                                      | Admin can see usage and ban a user                  |
| 18   | Hardening: rate limits, CSP, audit logs, idempotency                               | Security scan passes                                |
| 19   | Containerize all services + Docker Compose for local + GH Actions CI               | One-command local boot                              |
| 20   | Staging deploy on managed K8s; observability stack; load test (k6) to 50 concurrent| Grafana board green during 30-min soak              |
| 21   | Emotion / vision service (optional)                                                | Eye-contact meter in live room                      |
| 22   | Final polish, docs, thesis presentation                                            | Defense                                             |

### Critical-path decisions to make first

1. **MySQL stays** (don't migrate to Postgres unless needed for pgvector).
2. **Monorepo** — pnpm workspaces + turbo. Easier than 5 separate repos.
3. **LiveKit cloud** for SFU until you have load to justify self-hosting.
4. **Claude Haiku 4.5** as the LLM judge (cost-effective, supports Sinhala reasoning).
5. **TypeScript everywhere on the Node side.** Migrate `backend/` first; it pays back from week 2.

---

## 14. Third-Party Services & Cost

### Recommended

| Concern             | Vendor               | Free tier good?  | Notes                              |
| ------------------- | -------------------- | ---------------- | ---------------------------------- |
| LLM judge           | Anthropic Claude     | Trial credits    | Already used in current `ml-service` |
| STT (live)          | Deepgram             | $200 credit      | Sinhala via fallback to Whisper    |
| STT (batch)         | self-host Whisper    | n/a              | Cheapest at scale                  |
| TTS (AI voice)      | ElevenLabs / Azure Speech | limited     | ElevenLabs has best Sinhala-ish    |
| SFU                 | LiveKit              | 50 GB free       | Migrate later if needed            |
| Email               | Resend / Postmark    | Yes              | Verification + reports             |
| Payments            | Stripe               | Per-transaction  | Checkout + Customer Portal         |
| Auth (optional)     | Clerk / Auth0        | Yes              | Skip if you build auth in-house    |
| Error tracking      | Sentry               | 5k events/mo     |                                    |
| Logs/Metrics        | Grafana Cloud        | Yes              | Or self-host Prometheus + Loki     |
| CDN/WAF             | Cloudflare           | Yes              | Free plan covers MVP               |
| File storage        | AWS S3 / Azure Blob  | Trial            | $0.02/GB-mo                        |
| DB                  | RDS / Azure DB MySQL | Trial            | Or PlanetScale (Vitess)            |

### Rough monthly cost at 1k MAU / 5k interviews

| Item                          | Cost (USD/mo)   |
| ----------------------------- | --------------- |
| MySQL (managed, small)        | 25              |
| Redis (managed, small)        | 15              |
| K8s control plane (DO/EKS)    | 0–75            |
| 2× small worker nodes         | 40              |
| Object storage + bandwidth    | 20              |
| LiveKit cloud                 | 50              |
| Anthropic Claude (judge)      | 80              |
| Deepgram (live STT)           | 120             |
| Email + Sentry + Grafana      | 30              |
| **Total**                     | **~$380**       |

Free-tier-first build (Cloudflare + Render + free Postgres) can stay <$50/mo
through MVP demo.

---

## 15. Scaling Strategy

### Path from 100 to 100,000 users

| Stage      | Users        | Topology                                                                                              | Bottleneck-killer                       |
| ---------- | ------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 0          | < 100        | Monolith on single VPS, MySQL local, Whisper CPU                                                       | none                                    |
| 1          | < 5k         | Monolith + workers + managed DB + Redis + LiveKit                                                      | move workers to separate process        |
| 2          | < 50k        | Split ML services, K8s, read replicas, CDN cache for reports                                            | introduce caches + CQRS for history     |
| 3          | < 500k       | Multi-region K8s, Kafka instead of Redis Streams, partitioned MySQL or Vitess, GPU pool for Whisper    | edge inference for live STT             |

### Read scaling

- `Report` and `Interview` history reads are >90% of traffic — cache aggressively
  in Redis with `interview:{id}:v{n}` keys, bump `n` on write.
- Use read replicas with `prisma-read-replicas` for `GET` paths.

### Write scaling

- Outbox + workers absorb spikes (Whisper at 4× audio realtime).
- Sharding key candidate: `userId`. Don't shard until you must.

### Cold-start budget

- Speech service must stay warm — set `min_replicas: 1`.
- NLP service can cold-start (~5 s) on demand.

### Backpressure

- Per-user concurrent-interview cap enforced by gateway (one live at a time).
- BullMQ rate-limited per worker so we don't get 429'd by paid APIs.

---

## 16. Risks & Mitigations

| Risk                                                | Likelihood | Impact | Mitigation                                                                  |
| --------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------- |
| Sinhala STT accuracy disappoints                    | High       | High   | Side-by-side Deepgram vs Whisper; let user retry per-question; show confidence |
| LLM cost spikes                                     | Med        | High   | Cache scoring by (question, answer-hash); use cheaper Haiku model for judge |
| Whisper too slow on CPU                             | High       | Med    | `faster-whisper` + quantized model; degrade to Deepgram batch                |
| WebRTC NAT failures                                 | Med        | Med    | LiveKit's TURN; fallback to WebSocket audio relay                            |
| Privacy concerns (recording)                        | High       | High   | Opt-in only; 30-day auto-delete; encrypt at rest                             |
| Plagiarism (cheating during interview)              | Med        | Low    | Don't certify; clearly position as practice tool                              |
| Vendor lock-in (LiveKit / Anthropic)                | Med        | Med    | Adapter layer in BFF → ML services so we can swap                            |
| Solo-developer ops burden                           | High       | Med    | Stay on managed services until paid users justify K8s                        |
| Schema churn during thesis                          | Med        | Med    | Prisma migrations + integration tests around critical flows                  |

---

## Appendix A — Authentication flow

```
[Browser] ── POST /v1/auth/login (email, pw) ──▶ [BFF]
                                                   │ verify, issue access JWT (15m)
                                                   │ issue refresh token (30d), store hash
                                  ◀── 200 { access } + Set-Cookie: rt=...; HttpOnly Secure
[Browser] ── GET /v1/me  (Authorization: Bearer access) ──▶ [BFF]  ◀── 200 { me }

(15m later, 401 ANY route)
[Browser axios interceptor] ── POST /v1/auth/refresh (cookie) ──▶ [BFF]
                                                                  │ verify rt, revoke old, issue new pair
                                                ◀── 200 { access } + Set-Cookie: rt=newhash
[Browser] retries original request with new access token

(Logout)
[Browser] ── POST /v1/auth/logout (cookie) ──▶ [BFF] revoke family, clear cookie
```

## Appendix B — Interview session sequence

```
sequenceDiagram
  participant U as User (browser)
  participant W as Web (React)
  participant G as Gateway / BFF
  participant S as Socket.IO
  participant M as LiveKit SFU
  participant Q as BullMQ
  participant ST as Speech svc
  participant NL as NLP svc

  U->>W: Click "Start interview"
  W->>G: POST /v1/interviews
  G-->>W: { id, wsTicket, livekitToken }
  W->>S: connect(wsTicket)
  W->>M: connect(livekitToken)
  S-->>W: ai_state=speaking
  S-->>W: question { text, ordinal:1 }
  M-->>U: audio (AI TTS)
  U->>M: audio (user answer)
  M->>Q: rec chunk uploaded
  Q->>ST: transcribe
  ST-->>Q: { text }
  Q->>S: transcript_final
  S-->>W: transcript_final
  W->>S: { t:'next' }
  S->>NL: score(question, answer)
  NL-->>S: { metrics }
  S-->>W: metric_update
  W->>S: { t:'end' }
  S->>Q: enqueue scoring.aggregate(interviewId)
  Q->>NL: score_session
  NL-->>Q: { report }
  Q->>G: persist Report, emit ReportGenerated
  W->>G: GET /v1/reports/{id}  (poll or push)
```

## Appendix C — Domain events catalog

| Event                  | Producer      | Consumers                                |
| ---------------------- | ------------- | ---------------------------------------- |
| `user.registered`      | identity      | email, analytics                         |
| `cv.uploaded`          | cv            | cv-worker (parse)                        |
| `cv.parsed`            | cv-worker     | dashboard projection, recommender (warm) |
| `interview.started`    | interview     | analytics                                |
| `interview.questionAsked` | interview  | analytics                                |
| `interview.answerSubmitted` | interview | scoring-worker                          |
| `interview.completed`  | interview     | scoring-worker, notification, billing usage |
| `report.generated`     | scoring       | notification, recommender, email         |
| `subscription.updated` | billing       | identity (plan), notification            |

---

## Appendix D — "What changes vs. current codebase"

| Area                    | Current                                    | Target                                       | Effort   |
| ----------------------- | ------------------------------------------ | -------------------------------------------- | -------- |
| Backend language        | JS                                         | TypeScript                                   | M        |
| Backend layout          | Flat controllers/routes                    | Clean architecture per module                | M        |
| DB access               | Raw `mysql2`                               | Prisma + migrations                          | S        |
| DB schema               | 5 tables                                   | Full schema (§6)                             | M        |
| Auth                    | Plain JWT                                  | Access+Refresh, OAuth, RBAC, audit log       | M        |
| File upload             | `multer` to local disk                     | Pre-signed S3 / Blob                         | S        |
| ML transport            | HTTP from BFF                              | HTTP (P1) → gRPC (P2)                        | S→M      |
| Realtime                | None                                       | Socket.IO + LiveKit                          | L        |
| Scoring                 | Synchronous                                | Outbox + BullMQ workers                      | M        |
| Sinhala support         | Partial (Whisper)                          | Full STT + TTS + i18n UI                     | M        |
| Frontend                | Premium UI (done)                          | + i18n, generated client, error boundaries   | S        |
| Deployment              | None                                       | Docker Compose → K8s + IaC                   | L        |
| Observability           | None                                       | OTel + Prom + Grafana + Sentry               | M        |

**S** ≤ 3 days · **M** 1–2 weeks · **L** 3+ weeks

---

*End of document. Treat this as living: every Phase milestone should produce a
short ADR (Architecture Decision Record) under `ops/adr/` capturing what
actually shipped vs. this plan.*
