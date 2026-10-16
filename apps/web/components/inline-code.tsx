import { Fragment } from "react";

// Short plain-text descriptions (lane blurbs, challenge summaries)
// are written with Markdown-style `backticks` but rendered outside
// the Markdown component. This renders just those spans as <code>;
// text with unbalanced backticks is shown as-is.
export function InlineCode({ text }: { text: string }) {
  const parts = text.split("`");
  if (parts.length < 3 || parts.length % 2 === 0) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <code key={i}>{part}</code> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}
