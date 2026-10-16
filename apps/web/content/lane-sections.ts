import type { Lane } from "@ci-train/contracts";

// The challenge library's training progression — recommended start →
// host & device → triage → findings. Shared by the library page
// (/scenarios) and the public landing page (/). Keep the lane order
// inside each section as the canonical reading order; a new Lane enum
// value that isn't listed here falls into an "Other" section on the
// library page so it never silently disappears.

export interface LaneSectionConfig {
  key: string;
  title: string;
  description: string;
  laneSlugs: readonly Lane[];
}

export const LANE_SECTIONS: readonly LaneSectionConfig[] = [
  {
    key: "recommended-start",
    title: "Recommended Start",
    description:
      "Begin here. Short scenarios that warm you up on the platform and lay down the DF fundamentals every later lane builds on.",
    laneSlugs: ["ojt_bridge", "foundations"],
  },
  {
    key: "host-device-forensics",
    title: "Host & Device Forensics",
    description:
      "Per-OS and per-device artifact triage — Windows, Linux, macOS, mobile extractions, memory images, and removable-media spillage cases.",
    laneSlugs: [
      "windows_artifacts",
      "linux_forensics",
      "macos_forensics",
      "mobile_forensics",
      "memory_forensics",
      "removable_media_spillage",
    ],
  },
  {
    key: "cyber-triage",
    title: "Cyber Triage",
    description:
      "Reading inbound telemetry without over-claiming — email + BEC, network logs, malware samples, insider-risk indicators, signals awareness.",
    laneSlugs: [
      "email_bec",
      "network_logs",
      "malware_analysis",
      "anti_forensics",
      "cloud_forensics",
      "insider_risk",
      "rf_awareness",
    ],
  },
  {
    key: "findings-evidence",
    title: "Findings & Evidence",
    description:
      "Turning what the artifacts prove into custody-clean, defensible written findings.",
    laneSlugs: ["evidence_handling", "report_writing"],
  },
];
