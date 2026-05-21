import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

interface Props {
  source: string;
  // Apply a tighter style when used for an inline disclaimer banner.
  variant?: "default" | "callout";
}

// Server-rendered markdown. We sanitize on the server with rehype-sanitize
// — scenario authors are trusted but the brief body comes from data and
// will later flow through pack-import paths, so defense-in-depth is cheap
// here. No raw HTML pass-through, no images yet (artifacts come in M3).
export function Markdown({ source, variant = "default" }: Props) {
  return (
    <div className={variant === "callout" ? "md-callout" : "md"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
