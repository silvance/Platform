-- M2: scenarios + scenario_briefs

-- CreateEnum
CREATE TYPE "SkillArea" AS ENUM (
    'email_headers',
    'bec',
    'df_artifacts',
    'removable_media',
    'windows_artifacts',
    'network_logs',
    'account_compromise',
    'rf_awareness',
    'report_writing',
    'inference_discipline'
);

-- CreateEnum
CREATE TYPE "ScenarioStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "ScenarioSource" AS ENUM ('authored', 'imported');

-- CreateTable
CREATE TABLE "scenarios" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(1000) NOT NULL,
    "skill_areas" "SkillArea"[],
    "difficulty" INTEGER NOT NULL,
    "estimated_minutes" INTEGER,
    "author_user_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ScenarioStatus" NOT NULL DEFAULT 'draft',
    "source" "ScenarioSource" NOT NULL DEFAULT 'authored',
    "imported_pack_hash" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- Enforce 1..5 at the DB layer too, not only in the API.
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_difficulty_range"
    CHECK ("difficulty" BETWEEN 1 AND 5);

-- CreateIndex
CREATE UNIQUE INDEX "scenarios_slug_key" ON "scenarios"("slug");

-- CreateIndex
CREATE INDEX "scenarios_status_idx" ON "scenarios"("status");

-- CreateIndex (GIN for array contains queries on skill_areas + tags)
CREATE INDEX "scenarios_skill_areas_idx" ON "scenarios" USING GIN ("skill_areas");
CREATE INDEX "scenarios_tags_idx" ON "scenarios" USING GIN ("tags");

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_author_user_id_fkey"
    FOREIGN KEY ("author_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "scenario_briefs" (
    "id" UUID NOT NULL,
    "scenario_id" UUID NOT NULL,
    "markdown_body" TEXT NOT NULL,
    "disclaimer_md" TEXT,

    CONSTRAINT "scenario_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scenario_briefs_scenario_id_key" ON "scenario_briefs"("scenario_id");

-- AddForeignKey
ALTER TABLE "scenario_briefs" ADD CONSTRAINT "scenario_briefs_scenario_id_fkey"
    FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
