import type { ScenarioSeed } from "./types";
import { BEGINNER_SCENARIOS } from "./beginner";
import { BEC_SCENARIOS } from "./bec";
import { PHISHING_SCENARIOS } from "./phishing";
import { DFIR_SCENARIOS } from "./dfir";
import { INSIDER_SCENARIOS } from "./insider";
import { RF_AWARENESS_SCENARIOS } from "./rf-awareness";
import { REPORT_WRITING_SCENARIOS } from "./report-writing";

// Single combined catalogue. Order is family-grouped, with each
// family's polished (status undefined → "published") entries
// first and its draft entries after — the seed script writes
// them in this order, and the API's list endpoints show
// published-only to regular users, so the order also doubles
// as the user-visible launch curation.

export const SCENARIOS: ScenarioSeed[] = [
  // Beginner family lists first — these are the on-ramp for
  // students with only an intro-DF background, and surfacing
  // them at the top of the /scenarios list helps the right
  // audience find them fast.
  ...BEGINNER_SCENARIOS,
  ...BEC_SCENARIOS,
  ...PHISHING_SCENARIOS,
  ...DFIR_SCENARIOS,
  ...INSIDER_SCENARIOS,
  ...RF_AWARENESS_SCENARIOS,
  ...REPORT_WRITING_SCENARIOS,
];

export type { ScenarioSeed };
