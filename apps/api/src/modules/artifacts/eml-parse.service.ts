import { Injectable } from "@nestjs/common";
import { simpleParser, type AddressObject } from "mailparser";
import type { Readable } from "node:stream";
import {
  AuthCheck,
  AuthResult,
  EmailParty,
  EmlAttachmentMeta,
  EmlHeader,
  MAX_EML_HEADER_COUNT,
  MAX_EML_TEXT_BODY_BYTES,
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

    const headers = collectHeaders(parsed.headerLines);
    const authResults = extractAuthResults(headers);

    const textBodyRaw = parsed.text ?? null;
    const textTruncated =
      textBodyRaw !== null && textBodyRaw.length > MAX_EML_TEXT_BODY_BYTES;
    const textBody = textTruncated
      ? textBodyRaw!.slice(0, MAX_EML_TEXT_BODY_BYTES)
      : textBodyRaw;

    const attachments: EmlAttachmentMeta[] = (parsed.attachments ?? []).map(
      (a) => ({
        filename: a.filename ?? null,
        contentType: a.contentType ?? "application/octet-stream",
        sizeBytes: a.size ?? 0,
        contentDisposition: a.contentDisposition ?? null,
      }),
    );

    return ParsedEmlPayload.parse({
      subject: parsed.subject ?? null,
      from: firstParty(parsed.from),
      to: allParties(parsed.to),
      cc: allParties(parsed.cc),
      replyTo: firstParty(parsed.replyTo),
      returnPath: stringHeader(headers, "return-path"),
      date: parsed.date ? parsed.date.toISOString() : null,
      messageId: parsed.messageId ?? null,
      authResults,
      headers,
      textBody,
      textBodyTruncated: textTruncated,
      htmlBodyBytes: typeof parsed.html === "string" ? Buffer.byteLength(parsed.html, "utf8") : null,
      attachments,
    });
  }
}

function collectHeaders(headerLines: ReadonlyArray<{ key: string; line: string }>): EmlHeader[] {
  const out: EmlHeader[] = [];
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
  return out;
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
