-- M3: artifacts table

-- CreateEnum
CREATE TYPE "ArtifactKind" AS ENUM ('text', 'csv', 'json', 'pdf', 'image');

-- CreateTable
CREATE TABLE "artifacts" (
    "id" UUID NOT NULL,
    "scenario_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "kind" "ArtifactKind" NOT NULL,
    "relative_path" VARCHAR(400) NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "viewer_hint" VARCHAR(60),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- Sanity constraints. Sha256 must be 64 hex chars (Prisma's CHAR(64) only
-- enforces length, not encoding). Size must be non-negative.
ALTER TABLE "artifacts"
  ADD CONSTRAINT "artifacts_sha256_format"
    CHECK ("sha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "artifacts"
  ADD CONSTRAINT "artifacts_size_nonneg"
    CHECK ("size_bytes" >= 0);

-- Ordinal stays unique per scenario so the UI can render a deterministic tab order.
CREATE UNIQUE INDEX "artifacts_scenario_id_ordinal_key" ON "artifacts"("scenario_id", "ordinal");
CREATE INDEX "artifacts_scenario_id_idx" ON "artifacts"("scenario_id");

ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_scenario_id_fkey"
    FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
