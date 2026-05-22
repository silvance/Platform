-- M8 follow-up — strip the answer-key copy out of Question.optionsJson
-- for text_match rows. The acceptableAnswers list lives exclusively on
-- the AnswerKey.expectedJson now; mirroring it into options_json was a
-- latent leak risk if any future endpoint surfaces more of the options
-- payload to non-author roles.
--
-- Idempotent: jsonb `- key` returns the original value unchanged when
-- the key is absent. Safe to re-run.

UPDATE "questions"
   SET "options_json" = "options_json" - 'acceptableAnswers'
 WHERE "type" = 'text_match'
   AND "options_json" ? 'acceptableAnswers';
