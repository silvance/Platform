-- Rename the "Analyst On-Ramp" lane to "OJT Bridge". The previous
-- on-ramp framing (A+ / DC3-Intro audience) was too entry-level
-- for the actual cohort, which has completed INCH, CIRC, and
-- WFE-A/AXIOM. The bridge name + content target the right gap:
-- familiar tool outputs translated into evidence-safe findings.
--
-- Postgres 10+ supports renaming enum values in place; existing
-- rows pointing at the old value keep working without a data
-- migration. Any scenarios still tagged with the old lane are
-- archived in the same seed pass so they stop showing up in the
-- user-facing list (per the new audience).

ALTER TYPE "Lane" RENAME VALUE 'analyst_on_ramp' TO 'ojt_bridge';
