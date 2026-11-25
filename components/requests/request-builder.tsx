"use client";

import {
  Bookmark,
  Braces,
  CircleAlert,
  Code2,
  KeyRound,
  ListFilter,
  LoaderCircle,
  Save,
  Send,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useWorkspace } from "@/components/providers/workspace-provider";
import { AuthEditor } from "@/components/requests/auth-editor";
import { BodyEditor } from "@/components/requests/body-editor";
import { KeyValueEditor } from "@/components/requests/key-value-editor";
import { MethodSelector } from "@/components/requests/method-selector";
import { ResponseViewer } from "@/components/requests/response-viewer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocalStorageNote } from "@/components/shared/local-storage-note";
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
import type { SavedRequest } from "@/lib/storage/schema";
import { interpolateRequest } from "@/lib/variables/interpolate";

interface RequestBuilderProps {
  executionEnabled: boolean;
  csrfToken: string;
}

interface RequestBuilderFormProps extends RequestBuilderProps {
  initialSavedRequest: SavedRequest | null;
}

export function RequestBuilder({ executionEnabled, csrfToken }: RequestBuilderProps) {
  const { hydrated, requests, pendingRequest } = useWorkspace();

  if (!hydrated) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12" />
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const savedRequest = pendingRequest
    ? requests.find((request) => request.id === pendingRequest.id) ?? null
    : null;
  const formKey = savedRequest ? `${savedRequest.id}:${pendingRequest?.key ?? ""}` : "new";

  return (
    <RequestBuilderForm
      key={formKey}
      executionEnabled={executionEnabled}
      csrfToken={csrfToken}
      initialSavedRequest={savedRequest}
    />
  );
}

function RequestBuilderForm({
  executionEnabled,
  csrfToken,
  initialSavedRequest,
}: RequestBuilderFormProps) {
  const {
    storageError,
    clearStorageError,
    collections,
    environments,
    activeEnvironment,
    activeEnvironmentId,
    setActiveEnvironment,
    createCollection,
    createRequest,
    updateRequest,
  } = useWorkspace();

  const [method, setMethod] = useState<HttpMethod>(
    initialSavedRequest?.request.method ?? initialRequest.method,
  );
  const [url, setUrl] = useState(initialSavedRequest?.request.url ?? initialRequest.url);
  const [params, setParams] = useState<ParamRow[]>(
    initialSavedRequest?.request.params ?? initialParams,
  );
  const [headers, setHeaders] = useState<HeaderRow[]>(
    initialSavedRequest?.request.headers ?? initialHeaders,
  );
  const [auth, setAuth] = useState<AuthConfig>(
    initialSavedRequest?.request.auth ?? initialAuth,
  );
  const [body, setBody] = useState<BodyConfig>(initialSavedRequest?.request.body ?? initialBody);
  const [configTab, setConfigTab] = useState("params");
  const [responseTab, setResponseTab] = useState("pretty");
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<ExecutionError | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [loadedRequestId, setLoadedRequestId] = useState<string | null>(
    initialSavedRequest?.id ?? null,
  );
  const [loadedCollectionId, setLoadedCollectionId] = useState<string | null>(
    initialSavedRequest?.collectionId ?? null,
  );
  const [loadedFolder, setLoadedFolder] = useState(initialSavedRequest?.folder ?? "General");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState(initialSavedRequest?.name ?? "");
  const [saveDescription, setSaveDescription] = useState(initialSavedRequest?.description ?? "");
  const [saveCollectionId, setSaveCollectionId] = useState(
    initialSavedRequest?.collectionId ?? collections[0]?.id ?? "",
  );
  const [saveFolder, setSaveFolder] = useState(initialSavedRequest?.folder ?? "General");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [saveAsCopy, setSaveAsCopy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const payload = useMemo<ExecuteRequestPayload>(
    () => ({ method, url, params, headers, auth, body }),
    [method, url, params, headers, auth, body],
  );

  const variables = useMemo(
    () =>
      Object.fromEntries(
        (activeEnvironment?.variables ?? []).map((variable) => [variable.key, variable.value]),
      ),
    [activeEnvironment],
  );

  const preview = useMemo(() => {
    try {
      return `${method} ${buildFinalUrl(payload, { includeSensitiveQueryAuth: false }).toString()}`;
    } catch {
      return `${method} ${url || "Enter a valid URL"}`;
    }
  }, [method, payload, url]);

  const isMethodWithoutBody = method === "GET" || method === "HEAD";

  function clearValidation() {
    setValidationError(null);
  }

  function updateMethod(next: HttpMethod) {
    setMethod(next);
    clearValidation();
  }

  function updateParams(next: ParamRow[]) {
    setParams(next);
    clearValidation();
  }

  function updateHeaders(next: HeaderRow[]) {
    setHeaders(next);
    clearValidation();
  }

  function updateAuth(next: AuthConfig) {
    setAuth(next);
    clearValidation();
  }

  function updateBody(next: BodyConfig) {
    setBody(next);
    clearValidation();
  }

  async function handleSend() {
    if (!executionEnabled || loading) return;

    setValidationError(null);
    setError(null);

    const interpolation = interpolateRequest(payload, variables);
    if (interpolation.missing.length > 0) {
      const details = interpolation.missing
        .map((item) => `${item.name} (${item.location})`)
        .join(", ");
      setValidationError(
        `Missing variable${interpolation.missing.length === 1 ? "" : "s"} in ${
          activeEnvironment?.name ?? "the active environment"
        }: ${details}`,
      );
      return;
    }

    const parsed = executeRequestSchema.safeParse(interpolation.value);
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
      const response = await executeRequest(parsed.data, csrfToken);
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

  function openSaveDialog() {
    setSaveError(null);
    setSaveSuccess(null);
    setSaveName(loadedRequestId ? saveName : "");
    setSaveDescription(loadedRequestId ? saveDescription : "");
    setSaveCollectionId(loadedCollectionId ?? saveCollectionId ?? collections[0]?.id ?? "");
    setSaveFolder(loadedFolder || "General");
    setNewCollectionName("");
    setSaveAsCopy(false);
    setSaveOpen(true);
  }

  function handleSave() {
    setSaveError(null);

    const parsed = executeRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setSaveError(parsed.error.issues[0]?.message ?? "Fix the request before saving.");
      return;
    }
    if (!saveName.trim()) {
      setSaveError("Enter a request name.");
      return;
    }

    let collectionId = saveCollectionId;
    if (!collectionId) {
      if (!newCollectionName.trim()) {
        setSaveError("Choose a collection or enter a new collection name.");
        return;
      }
      const collection = createCollection({ name: newCollectionName.trim(), description: "" });
      collectionId = collection.id;
    }

    const input = {
      collectionId,
      folder: saveFolder.trim() || "General",
      name: saveName.trim(),
      description: saveDescription.trim(),
      request: parsed.data,
    };

    if (loadedRequestId && !saveAsCopy) {
      updateRequest(loadedRequestId, input);
      setSaveSuccess("Saved request updated.");
    } else {
      const created = createRequest(input);
      setLoadedRequestId(created.id);
      setLoadedCollectionId(created.collectionId);
      setLoadedFolder(created.folder);
      setSaveSuccess("Request saved to collection.");
      setSaveAsCopy(false);
    }

    setSaveCollectionId(collectionId);
    setNewCollectionName("");
    setSaveOpen(false);
  }

  function clearResponse() {
    setResult(null);
    setError(null);
  }

  return (
    <div className="space-y-5">
      <LocalStorageNote compact />

      {storageError ? (
        <Alert variant="destructive">
          <AlertTitle>Storage warning</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{storageError}</span>
            <Button variant="ghost" size="xs" onClick={clearStorageError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {saveSuccess ? (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{saveSuccess}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Request builder
            {loadedRequestId ? <Badge variant="secondary">Saved request</Badge> : null}
          </CardTitle>
          <CardDescription>
            Build a real HTTP request, then inspect status, timing, headers, and body.
          </CardDescription>
          <CardAction>
            <Button variant="outline" onClick={openSaveDialog}>
              <Save />
              Save Request
            </Button>
          </CardAction>
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

          <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
            <Label htmlFor="builder-environment" className="text-muted-foreground">
              <SlidersHorizontal className="size-4" />
              Active environment
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="builder-environment"
                className="h-8 min-w-40 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={activeEnvironmentId ?? ""}
                onChange={(event) => setActiveEnvironment(event.target.value || null)}
              >
                <option value="">No environment</option>
                {environments.map((environment) => (
                  <option key={environment.id} value={environment.id}>
                    {environment.name}
                  </option>
                ))}
              </select>
              <Badge variant="outline">
                {activeEnvironment ? `${activeEnvironment.variables.length} variables` : "No variables"}
              </Badge>
            </div>
          </div>

          {validationError ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Check your request</AlertTitle>
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <MethodSelector value={method} onChange={updateMethod} disabled={!executionEnabled} />
            <Input
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                clearValidation();
              }}
              placeholder="{{BASE_URL}}/users/{{USER_ID}}"
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
                onChange={updateParams}
                createRow={createParamRow}
                label="parameters"
                keyPlaceholder="Query key"
                valuePlaceholder="Query value"
              />
            </TabsContent>

            <TabsContent value="headers" className="pt-4">
              <KeyValueEditor
                rows={headers}
                onChange={updateHeaders}
                createRow={createHeaderRow}
                label="headers"
                keyPlaceholder="Header name"
                valuePlaceholder="Header value"
              />
            </TabsContent>

            <TabsContent value="auth" className="pt-4">
              <AuthEditor value={auth} onChange={updateAuth} disabled={!executionEnabled} />
            </TabsContent>

            <TabsContent value="body" className="pt-4">
              <BodyEditor value={body} onChange={updateBody} noBodyMethod={isMethodWithoutBody} />
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

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{loadedRequestId ? "Save request" : "Save new request"}</DialogTitle>
            <DialogDescription>
              Store the complete request configuration in a collection in this browser.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="save-request-name">Request name</Label>
              <Input
                id="save-request-name"
                value={saveName}
                onChange={(event) => {
                  setSaveName(event.target.value);
                  setSaveError(null);
                }}
                placeholder="Get users"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="save-request-description">Description</Label>
              <Input
                id="save-request-description"
                value={saveDescription}
                onChange={(event) => setSaveDescription(event.target.value)}
                placeholder="Optional notes"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="save-collection">Collection</Label>
                <select
                  id="save-collection"
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={saveCollectionId}
                  onChange={(event) => {
                    setSaveCollectionId(event.target.value);
                    setNewCollectionName("");
                    setSaveError(null);
                  }}
                >
                  <option value="">New collection…</option>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="save-folder">Folder</Label>
                <Input
                  id="save-folder"
                  value={saveFolder}
                  onChange={(event) => setSaveFolder(event.target.value)}
                  placeholder="General"
                />
              </div>
            </div>
            {!saveCollectionId ? (
              <div className="space-y-2">
                <Label htmlFor="new-collection-name">New collection name</Label>
                <Input
                  id="new-collection-name"
                  value={newCollectionName}
                  onChange={(event) => {
                    setNewCollectionName(event.target.value);
                    setSaveError(null);
                  }}
                  placeholder="Users API"
                />
              </div>
            ) : null}
            {loadedRequestId ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={saveAsCopy}
                  onChange={(event) => setSaveAsCopy(event.target.checked)}
                  className="size-4 rounded border-input"
                />
                Save as a new copy
              </label>
            ) : null}
            <LocalStorageNote compact />
            {saveError ? <p className="text-xs text-destructive">{saveError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Bookmark />
              {loadedRequestId && !saveAsCopy ? "Update request" : "Save request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
