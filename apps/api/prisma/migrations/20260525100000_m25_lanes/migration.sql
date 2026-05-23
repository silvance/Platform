-- M25: curated challenge-library structure.
--
-- Add `lane` (Postgres enum), `module` (free-text), and `sequence`
-- (integer) to scenarios. Existing rows back-fill to lane
-- "foundations" and sequence 0; the seed re-asserts the real
-- (lane, module, sequence) values on its next run, and an admin
-- can re-bucket via the authoring editor in the meantime.

CREATE TYPE "Lane" AS ENUM (
  'foundations',
  'email_bec',
  'windows_artifacts',
  'removable_media_spillage',
  'insider_risk',
  'network_logs',
  'rf_awareness',
  'evidence_handling',
  'report_writing'
);

ALTER TABLE "scenarios"
  ADD COLUMN "lane"     "Lane"        NOT NULL DEFAULT 'foundations',
  ADD COLUMN "module"   VARCHAR(120),
  ADD COLUMN "sequence" INTEGER       NOT NULL DEFAULT 0;

CREATE INDEX "scenarios_lane_sequence_idx"
  ON "scenarios" ("lane", "sequence");
