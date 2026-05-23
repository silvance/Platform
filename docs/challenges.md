# Challenge library

The seed populates a curated set of challenges grouped into two
tiers:

- **Tier 1 (published)** — beta-ready. Strong briefs, multiple
  artifacts, 3–5 questions with substantive debriefs. Visible to
  every signed-in user.
- **Tier 2 (drafts)** — usable but lighter. Functional artifact +
  question wiring, decent debriefs. Visible only to admins (via
  `/admin/challenges`) so the regular-user catalogue stays
  curated.

Re-running the seed is idempotent — content is upserted by slug
on every run; questions, indicator sets, and artifacts are
replaced in place so an edit in a content file lands cleanly on
the next deploy.

## Content principles

Every challenge in the library obeys these rules:

- Static artifacts only — no live exploitation, no malware
  execution, no SDR integration, no operational TSCM procedure.
- Fictional and sanitized examples — no real classified content;
  domains use `.example` / `.local` / `.xyz` placeholders; people
  and orgs are invented.
- Inference-discipline beat — every challenge teaches the
  difference between **fact** (directly observable),
  **inference** (supported by artifacts but requires judgment),
  **assumption** (relied on, not yet verified), and **lead**
  (next investigative step).

## Catalogue (M16 launch set)

### Email / BEC / phishing

| Slug | Tier | Difficulty | Focus |
|---|---|---|---|
| `bec-vendor-redirect-001` | 1 | 2 | DKIM/DMARC fail + lookalike domain; wire-level evidence vs. social-engineering markers. |
| `phishing-header-path-001` | 1 | 2 | Auth-pass for a lookalike domain is the diagnostic — not a guarantee. Walk the Received chain. |
| `phishing-attachment-lure-001` | 1 | 2 | Static review of a CFB document labelled `.pdf` with a `Document_Open` macro. Runtime ≠ static. |
| `bec-w2-payroll-redirect-002` | 2 | 1 | W-2 direct-deposit redirect; SPF/DMARC fail; out-of-band verification. |
| `phishing-reply-to-mismatch-001` | 2 | 1 | Auth-pass for partner.example + Reply-To divergence = mailbox-rule / account-compromise lead. |
| `phishing-spoofed-display-name-001` | 2 | 1 | Auth-pass for `gmail.com` ≠ "from the CEO." |
| `phishing-lookalike-domain-001` | 2 | 1 | Subdomain stacking on a freshly-registered base domain. |
| `phishing-qr-code-static-001` | 2 | 1 | Decoded QR URL, static pivot, no live scanning. |

### Digital forensics / Windows artifacts

| Slug | Tier | Difficulty | Focus |
|---|---|---|---|
| `usb-carved-classified-doc-001` | 1 | 3 | Carving from unallocated space recovers bytes, not authorship. |
| `browser-download-execution-001` | 1 | 3 | Download is easy to prove; execution is not — absence of evidence isn't proof of absence. |
| `windows-execution-artifacts-001` | 1 | 3 | Prefetch / Amcache / Shimcache record different things; the Shimcache "executed" flag is a footgun. |
| `dfir-deleted-file-attribution-001` | 2 | 2 | Recycle-bin metadata names the deleting user, not the author. |
| `dfir-lnk-jumplist-mru-001` | 2 | 2 | LNK + jumplist agreement; UserAssist's absence is a weak signal. |

### Insider risk / CI reasoning

| Slug | Tier | Difficulty | Focus |
|---|---|---|---|
| `insider-file-access-timeline-001` | 1 | 3 | Bulk-download + USB mount overlap — anomaly, not finding. Name the missing artifact. |
| `insider-working-hours-pattern-001` | 2 | 2 | Off-hours logons explained by team's documented push hours; watch for divergence. |
| `insider-removable-media-with-sensitive-access-001` | 2 | 2 | Mount-with-open is suggestive; EDR file-write or portal log resolves it. |

### RF awareness

| Slug | Tier | Difficulty | Focus |
|---|---|---|---|
| `rf-awareness-clean-sweep-001` | 1 | 2 | Bounded observation language; absence of evidence ≠ evidence of absence. |
| `rf-awareness-suspicious-observation-001` | 2 | 2 | Escalation threshold to qualified TSCM personnel; observation ≠ conclusion. |

All RF-awareness scenarios carry the same explicit
"awareness module, not TSCM training" disclaimer.

### Report writing / testimony discipline

| Slug | Tier | Difficulty | Focus |
|---|---|---|---|
| `report-writing-ambiguous-evidence-001` | 1 | 3 | Mixed-evidence finding; sort sentences into fact / inference / assumption / lead. |
| `report-writing-classify-statements-001` | 2 | 1 | Classify a small list of writeup sentences by category. |
| `report-writing-presence-vs-execution-001` | 2 | 1 | Rewrite an overconfident "downloaded AND executed" sentence. |

## How tiering works in the code

- `apps/api/src/scripts/seed-content/*.ts` — one file per family.
- Each `ScenarioSeed` may set `status: "draft"` to opt into
  Tier 2; omitting the field defaults to `"published"`.
- The API's scenario list endpoint surfaces only published
  scenarios to users; admin endpoints see everything.
- `apps/api/src/scripts/seed-content/validate.ts` walks the
  catalogue before any DB write and fails loudly on broken
  cross-references (multi_choice correctIds not in options,
  select_indicators referencing missing indicator-sets,
  duplicate ordinals / slugs, etc.). Jest covers each rule.

## Adding a new challenge

1. Pick the right family file under `seed-content/`.
2. Append a new `ScenarioSeed` object — see the polished entries
   in `bec.ts` / `dfir.ts` for the full shape.
3. New challenges default to `status: "published"`; mark
   `status: "draft"` if it's not ready for the user-facing
   catalogue yet.
4. Run `pnpm --filter @ci-train/api test` — the validator spec
   will catch malformed wiring.
5. Run the seed against a dev DB; verify the challenge renders
   end-to-end (artifact tabs, question submission, debrief
   reveal on completion).
