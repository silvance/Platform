import { z } from "zod";

// Authentication-Results values per RFC 8601.  We surface the four most
// commonly meaningful values; anything else maps to `unknown`. The
// "missing" state indicates the header was not present at all (often
// because the message bypassed the receiving MTA's auth checks).
export const AuthResult = z.enum([
  "pass",
  "fail",
  "softfail",
  "neutral",
  "none",
  "temperror",
  "permerror",
  "policy",
  "unknown",
  "missing",
]);
export type AuthResult = z.infer<typeof AuthResult>;

export const AuthCheck = z.object({
  result: AuthResult,
  // Free-form remainder of the Authentication-Results entry — domain,
  // reason, comments. Caps to keep pathological headers in check.
  detail: z.string().max(500).nullable(),
});
export type AuthCheck = z.infer<typeof AuthCheck>;

export const EmailParty = z.object({
  name: z.string().max(200).nullable(),
  address: z.string().max(254).nullable(),
});
export type EmailParty = z.infer<typeof EmailParty>;

export const EmlHeader = z.object({
  name: z.string().min(1).max(120),
  // 8 KB cap on a single header value — well above any sensible header
  // (DKIM signatures and Received chains push the upper bound) and below
  // "lock the renderer" territory.
  value: z.string().max(8 * 1024),
});
export type EmlHeader = z.infer<typeof EmlHeader>;

export const EmlAttachmentMeta = z.object({
  filename: z.string().max(255).nullable(),
  contentType: z.string().max(120),
  sizeBytes: z.number().int().nonnegative(),
  contentDisposition: z.string().max(60).nullable(),
});
export type EmlAttachmentMeta = z.infer<typeof EmlAttachmentMeta>;

// Hard caps shared by API + web so any parsing-layer surprise (e.g. a
// 50 MB text body smuggled through a multipart) cannot lock up the
// renderer.
export const MAX_EML_TEXT_BODY_BYTES = 200_000;
export const MAX_EML_HEADER_COUNT = 200;

export const ParsedEmlPayload = z.object({
  // Subject line and well-known parties pulled out for the header strip.
  subject: z.string().max(998).nullable(),
  from: EmailParty.nullable(),
  to: z.array(EmailParty).max(50),
  cc: z.array(EmailParty).max(50),
  replyTo: EmailParty.nullable(),
  returnPath: z.string().max(254).nullable(),
  // ISO timestamp pulled from the Date: header when parseable.
  date: z.string().datetime().nullable(),
  messageId: z.string().max(998).nullable(),

  // Parsed Authentication-Results header → per-mechanism summary. When
  // the header is absent, all three are { result: "missing" }.
  authResults: z.object({
    spf: AuthCheck,
    dkim: AuthCheck,
    dmarc: AuthCheck,
  }),

  // Flat header list, in arrival order, capped at MAX_EML_HEADER_COUNT.
  headers: z.array(EmlHeader),

  // text/plain body. Capped; `textBodyTruncated` indicates we cut it
  // short. May be null when the message is HTML-only.
  textBody: z.string().nullable(),
  textBodyTruncated: z.boolean(),

  // HTML body presence is signalled but the rendered view doesn't land
  // until M4.1. The byte count is shown so the trainee knows there's
  // something they could download.
  htmlBodyBytes: z.number().int().nonnegative().nullable(),

  attachments: z.array(EmlAttachmentMeta),
});
export type ParsedEmlPayload = z.infer<typeof ParsedEmlPayload>;
