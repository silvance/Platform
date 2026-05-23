import type { ScenarioSeed } from "./types";
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
  ...BEC_SCENARIOS,
  ...PHISHING_SCENARIOS,
  ...DFIR_SCENARIOS,
  ...INSIDER_SCENARIOS,
  ...RF_AWARENESS_SCENARIOS,
  ...REPORT_WRITING_SCENARIOS,
];

export type { ScenarioSeed };
