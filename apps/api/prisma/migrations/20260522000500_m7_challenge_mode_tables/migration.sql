-- M7 step 2/2 — challenge-mode pivot: drop attempts/attempt_answers,
-- create scenario_progress/question_responses.
--
-- Destructive: any in-flight attempts data is discarded. This is
-- acceptable because the platform is still in pre-public-beta and
-- the only attempt rows in existence are the seeded ones, which the
-- next seed run will recreate against the new schema.

DROP TABLE IF EXISTS "attempt_answers" CASCADE;
DROP TABLE IF EXISTS "attempts" CASCADE;
-- AutoScoreOutcome enum is no longer used anywhere.
DROP TYPE IF EXISTS "AutoScoreOutcome";

-- One row per (trainee, scenario). Tracks aggregate completion.
CREATE TABLE "scenario_progress" (
    "id" UUID NOT NULL,
    "scenario_id" UUID NOT NULL,
    "trainee_user_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "completed_questions" INTEGER NOT NULL DEFAULT 0,
    "total_questions" INTEGER NOT NULL,

    CONSTRAINT "scenario_progress_pkey" PRIMARY KEY ("id")
);

-- Counters must stay non-negative; completed never exceeds total.
ALTER TABLE "scenario_progress" ADD CONSTRAINT "scenario_progress_counters_sane"
    CHECK ("completed_questions" >= 0
       AND "total_questions" >= 0
       AND "completed_questions" <= "total_questions");

-- One progress row per (scenario, trainee). The challenge-mode model
-- doesn't support multiple attempts per scenario — retries happen at
-- the per-question level inside the existing row.
CREATE UNIQUE INDEX "scenario_progress_scenario_trainee_key"
    ON "scenario_progress"("scenario_id", "trainee_user_id");
CREATE INDEX "scenario_progress_trainee_idx"
    ON "scenario_progress"("trainee_user_id");

ALTER TABLE "scenario_progress" ADD CONSTRAINT "scenario_progress_scenario_id_fkey"
    FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scenario_progress" ADD CONSTRAINT "scenario_progress_trainee_user_id_fkey"
    FOREIGN KEY ("trainee_user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- One row per (progress, question). Stores the trainee's latest
-- submitted response, when (if) they got it right, and how many
-- times they've tried.
CREATE TABLE "question_responses" (
    "id" UUID NOT NULL,
    "progress_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "response_json" JSONB,
    "completed_at" TIMESTAMP(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_responses_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "question_responses" ADD CONSTRAINT "question_responses_attempt_count_nonneg"
    CHECK ("attempt_count" >= 0);

CREATE UNIQUE INDEX "question_responses_progress_question_key"
    ON "question_responses"("progress_id", "question_id");
CREATE INDEX "question_responses_progress_idx"
    ON "question_responses"("progress_id");

ALTER TABLE "question_responses" ADD CONSTRAINT "question_responses_progress_id_fkey"
    FOREIGN KEY ("progress_id") REFERENCES "scenario_progress"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_responses" ADD CONSTRAINT "question_responses_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "questions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
