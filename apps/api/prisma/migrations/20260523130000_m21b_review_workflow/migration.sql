-- M21b: admin-only review workflow on scenarios and questions.

-- Scenario-level review verdict.
CREATE TYPE "ScenarioReviewStatus" AS ENUM (
  'needs_review',
  'approved',
  'needs_rewrite',
  'too_generic',
  'unclear_question',
  'answer_key_issue',
  'debrief_issue',
  'retire_candidate'
);

ALTER TABLE "scenarios"
  ADD COLUMN "review_status" "ScenarioReviewStatus" NOT NULL DEFAULT 'needs_review',
  ADD COLUMN "review_notes" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_by_user_id" UUID;

ALTER TABLE "scenarios"
  ADD CONSTRAINT "scenarios_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

CREATE INDEX "scenarios_review_status_idx"
  ON "scenarios"("review_status");

-- Question-level review notes.
ALTER TABLE "questions"
  ADD COLUMN "review_notes" TEXT;
