"use client";

import { CircleAlert, Code2, KeyRound, Send, ShieldCheck, ListFilter, Braces, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { AuthEditor } from "@/components/requests/auth-editor";
import { BodyEditor } from "@/components/requests/body-editor";
import { KeyValueEditor } from "@/components/requests/key-value-editor";
import { MethodSelector } from "@/components/requests/method-selector";
import { ResponseViewer } from "@/components/requests/response-viewer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { executeRequest } from "@/lib/requests/client";
import {
  createHeaderRow,
  createParamRow,
  initialAuth,
  initialBody,
  initialHeaders,
  initialParams,
  initialRequest,
} from "@/lib/requests/defaults";
import {
  executeRequestSchema,
  type AuthConfig,
  type BodyConfig,
  type ExecutionError,
  type ExecutionResult,
  type ExecuteRequestPayload,
  type HeaderRow,
  type HttpMethod,
  type ParamRow,
} from "@/lib/requests/schema";
import { buildFinalUrl } from "@/lib/requests/url";

interface RequestBuilderProps {
  executionEnabled: boolean;
}

export function RequestBuilder({ executionEnabled }: RequestBuilderProps) {
  const [method, setMethod] = useState<HttpMethod>(initialRequest.method);
  const [url, setUrl] = useState(initialRequest.url);
  const [params, setParams] = useState<ParamRow[]>(initialParams);
  const [headers, setHeaders] = useState<HeaderRow[]>(initialHeaders);
  const [auth, setAuth] = useState<AuthConfig>(initialAuth);
  const [body, setBody] = useState<BodyConfig>(initialBody);
  const [configTab, setConfigTab] = useState("params");
  const [responseTab, setResponseTab] = useState("pretty");
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<ExecutionError | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const payload = useMemo<ExecuteRequestPayload>(
    () => ({ method, url, params, headers, auth, body }),
    [method, url, params, headers, auth, body],
  );

  const preview = useMemo(() => {
    try {
      return `${method} ${buildFinalUrl(payload, { includeSensitiveQueryAuth: false }).toString()}`;
    } catch {
      return `${method} ${url || "Enter a valid URL"}`;
    }
  }, [method, payload, url]);

  const isMethodWithoutBody = method === "GET" || method === "HEAD";

  async function handleSend() {
    if (!executionEnabled || loading) return;

    setValidationError(null);
    setError(null);

    const parsed = executeRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Invalid request configuration.");
      return;
    }

    if (
      parsed.data.auth.type === "apiKey" &&
      parsed.data.auth.in === "header" &&
      !parsed.data.auth.key.trim()
    ) {
      setValidationError("Enter a key name for the API key header.");
      return;
    }

    if (parsed.data.body.type === "json" && parsed.data.body.content.trim()) {
      try {
        JSON.parse(parsed.data.body.content);
      } catch {
        setValidationError("Request body must be valid JSON before sending.");
        return;
      }
    }

    setLoading(true);
    try {
      const response = await executeRequest(parsed.data);
      if (response.ok) {
        setResult(response.data);
        setResponseTab("pretty");
      } else {
        setResult(null);
        setError(response.error);
      }
    } finally {
      setLoading(false);
    }
  }

  function clearResponse() {
    setResult(null);
    setError(null);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Request builder</CardTitle>
          <CardDescription>
            Build a real HTTP request, then inspect status, timing, headers, and body.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!executionEnabled ? (
            <Alert>
              <ShieldCheck />
              <AlertTitle>Execution is disabled</AlertTitle>
              <AlertDescription>
                Request execution is available only in development. Production requires a
                dedicated, authenticated proxy before it can be enabled.
              </AlertDescription>
            </Alert>
          ) : null}

          {validationError ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Check your request</AlertTitle>
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <MethodSelector value={method} onChange={setMethod} disabled={!executionEnabled} />
            <Input
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setValidationError(null);
              }}
              placeholder="https://api.example.com/v1/resource"
              aria-label="Request URL"
              disabled={!executionEnabled}
              className="h-9 flex-1 font-mono text-xs"
            />
            <Button
              onClick={handleSend}
              disabled={!executionEnabled || loading}
              className="h-9 sm:min-w-24"
            >
              {loading ? <LoaderCircle className="animate-spin" /> : <Send />}
              {loading ? "Sending" : "Send"}
            </Button>
          </div>

          <p className="truncate text-xs text-muted-foreground" title={preview}>
            <span className="font-medium text-foreground">Preview:</span> {preview}
          </p>

          <Tabs value={configTab} onValueChange={(value) => setConfigTab(String(value))}>
            <TabsList variant="line" className="w-full justify-start gap-4">
              <TabsTrigger value="params">
                <ListFilter />
                Params
              </TabsTrigger>
              <TabsTrigger value="headers">
                <Code2 />
                Headers
              </TabsTrigger>
              <TabsTrigger value="auth">
                <KeyRound />
                Authorization
              </TabsTrigger>
              <TabsTrigger value="body">
                <Braces />
                Body
              </TabsTrigger>
            </TabsList>

            <TabsContent value="params" className="pt-4">
              <KeyValueEditor
                rows={params}
                onChange={setParams}
                createRow={createParamRow}
                label="parameters"
                keyPlaceholder="Query key"
                valuePlaceholder="Query value"
              />
            </TabsContent>

            <TabsContent value="headers" className="pt-4">
              <KeyValueEditor
                rows={headers}
                onChange={setHeaders}
                createRow={createHeaderRow}
                label="headers"
                keyPlaceholder="Header name"
                valuePlaceholder="Header value"
              />
            </TabsContent>

            <TabsContent value="auth" className="pt-4">
              <AuthEditor value={auth} onChange={setAuth} disabled={!executionEnabled} />
            </TabsContent>

            <TabsContent value="body" className="pt-4">
              <BodyEditor value={body} onChange={setBody} noBodyMethod={isMethodWithoutBody} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Response</CardTitle>
          <CardDescription>Formatted, raw, and header views of the latest response.</CardDescription>
          <CardAction>
            <Button
              variant="ghost"
              size="xs"
              onClick={clearResponse}
              disabled={!result && !error}
            >
              Clear
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="pt-4">
          <ResponseViewer
            result={result}
            error={error}
            loading={loading}
            executionEnabled={executionEnabled}
            tab={responseTab}
            onTabChange={setResponseTab}
          />
        </CardContent>
      </Card>
    </div>
  );
}
