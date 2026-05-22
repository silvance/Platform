-- M8 — drop the deprecated short_answer / long_answer values from the
-- QuestionType enum. M7 left them in for back-compat (Postgres can't
-- ALTER TYPE ... DROP VALUE), but the contract and API have refused to
-- create such questions since M7. With authoring landing in M8, hiding
-- two impossible values from the admin UI is cleaner than carrying
-- them as ghosts forever.
--
-- Strategy: create a new enum with only the supported values, delete
-- any stale rows of the deprecated types (defense in depth — there
-- shouldn't be any in seed data, but a beta DB could carry rows from
-- an earlier seed run), drop the existing CHECK constraint that
-- references enum literals on the column, swap the column type, drop
-- the old enum, then re-add the CHECK constraint (now bound to the
-- replacement enum).
--
-- Destructive on stale rows by design. Beta-only milestone.

DELETE FROM "questions" WHERE "type" IN ('short_answer', 'long_answer');

-- The questions_indicator_set_required_for_indicators CHECK is
-- type-bound: it references 'select_indicators' as an enum literal.
-- We have to drop it before swapping the column type and re-add it
-- after — Postgres re-resolves enum literals against the column type
-- at constraint creation, so the new constraint will bind to the
-- replacement enum.
ALTER TABLE "questions"
  DROP CONSTRAINT "questions_indicator_set_required_for_indicators";

CREATE TYPE "QuestionType_new" AS ENUM (
  'multi_choice',
  'confidence',
  'select_indicators',
  'text_match'
);

ALTER TABLE "questions"
  ALTER COLUMN "type" TYPE "QuestionType_new"
  USING ("type"::text::"QuestionType_new");

DROP TYPE "QuestionType";
ALTER TYPE "QuestionType_new" RENAME TO "QuestionType";

ALTER TABLE "questions" ADD CONSTRAINT "questions_indicator_set_required_for_indicators"
    CHECK (
      ("type" = 'select_indicators' AND "indicator_set_id" IS NOT NULL)
      OR
      ("type" <> 'select_indicators' AND "indicator_set_id" IS NULL)
    );
