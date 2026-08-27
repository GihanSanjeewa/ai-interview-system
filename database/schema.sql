-- =============================================================================
-- AI Interview System — Comprehensive Production Database Schema
-- Database: MySQL 8.0+ / MariaDB 10.5+
-- Charset: utf8mb4 (Full Unicode support for multilingual Q&A, Sinhala & English)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS ai_interview_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ai_interview_system;

-- Disable foreign key checks during creation to prevent ordering issues
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. IDENTITY & AUTHENTICATION MODULE
-- -----------------------------------------------------------------------------

-- Users table: Core identity, profile metadata, roles, and subscription tier
CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL,
    emailVerified DATETIME(3) NULL,
    passwordHash VARCHAR(255) NULL,
    fullName VARCHAR(255) NOT NULL,
    avatarUrl VARCHAR(500) NULL,
    title VARCHAR(255) NULL,
    bio TEXT NULL,
    locale VARCHAR(8) NOT NULL DEFAULT 'en',
    role ENUM('USER', 'ADMIN', 'RECRUITER') NOT NULL DEFAULT 'USER',
    status ENUM('ACTIVE', 'SUSPENDED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    plan ENUM('FREE', 'PRO', 'TEAM') NOT NULL DEFAULT 'FREE',
    lastLoginAt DATETIME(3) NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (id),
    UNIQUE INDEX users_email_key (email),
    INDEX users_role_status_idx (role, status),
    INDEX users_created_at_idx (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- OAuth Accounts: Multi-provider SSO authentication (Google, GitHub, LinkedIn)
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id CHAR(36) NOT NULL,
    userId CHAR(36) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    providerId VARCHAR(255) NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (id),
    UNIQUE INDEX oauth_accounts_provider_providerId_key (provider, providerId),
    INDEX oauth_accounts_userId_idx (userId),
    CONSTRAINT fk_oauth_accounts_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refresh Tokens: Token-family based rotation for secure JWT session management
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id CHAR(36) NOT NULL,
    userId CHAR(36) NOT NULL,
    familyId CHAR(36) NOT NULL,
    tokenHash VARCHAR(128) NOT NULL,
    expiresAt DATETIME(3) NOT NULL,
    revokedAt DATETIME(3) NULL,
    userAgent VARCHAR(500) NULL,
    ip VARCHAR(64) NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (id),
    UNIQUE INDEX refresh_tokens_tokenHash_key (tokenHash),
    INDEX refresh_tokens_userId_expiresAt_idx (userId, expiresAt),
    INDEX refresh_tokens_familyId_idx (familyId),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 2. CV INTELLIGENCE & INGESTION MODULE
-- -----------------------------------------------------------------------------

-- CVs table: Parsed resume documents, extracted technical tracks, and ATS readiness
CREATE TABLE IF NOT EXISTS cvs (
    id CHAR(36) NOT NULL,
    userId CHAR(36) NOT NULL,
    fileKey VARCHAR(500) NOT NULL,
    originalName VARCHAR(500) NOT NULL,
    mimeType VARCHAR(128) NOT NULL DEFAULT 'application/pdf',
    sizeBytes INT NOT NULL DEFAULT 0,
    pageCount INT NULL,
    rawText LONGTEXT NULL,
    parsed JSON NULL,
    readinessScore INT NULL,
    suggestedTracks JSON NULL,
    status ENUM('PENDING', 'PARSED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    errorMessage TEXT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (id),
    INDEX cvs_userId_createdAt_idx (userId, createdAt),
    CONSTRAINT fk_cvs_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 3. INTERVIEW ENGINE & REAL-TIME SESSIONS MODULE
-- -----------------------------------------------------------------------------

-- Interviews: Real-time interactive mock interview sessions
CREATE TABLE IF NOT EXISTS interviews (
    id CHAR(36) NOT NULL,
    userId CHAR(36) NOT NULL,
    cvId CHAR(36) NULL,
    role VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'technical',
    language VARCHAR(8) NOT NULL DEFAULT 'en',
    difficulty VARCHAR(32) NOT NULL DEFAULT 'intermediate',
    persona VARCHAR(32) NOT NULL DEFAULT 'aria',
    plannedSec INT NOT NULL DEFAULT 1800,
    startedAt DATETIME(3) NULL,
    endedAt DATETIME(3) NULL,
    status ENUM('PENDING', 'LIVE', 'COMPLETED', 'ABORTED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    abortReason VARCHAR(255) NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (id),
    INDEX interviews_userId_status_idx (userId, status),
    INDEX interviews_userId_createdAt_idx (userId, createdAt),
    CONSTRAINT fk_interviews_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_interviews_cv FOREIGN KEY (cvId) REFERENCES cvs(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Questions: Dynamic questions generated per interview phase (intro, technical, deep_dive, behavioral, wrapup)
CREATE TABLE IF NOT EXISTS questions (
    id CHAR(36) NOT NULL,
    interviewId CHAR(36) NOT NULL,
    ordinal INT NOT NULL,
    text TEXT NOT NULL,
    phase VARCHAR(32) NOT NULL DEFAULT 'core',
    askedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (id),
    UNIQUE INDEX questions_interviewId_ordinal_key (interviewId, ordinal),
    CONSTRAINT fk_questions_interview FOREIGN KEY (interviewId) REFERENCES interviews(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Answers: Audio, Whisper ASR transcripts, word timings, latency, and ML scoring metrics
CREATE TABLE IF NOT EXISTS answers (
    id CHAR(36) NOT NULL,
    questionId CHAR(36) NOT NULL,
    audioKey VARCHAR(500) NULL,
    transcript LONGTEXT NULL,
    wordTimings JSON NULL,
    durationMs INT NULL,
    metrics JSON NULL,
    scoredAt DATETIME(3) NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (id),
    UNIQUE INDEX answers_questionId_key (questionId),
    CONSTRAINT fk_answers_question FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Interview Events: Fine-grained session lifecycle audit and event stream
CREATE TABLE IF NOT EXISTS interview_events (
    id CHAR(36) NOT NULL,
    interviewId CHAR(36) NOT NULL,
    type VARCHAR(64) NOT NULL,
    payload JSON NULL,
    occurredAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (id),
    INDEX interview_events_interviewId_occurredAt_idx (interviewId, occurredAt),
    CONSTRAINT fk_interview_events_interview FOREIGN KEY (interviewId) REFERENCES interviews(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 4. MULTI-DIMENSIONAL EVALUATION & REPORTS MODULE
-- -----------------------------------------------------------------------------

-- Performance Reports: 6 core proposal metrics (Technical, Communication, Confidence, Fluency, Relevance, Pace)
CREATE TABLE IF NOT EXISTS reports (
    id CHAR(36) NOT NULL,
    interviewId CHAR(36) NOT NULL,
    userId CHAR(36) NOT NULL,
    overallScore INT NOT NULL,
    confidence INT NOT NULL,
    communication INT NOT NULL,
    relevance INT NOT NULL,
    technical INT NOT NULL,
    fluency INT NOT NULL,
    pace INT NOT NULL,
    performanceLevel ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED') NOT NULL DEFAULT 'INTERMEDIATE',
    strengths JSON NOT NULL,
    weaknesses JSON NOT NULL,
    suggestions JSON NOT NULL,
    resources JSON NULL,
    pdfKey VARCHAR(500) NULL,
    generatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (id),
    UNIQUE INDEX reports_interviewId_key (interviewId),
    INDEX reports_userId_generatedAt_idx (userId, generatedAt),
    CONSTRAINT fk_reports_interview FOREIGN KEY (interviewId) REFERENCES interviews(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_reports_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 5. CAREER & JOB MATCHING MODULE
-- -----------------------------------------------------------------------------

-- Jobs: Targeted industry job openings for candidate opportunity matching
CREATE TABLE IF NOT EXISTS jobs (
    id CHAR(36) NOT NULL,
    externalId VARCHAR(255) NULL,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    location VARCHAR(255) NULL,
    remote BOOLEAN NOT NULL DEFAULT FALSE,
    seniority VARCHAR(64) NULL,
    description LONGTEXT NOT NULL,
    skills JSON NOT NULL,
    postedAt DATETIME(3) NULL,
    sourceUrl VARCHAR(500) NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (id),
    UNIQUE INDEX jobs_externalId_key (externalId),
    INDEX jobs_title_idx (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Job Matches: AI-computed candidate fit score, reasoning, and identified skill gaps
CREATE TABLE IF NOT EXISTS job_matches (
    id CHAR(36) NOT NULL,
    reportId CHAR(36) NOT NULL,
    jobId CHAR(36) NOT NULL,
    matchScore DOUBLE NOT NULL,
    reasonJson JSON NOT NULL,
    skillGaps JSON NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (id),
    INDEX job_matches_reportId_matchScore_idx (reportId, matchScore),
    CONSTRAINT fk_job_matches_report FOREIGN KEY (reportId) REFERENCES reports(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_job_matches_job FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 6. SUBSCRIPTION & BILLING MODULE
-- -----------------------------------------------------------------------------

-- Subscriptions: User plan tracking with Stripe integration
CREATE TABLE IF NOT EXISTS subscriptions (
    id CHAR(36) NOT NULL,
    userId CHAR(36) NOT NULL,
    plan ENUM('FREE', 'PRO', 'TEAM') NOT NULL DEFAULT 'FREE',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    stripeSubId VARCHAR(255) NULL,
    currentPeriodEnd DATETIME(3) NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (id),
    UNIQUE INDEX subscriptions_stripeSubId_key (stripeSubId),
    INDEX subscriptions_userId_idx (userId),
    CONSTRAINT fk_subscriptions_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoices: Record of billing transactions and hosted invoice links
CREATE TABLE IF NOT EXISTS invoices (
    id CHAR(36) NOT NULL,
    subscriptionId CHAR(36) NOT NULL,
    amountCents INT NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    status VARCHAR(32) NOT NULL DEFAULT 'paid',
    hostedUrl VARCHAR(500) NULL,
    paidAt DATETIME(3) NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (id),
    INDEX invoices_subscriptionId_idx (subscriptionId),
    CONSTRAINT fk_invoices_subscription FOREIGN KEY (subscriptionId) REFERENCES subscriptions(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 7. PLATFORM, NOTIFICATIONS, AUDIT & ASYNC EVENTS
-- -----------------------------------------------------------------------------

-- Notifications: User alerts for report readiness, session reminders, and matches
CREATE TABLE IF NOT EXISTS notifications (
    id CHAR(36) NOT NULL,
    userId CHAR(36) NOT NULL,
    type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NULL,
    link VARCHAR(500) NULL,
    readAt DATETIME(3) NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (id),
    INDEX notifications_userId_readAt_idx (userId, readAt),
    CONSTRAINT fk_notifications_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit Logs: Compliance tracking for sensitive operations, logins, and deletions
CREATE TABLE IF NOT EXISTS audit_logs (
    id CHAR(36) NOT NULL,
    userId CHAR(36) NULL,
    actor VARCHAR(32) NOT NULL,
    action VARCHAR(128) NOT NULL,
    entity VARCHAR(64) NOT NULL,
    entityId VARCHAR(64) NULL,
    ip VARCHAR(64) NULL,
    userAgent VARCHAR(500) NULL,
    metadata JSON NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (id),
    INDEX audit_logs_entity_entityId_idx (entity, entityId),
    INDEX audit_logs_userId_createdAt_idx (userId, createdAt),
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Outbox Events: Transactional outbox pattern for reliable domain event publishing
CREATE TABLE IF NOT EXISTS outbox_events (
    id CHAR(36) NOT NULL,
    aggregate VARCHAR(64) NOT NULL,
    aggregateId VARCHAR(64) NOT NULL,
    type VARCHAR(128) NOT NULL,
    payload JSON NOT NULL,
    publishedAt DATETIME(3) NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    PRIMARY KEY (id),
    INDEX outbox_events_publishedAt_createdAt_idx (publishedAt, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 8. BACKWARD COMPATIBILITY / PROTOTYPE SUPPORT
-- -----------------------------------------------------------------------------

-- Interview Sessions: Simplified question/answer schema used by standalone demo scripts
CREATE TABLE IF NOT EXISTS interview_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    interview_id CHAR(36) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NULL,
    audio_path VARCHAR(500) NULL,
    feedback TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX interview_sessions_interview_id_idx (interview_id),
    CONSTRAINT fk_interview_sessions_interview FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
