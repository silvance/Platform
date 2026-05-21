-- M5 audit fix #4: DB-level cap on questions.prompt_md (5000 chars,
-- matching MAX_PROMPT_MD_CHARS in @ci-train/contracts). Defense in
-- depth — the contract already validates incoming payloads, but the
-- CHECK protects against direct DB writes (seed/import paths,
-- pg_restore, hand-edits).
ALTER TABLE "questions" ADD CONSTRAINT "questions_prompt_md_length"
    CHECK (char_length("prompt_md") <= 5000);
