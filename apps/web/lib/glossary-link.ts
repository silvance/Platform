import { GLOSSARY, GLOSSARY_BY_ID } from "@/content/glossary";

// Inline glossary linking. Takes raw markdown, finds glossary
// terms / aliases (word-boundary, longest-first, case-insensitive)
// in non-code regions, and rewrites them as
// `[term](glossary:<term-id>)` Markdown links. The Markdown
// component's link renderer then swaps those for popovers via
// the GlossaryTerm component.
//
// Discipline:
//   - Only link the FIRST occurrence in any given source string.
//     Multiple links to the same term in one paragraph are noisy
//     and rarely useful.
//   - Skip text inside fenced code blocks (``` ... ```) and inline
//     code spans (`...`). Those regions are usually literal
//     artifact names and don't want pop-up explanations.
//   - Skip text already inside a markdown link `[...](...)`.
//   - Match alias spellings too -- "BAM" matches the BAM entry,
//     "background activity moderator" also matches it.

// Build the match regex once at module load. Patterns are sorted
// longest-first so e.g. "$STANDARD_INFORMATION vs $FILE_NAME"
// beats "$STANDARD_INFORMATION" beats "MFT".
const PATTERN_LIST: Array<{ pattern: string; termId: string }> = [];
for (const term of GLOSSARY) {
  const names = [term.term, ...(term.aliases ?? [])];
  for (const n of names) {
    PATTERN_LIST.push({ pattern: n, termId: term.id });
  }
}
PATTERN_LIST.sort((a, b) => b.pattern.length - a.pattern.length);

// Escape regex metacharacters in the patterns. Word-boundary
// wrapping only when the pattern starts and ends with a
// word-char -- for patterns like "$SI vs $FN" the standard \b
// won't match around the leading "$", so we accept those without
// word boundaries and rely on the longest-first ordering to
// avoid spurious matches.
function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TERM_REGEX = new RegExp(
  PATTERN_LIST.map((p) => {
    const escaped = escapeForRegex(p.pattern);
    // If pattern starts AND ends with word chars, wrap in \b\b.
    // Otherwise leave bare -- e.g. "$STANDARD_INFORMATION vs $FILE_NAME"
    // can't use word boundary on the leading "$".
    const head = /\w/.test(p.pattern[0]!);
    const tail = /\w/.test(p.pattern[p.pattern.length - 1]!);
    return `(?:${head ? "\\b" : ""}${escaped}${tail ? "\\b" : ""})`;
  }).join("|"),
  "gi",
);

// Split markdown into "safe to link" and "skip" segments so we
// don't rewrite inside code fences, inline code, or existing
// links. Returns an alternating array starting with a safe segment.
function splitForLinking(md: string): Array<{ text: string; safe: boolean }> {
  const parts: Array<{ text: string; safe: boolean }> = [];
  // Fenced code blocks first -- ```...``` (multi-line, lazy).
  // Then inline `code` and existing [text](url) on the safe pieces.
  let remaining = md;
  // Pull out fenced code first (greedy splits per ``` boundary).
  const fenceRegex = /```[\s\S]*?```/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = fenceRegex.exec(remaining))) {
    if (m.index > lastIdx) {
      parts.push({ text: remaining.slice(lastIdx, m.index), safe: true });
    }
    parts.push({ text: m[0], safe: false });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < remaining.length) {
    parts.push({ text: remaining.slice(lastIdx), safe: true });
  }
  // For each safe segment, split out inline code and existing links.
  const out: Array<{ text: string; safe: boolean }> = [];
  for (const seg of parts) {
    if (!seg.safe) {
      out.push(seg);
      continue;
    }
    const innerRegex = /`[^`]+`|\[[^\]]*\]\([^)]*\)/g;
    let s = seg.text;
    let li = 0;
    let im: RegExpExecArray | null;
    while ((im = innerRegex.exec(s))) {
      if (im.index > li) {
        out.push({ text: s.slice(li, im.index), safe: true });
      }
      out.push({ text: im[0], safe: false });
      li = im.index + im[0].length;
    }
    if (li < s.length) {
      out.push({ text: s.slice(li), safe: true });
    }
  }
  return out;
}

export function injectGlossaryLinks(md: string): string {
  const segments = splitForLinking(md);
  const usedTermIds = new Set<string>();
  const out: string[] = [];
  for (const seg of segments) {
    if (!seg.safe) {
      out.push(seg.text);
      continue;
    }
    // Rewrite the segment: first-occurrence-only per term across
    // the whole document, longest-pattern-first via TERM_REGEX.
    const rewritten = seg.text.replace(TERM_REGEX, (match) => {
      // Find which term this matched. We rebuild the index instead
      // of capturing groups because the alternation is large.
      const matchLower = match.toLowerCase();
      const hit = PATTERN_LIST.find(
        (p) => p.pattern.toLowerCase() === matchLower,
      );
      if (!hit) return match;
      if (usedTermIds.has(hit.termId)) return match;
      if (!GLOSSARY_BY_ID[hit.termId]) return match;
      usedTermIds.add(hit.termId);
      return `[${match}](glossary:${hit.termId})`;
    });
    out.push(rewritten);
  }
  return out.join("");
}
