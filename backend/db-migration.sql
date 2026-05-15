-- Run this against your MySQL database to add the new columns.
-- Safe to run on an existing database (add only, no destructive changes).

-- Add language and difficulty tracking to interviews
ALTER TABLE interviews
  ADD COLUMN language VARCHAR(20) NOT NULL DEFAULT 'english',
  ADD COLUMN difficulty VARCHAR(20) NOT NULL DEFAULT 'intermediate';

-- Extend reports with the new evaluation fields
ALTER TABLE reports
  ADD COLUMN confidence_score INT DEFAULT NULL,
  ADD COLUMN performance_level VARCHAR(20) DEFAULT NULL,
  ADD COLUMN key_strengths TEXT DEFAULT NULL,
  ADD COLUMN areas_for_improvement TEXT DEFAULT NULL,
  ADD COLUMN learning_resources TEXT DEFAULT NULL;
