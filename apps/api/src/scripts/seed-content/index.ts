import type { ScenarioSeed } from "./types";
import { OJT_BRIDGE_SCENARIOS } from "./ojt-bridge";
import { ANALYST_ON_RAMP_SCENARIOS } from "./on-ramp";
import { BEGINNER_SCENARIOS } from "./beginner";
import { BEC_SCENARIOS } from "./bec";
import { PHISHING_SCENARIOS } from "./phishing";
import { DFIR_SCENARIOS } from "./dfir";
import { WINDOWS11_SCENARIOS } from "./windows11";
import { LINUX_FORENSICS_SCENARIOS } from "./linux";
import { MACOS_FORENSICS_SCENARIOS } from "./macos";
import { INSIDER_SCENARIOS } from "./insider";
import { RF_AWARENESS_SCENARIOS } from "./rf-awareness";
import { REPORT_WRITING_SCENARIOS } from "./report-writing";
import { NETWORK_LOGS_SCENARIOS } from "./network-logs";
import { MEMORY_FORENSICS_SCENARIOS } from "./memory";
import { MOBILE_FORENSICS_SCENARIOS } from "./mobile";
import { EVIDENCE_HANDLING_SCENARIOS } from "./evidence-handling";

// Single combined catalogue. Order is family-grouped, with each
// family's polished (status undefined → "published") entries
// first and its draft entries after — the seed script writes
// them in this order, and the API's list endpoints show
// published-only to regular users, so the order also doubles
// as the user-visible launch curation.

export const SCENARIOS: ScenarioSeed[] = [
  // OJT Bridge leads. Short bridge scenarios for new CDTIs who
  // have completed introductory coursework (INCH / CIRC /
  // WFE-A / AXIOM). Foundations + every later lane assumes the
  // bridge has been crossed.
  ...OJT_BRIDGE_SCENARIOS,
  // The earlier "Analyst On-Ramp" entries ship `status:
  // "archived"` and are kept here so the seed idempotently
  // demotes them on each reseed (rather than orphaning them in
  // the DB). They no longer appear in the user-facing list.
  ...ANALYST_ON_RAMP_SCENARIOS,
  // Beginner family — Foundations-tier scenarios.
  ...BEGINNER_SCENARIOS,
  ...BEC_SCENARIOS,
  ...PHISHING_SCENARIOS,
  ...DFIR_SCENARIOS,
  ...WINDOWS11_SCENARIOS,
  ...LINUX_FORENSICS_SCENARIOS,
  ...MACOS_FORENSICS_SCENARIOS,
  ...INSIDER_SCENARIOS,
  ...NETWORK_LOGS_SCENARIOS,
  ...MEMORY_FORENSICS_SCENARIOS,
  ...MOBILE_FORENSICS_SCENARIOS,
  ...RF_AWARENESS_SCENARIOS,
  ...EVIDENCE_HANDLING_SCENARIOS,
  ...REPORT_WRITING_SCENARIOS,
];

export type { ScenarioSeed };
