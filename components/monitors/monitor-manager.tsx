"use client";

import { useCallback, useState, useSyncExternalStore, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/monitoring/format";
import { HTTP_METHODS } from "@/lib/requests/schema";
import { WORKSPACE_STORAGE_KEY } from "@/lib/storage/schema";
import { serializeWorkspaceData } from "@/lib/storage/secrets";

interface SessionState {
  email: string;
  csrfToken: string;
}

interface AdminMonitor {
  id: string;
  name: string;
  description: string;
  url: string;
  method: string;
  expectedStatus: number;
  intervalMinutes: number;
  timeoutSeconds: number;
  isActive: boolean;
  displayPublicly: boolean;
  currentStatus: string;
  lastCheckedAt: string | null;
  lastResponseTime: number | null;
  consecutiveFailures: number;
  _count?: { checks: number; incidents: number };
  incidents?: Array<{ id: string; title: string; status: string }>;
}

interface MonitorFormState {
  name: string;
  description: string;
  url: string;
  method: string;
  expectedStatus: string;
  intervalMinutes: string;
  timeoutSeconds: string;
  isActive: boolean;
  displayPublicly: boolean;
}

interface AdminState {
  session: SessionState | null;
  monitors: AdminMonitor[];
  checking: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
}

const emptyForm: MonitorFormState = {
  name: "",
  description: "",
  url: "",
  method: "GET",
  expectedStatus: "200",
  intervalMinutes: "5",
  timeoutSeconds: "10",
  isActive: true,
  displayPublicly: true,
};

let adminState: AdminState = {
  session: null,
  monitors: [],
  checking: true,
  busy: false,
  error: null,
  message: null,
};

const adminListeners = new Set<() => void>();
let adminInitialization: Promise<void> | null = null;

function patchAdminState(patch: Partial<AdminState>): void {
  adminState = { ...adminState, ...patch };
  for (const listener of adminListeners) listener();
}

function getAdminSnapshot(): AdminState {
  return adminState;
}

async function apiFetch<T>(
  url: string,
  method: string,
  body?: unknown,
  csrfToken?: string,
): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    signal: AbortSignal.timeout(8000),
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await response.json().catch(() => null)) as
    | { ok: true; data: T }
    | { ok: false; error: { message: string } }
    | null;
  if (!response.ok || !json?.ok) {
    throw new Error(json && !json.ok ? json.error.message : `Request failed (${response.status}).`);
  }
  return json.data;
}

async function refreshMonitors(): Promise<void> {
  try {
    const data = await apiFetch<{ monitors: AdminMonitor[] }>("/api/admin/monitors", "GET");
    patchAdminState({ monitors: data.monitors });
  } catch (error) {
    patchAdminState({
      error: error instanceof Error ? error.message : "Could not load monitors.",
    });
  }
}

async function initializeAdmin(): Promise<void> {
  try {
    const session = await apiFetch<SessionState>("/api/admin/session", "GET");
    patchAdminState({ session, checking: false });
    await refreshMonitors();
  } catch (error) {
    patchAdminState({
      session: null,
      checking: false,
      error: error instanceof Error ? `Session check failed: ${error.message}` : "Session check failed.",
    });
  }
}

function ensureAdminInitialized(): void {
  if (!adminInitialization && adminState.checking) {
    adminInitialization = initializeAdmin().finally(() => {
      adminInitialization = null;
    });
  }
}

function subscribeAdmin(listener: () => void): () => void {
  adminListeners.add(listener);
  ensureAdminInitialized();
  return () => {
    adminListeners.delete(listener);
  };
}

export function MonitorManager() {
  const admin = useSyncExternalStore(subscribeAdmin, getAdminSnapshot, getAdminSnapshot);
  const [form, setForm] = useState<MonitorFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const session = admin.session;
  const busy = admin.busy;

  const updateForm = useCallback(
    <K extends keyof MonitorFormState>(key: K, value: MonitorFormState[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const resetForm = useCallback(() => {
    setForm(emptyForm);
    setEditingId(null);
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    patchAdminState({ busy: true, error: null, message: null });
    try {
      const nextSession = await apiFetch<SessionState>("/api/admin/login", "POST", {
        email,
        password,
      });
      setPassword("");
      patchAdminState({ session: nextSession, busy: false, message: "Signed in as administrator." });
      await refreshMonitors();
    } catch (error) {
      patchAdminState({
        busy: false,
        error: error instanceof Error ? error.message : "Could not sign in.",
      });
    }
  }

  async function handleLogout() {
    patchAdminState({ busy: true, error: null, message: null });
    try {
      if (session) {
        await apiFetch("/api/admin/session", "DELETE", undefined, session.csrfToken);
      }
      patchAdminState({
        session: null,
        monitors: [],
        busy: false,
        message: "Signed out.",
      });
    } catch (error) {
      patchAdminState({
        busy: false,
        error: error instanceof Error ? error.message : "Could not sign out.",
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    patchAdminState({ busy: true, error: null, message: null });
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      url: form.url.trim(),
      method: form.method,
      expectedStatus: Number(form.expectedStatus),
      intervalMinutes: Number(form.intervalMinutes),
      timeoutSeconds: Number(form.timeoutSeconds),
      isActive: form.isActive,
      displayPublicly: form.displayPublicly,
    };
    try {
      await apiFetch(
        editingId ? `/api/admin/monitors/${editingId}` : "/api/admin/monitors",
        editingId ? "PATCH" : "POST",
        payload,
        session.csrfToken,
      );
      patchAdminState({
        busy: false,
        message: editingId ? "Monitor updated." : "Monitor created.",
      });
      resetForm();
      await refreshMonitors();
    } catch (error) {
      patchAdminState({
        busy: false,
        error: error instanceof Error ? error.message : "Could not save monitor.",
      });
    }
  }

  function startEditing(monitor: AdminMonitor) {
    setEditingId(monitor.id);
    setForm({
      name: monitor.name,
      description: monitor.description,
      url: monitor.url,
      method: monitor.method,
      expectedStatus: String(monitor.expectedStatus),
      intervalMinutes: String(monitor.intervalMinutes),
      timeoutSeconds: String(monitor.timeoutSeconds),
      isActive: monitor.isActive,
      displayPublicly: monitor.displayPublicly,
    });
    patchAdminState({ message: null });
  }

  async function handleRunCheck(monitorId: string) {
    if (!session) return;
    patchAdminState({ busy: true, error: null, message: null });
    try {
      await apiFetch(`/api/admin/monitors/${monitorId}/check`, "POST", {}, session.csrfToken);
      patchAdminState({ busy: false, message: "Check completed. Results have been stored." });
      await refreshMonitors();
    } catch (error) {
      patchAdminState({
        busy: false,
        error: error instanceof Error ? error.message : "Could not run check.",
      });
    }
  }

  async function handleDelete(monitorId: string) {
    if (!session || !window.confirm("Delete this monitor and all of its history?")) return;
    patchAdminState({ busy: true, error: null, message: null });
    try {
      await apiFetch(`/api/admin/monitors/${monitorId}`, "DELETE", undefined, session.csrfToken);
      patchAdminState({ busy: false, message: "Monitor deleted." });
      if (editingId === monitorId) resetForm();
      await refreshMonitors();
    } catch (error) {
      patchAdminState({
        busy: false,
        error: error instanceof Error ? error.message : "Could not delete monitor.",
      });
    }
  }

  async function handleImportWorkspace() {
    if (!session) return;
    patchAdminState({ busy: true, error: null, message: null });
    try {
      const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (!raw) throw new Error("This browser has no Phase 3 workspace to import.");
      const result = await apiFetch<{
        imported: { collections: number; requests: number; environments: number };
      }>("/api/admin/workspace", "PUT", JSON.parse(raw), session.csrfToken);
      patchAdminState({
        busy: false,
        message: `Imported ${result.imported.collections} collections, ${result.imported.requests} requests, and ${result.imported.environments} environments.`,
      });
    } catch (error) {
      patchAdminState({
        busy: false,
        error: error instanceof Error ? error.message : "Could not import the local workspace.",
      });
    }
  }

  async function handleLoadWorkspace() {
    if (!session) return;
    patchAdminState({ busy: true, error: null, message: null });
    try {
      const data = await apiFetch<{ workspace: Parameters<typeof serializeWorkspaceData>[0] }>(
        "/api/admin/workspace",
        "GET",
      );
      window.localStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify(serializeWorkspaceData(data.workspace)),
      );
      patchAdminState({
        busy: false,
        message: "Database workspace loaded into this browser. Reloading…",
      });
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      patchAdminState({
        busy: false,
        error: error instanceof Error ? error.message : "Could not load workspace.",
      });
    }
  }

  if (admin.checking) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading admin session…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {admin.error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {admin.error}
        </div>
      ) : null}
      {admin.message ? (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {admin.message}
        </div>
      ) : null}

      {!session ? (
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle>Administrator sign in</CardTitle>
            <CardDescription>Manage the shared monitor and workspace configuration.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="space-y-1.5">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Monitors</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Signed in as {session.email}. Changes apply to the shared workspace.
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout} disabled={busy}>
              Sign out
            </Button>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <Card>
              <CardHeader>
                <CardTitle>{editingId ? "Edit monitor" : "Add monitor"}</CardTitle>
                <CardDescription>
                  Checks are executed server-side after URL safety validation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-1.5">
                    <Label htmlFor="monitor-name">Name</Label>
                    <Input
                      id="monitor-name"
                      value={form.name}
                      onChange={(event) => updateForm("name", event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="monitor-url">URL</Label>
                    <Input
                      id="monitor-url"
                      type="url"
                      value={form.url}
                      onChange={(event) => updateForm("url", event.target.value)}
                      placeholder="https://api.example.com/health"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="monitor-description">Description</Label>
                    <Textarea
                      id="monitor-description"
                      value={form.description}
                      onChange={(event) => updateForm("description", event.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="monitor-method">Method</Label>
                      <select
                        id="monitor-method"
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                        value={form.method}
                        onChange={(event) => updateForm("method", event.target.value)}
                      >
                        {HTTP_METHODS.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="monitor-status">Expected status</Label>
                      <Input
                        id="monitor-status"
                        type="number"
                        min={100}
                        max={599}
                        value={form.expectedStatus}
                        onChange={(event) => updateForm("expectedStatus", event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="monitor-interval">Interval (minutes)</Label>
                      <Input
                        id="monitor-interval"
                        type="number"
                        min={1}
                        max={1440}
                        value={form.intervalMinutes}
                        onChange={(event) => updateForm("intervalMinutes", event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="monitor-timeout">Timeout (seconds)</Label>
                      <Input
                        id="monitor-timeout"
                        type="number"
                        min={1}
                        max={120}
                        value={form.timeoutSeconds}
                        onChange={(event) => updateForm("timeoutSeconds", event.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-5 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(event) => updateForm("isActive", event.target.checked)}
                      />
                      Active
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.displayPublicly}
                        onChange={(event) => updateForm("displayPublicly", event.target.checked)}
                      />
                      Show publicly
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={busy}>
                      {editingId ? "Update monitor" : "Create monitor"}
                    </Button>
                    {editingId ? (
                      <Button type="button" variant="outline" onClick={resetForm} disabled={busy}>
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configured monitors</CardTitle>
                <CardDescription>Run checks, edit settings, or remove monitors.</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Monitor</TableHead>
                      <TableHead className="px-4">Status</TableHead>
                      <TableHead className="px-4">Last checked</TableHead>
                      <TableHead className="px-4">Checks</TableHead>
                      <TableHead className="px-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admin.monitors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                          No monitors configured yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      admin.monitors.map((monitor) => (
                        <TableRow key={monitor.id}>
                          <TableCell className="px-4">
                            <div className="space-y-0.5">
                              <span className="font-medium text-foreground">{monitor.name}</span>
                              <span className="block max-w-[260px] truncate font-mono text-xs text-muted-foreground">
                                {monitor.url}
                              </span>
                              {!monitor.isActive || !monitor.displayPublicly ? (
                                <span className="text-[0.7rem] text-muted-foreground">
                                  {!monitor.isActive ? "Inactive" : ""}
                                  {!monitor.isActive && !monitor.displayPublicly ? " · " : ""}
                                  {!monitor.displayPublicly ? "Private" : ""}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="px-4">
                            <span className="text-sm text-foreground">{monitor.currentStatus}</span>
                            {monitor.consecutiveFailures > 0 ? (
                              <span className="block text-xs text-danger">
                                {monitor.consecutiveFailures} failed
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="px-4 text-xs text-muted-foreground">
                            {formatDateTime(monitor.lastCheckedAt)}
                          </TableCell>
                          <TableCell className="px-4 text-sm tabular-nums">
                            {monitor._count?.checks ?? 0}
                          </TableCell>
                          <TableCell className="px-4">
                            <div className="flex flex-wrap gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRunCheck(monitor.id)}
                                disabled={busy}
                              >
                                Check
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditing(monitor)}
                                disabled={busy}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(monitor.id)}
                                disabled={busy}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Workspace migration</CardTitle>
              <CardDescription>
                Move Phase 3 browser storage into the shared database without losing collections,
                requests, or environments.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleImportWorkspace} disabled={busy}>
                Import local workspace
              </Button>
              <Button variant="outline" onClick={handleLoadWorkspace} disabled={busy}>
                Load database workspace here
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
