"use client";

import {
  Clock3,
  HardDriveDownload,
  Inbox,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useMemo } from "react";

import { JsonViewer } from "@/components/requests/json-viewer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ExecutionError, ExecutionResult } from "@/lib/requests/schema";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusStyles(status: number): string {
  if (status >= 200 && status < 300) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status >= 300 && status < 400) {
    return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  }
  if (status >= 400 && status < 500) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

function looksLikeJson(body: string, contentType: string): boolean {
  if (contentType.toLowerCase().includes("json")) return true;
  const trimmed = body.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

interface ResponseViewerProps {
  result: ExecutionResult | null;
  error: ExecutionError | null;
  loading: boolean;
  executionEnabled: boolean;
  tab: string;
  onTabChange: (tab: string) => void;
}

export function ResponseViewer({
  result,
  error,
  loading,
  executionEnabled,
  tab,
  onTabChange,
}: ResponseViewerProps) {
  const prettyBody = useMemo(() => {
    if (!result?.body) return "";
    try {
      return JSON.stringify(JSON.parse(result.body), null, 2);
    } catch {
      return result.body;
    }
  }, [result]);

  if (loading) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="size-6 animate-spin text-primary" />
        Sending request…
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <ShieldCheck />
        <AlertTitle>Request could not be completed</AlertTitle>
        <AlertDescription>
          <span className="font-mono text-xs uppercase">{error.code}</span>
          <p className="mt-1">{error.message}</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (!result) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
        <Inbox className="size-7 text-primary/60" />
        <div>
          <p className="font-medium text-foreground">No response yet</p>
          <p className="mt-1">
            {executionEnabled
              ? "Configure a request and press Send to inspect the response."
              : "Request execution is only available in development."}
          </p>
        </div>
      </div>
    );
  }

  const isJson = looksLikeJson(result.body, result.contentType);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={statusStyles(result.status)}>
            {result.status} {result.statusText}
          </Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 className="size-3.5" />
            {result.timeMs} ms
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <HardDriveDownload className="size-3.5" />
            {formatBytes(result.size)}
          </span>
          {result.redirected ? <Badge variant="secondary">Redirected</Badge> : null}
          {result.truncated ? (
            <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-300">
              Truncated at 1 MB
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground" title={result.finalUrl}>
          {result.finalUrl}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(value) => onTabChange(String(value))}>
        <TabsList variant="line">
          <TabsTrigger value="pretty">Pretty</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
          <TabsTrigger value="headers">Headers ({Object.keys(result.headers).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pretty" className="pt-3">
          {!result.body ? (
            <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              This response has no body.
            </p>
          ) : isJson ? (
            <JsonViewer code={prettyBody} />
          ) : (
            <pre className="max-h-[520px] overflow-auto rounded-lg bg-muted/40 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {prettyBody}
            </pre>
          )}
        </TabsContent>

        <TabsContent value="raw" className="pt-3">
          <pre className="max-h-[520px] overflow-auto rounded-lg bg-muted/40 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {result.body || "(empty body)"}
          </pre>
        </TabsContent>

        <TabsContent value="headers" className="pt-3">
          {Object.keys(result.headers).length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              This response has no headers.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              {Object.entries(result.headers).map(([name, value]) => (
                <div
                  key={name}
                  className="grid gap-1 border-b px-3 py-2 last:border-b-0 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:gap-4"
                >
                  <span className="font-mono text-xs font-medium text-foreground">{name}</span>
                  <span className="font-mono text-xs break-all text-muted-foreground">{value}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
