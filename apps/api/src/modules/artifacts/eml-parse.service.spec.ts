import { Readable } from "node:stream";
import { EmlParseService } from "./eml-parse.service";

const SAMPLE_BEC_EML = [
  'From: "Jane Doe" <jane.doe@vendor.example>',
  "To: controller@partner.example",
  "Reply-To: ceo.urgent@gmail.com",
  "Return-Path: <noreply@vendor-lookup-alike.com>",
  "Subject: URGENT: Updated wire instructions for INV-2026-0418",
  "Date: Thu, 18 Apr 2026 14:07:02 +0000",
  "Message-ID: <1234abcd@vendor-lookup-alike.com>",
  "Authentication-Results: mx.partner.example;",
  " spf=neutral smtp.mailfrom=vendor-lookup-alike.com;",
  " dkim=fail header.d=vendor.example;",
  " dmarc=fail policy.dmarc=reject",
  "MIME-Version: 1.0",
  "Content-Type: multipart/alternative; boundary=\"BOUNDARY\"",
  "",
  "--BOUNDARY",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Hello,",
  "",
  "Please update the wire instructions for INV-2026-0418 to the new",
  "account immediately. Confidentiality is critical.",
  "",
  "Thanks,",
  "Jane",
  "--BOUNDARY",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<p>Hello,</p><p>Please update the wire instructions immediately.</p>",
  "--BOUNDARY--",
  "",
].join("\r\n");

function fromString(s: string): Readable {
  return Readable.from(Buffer.from(s, "utf8"));
}

describe("EmlParseService", () => {
  const svc = new EmlParseService();

  it("extracts the well-known parties + subject + date", async () => {
    const parsed = await svc.parse(fromString(SAMPLE_BEC_EML));
    expect(parsed.from?.address).toBe("jane.doe@vendor.example");
    expect(parsed.from?.name).toBe("Jane Doe");
    expect(parsed.to[0]?.address).toBe("controller@partner.example");
    expect(parsed.replyTo?.address).toBe("ceo.urgent@gmail.com");
    expect(parsed.returnPath).toBe("noreply@vendor-lookup-alike.com");
    expect(parsed.subject).toContain("URGENT");
    expect(parsed.date).toMatch(/^2026-04-18T14:07:/);
    expect(parsed.messageId).toBe("<1234abcd@vendor-lookup-alike.com>");
  });

  it("parses Authentication-Results into SPF/DKIM/DMARC", async () => {
    const parsed = await svc.parse(fromString(SAMPLE_BEC_EML));
    expect(parsed.authResults.spf.result).toBe("neutral");
    expect(parsed.authResults.dkim.result).toBe("fail");
    expect(parsed.authResults.dmarc.result).toBe("fail");
    expect(parsed.authResults.dkim.detail).toMatch(/header\.d=vendor\.example/);
  });

  it("reports `missing` when Authentication-Results is absent", async () => {
    const noAuth = SAMPLE_BEC_EML.replace(
      /Authentication-Results:[\s\S]*?dmarc=fail policy\.dmarc=reject\r\n/,
      "",
    );
    const parsed = await svc.parse(fromString(noAuth));
    expect(parsed.authResults.spf.result).toBe("missing");
    expect(parsed.authResults.dkim.result).toBe("missing");
    expect(parsed.authResults.dmarc.result).toBe("missing");
  });

  it("returns the text/plain body and flags HTML alternative presence", async () => {
    const parsed = await svc.parse(fromString(SAMPLE_BEC_EML));
    expect(parsed.textBody).toContain("Please update the wire instructions");
    expect(parsed.textBodyTruncated).toBe(false);
    expect(parsed.htmlBodyBytes).not.toBeNull();
    expect(parsed.htmlBodyBytes!).toBeGreaterThan(0);
  });

  it("collects raw headers in arrival order", async () => {
    const parsed = await svc.parse(fromString(SAMPLE_BEC_EML));
    const names = parsed.headers.map((h) => h.name.toLowerCase());
    expect(names).toContain("from");
    expect(names).toContain("to");
    expect(names).toContain("reply-to");
    expect(names).toContain("return-path");
    expect(names).toContain("authentication-results");
    expect(names.indexOf("from")).toBeLessThan(names.indexOf("subject"));
  });

  it("truncates text bodies that exceed MAX_EML_TEXT_BODY_BYTES", async () => {
    const big = [
      "From: a@b.com",
      "To: c@d.com",
      "Subject: big",
      "",
      "x".repeat(300_000),
    ].join("\r\n");
    const parsed = await svc.parse(fromString(big));
    expect(parsed.textBodyTruncated).toBe(true);
    expect(parsed.textBody!.length).toBeLessThanOrEqual(200_000);
  });

  it("normalizes unknown auth verdicts to 'unknown'", async () => {
    const weird = [
      "From: a@b.com",
      "To: c@d.com",
      "Authentication-Results: mx.partner.example; spf=wat; dkim=alsowat; dmarc=anyhow",
      "Subject: weird",
      "",
      "body",
    ].join("\r\n");
    const parsed = await svc.parse(fromString(weird));
    expect(parsed.authResults.spf.result).toBe("unknown");
    expect(parsed.authResults.dkim.result).toBe("unknown");
    expect(parsed.authResults.dmarc.result).toBe("unknown");
  });

  it("collects attachment metadata without inlining bytes", async () => {
    const withAttachment = [
      "From: a@b.com",
      "To: c@d.com",
      "Subject: invoice",
      'Content-Type: multipart/mixed; boundary="X"',
      "",
      "--X",
      "Content-Type: text/plain",
      "",
      "see attached",
      "--X",
      "Content-Type: application/pdf",
      'Content-Disposition: attachment; filename="INV-2026-0418-revised.pdf"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from("%PDF-1.4 hello").toString("base64"),
      "--X--",
      "",
    ].join("\r\n");
    const parsed = await svc.parse(fromString(withAttachment));
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0]!.filename).toBe("INV-2026-0418-revised.pdf");
    expect(parsed.attachments[0]!.contentType).toBe("application/pdf");
    expect(parsed.attachments[0]!.contentDisposition).toBe("attachment");
    expect(parsed.attachments[0]!.sizeBytes).toBeGreaterThan(0);
  });
});
