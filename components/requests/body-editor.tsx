"use client";

import { Braces, Info } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BODY_TYPES, type BodyConfig, type BodyType } from "@/lib/requests/schema";

const bodyLabels: Record<BodyType, string> = {
  none: "None",
  json: "JSON",
  raw: "Raw text",
};

function defaultBodyFor(type: BodyType): BodyConfig {
  switch (type) {
    case "json":
      return { type: "json", content: "" };
    case "raw":
      return { type: "raw", content: "", contentType: "text/plain" };
    default:
      return { type: "none" };
  }
}

interface BodyEditorProps {
  value: BodyConfig;
  onChange: (body: BodyConfig) => void;
  noBodyMethod?: boolean;
}

export function BodyEditor({ value, onChange, noBodyMethod }: BodyEditorProps) {
  const [formatError, setFormatError] = useState<string | null>(null);

  function formatJson() {
    if (value.type !== "json") return;
    try {
      const parsed = JSON.parse(value.content);
      onChange({ ...value, content: JSON.stringify(parsed, null, 2) });
      setFormatError(null);
    } catch {
      setFormatError("Body must be valid JSON before it can be formatted.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
        <Label htmlFor="body-type">Body type</Label>
        <select
          id="body-type"
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          value={value.type}
          onChange={(event) => {
            onChange(defaultBodyFor(event.target.value as BodyType));
            setFormatError(null);
          }}
          disabled={noBodyMethod}
        >
          {BODY_TYPES.map((type) => (
            <option key={type} value={type}>
              {bodyLabels[type]}
            </option>
          ))}
        </select>
      </div>

      {noBodyMethod ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
          <Info className="size-4" />
          GET and HEAD requests do not send a request body.
        </div>
      ) : null}

      {value.type === "json" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="body-content">JSON body</Label>
            <Button
              variant="ghost"
              size="xs"
              onClick={formatJson}
              disabled={noBodyMethod || !value.content.trim()}
            >
              <Braces />
              Format
            </Button>
          </div>
          <Textarea
            id="body-content"
            value={value.content}
            onChange={(event) => {
              onChange({ ...value, content: event.target.value });
              setFormatError(null);
            }}
            placeholder={'{\n  "name": "PulseWatch"\n}'}
            spellCheck={false}
            disabled={noBodyMethod}
            className="min-h-56 font-mono text-xs leading-relaxed"
          />
          {formatError ? <p className="text-xs text-destructive">{formatError}</p> : null}
        </div>
      ) : null}

      {value.type === "raw" ? (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
            <Label htmlFor="body-content-type">Content type</Label>
            <Input
              id="body-content-type"
              value={value.contentType}
              onChange={(event) => onChange({ ...value, contentType: event.target.value })}
              placeholder="text/plain"
              disabled={noBodyMethod}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body-content">Raw body</Label>
            <Textarea
              id="body-content"
              value={value.content}
              onChange={(event) => onChange({ ...value, content: event.target.value })}
              placeholder="Enter raw request body"
              spellCheck={false}
              disabled={noBodyMethod}
              className="min-h-56 font-mono text-xs leading-relaxed"
            />
          </div>
        </div>
      ) : null}

      {value.type === "none" ? (
        <div className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          This request has no body.
        </div>
      ) : null}
    </div>
  );
}
