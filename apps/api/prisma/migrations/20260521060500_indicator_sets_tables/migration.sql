-- M6 step 2/2: indicator_sets table + the questions.indicator_set_id
-- column + the type/FK CHECK constraint that references the
-- 'select_indicators' enum value added in 20260521060000.

CREATE TABLE "indicator_sets" (
    "id" UUID NOT NULL,
    "scenario_id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "source_artifact_id" UUID,
    "items_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indicator_sets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "indicator_sets_scenario_id_slug_key"
    ON "indicator_sets"("scenario_id", "slug");
CREATE INDEX "indicator_sets_scenario_id_idx"
    ON "indicator_sets"("scenario_id");

ALTER TABLE "indicator_sets" ADD CONSTRAINT "indicator_sets_scenario_id_fkey"
    FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "indicator_sets" ADD CONSTRAINT "indicator_sets_source_artifact_id_fkey"
    FOREIGN KEY ("source_artifact_id") REFERENCES "artifacts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "questions" ADD COLUMN "indicator_set_id" UUID;

CREATE INDEX "questions_indicator_set_id_idx"
    ON "questions"("indicator_set_id");

ALTER TABLE "questions" ADD CONSTRAINT "questions_indicator_set_id_fkey"
    FOREIGN KEY ("indicator_set_id") REFERENCES "indicator_sets"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Required-when-type matches; forbidden otherwise. We enforce both
-- directions so a misconfigured authoring path can't write a row
-- that the API would later 500 on. This CHECK references the
-- 'select_indicators' enum value added in the previous migration —
-- splitting into two files is what lets Postgres see it as committed.
ALTER TABLE "questions" ADD CONSTRAINT "questions_indicator_set_required_for_indicators"
    CHECK (
      ("type" = 'select_indicators' AND "indicator_set_id" IS NOT NULL)
      OR
      ("type" <> 'select_indicators' AND "indicator_set_id" IS NULL)
    );
