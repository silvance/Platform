import type { ArtifactListItem, AuthResult, EmailParty, ParsedEmlPayload } from "@ci-train/contracts";
import { api, ApiError } from "@/lib/api";
import { ViewerError } from "./viewer-shell";

interface Props {
  artifact: ArtifactListItem;
  scenarioSlug: string;
  token: string;
}

export async function EmlViewer({ artifact, scenarioSlug, token }: Props) {
  let parsed: ParsedEmlPayload;
  try {
    parsed = await api.scenarios.getParsedEml(token, scenarioSlug, artifact.id);
  } catch (err) {
    return <ViewerError message={err instanceof ApiError ? err.message : "Could not parse EML."} />;
  }

  return (
    <div className="eml-viewer">
      <HeaderStrip parsed={parsed} />
      <AuthResultsPanel parsed={parsed} />
      <BodyPanel parsed={parsed} />
      <AttachmentsPanel parsed={parsed} />
      <RawHeadersPanel parsed={parsed} />
    </div>
  );
}

function HeaderStrip({ parsed }: { parsed: ParsedEmlPayload }) {
  const fromAddress = parsed.from?.address ?? null;
  const replyToAddress = parsed.replyTo?.address ?? null;
  const returnPathDomain = parsed.returnPath ? domainOf(parsed.returnPath) : null;
  const fromDomain = fromAddress ? domainOf(fromAddress) : null;

  // Anomaly flags: Reply-To address differs from From, or Return-Path
  // domain differs from From domain. Both are classic BEC indicators.
  const replyToDivergent =
    replyToAddress !== null && fromAddress !== null &&
    replyToAddress.toLowerCase() !== fromAddress.toLowerCase();
  const returnPathDivergent =
    returnPathDomain !== null && fromDomain !== null &&
    returnPathDomain.toLowerCase() !== fromDomain.toLowerCase();

  return (
    <div className="eml-header-strip card">
      <dl className="eml-kv">
        <dt>Subject</dt>
        <dd>{parsed.subject ?? <em>(no subject)</em>}</dd>

        <dt>From</dt>
        <dd>{formatParty(parsed.from)}</dd>

        <dt>To</dt>
        <dd>
          {parsed.to.map(formatPartyShort).join(", ") || <em>(none)</em>}
          {parsed.toTruncated ? (
            <Anomaly>To list truncated — additional recipients exist beyond what's shown.</Anomaly>
          ) : null}
        </dd>

        {parsed.cc.length > 0 ? (
          <>
            <dt>Cc</dt>
            <dd>
              {parsed.cc.map(formatPartyShort).join(", ")}
              {parsed.ccTruncated ? (
                <Anomaly>Cc list truncated — additional recipients exist beyond what's shown.</Anomaly>
              ) : null}
            </dd>
          </>
        ) : null}

        <dt>Reply-To</dt>
        <dd>
          {replyToAddress ? formatParty(parsed.replyTo) : <em>(absent)</em>}
          {replyToDivergent ? <Anomaly>Reply-To differs from From — common BEC signal.</Anomaly> : null}
        </dd>

        <dt>Return-Path</dt>
        <dd>
          {parsed.returnPath ?? <em>(absent)</em>}
          {returnPathDivergent ? (
            <Anomaly>
              Return-Path domain (<code>{returnPathDomain}</code>) does not match From
              domain (<code>{fromDomain}</code>).
            </Anomaly>
          ) : null}
        </dd>

        <dt>Date</dt>
        <dd>{parsed.date ?? <em>(unparseable)</em>}</dd>

        <dt>Message-ID</dt>
        <dd className="eml-monospace">{parsed.messageId ?? <em>(absent)</em>}</dd>
      </dl>
    </div>
  );
}

function AuthResultsPanel({ parsed }: { parsed: ParsedEmlPayload }) {
  const { spf, dkim, dmarc } = parsed.authResults;
  const anyMissing = spf.result === "missing" || dkim.result === "missing" || dmarc.result === "missing";
  return (
    <div className="card eml-auth">
      <h3 style={{ margin: "0 0 .5rem", fontSize: "1rem" }}>Authentication-Results</h3>
      <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
        <AuthChip label="SPF" check={spf} />
        <AuthChip label="DKIM" check={dkim} />
        <AuthChip label="DMARC" check={dmarc} />
      </div>
      {anyMissing ? (
        <p style={{ marginTop: ".5rem", fontSize: ".85rem", color: "var(--muted)" }}>
          A <code>missing</code> verdict means the Authentication-Results header
          did not assert that mechanism. Treat as <em>absence of evidence</em>,
          not evidence of absence.
        </p>
      ) : null}
    </div>
  );
}

function AuthChip({ label, check }: { label: string; check: { result: AuthResult; detail: string | null } }) {
  return (
    <span
      className={`chip auth-chip auth-${check.result}`}
      title={check.detail ?? undefined}
    >
      <strong>{label}</strong> <span>{check.result}</span>
    </span>
  );
}

function BodyPanel({ parsed }: { parsed: ParsedEmlPayload }) {
  if (parsed.textBody === null && parsed.htmlBodyBytes === null) {
    return (
      <div className="card">
        <p style={{ margin: 0, color: "var(--muted)" }}>This message has no readable body.</p>
      </div>
    );
  }
  return (
    <div className="card eml-body">
      <h3 style={{ margin: "0 0 .5rem", fontSize: "1rem" }}>Body</h3>
      {parsed.textBody !== null ? (
        <>
          <pre className="artifact-text">{parsed.textBody}</pre>
          {parsed.textBodyTruncated ? (
            <p style={{ color: "var(--muted)", fontSize: ".85rem", marginTop: ".5rem" }}>
              Text body truncated. Download the raw .eml to see the full content.
            </p>
          ) : null}
        </>
      ) : (
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          No plain-text alternative — only HTML.
        </p>
      )}
      {parsed.htmlBodyBytes !== null ? (
        <p style={{ color: "var(--muted)", fontSize: ".85rem", marginTop: ".5rem" }}>
          HTML alternative present ({parsed.htmlBodyBytes.toLocaleString()} bytes).
          The sanitized HTML render lands in M4.1; until then, download the raw
          .eml if you need to inspect the HTML form.
        </p>
      ) : null}
    </div>
  );
}

function AttachmentsPanel({ parsed }: { parsed: ParsedEmlPayload }) {
  if (parsed.attachments.length === 0 && !parsed.attachmentsTruncated) return null;
  return (
    <div className="card">
      <h3 style={{ margin: "0 0 .5rem", fontSize: "1rem" }}>Attachments</h3>
      <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
        {parsed.attachments.map((a, i) => (
          <li key={i} style={{ marginBottom: ".25rem" }}>
            <code>{a.filename ?? "(unnamed)"}</code>{" "}
            <span style={{ color: "var(--muted)" }}>
              · {a.contentType}
              {a.contentDisposition ? ` · ${a.contentDisposition}` : ""}
              {" "}· {formatBytes(a.sizeBytes)}
            </span>
          </li>
        ))}
      </ul>
      {parsed.attachmentsTruncated ? (
        <p style={{ color: "#f0d68a", fontSize: ".85rem", marginTop: ".5rem" }}>
          ⚠ Attachment list truncated — the EML contains more attachments
          than this view will surface. Download the raw .eml to enumerate
          all of them.
        </p>
      ) : null}
      <p style={{ color: "var(--muted)", fontSize: ".85rem", marginTop: ".5rem" }}>
        Individual attachment download lands in a future milestone — currently
        only metadata is surfaced.
      </p>
    </div>
  );
}

function RawHeadersPanel({ parsed }: { parsed: ParsedEmlPayload }) {
  return (
    <details className="card eml-raw-headers">
      <summary style={{ cursor: "pointer", color: "var(--muted)" }}>
        Show all headers ({parsed.headers.length}
        {parsed.headersTruncated ? "+, truncated" : ""})
      </summary>
      {parsed.headersTruncated ? (
        <p style={{ color: "#f0d68a", fontSize: ".85rem", marginTop: ".5rem", marginBottom: 0 }}>
          ⚠ Header list truncated. Chain-of-custody reasoning over Received
          hops needs the complete header set — download the raw .eml if
          you need the full chain.
        </p>
      ) : null}
      <pre className="artifact-text" style={{ marginTop: ".5rem" }}>
        {parsed.headers.map((h) => `${h.name}: ${h.value}`).join("\n")}
      </pre>
    </details>
  );
}

function Anomaly({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "block",
        marginTop: ".25rem",
        color: "#f8b4b4",
        fontSize: ".85rem",
      }}
    >
      ⚠ {children}
    </span>
  );
}

function formatParty(p: EmailParty | null): React.ReactNode {
  if (!p) return <em>(none)</em>;
  if (p.name && p.address) {
    return (
      <>
        {p.name} <code style={{ color: "var(--muted)" }}>&lt;{p.address}&gt;</code>
      </>
    );
  }
  if (p.address) return <code>{p.address}</code>;
  if (p.name) return p.name;
  return <em>(none)</em>;
}

function formatPartyShort(p: EmailParty): string {
  if (p.name && p.address) return `${p.name} <${p.address}>`;
  return p.address ?? p.name ?? "(none)";
}

function domainOf(addrOrPath: string): string | null {
  const at = addrOrPath.lastIndexOf("@");
  if (at < 0) return null;
  return addrOrPath.slice(at + 1).replace(/[>\s]/g, "");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
