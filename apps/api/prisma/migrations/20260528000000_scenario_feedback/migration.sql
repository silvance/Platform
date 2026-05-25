-- scenario_feedback: free-form post-challenge feedback users leave
-- on a solve view. Visible to admins only. Many rows per user per
-- scenario allowed (the same student may leave feedback on multiple
-- runs through the same challenge).
--
--   rating  is nullable 1..5; body is required text up to 2000 chars.
--   No edit / delete — feedback is append-only.
--
-- Indexed for the admin "all feedback newest-first" listing, and for
-- the per-scenario filter on /admin/feedback?scenario=<slug>.

CREATE TABLE "scenario_feedback" (
  "id"          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "scenario_id" UUID         NOT NULL,
  "user_id"     UUID         NOT NULL,
  "rating"      INTEGER,
  "body"        VARCHAR(2000) NOT NULL,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "scenario_feedback_rating_range"
    CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5)),

  CONSTRAINT "scenario_feedback_body_nonempty"
    CHECK (length(btrim("body")) > 0),

  CONSTRAINT "scenario_feedback_scenario_fk"
    FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE,

  CONSTRAINT "scenario_feedback_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "scenario_feedback_created_at_idx"
  ON "scenario_feedback" ("created_at" DESC);

CREATE INDEX "scenario_feedback_scenario_created_idx"
  ON "scenario_feedback" ("scenario_id", "created_at" DESC);
