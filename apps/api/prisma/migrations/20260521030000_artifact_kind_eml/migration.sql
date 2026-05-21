-- M4: extend ArtifactKind with eml.
-- Postgres ENUM is append-only via ALTER TYPE ... ADD VALUE — irreversible
-- in a single transaction (so we leave the rollback path as a manual
-- DDL recipe rather than embedding it here).
ALTER TYPE "ArtifactKind" ADD VALUE 'eml';
