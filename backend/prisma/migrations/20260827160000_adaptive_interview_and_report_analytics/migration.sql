-- Adaptive interview planning + evidence-backed reports.
--
-- All columns are additive and nullable (or defaulted), so existing rows remain
-- valid: interviews created before adaptive planning simply carry NULL plan
-- metadata, and the application already treats those as absent.

-- questions: plan metadata produced by the ML question planner. `expects` holds
-- the concepts a good answer should cover, which the report generator uses to
-- measure concept coverage.
ALTER TABLE `questions`
  ADD COLUMN `domain`     VARCHAR(64) NULL,
  ADD COLUMN `difficulty` VARCHAR(32) NULL,
  ADD COLUMN `source`     VARCHAR(32) NULL,
  ADD COLUMN `expects`    JSON        NULL;

-- answers: how the candidate's turn was classified. `skipped` marks a declined
-- question so it is excluded from accuracy scoring rather than counted wrong.
ALTER TABLE `answers`
  ADD COLUMN `intent`  VARCHAR(24) NULL,
  ADD COLUMN `skipped` BOOLEAN     NOT NULL DEFAULT FALSE;

-- reports: the measurements behind every score, so the report can show its
-- working instead of asserting numbers.
ALTER TABLE `reports`
  ADD COLUMN `analytics`   JSON NULL,
  ADD COLUMN `perQuestion` JSON NULL,
  ADD COLUMN `diagnosis`   JSON NULL;
