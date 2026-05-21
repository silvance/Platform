-- M5: questions, answer_keys, attempts, attempt_answers.

CREATE TYPE "QuestionType" AS ENUM (
    'multi_choice',
    'short_answer',
    'long_answer',
    'confidence'
);

CREATE TYPE "AutoScoreOutcome" AS ENUM (
    'correct',
    'incorrect',
    'partial',
    'in_range',
    'out_of_range',
    'ungradable'
);

CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "scenario_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt_md" TEXT NOT NULL,
    "options_json" JSONB,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- weight must be a positive integer; mirrors the Zod contract.
ALTER TABLE "questions" ADD CONSTRAINT "questions_weight_positive"
    CHECK ("weight" > 0);

CREATE UNIQUE INDEX "questions_scenario_id_ordinal_key"
    ON "questions"("scenario_id", "ordinal");
CREATE INDEX "questions_scenario_id_idx" ON "questions"("scenario_id");

ALTER TABLE "questions" ADD CONSTRAINT "questions_scenario_id_fkey"
    FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "answer_keys" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "expected_json" JSONB NOT NULL,
    "debrief_md" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "answer_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "answer_keys_question_id_key"
    ON "answer_keys"("question_id");

ALTER TABLE "answer_keys" ADD CONSTRAINT "answer_keys_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "questions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "attempts" (
    "id" UUID NOT NULL,
    "scenario_id" UUID NOT NULL,
    "trainee_user_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "total_score" DOUBLE PRECISION,
    "max_score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- max_score must be positive; total_score (when set) must be in [0, max].
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_max_score_positive"
    CHECK ("max_score" > 0);
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_total_score_bounds"
    CHECK ("total_score" IS NULL OR ("total_score" >= 0 AND "total_score" <= "max_score"));
-- locked implies submitted_at is set.
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_locked_implies_submitted"
    CHECK (NOT "locked" OR "submitted_at" IS NOT NULL);

-- One attempt per (scenario, trainee) in M5.
CREATE UNIQUE INDEX "attempts_scenario_id_trainee_user_id_key"
    ON "attempts"("scenario_id", "trainee_user_id");
CREATE INDEX "attempts_trainee_user_id_idx" ON "attempts"("trainee_user_id");

ALTER TABLE "attempts" ADD CONSTRAINT "attempts_scenario_id_fkey"
    FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_trainee_user_id_fkey"
    FOREIGN KEY ("trainee_user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "attempt_answers" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "response_json" JSONB,
    "auto_score" DOUBLE PRECISION,
    "auto_outcome" "AutoScoreOutcome",
    "manual_score" DOUBLE PRECISION,
    "instructor_notes_md" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attempt_answers_pkey" PRIMARY KEY ("id")
);

-- Auto/manual scores must be in [0, 1] when present.
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_auto_score_bounds"
    CHECK ("auto_score" IS NULL OR ("auto_score" >= 0 AND "auto_score" <= 1));
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_manual_score_bounds"
    CHECK ("manual_score" IS NULL OR ("manual_score" >= 0 AND "manual_score" <= 1));

CREATE UNIQUE INDEX "attempt_answers_attempt_id_question_id_key"
    ON "attempt_answers"("attempt_id", "question_id");
CREATE INDEX "attempt_answers_attempt_id_idx" ON "attempt_answers"("attempt_id");

ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_id_fkey"
    FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "questions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
