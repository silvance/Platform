import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { injectGlossaryLinks } from "@/lib/glossary-link";
import { GlossaryTerm } from "./glossary-term";

interface Props {
  source: string;
  // Apply a tighter style when used for an inline disclaimer banner.
  variant?: "default" | "callout";
  // Set to true to bypass the glossary-link preprocessor. Used by
  // the glossary page itself (so a term definition doesn't link
  // back to itself) and by anywhere a recursion risk would
  // appear (e.g. a popover rendering markdown).
  noGlossary?: boolean;
}

// Allow custom `glossary:<id>` href values past the sanitizer.
// `rehype-sanitize` strips href values that aren't in its
// allowlisted protocols (http, https, mailto, etc.); without
// this override the preprocessor's `[term](glossary:id)` links
// would get stripped at render time and we'd see the bare text
// with no popover.
const glossarySchema = {
  ...defaultSchema,
  protocols: {
    ...(defaultSchema.protocols ?? {}),
    href: [...(defaultSchema.protocols?.href ?? []), "glossary"],
  },
};

// Server-rendered markdown. We sanitize on the server with rehype-sanitize
// — scenario authors are trusted but the brief body comes from data and
// will later flow through pack-import paths, so defense-in-depth is cheap
// here. No raw HTML pass-through, no images yet (artifacts come in M3).
export function Markdown({ source, variant = "default", noGlossary }: Props) {
  const processed = noGlossary ? source : injectGlossaryLinks(source);
  return (
    <div className={variant === "callout" ? "md-callout" : "md"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, glossarySchema]]}
        // react-markdown's default urlTransform strips any URL whose
        // protocol isn't http/https/irc/ircs/mailto/xmpp. Allow our
        // `glossary:<id>` pseudo-protocol through; everything else
        // falls back to the default behaviour.
        urlTransform={(value) => {
          if (typeof value === "string" && value.startsWith("glossary:")) {
            return value;
          }
          return defaultUrlTransform(value);
        }}
        components={{
          a({ href, children, ...rest }) {
            if (typeof href === "string" && href.startsWith("glossary:")) {
              const termId = href.slice("glossary:".length);
              return <GlossaryTerm termId={termId}>{children}</GlossaryTerm>;
            }
            return (
              <a href={href} {...rest}>
                {children}
              </a>
            );
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
