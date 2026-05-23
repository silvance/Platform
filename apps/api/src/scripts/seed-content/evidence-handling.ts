import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// Evidence-handling lane. Reviewer-eye exercises against
// custody-document extracts and storage scenarios. Form completion
// is out of scope; the goal is to identify documentation gaps and
// pick the right corrective steps.

export const EVIDENCE_HANDLING_SCENARIOS: ScenarioSeed[] = [
  // ─── 1. Sealed-container handling — spot the break ─────────
  {
    slug: "evidence-sealed-container-break-001",
    title: "Evidence Handling: Sealed-Container Break",
    summary:
      "A short narrative of an evidence container moving through transfers contains two seal/tag hygiene issues. Find them.",
    skillAreas: ["report_writing", "inference_discipline", "df_artifacts"],
    difficulty: 1,
    estimatedMinutes: 10,
    tags: ["evidence_handling", "chain_of_custody", "inference_discipline"],
    lane: "evidence_handling",
    module: "Container handling",
    sequence: 1,
    brief: `
# Brief

A short narrative of an evidence container moving from scene to
transport to lab and back. The container holds three small items
listed as a single line on the receipt. Two of the transfer
notes describe seal- or tag-hygiene issues — find them.

Two principles to keep in mind:

- **Tamper-evidence.** A broken seal is not by itself fatal, but
  if a seal is reopened during an authorised step (re-inspection,
  laboratory analysis, etc.), the *resealer* must reseal in
  tamper-evident packaging and write their initials + date across
  the new seals. A reseal whose origin can't be attributed is a
  break in the document trail.
- **Per-item identification.** When several items are grouped in
  a single sealed bag, the seal protects the *group*. The
  individual items also need identification (a tag tied to each
  item, or an internal manifest sealed with the bag) so a later
  reviewer can match an examined item to the document entry.
  Affixing only the outer-bag tag without identifying the items
  inside leaves a re-association gap.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "container-handling-narrative.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "TRAINING EXTRACT — FICTIONAL DATA",
            "Container handling narrative for evidence container EB-2026-0407",
            "Items grouped: (1) USB drive, (2) microSD card, (3) phone charging cable",
            "================================================================",
            "",
            "Transfer 1  (Collection at scene, 2026-04-07 09:10 UTC)",
            "  Released by: M. CALDWELL (collecting agent)",
            "  Received by: SGT R. OLEKOWSKI (transport NCO)",
            "  Notes: Items placed together in tamper-evident bag EB-2026-0407.",
            "         A single DA Form 4002 tag (#EB-2026-0407) was affixed to",
            "         the outer bag. No individual tags were attached to the",
            "         items inside the bag. M. CALDWELL initialed the seal.",
            "",
            "Transfer 2  (Lab intake, 2026-04-07 11:35 UTC)",
            "  Released by: SGT R. OLEKOWSKI",
            "  Received by: T. ABRAMOV (lab intake examiner)",
            "  Notes: Bag EB-2026-0407 received intact. Seal initials \"M.C.\"",
            "         verified before signing. Items not re-inventoried at",
            "         intake (verification deferred to examination).",
            "",
            "Transfer 3  (Re-inspection by lead examiner, 2026-04-07 14:50 UTC)",
            "  Released by: T. ABRAMOV",
            "  Received by: DR. M. LIU (lead examiner)",
            "  Notes: Outer seal on bag EB-2026-0407 cut by DR. M. LIU for",
            "         re-inspection of contents. Contents re-bagged in a fresh",
            "         tamper-evident bag (EB-2026-0407-A). New seal applied.",
            "         No initials or date written across the new seal.",
            "",
            "Transfer 4  (Return to evidence room, 2026-04-07 16:05 UTC)",
            "  Released by: DR. M. LIU",
            "  Received by: T. ABRAMOV",
            "  Notes: Bag EB-2026-0407-A received intact (per visual",
            "         inspection of the new seal). Returned to evidence room",
            "         locker.",
            "",
          ].join("\n"),
        ),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which statements about the narrative are accurate?",
        options: [
          {
            id: "reseal-unattributed",
            label:
              "Transfer 3 records a reseal of the contents into a new bag, but no initials or date were written across the new seal. The reseal is therefore not attributed on the face of the document.",
          },
          {
            id: "item-id-missing",
            label:
              "At collection, only the outer-bag tag was affixed. The three items inside the bag have no per-item identifiers (no individual tags, no internal manifest). A later examiner cannot match an examined item back to the document without that identifier.",
          },
          {
            id: "no-collection-record",
            label:
              "The collection event is missing from the narrative.",
          },
          {
            id: "intake-skipped-inventory",
            label:
              "Lab intake deferred per-item inventory — this is a fatal break in custody.",
          },
          {
            id: "seal-broken-fatal",
            label:
              "The outer seal was cut at re-inspection — this fact alone breaks the custody chain.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["reseal-unattributed", "item-id-missing"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Accurate:**",
          "",
          "- *Unattributed reseal* — when a seal is cut for an authorised purpose, the resealer must initial and date the new seal. Without those marks, a later reviewer cannot tell who applied the new seal or when, which weakens the *tamper-evident* property the reseal was supposed to restore.",
          "- *Missing per-item identification* — a single bag tag protects the **group** at the boundary, but the document then has no way to say \"the device examined in the report is the same device entered on line 2.\" Internal tags or a sealed manifest closes that gap.",
          "",
          "**Not accurate:**",
          "",
          "- *Missing collection* — Transfer 1 documents collection.",
          "- *Deferred inventory* — deferring per-item inventory to examination is a workflow choice, not a chain break, *provided* the items are identifiable. (The real problem there is the per-item-identification gap above.)",
          "- *Cut seal = fatal* — cutting the seal for an authorised step is fine when the resealer attributes the new seal. The cut itself isn't the break; the silent reseal is.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which corrective steps best fit these issues before any downstream report cites this narrative?",
        options: [
          {
            id: "mfr-reseal",
            label:
              "DR. M. LIU writes a Memorandum For Record describing the reseal (purpose, time, contents) and attaches it to the document. The new seal on EB-2026-0407-A is initialed and dated at that point — if it isn't already.",
          },
          {
            id: "internal-manifest",
            label:
              "On the first opportunity the items are individually tagged or a sealed internal manifest is created and the receipt is annotated.",
          },
          {
            id: "destroy-restart",
            label:
              "Destroy the original bag and start the chain over from collection.",
          },
          {
            id: "retro-sign-original",
            label:
              "Have M. CALDWELL retroactively initial each item inside the bag.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["mfr-reseal", "internal-manifest"],
          allowMultiple: true,
        },
        debriefMd:
          "Document what happened, document what was done about it, and add the per-item identifiers going forward. \"Start over\" isn't an option (the items already exist and have a partial chain). Retroactive initials inside a previously-sealed bag don't help — M. CALDWELL can only attest to what they personally observed at collection, not to anything that happened after the seal closed.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the narrative AS-IS is ready to support a referenced finding in a downstream report.",
        expected: { type: "confidence", expectedRange: [1, 3] },
        debriefMd:
          "**Low.** The chain isn't fatally broken — two of the four transfers attest cleanly — but the unattributed reseal and the per-item-identification gap both invite challenge. Both are cheap to close (an MFR and an internal manifest / per-item tag); do that before referencing the narrative anywhere downstream.",
      },
    ],
  },

  // ─── 2. Closing a custody gap with an MFR ─────────────────
  {
    slug: "evidence-custody-gap-mfr-001",
    title: "Evidence Handling: Closing a Custody Gap",
    summary:
      "A custody narrative has a documented overnight gap. Pick the corrective artefact and the right one-paragraph summary for the MFR.",
    skillAreas: ["report_writing", "inference_discipline", "df_artifacts"],
    difficulty: 2,
    estimatedMinutes: 12,
    tags: ["evidence_handling", "chain_of_custody", "mfr", "report_writing"],
    lane: "evidence_handling",
    module: "Custody documents",
    sequence: 2,
    brief: `
# Brief

A custody narrative has a documented gap — the item sat in a
shared overnight locker between two transfers, with no named
acting custodian for the locker period. The reviewer's task
isn't to paper the gap over; it's to close it the right way.

Two questions follow:

1. Which **corrective artefact(s)** actually close the gap?
2. Which **one-paragraph summary** belongs on the Memorandum For
   Record that accompanies the artefact and goes into the case
   file with the custody document?

The right MFR describes what happened, describes what was done
about it, and cites the artefact — without speculation and
without minimising the gap.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "custody-narrative.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "TRAINING EXTRACT — FICTIONAL DATA",
            "Custody narrative — item OBJ-2026-104-A (sealed device bag)",
            "================================================================",
            "",
            "Transfer 1  (Collection → transport)",
            "  Date / time:  2026-08-12 17:45 UTC",
            "  Released by:  T. NAKAMURA (collecting agent)",
            "  Received by:  SSG D. WERNER (transport NCO)",
            "  Notes:        Bag #B-1101 sealed in T. NAKAMURA's presence.",
            "",
            "Transfer 2  (Transport → overnight storage)",
            "  Date / time:  2026-08-12 18:30 UTC",
            "  Released by:  SSG D. WERNER",
            "  Received by:  Overnight Locker 4 (shared evidence room)",
            "  Signature:    N/A",
            "  Notes:        Bag #B-1101 intact at placement.",
            "",
            "  --- overnight ---",
            "",
            "Transfer 3  (Overnight storage → lab intake)",
            "  Date / time:  2026-08-13 09:10 UTC",
            "  Released by:  Overnight Locker 4 (shared evidence room)",
            "  Signature:    N/A",
            "  Received by:  P. ALVARES (lab intake)",
            "  Notes:        Bag #B-1101 intact at receipt; tag verified.",
            "",
            "Open follow-ups noted by P. ALVARES at intake:",
            "  - The overnight period (~14h 40m) has no named acting custodian.",
            "  - The shared evidence room has a keycard-logged door; the door-",
            "    access log for that window is available on request.",
            "  - The room's daily duty roster names a duty NCO who is",
            "    accountable for the locker room each shift.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "candidate-artifacts.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Candidate corrective artefacts under consideration",
            "--------------------------------------------------",
            "",
            "  A. The keycard / door-access log for the evidence room during",
            "     the 2026-08-12T18:30Z → 2026-08-13T09:10Z window.",
            "  B. The unit's daily duty roster naming the on-shift duty NCO",
            "     accountable for the evidence room overnight.",
            "  C. A retroactive signature from SSG D. WERNER attesting that",
            "     they checked the locker again at 03:00.",
            "  D. A photograph of the sealed bag taken at lab intake.",
            "  E. A general statement from the evidence-room supervisor that",
            "     \"all items in the locker were undisturbed overnight.\"",
            "",
          ].join("\n"),
        ),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which of the candidate artefacts are useful for documenting the overnight gap?",
        options: [
          {
            id: "door-log",
            label:
              "A — the keycard / door-access log for the gap window.",
          },
          {
            id: "duty-roster",
            label:
              "B — the duty roster naming the duty NCO accountable for the room.",
          },
          {
            id: "retro-sig",
            label:
              "C — a retroactive signature from SSG WERNER.",
          },
          {
            id: "photo-intake",
            label:
              "D — a photograph of the sealed bag at intake.",
          },
          {
            id: "general-stmt",
            label:
              "E — a general supervisor statement that everything was undisturbed.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["door-log", "duty-roster"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Useful:**",
          "",
          "- *Door-access log* — corroborates the locker-period accountability. It either shows no access (the gap closes cleanly) or names every person who entered (each becomes a follow-up).",
          "- *Duty roster* — names a person accountable for the room during the shift. Combined with the keycard log it covers the *who-was-on-duty + who-entered* question the gap raises.",
          "",
          "**Not useful:**",
          "",
          "- *Retroactive signature* — a witness can only attest to what they personally observed. SSG WERNER didn't observe the locker overnight; a backdated check note has no probative value.",
          "- *Photograph at intake* — only documents the **end state** of the seal. It says nothing about what happened during the unattested window.",
          "- *General supervisor statement* — broad statements about \"all items\" without specific observation of the bag during the window are not corrective; they are filler.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which one-paragraph summary is appropriate for the MFR that will accompany the custody document into the case file?",
        options: [
          {
            id: "summary-good",
            label:
              "\"Item OBJ-2026-104-A (bag #B-1101) was placed in shared Overnight Locker 4 at 2026-08-12T18:30Z and released to lab intake at 2026-08-13T09:10Z. No named acting custodian signed for the item during this ~14h 40m period. The keycard / door-access log for the evidence room across this window and the duty roster naming the on-shift duty NCO are attached for the case file. Bag and tag were observed intact at intake.\"",
          },
          {
            id: "summary-minimising",
            label:
              "\"There was a small administrative gap overnight, which is normal procedure for items held in evidence storage; no action required.\"",
          },
          {
            id: "summary-speculative",
            label:
              "\"It is suspected that the item was undisturbed overnight; no one would have had a motive to access the locker.\"",
          },
          {
            id: "summary-vague",
            label:
              "\"Item placed in locker. Door log attached. Chain intact.\"",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["summary-good"],
          allowMultiple: false,
        },
        debriefMd:
          "The right MFR names the period, names what is missing on the face of the document, names the corroborating artefact, and reports the observed end state — no minimising, no speculation about intent, no vagueness. The other three summaries fail in different ways: minimising the gap (and inventing \"normal procedure\" as cover), speculating about motive, or being too brief to actually document anything.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that, with the door-access log + duty roster attached and an MFR written as above, the custody document is sufficient to support a downstream forensic exam.",
        expected: { type: "confidence", expectedRange: [3, 5] },
        debriefMd:
          "**4 (or thereabouts).** The gap is now documented and corroborated. A reviewing attorney can read the document, read the MFR, and verify the corroborating artefacts. That's the disciplined response to a gap. Hold at 4 unless the door log itself raises new questions (e.g., it shows unexplained access events), in which case those become their own follow-up.",
      },
    ],
  },
];
