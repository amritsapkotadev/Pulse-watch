"use client";

import { cn } from "cn";
import { Highlight, type PrismTheme } from "prism-react-renderer";

const jsonTheme: PrismTheme = {
  plain: {
    color: "#334155",
    backgroundColor: "transparent",
  },
  styles: [
    { types: ["property", "tag"], style: { color: "#6d28d9" } },
    { types: ["string", "attr-value"], style: { color: "#047857" } },
    { types: ["number", "boolean", "constant"], style: { color: "#b45309" } },
    { types: ["punctuation", "operator"], style: { color: "#64748b" } },
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "#94a3b8", fontStyle: "italic" } },
  ],
};

interface JsonViewerProps {
  code: string;
}

export function JsonViewer({ code }: JsonViewerProps) {
  return (
    <Highlight theme={jsonTheme} code={code} language="json">
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={cn(
            "max-h-[520px] overflow-auto rounded-lg bg-muted/40 p-4 font-mono text-xs leading-relaxed",
            className,
          )}
          style={style}
        >
          {tokens.map((line, lineIndex) => (
            <div key={lineIndex} {...getLineProps({ line })}>
              <span className="mr-4 inline-block w-7 select-none text-right text-muted-foreground/60">
                {lineIndex + 1}
              </span>
              {line.map((token, tokenIndex) => (
                <span key={tokenIndex} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}
