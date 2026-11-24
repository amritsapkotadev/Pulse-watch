"use client";

import { Eye, EyeOff, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";

import { useWorkspace } from "@/components/providers/workspace-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { LocalStorageNote } from "@/components/shared/local-storage-note";
import type { Environment, EnvironmentInput, EnvironmentVariableInput } from "@/lib/storage/schema";

const variableNamePattern = /^[A-Za-z_][A-Za-z0-9_.]*$/;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function validateVariable(
  input: EnvironmentVariableInput,
  existingKey?: string,
): string | null {
  if (!input.key.trim()) return "Enter a variable name.";
  if (!variableNamePattern.test(input.key.trim())) {
    return "Use letters, numbers, dots, and underscores; start with a letter or underscore.";
  }
  if (existingKey && input.key.trim() === existingKey) return null;
  return null;
}

interface EnvironmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environment: Environment | null;
  onSubmit: (input: EnvironmentInput) => void;
}

function EnvironmentDialog({
  open,
  onOpenChange,
  environment,
  onSubmit,
}: EnvironmentDialogProps) {
  const [name, setName] = useState(environment?.name ?? "");
  const [description, setDescription] = useState(environment?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!name.trim()) {
      setError("Enter an environment name.");
      return;
    }
    onSubmit({ name: name.trim(), description: description.trim() });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{environment ? "Rename environment" : "Create environment"}</DialogTitle>
          <DialogDescription>
            Environments hold reusable variables such as BASE_URL and API_TOKEN.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="environment-name">Name</Label>
            <Input
              id="environment-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              placeholder="Development"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="environment-description">Description</Label>
            <Textarea
              id="environment-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional notes about this environment"
              className="min-h-20"
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>{environment ? "Save changes" : "Create environment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EnvironmentsManager() {
  const {
    hydrated,
    storageError,
    clearStorageError,
    environments,
    activeEnvironmentId,
    activeEnvironment,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    addVariable,
    updateVariable,
    deleteVariable,
    setActiveEnvironment,
  } = useWorkspace();

  const [dialog, setDialog] = useState<{ environment: Environment | null } | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newSecret, setNewSecret] = useState(false);
  const [variableError, setVariableError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editSecret, setEditSecret] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  function handleEnvironmentSelect(id: string | null) {
    setEditingId(null);
    setVariableError(null);
    setActiveEnvironment(id);
  }

  function handleEnvironmentSubmit(input: EnvironmentInput) {
    if (dialog?.environment) updateEnvironment(dialog.environment.id, input);
    else createEnvironment(input);
  }

  function handleAddVariable() {
    if (!activeEnvironment) return;
    const input = { key: newKey.trim(), value: newValue, secret: newSecret };
    const error = validateVariable(input);
    if (error) {
      setVariableError(error);
      return;
    }
    if (activeEnvironment.variables.some((variable) => variable.key === input.key)) {
      setVariableError("A variable with that name already exists.");
      return;
    }
    addVariable(activeEnvironment.id, input);
    setNewKey("");
    setNewValue("");
    setNewSecret(false);
    setVariableError(null);
  }

  function handleStartEdit(variable: Environment["variables"][number]) {
    setEditingId(variable.id);
    setEditKey(variable.key);
    setEditValue(variable.value);
    setEditSecret(variable.secret);
    setVariableError(null);
  }

  function handleSaveEdit() {
    if (!activeEnvironment || !editingId) return;
    const current = activeEnvironment.variables.find((variable) => variable.id === editingId);
    const input = { key: editKey.trim(), value: editValue, secret: editSecret };
    const error = validateVariable(input, current?.key);
    if (error) {
      setVariableError(error);
      return;
    }
    if (
      activeEnvironment.variables.some(
        (variable) => variable.id !== editingId && variable.key === input.key,
      )
    ) {
      setVariableError("A variable with that name already exists.");
      return;
    }
    updateVariable(activeEnvironment.id, editingId, input);
    setEditingId(null);
    setVariableError(null);
  }

  if (!hydrated) {
    return (
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <LocalStorageNote />

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

      {environments.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No environments yet"
          description="Create Development, Staging, or Production environments to reuse variables across requests."
          action={
            <Button onClick={() => setDialog({ environment: null })}>
              <Plus />
              Create environment
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Environments</CardTitle>
              <CardDescription>
                {environments.length} saved in this browser.
              </CardDescription>
              <CardAction>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDialog({ environment: null })}
                  aria-label="Create environment"
                >
                  <Plus />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="active-environment">Active environment</Label>
                <select
                  id="active-environment"
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={activeEnvironmentId ?? ""}
                  onChange={(event) => handleEnvironmentSelect(event.target.value || null)}
                >
                  <option value="">No environment</option>
                  {environments.map((environment) => (
                    <option key={environment.id} value={environment.id}>
                      {environment.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                {environments.map((environment) => {
                  const active = environment.id === activeEnvironmentId;
                  return (
                    <div
                      key={environment.id}
                      className={`rounded-lg border transition-colors ${
                        active ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleEnvironmentSelect(environment.id)}
                        className="w-full px-3 py-3 text-left"
                      >
                        <span className="flex items-center gap-2">
                          <SlidersHorizontal className="size-4 shrink-0 text-primary" />
                          <span className="truncate text-sm font-medium">{environment.name}</span>
                          {active ? <Badge variant="secondary">Active</Badge> : null}
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {environment.description || "No description"}
                        </span>
                        <span className="mt-2 block text-[0.7rem] text-muted-foreground">
                          {environment.variables.length} variable
                          {environment.variables.length === 1 ? "" : "s"} · Updated{" "}
                          {formatDate(environment.updatedAt)}
                        </span>
                      </button>
                      <div className="flex justify-end gap-1 border-t px-2 py-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setDialog({ environment })}
                          aria-label={`Rename ${environment.name}`}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            if (window.confirm(`Delete environment "${environment.name}"?`)) {
                              deleteEnvironment(environment.id);
                              if (environment.id === activeEnvironmentId) {
                                setEditingId(null);
                                setVariableError(null);
                              }
                            }
                          }}
                          aria-label={`Delete ${environment.name}`}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{activeEnvironment?.name ?? "No active environment"}</CardTitle>
              <CardDescription>
                {activeEnvironment?.description ||
                  "Select an environment to manage its variables."}
              </CardDescription>
              {activeEnvironment ? (
                <CardAction>
                  <Badge variant="outline">Active</Badge>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-5">
              {!activeEnvironment ? (
                <EmptyState
                  icon={SlidersHorizontal}
                  title="No active environment"
                  description="Select an environment from the list to add variables like BASE_URL and API_TOKEN."
                />
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border">
                    <div className="min-w-[620px]">
                      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_90px_110px] items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                        <span>Variable</span>
                        <span>Value</span>
                        <span>Secret</span>
                        <span className="text-right">Actions</span>
                      </div>
                      {activeEnvironment.variables.length === 0 ? (
                        <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                          No variables yet. Add one below.
                        </p>
                      ) : (
                        activeEnvironment.variables.map((variable) => {
                          const isEditing = editingId === variable.id;
                          return (
                            <div
                              key={variable.id}
                              className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_90px_110px] items-center gap-2 border-b px-3 py-2 last:border-b-0"
                            >
                              {isEditing ? (
                                <>
                                  <Input
                                    value={editKey}
                                    onChange={(event) => setEditKey(event.target.value)}
                                    aria-label="Variable name"
                                    className="h-7 font-mono text-xs"
                                  />
                                  <Input
                                    value={editValue}
                                    onChange={(event) => setEditValue(event.target.value)}
                                    type={editSecret && !revealed[variable.id] ? "password" : "text"}
                                    aria-label="Variable value"
                                    className="h-7 font-mono text-xs"
                                  />
                                  <Checkbox
                                    checked={editSecret}
                                    onCheckedChange={(checked) => setEditSecret(checked)}
                                    aria-label="Secret variable"
                                  />
                                  <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon-xs" onClick={handleSaveEdit} aria-label="Save variable">
                                      <Pencil />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => setEditingId(null)}
                                      aria-label="Cancel edit"
                                    >
                                      ×
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span className="truncate font-mono text-xs font-medium">
                                    {variable.key}
                                  </span>
                                  <span className="flex items-center gap-2">
                                    <span className="truncate font-mono text-xs text-muted-foreground">
                                      {variable.secret && !revealed[variable.id]
                                        ? "••••••••"
                                        : variable.value || "(empty)"}
                                    </span>
                                    {variable.secret ? (
                                      <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() =>
                                          setRevealed((current) => ({
                                            ...current,
                                            [variable.id]: !current[variable.id],
                                          }))
                                        }
                                        aria-label={revealed[variable.id] ? "Hide value" : "Show value"}
                                      >
                                        {revealed[variable.id] ? <EyeOff /> : <Eye />}
                                      </Button>
                                    ) : null}
                                  </span>
                                  <span>
                                    <Badge variant={variable.secret ? "secondary" : "outline"}>
                                      {variable.secret ? "Secret" : "Plain"}
                                    </Badge>
                                  </span>
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => handleStartEdit(variable)}
                                      aria-label={`Edit ${variable.key}`}
                                    >
                                      <Pencil />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() =>
                                        deleteVariable(activeEnvironment.id, variable.id)
                                      }
                                      aria-label={`Delete ${variable.key}`}
                                    >
                                      <Trash2 />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-dashed p-4">
                    <div className="text-sm font-medium">Add variable</div>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                      <Input
                        value={newKey}
                        onChange={(event) => {
                          setNewKey(event.target.value);
                          setVariableError(null);
                        }}
                        placeholder="BASE_URL"
                        className="font-mono text-xs"
                      />
                      <Input
                        value={newValue}
                        onChange={(event) => setNewValue(event.target.value)}
                        type={newSecret ? "password" : "text"}
                        placeholder="https://api.example.com"
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={newSecret}
                          onCheckedChange={(checked) => setNewSecret(checked)}
                          aria-label="Mark as secret"
                        />
                        Mark as secret
                      </Label>
                      <Button size="sm" onClick={handleAddVariable}>
                        <Plus />
                        Add variable
                      </Button>
                    </div>
                    {variableError ? (
                      <p className="text-xs text-destructive">{variableError}</p>
                    ) : null}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Use variables in requests as {"{{VARIABLE_NAME}}"} in URLs, query params, headers,
                    and bodies. Missing variables are reported before sending.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {dialog ? (
        <EnvironmentDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          environment={dialog.environment}
          onSubmit={handleEnvironmentSubmit}
        />
      ) : null}
    </div>
  );
}
