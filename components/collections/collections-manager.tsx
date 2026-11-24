"use client";

import {
  Copy,
  ExternalLink,
  FileJson,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { useWorkspace } from "@/components/providers/workspace-provider";
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
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { LocalStorageNote } from "@/components/shared/local-storage-note";
import type { HttpMethod } from "@/lib/requests/schema";
import { parsePostmanCollection } from "@/lib/postman/parse";
import type { Collection, CollectionInput, SavedRequest } from "@/lib/storage/schema";

const methodStyles: Record<HttpMethod, string> = {
  GET: "text-emerald-700 dark:text-emerald-300",
  POST: "text-blue-700 dark:text-blue-300",
  PUT: "text-amber-700 dark:text-amber-300",
  PATCH: "text-violet-700 dark:text-violet-300",
  DELETE: "text-rose-700 dark:text-rose-300",
  HEAD: "text-slate-700 dark:text-slate-300",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface CollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: Collection | null;
  onSubmit: (input: CollectionInput) => void;
}

function CollectionDialog({
  open,
  onOpenChange,
  collection,
  onSubmit,
}: CollectionDialogProps) {
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!name.trim()) {
      setError("Enter a collection name.");
      return;
    }
    onSubmit({ name: name.trim(), description: description.trim() });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{collection ? "Rename collection" : "Create collection"}</DialogTitle>
          <DialogDescription>
            Collections group saved API requests. Folders can be added when saving a request.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collection-name">Name</Label>
            <Input
              id="collection-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              placeholder="Payments API"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collection-description">Description</Label>
            <Textarea
              id="collection-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional notes about this collection"
              className="min-h-20"
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>{collection ? "Save changes" : "Create collection"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CollectionsManager() {
  const router = useRouter();
  const {
    hydrated,
    storageError,
    clearStorageError,
    collections,
    requests,
    createCollection,
    updateCollection,
    deleteCollection,
    importCollection,
    importEnvironment,
    deleteRequest,
    duplicateRequest,
    moveRequest,
    openRequest,
  } = useWorkspace();

  const [selectedOverride, setSelectedOverride] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ collection: Collection | null } | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCollection =
    collections.find((collection) => collection.id === selectedOverride) ?? collections[0] ?? null;
  const selectedId = selectedCollection?.id ?? null;

  const collectionRequests = useMemo(
    () =>
      requests
        .filter((request) => request.collectionId === selectedId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [requests, selectedId],
  );

  const folders = useMemo(() => {
    const grouped = new Map<string, SavedRequest[]>();
    for (const request of collectionRequests) {
      const folder = request.folder.trim() || "General";
      const existing = grouped.get(folder) ?? [];
      existing.push(request);
      grouped.set(folder, existing);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [collectionRequests]);

  function handleCollectionSubmit(input: CollectionInput) {
    if (dialog?.collection) {
      updateCollection(dialog.collection.id, input);
      return;
    }
    const collection = createCollection(input);
    setSelectedOverride(collection.id);
  }

  function handleDeleteCollection(collection: Collection) {
    if (!window.confirm(`Delete "${collection.name}" and all of its saved requests?`)) return;
    deleteCollection(collection.id);
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportMessage(null);
    setImportWarnings([]);

    try {
      const text = await file.text();
      const parsed = parsePostmanCollection(text);
      const collection = importCollection(parsed);
      if (parsed.environment) importEnvironment(parsed.environment);

      const skipped = parsed.skipped > 0 ? ` ${parsed.skipped} item(s) were skipped.` : "";
      setImportMessage(
        `Imported ${parsed.requests.length} request(s) into "${collection.name}". Imported requests were not executed.${skipped}`,
      );
      setImportWarnings(parsed.warnings);
      setSelectedOverride(collection.id);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not import collection.");
    } finally {
      event.target.value = "";
    }
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

      {importError ? (
        <Alert variant="destructive">
          <AlertTitle>Import failed</AlertTitle>
          <AlertDescription>{importError}</AlertDescription>
        </Alert>
      ) : null}

      {importMessage ? (
        <Alert>
          <AlertTitle>Import complete</AlertTitle>
          <AlertDescription>
            <p>{importMessage}</p>
            {importWarnings.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {importWarnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {collections.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No collections yet"
          description="Create a collection to organize saved requests, or import a Postman Collection v2.1 JSON file."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setDialog({ collection: null })}>
                <FolderPlus />
                Create collection
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload />
                Import collection
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Collections</CardTitle>
              <CardDescription>{collections.length} saved in this browser.</CardDescription>
              <CardAction>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDialog({ collection: null })}
                  aria-label="Create collection"
                >
                  <Plus />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()}>
                <FileJson />
                Import Postman JSON
              </Button>
              <div className="space-y-2">
                {collections.map((collection) => {
                  const count = requests.filter((request) => request.collectionId === collection.id).length;
                  const active = collection.id === selectedId;
                  return (
                    <div
                      key={collection.id}
                      className={`rounded-lg border transition-colors ${
                        active ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedOverride(collection.id)}
                        className="w-full px-3 py-3 text-left"
                      >
                        <span className="flex items-center gap-2">
                          <Folder className="size-4 shrink-0 text-primary" />
                          <span className="truncate text-sm font-medium">{collection.name}</span>
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {collection.description || "No description"}
                        </span>
                        <span className="mt-2 flex items-center gap-2 text-[0.7rem] text-muted-foreground">
                          <Badge variant="secondary">{count} request{count === 1 ? "" : "s"}</Badge>
                          <span>Updated {formatDate(collection.updatedAt)}</span>
                        </span>
                      </button>
                      <div className="flex justify-end gap-1 border-t px-2 py-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setDialog({ collection })}
                          aria-label={`Rename ${collection.name}`}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDeleteCollection(collection)}
                          aria-label={`Delete ${collection.name}`}
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
              <CardTitle>{selectedCollection?.name ?? "Select a collection"}</CardTitle>
              <CardDescription>
                {selectedCollection?.description || "Choose a collection to view its saved requests."}
              </CardDescription>
              <CardAction>
                {selectedCollection ? (
                  <div className="flex gap-1">
                    <Button variant="outline" size="xs" onClick={() => router.push("/requests")}>
                      <Plus />
                      New request
                    </Button>
                  </div>
                ) : null}
              </CardAction>
            </CardHeader>
            <CardContent>
              {!selectedCollection ? (
                <EmptyState
                  icon={Folder}
                  title="Select a collection"
                  description="Choose a collection from the list to see its folders and requests."
                />
              ) : collectionRequests.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="No requests in this collection"
                  description="Save a request from the Request Builder to add it here."
                  action={
                    <Button size="sm" onClick={() => router.push("/requests")}>
                      Open Request Builder
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-5">
                  {folders.map(([folder, items]) => (
                    <div key={folder} className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <Folder className="size-3.5" />
                        {folder}
                        <span className="font-normal normal-case">({items.length})</span>
                      </div>
                      <div className="overflow-hidden rounded-lg border">
                        {items.map((request) => (
                          <div
                            key={request.id}
                            className="flex flex-col gap-3 border-b px-3 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={methodStyles[request.request.method]}>
                                  {request.request.method}
                                </Badge>
                                <span className="truncate text-sm font-medium">{request.name}</span>
                              </div>
                              <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={request.request.url}>
                                {request.request.url}
                              </p>
                              {request.description ? (
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  {request.description}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              <select
                                aria-label={`Move ${request.name}`}
                                className="h-7 rounded-lg border border-input bg-background px-2 text-xs outline-none"
                                value={request.collectionId}
                                onChange={(event) =>
                                  moveRequest(request.id, event.target.value, request.folder)
                                }
                              >
                                {collections.map((collection) => (
                                  <option key={collection.id} value={collection.id}>
                                    {collection.name}
                                  </option>
                                ))}
                              </select>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  openRequest(request.id);
                                  router.push("/requests");
                                }}
                                aria-label={`Open ${request.name}`}
                                title="Open in Request Builder"
                              >
                                <ExternalLink />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => duplicateRequest(request.id)}
                                aria-label={`Duplicate ${request.name}`}
                                title="Duplicate"
                              >
                                <Copy />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  if (window.confirm(`Delete "${request.name}"?`)) deleteRequest(request.id);
                                }}
                                aria-label={`Delete ${request.name}`}
                                title="Delete"
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      {dialog ? (
        <CollectionDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          collection={dialog.collection}
          onSubmit={handleCollectionSubmit}
        />
      ) : null}
    </div>
  );
}
