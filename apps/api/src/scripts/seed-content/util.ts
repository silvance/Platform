// Shared helpers for building seed artifact bytes. Keeping these
// out of seed.ts lets the scenarios file pull them in without
// reaching into the Prisma orchestration module.

export function utf8(s: string): Buffer {
  return Buffer.from(s, "utf-8");
}

// A minimal but valid 1x1 transparent PNG. Tiny enough to embed
// inline; big enough to prove the image-viewer dispatch works
// end-to-end. Suitable for placeholder photographs that the
// scenario text describes — the exercise is never to identify
// anything from the image bytes.
export const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export function tinyPngBytes(): Buffer {
  return Buffer.from(TINY_PNG_BASE64, "base64");
}

// A minimal valid one-page PDF rendered with a single line of
// text. Hand-built to keep the seed self-contained (no PDF
// library dependency). Renders in any standards-compliant
// viewer.
export function buildTinyPdf(text = "ci-train seed PDF artifact"): Buffer {
  // Strip parentheses defensively — PDF strings use them as
  // delimiters. Anything else printable is fine.
  const safeText = text.replace(/[()]/g, "");
  const stream = `BT /F1 24 Tf 60 720 Td (${safeText}) Tj ET`;
  const streamBytes = Buffer.from(stream, "ascii");

  const objects: string[] = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj\n",
    `4 0 obj << /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
  ];
  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  let cursor = Buffer.byteLength(header, "binary");
  for (const o of objects) {
    offsets.push(cursor);
    cursor += Buffer.byteLength(o, "binary");
  }
  const xrefOffset = cursor;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.concat([
    Buffer.from(header, "binary"),
    ...objects.map((o) => Buffer.from(o, "binary")),
    Buffer.from(xref, "binary"),
    Buffer.from(trailer, "binary"),
  ]);
}

// RF-awareness scenarios share the same disclaimer so the legal /
// scope framing is identical across the family.
export const RF_AWARENESS_DISCLAIMER = `
> **Awareness module — not TSCM training.** This scenario builds
> investigative judgement around RF observations. It does **not**
> qualify you to conduct TSCM sweeps, evaluate device presence,
> or render technical findings on RF threats. When in doubt,
> escalate to qualified TSCM personnel and document observations
> conservatively.
`.trim();
