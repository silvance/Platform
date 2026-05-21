-- M6 step 1/2: extend the QuestionType enum with `select_indicators`.
--
-- Postgres forbids using a newly-added enum value in the SAME transaction
-- that added it. So we land the value in this standalone migration, then
-- the next migration creates the tables and CHECK constraint that
-- reference it.
ALTER TYPE "QuestionType" ADD VALUE 'select_indicators';
