import { Injectable } from "@nestjs/common";
import { simpleParser, type AddressObject } from "mailparser";
import type { Readable } from "node:stream";
import {
  AuthCheck,
  AuthResult,
  EmailParty,
  EmlAttachmentMeta,
  EmlHeader,
  MAX_EML_ATTACHMENT_COUNT,
  MAX_EML_HEADER_COUNT,
  MAX_EML_RECIPIENTS,
  MAX_EML_TEXT_BODY_CHARS,
  ParsedEmlPayload,
} from "@ci-train/contracts";

@Injectable()
export class EmlParseService {
  async parse(stream: Readable): Promise<ParsedEmlPayload> {
    const parsed = await simpleParser(stream, {
      // Don't run the embedded mailparser feed-handler for HTML — we
      // surface htmlBodyBytes only and defer rendering to M4.1.
      skipHtmlToText: true,
      skipImageLinks: true,
    });

    const { headers, truncated: headersTruncated } = collectHeaders(parsed.headerLines);
    const authResults = extractAuthResults(headers);

    const textBodyRaw = parsed.text ?? null;
    const textTruncated =
      textBodyRaw !== null && textBodyRaw.length > MAX_EML_TEXT_BODY_CHARS;
    const textBody = textTruncated
      ? textBodyRaw!.slice(0, MAX_EML_TEXT_BODY_CHARS)
      : textBodyRaw;

    const toAll = allParties(parsed.to);
    const ccAll = allParties(parsed.cc);
    const toTruncated = toAll.length > MAX_EML_RECIPIENTS;
    const ccTruncated = ccAll.length > MAX_EML_RECIPIENTS;

    const attachmentsAll = parsed.attachments ?? [];
    const attachmentsTruncated = attachmentsAll.length > MAX_EML_ATTACHMENT_COUNT;
    const attachments: EmlAttachmentMeta[] = attachmentsAll
      .slice(0, MAX_EML_ATTACHMENT_COUNT)
      .map((a) => ({
        filename: a.filename ?? null,
        // Normalize attachment Content-Type: strip parameters after `;`,
        // trim, lowercase. Fall back to application/octet-stream when
        // the parsed value isn't a meaningful media type. We never trust
        // the raw EML value for routing — display only.
        contentType: normalizeMediaType(a.contentType),
        sizeBytes: a.size ?? 0,
        contentDisposition: a.contentDisposition ?? null,
      }));

    return ParsedEmlPayload.parse({
      subject: parsed.subject ?? null,
      from: firstParty(parsed.from),
      to: toAll.slice(0, MAX_EML_RECIPIENTS),
      toTruncated,
      cc: ccAll.slice(0, MAX_EML_RECIPIENTS),
      ccTruncated,
      replyTo: firstParty(parsed.replyTo),
      returnPath: stringHeader(headers, "return-path"),
      date: parsed.date ? parsed.date.toISOString() : null,
      messageId: parsed.messageId ?? null,
      authResults,
      headers,
      headersTruncated,
      textBody,
      textBodyTruncated: textTruncated,
      htmlBodyBytes: typeof parsed.html === "string" ? Buffer.byteLength(parsed.html, "utf8") : null,
      attachments,
      attachmentsTruncated,
    });
  }
}

function collectHeaders(
  headerLines: ReadonlyArray<{ key: string; line: string }>,
): { headers: EmlHeader[]; truncated: boolean } {
  const out: EmlHeader[] = [];
  const sourceLen = headerLines.length;
  for (const h of headerLines.slice(0, MAX_EML_HEADER_COUNT)) {
    // `line` is "Name: value possibly\r\n folded". Split on the first colon
    // so the cased original name is preserved, and trim folding whitespace.
    const colon = h.line.indexOf(":");
    if (colon < 0) continue;
    const name = h.line.slice(0, colon).trim();
    const value = h.line.slice(colon + 1).replace(/\r?\n\s+/g, " ").trim();
    if (!name) continue;
    out.push({ name, value });
  }
  return { headers: out, truncated: sourceLen > MAX_EML_HEADER_COUNT };
}

function stringHeader(headers: EmlHeader[], lowerName: string): string | null {
  const found = headers.find((h) => h.name.toLowerCase() === lowerName);
  if (!found) return null;
  // Return-Path arrives as "<addr@host>"; strip the angle brackets.
  const v = found.value.replace(/^<|>$/g, "").trim();
  return v.length === 0 ? null : v;
}

function firstParty(party: AddressObject | AddressObject[] | undefined): EmailParty | null {
  const parties = allParties(party);
  return parties[0] ?? null;
}

function allParties(party: AddressObject | AddressObject[] | undefined): EmailParty[] {
  if (!party) return [];
  const arr = Array.isArray(party) ? party : [party];
  const out: EmailParty[] = [];
  for (const p of arr) {
    for (const v of p.value) {
      out.push({
        name: typeof v.name === "string" && v.name.length > 0 ? v.name : null,
        address: typeof v.address === "string" && v.address.length > 0 ? v.address : null,
      });
    }
  }
  return out;
}

// Extract SPF/DKIM/DMARC from the Authentication-Results header, if any.
// Per RFC 8601: `authserv-id; spf=pass smtp.mailfrom=... ; dkim=fail ...`
// We accept multiple Authentication-Results headers (one per upstream MTA)
// and prefer the earliest non-"missing" verdict per mechanism.
function extractAuthResults(headers: EmlHeader[]): {
  spf: AuthCheck;
  dkim: AuthCheck;
  dmarc: AuthCheck;
} {
  const initial: { spf: AuthCheck; dkim: AuthCheck; dmarc: AuthCheck } = {
    spf: { result: "missing", detail: null },
    dkim: { result: "missing", detail: null },
    dmarc: { result: "missing", detail: null },
  };
  const arHeaders = headers.filter((h) => h.name.toLowerCase() === "authentication-results");
  for (const h of arHeaders) {
    // Strip the leading "authserv-id;" segment if present.
    const body = h.value.includes(";") ? h.value.slice(h.value.indexOf(";") + 1) : h.value;
    // Split on commas or semicolons; mailparser folds, so this is a flat list.
    const segments = body.split(/[,;]/);
    for (const segRaw of segments) {
      const seg = segRaw.trim();
      if (!seg) continue;
      const m = seg.match(/^(spf|dkim|dmarc)\s*=\s*([a-zA-Z]+)\s*(.*)$/i);
      if (!m) continue;
      const mech = m[1]!.toLowerCase() as "spf" | "dkim" | "dmarc";
      const result = normalizeAuthResult(m[2]!);
      const detail = m[3] ? m[3].slice(0, 500) : null;
      if (initial[mech].result === "missing") {
        initial[mech] = { result, detail };
      }
    }
  }
  return initial;
}

function normalizeAuthResult(raw: string): AuthResult {
  const v = raw.toLowerCase();
  if (
    v === "pass" || v === "fail" || v === "softfail" || v === "neutral" ||
    v === "none" || v === "temperror" || v === "permerror" || v === "policy"
  ) {
    return v;
  }
  return "unknown";
}

// `type/subtype` after stripping parameters, trimming, and lower-casing.
// Falls back to application/octet-stream when the input doesn't look
// like a media type. Caps at 120 chars so a pathological header can't
// blow the contract's max-length validator.
export function normalizeMediaType(raw: string | undefined | null): string {
  if (typeof raw !== "string") return "application/octet-stream";
  const base = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!/^[a-z][a-z0-9!#$&^_.+-]*\/[a-z0-9!#$&^_.+-]+$/.test(base)) {
    return "application/octet-stream";
  }
  return base.length > 120 ? "application/octet-stream" : base;
}
