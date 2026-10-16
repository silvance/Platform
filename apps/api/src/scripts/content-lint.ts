import { SCENARIOS } from "./seed-content";
import {
  formatLintMarkdown,
  formatLintText,
  lintScenarios,
} from "./seed-content/lint";

// Content-quality lint over the seed catalogue (warnings, not errors;
// see seed-content/lint.ts for the rules).
//
// Usage:
//   pnpm --filter @ci-train/api content:lint              # readable report
//   pnpm --filter @ci-train/api content:lint --markdown   # edit list as Markdown
//   pnpm --filter @ci-train/api content:lint --strict     # exit 1 on findings

const args = process.argv.slice(2);
const findings = lintScenarios(SCENARIOS);

// eslint-disable-next-line no-console
console.log(args.includes("--markdown") ? formatLintMarkdown(findings) : formatLintText(findings));

if (args.includes("--strict") && findings.length > 0) process.exitCode = 1;
