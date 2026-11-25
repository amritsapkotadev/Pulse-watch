"use client";

import { useState, type FormEvent } from "react";

import { PageHeader } from "@/components/shared/page-header";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/monitoring/format";
import { HTTP_METHODS } from "@/lib/requests/schema";
import { WORKSPACE_STORAGE_KEY } from "@/lib/storage/schema";
import { serializeWorkspaceData } from "@/lib/storage/secrets";

export interface AdminMonitor {
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
  consecutiveFailures: number;
  _count?: { checks: number; incidents: number };
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

export interface MonitorManagerProps {
  csrfToken: string;
  initialMonitors: AdminMonitor[];
}

async function apiFetch<T>(
  url: string,
  method: string,
  csrfToken?: string,
  body?: unknown,
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

export function MonitorManager({ csrfToken, initialMonitors }: MonitorManagerProps) {
  const [monitors, setMonitors] = useState<AdminMonitor[]>(initialMonitors);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<MonitorFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadMonitors() {
    try {
      const data = await apiFetch<{ monitors: AdminMonitor[] }>("/api/admin/monitors", "GET");
      setMonitors(data.monitors);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load monitors.");
    }
  }

  function updateForm<K extends keyof MonitorFormState>(key: K, value: MonitorFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function runMutation(
    action: () => Promise<string | void>,
    successMessage: string,
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      setMessage(result ?? successMessage);
      await loadMonitors();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete the request.");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    void runMutation(async () => {
      await apiFetch(
        editingId ? `/api/admin/monitors/${editingId}` : "/api/admin/monitors",
        editingId ? "PATCH" : "POST",
        csrfToken,
        payload,
      );
      resetForm();
    }, editingId ? "Monitor updated." : "Monitor created.");
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
  }

  async function handleImportWorkspace() {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) {
      setError("This browser has no local workspace to import.");
      return;
    }
    await runMutation(async () => {
      const result = await apiFetch<{
        imported: { collections: number; requests: number; environments: number };
      }>("/api/admin/workspace", "PUT", csrfToken, JSON.parse(raw));
      return `Imported ${result.imported.collections} collections, ${result.imported.requests} requests, and ${result.imported.environments} environments.`;
    }, "Workspace imported.");
  }

  async function handleLoadWorkspace() {
    await runMutation(async () => {
      const data = await apiFetch<{ workspace: Parameters<typeof serializeWorkspaceData>[0] }>(
        "/api/admin/workspace",
        "GET",
      );
      window.localStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify(serializeWorkspaceData(data.workspace)),
      );
      window.setTimeout(() => window.location.reload(), 500);
      return "Database workspace loaded into this browser. Reloading…";
    }, "Workspace loaded.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitors"
        description="Create and configure availability checks. Public pages only show monitors marked for public display."
      />
      {error ? (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card className="gap-0 py-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-base">{editingId ? "Edit monitor" : "Add monitor"}</CardTitle>
            <CardDescription>Checks are executed server-side after URL safety validation.</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5">
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

        <Card className="gap-0 py-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-base">Configured monitors</CardTitle>
            <CardDescription>Run checks, edit settings, or remove monitors.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
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
                  {monitors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No monitors configured yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    monitors.map((monitor) => (
                      <TableRow key={monitor.id}>
                        <TableCell className="px-4">
                          <span className="font-medium text-foreground">{monitor.name}</span>
                          <span className="mt-0.5 block max-w-[260px] truncate font-mono text-xs text-muted-foreground">
                            {monitor.url}
                          </span>
                          {!monitor.isActive || !monitor.displayPublicly ? (
                            <span className="text-[0.7rem] text-muted-foreground">
                              {!monitor.isActive ? "Inactive" : ""}
                              {!monitor.isActive && !monitor.displayPublicly ? " · " : ""}
                              {!monitor.displayPublicly ? "Private" : ""}
                            </span>
                          ) : null}
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
                              disabled={busy}
                              onClick={() =>
                                void runMutation(async () => {
                                  await apiFetch(
                                    `/api/admin/monitors/${monitor.id}/check`,
                                    "POST",
                                    csrfToken,
                                  );
                                }, "Check completed. Results have been stored.")
                              }
                            >
                              Check
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => startEditing(monitor)} disabled={busy}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => {
                                if (!window.confirm("Delete this monitor and all of its history?")) return;
                                void runMutation(async () => {
                                  await apiFetch(`/api/admin/monitors/${monitor.id}`, "DELETE", csrfToken);
                                  if (editingId === monitor.id) resetForm();
                                }, "Monitor deleted.");
                              }}
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
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
              <Button variant="outline" onClick={() => void handleImportWorkspace()} disabled={busy}>
                Import local workspace
              </Button>
              <Button variant="outline" onClick={() => void handleLoadWorkspace()} disabled={busy}>
                Load database workspace here
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
