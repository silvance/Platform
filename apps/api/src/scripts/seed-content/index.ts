import type { ScenarioSeed } from "./types";
import { ANALYST_ON_RAMP_SCENARIOS } from "./on-ramp";
import { BEGINNER_SCENARIOS } from "./beginner";
import { BEC_SCENARIOS } from "./bec";
import { PHISHING_SCENARIOS } from "./phishing";
import { DFIR_SCENARIOS } from "./dfir";
import { WINDOWS11_SCENARIOS } from "./windows11";
import { INSIDER_SCENARIOS } from "./insider";
import { RF_AWARENESS_SCENARIOS } from "./rf-awareness";
import { REPORT_WRITING_SCENARIOS } from "./report-writing";
import { NETWORK_LOGS_SCENARIOS } from "./network-logs";
import { MOBILE_FORENSICS_SCENARIOS } from "./mobile";
import { EVIDENCE_HANDLING_SCENARIOS } from "./evidence-handling";

// Single combined catalogue. Order is family-grouped, with each
// family's polished (status undefined → "published") entries
// first and its draft entries after — the seed script writes
// them in this order, and the API's list endpoints show
// published-only to regular users, so the order also doubles
// as the user-visible launch curation.

export const SCENARIOS: ScenarioSeed[] = [
  // Analyst On-Ramp leads. Lowest-difficulty lane in the
  // catalogue — for students whose baseline is closer to A+ /
  // DC3-Intro than analytic forensic experience. Foundations
  // assumes the inference-discipline frame; the on-ramp builds
  // it.
  ...ANALYST_ON_RAMP_SCENARIOS,
  // Beginner family next — the on-ramp for students with an
  // intro-DF background. Foundations-tier scenarios surfaced
  // toward the top of /scenarios after the on-ramp.
  ...BEGINNER_SCENARIOS,
  ...BEC_SCENARIOS,
  ...PHISHING_SCENARIOS,
  ...DFIR_SCENARIOS,
  ...WINDOWS11_SCENARIOS,
  ...INSIDER_SCENARIOS,
  ...NETWORK_LOGS_SCENARIOS,
  ...MOBILE_FORENSICS_SCENARIOS,
  ...RF_AWARENESS_SCENARIOS,
  ...EVIDENCE_HANDLING_SCENARIOS,
  ...REPORT_WRITING_SCENARIOS,
];

export type { ScenarioSeed };
