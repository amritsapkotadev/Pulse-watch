"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  type Collection,
  type CollectionInput,
  type Environment,
  type EnvironmentInput,
  type EnvironmentVariable,
  type EnvironmentVariableInput,
  type SavedRequest,
  type SavedRequestInput,
  type WorkspaceData,
} from "@/lib/storage/schema";
import { createEmptyWorkspace, loadWorkspace, saveWorkspace } from "@/lib/storage/workspace-storage";

interface ImportCollectionInput {
  collection: CollectionInput;
  requests: Array<Omit<SavedRequestInput, "collectionId">>;
}

interface ImportEnvironmentInput extends EnvironmentInput {
  variables: EnvironmentVariableInput[];
}

interface PendingOpenRequest {
  id: string;
  key: string;
}

interface WorkspaceSnapshot {
  data: WorkspaceData;
  error: string | null;
}

interface WorkspaceContextValue {
  hydrated: boolean;
  storageError: string | null;
  clearStorageError: () => void;
  collections: Collection[];
  requests: SavedRequest[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  activeEnvironment: Environment | null;
  pendingRequest: PendingOpenRequest | null;
  createCollection: (input: CollectionInput) => Collection;
  updateCollection: (id: string, input: CollectionInput) => void;
  deleteCollection: (id: string) => void;
  importCollection: (input: ImportCollectionInput) => Collection;
  createRequest: (input: SavedRequestInput) => SavedRequest;
  updateRequest: (id: string, input: SavedRequestInput) => void;
  duplicateRequest: (id: string) => SavedRequest | null;
  deleteRequest: (id: string) => void;
  moveRequest: (id: string, collectionId: string, folder: string) => void;
  createEnvironment: (input: EnvironmentInput) => Environment;
  importEnvironment: (input: ImportEnvironmentInput) => Environment;
  updateEnvironment: (id: string, input: EnvironmentInput) => void;
  deleteEnvironment: (id: string) => void;
  addVariable: (environmentId: string, input: EnvironmentVariableInput) => void;
  updateVariable: (environmentId: string, variableId: string, input: EnvironmentVariableInput) => void;
  deleteVariable: (environmentId: string, variableId: string) => void;
  setActiveEnvironment: (id: string | null) => void;
  openRequest: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const SERVER_WORKSPACE_SNAPSHOT: WorkspaceSnapshot = {
  data: createEmptyWorkspace(),
  error: null,
};

let workspaceSnapshot: WorkspaceSnapshot | null = null;
const workspaceListeners = new Set<() => void>();

function subscribeWorkspace(listener: () => void): () => void {
  workspaceListeners.add(listener);
  return () => {
    workspaceListeners.delete(listener);
  };
}

function getWorkspaceSnapshot(): WorkspaceSnapshot {
  if (!workspaceSnapshot) {
    const loaded = loadWorkspace();
    workspaceSnapshot = { data: loaded.data, error: loaded.error };
  }
  return workspaceSnapshot;
}

function getServerWorkspaceSnapshot(): WorkspaceSnapshot {
  return SERVER_WORKSPACE_SNAPSHOT;
}

function emitWorkspace(): void {
  for (const listener of workspaceListeners) listener();
}

function commitWorkspace(updater: (current: WorkspaceData) => WorkspaceData): WorkspaceData {
  const current = getWorkspaceSnapshot();
  const next = updater(current.data);
  const error = saveWorkspace(next);
  workspaceSnapshot = { data: next, error };
  emitWorkspace();
  return next;
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribeWorkspace,
    getWorkspaceSnapshot,
    getServerWorkspaceSnapshot,
  );
  const [pendingRequest, setPendingRequest] = useState<PendingOpenRequest | null>(null);

  const hydrated = snapshot !== SERVER_WORKSPACE_SNAPSHOT;

  const clearStorageError = useCallback(() => {
    const current = getWorkspaceSnapshot();
    if (!current.error) return;
    workspaceSnapshot = { ...current, error: null };
    emitWorkspace();
  }, []);

  const createCollection = useCallback((input: CollectionInput): Collection => {
    const now = new Date().toISOString();
    const collection: Collection = {
      id: createId("collection"),
      name: input.name,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    };
    commitWorkspace((current) => ({ ...current, collections: [collection, ...current.collections] }));
    return collection;
  }, []);

  const updateCollection = useCallback((id: string, input: CollectionInput) => {
    const now = new Date().toISOString();
    commitWorkspace((current) => ({
      ...current,
      collections: current.collections.map((collection) =>
        collection.id === id ? { ...collection, ...input, updatedAt: now } : collection,
      ),
    }));
  }, []);

  const deleteCollection = useCallback((id: string) => {
    commitWorkspace((current) => ({
      ...current,
      collections: current.collections.filter((collection) => collection.id !== id),
      requests: current.requests.filter((request) => request.collectionId !== id),
    }));
  }, []);

  const importCollection = useCallback((input: ImportCollectionInput): Collection => {
    const now = new Date().toISOString();
    const collection: Collection = {
      id: createId("collection"),
      name: input.collection.name,
      description: input.collection.description,
      createdAt: now,
      updatedAt: now,
    };
    const requests: SavedRequest[] = input.requests.map((request) => ({
      ...request,
      id: createId("request"),
      collectionId: collection.id,
      createdAt: now,
      updatedAt: now,
    }));

    commitWorkspace((current) => ({
      ...current,
      collections: [collection, ...current.collections],
      requests: [...requests, ...current.requests],
    }));
    return collection;
  }, []);

  const createRequest = useCallback((input: SavedRequestInput): SavedRequest => {
    const now = new Date().toISOString();
    const request: SavedRequest = { ...input, id: createId("request"), createdAt: now, updatedAt: now };
    commitWorkspace((current) => ({
      ...current,
      requests: [request, ...current.requests],
      collections: current.collections.map((collection) =>
        collection.id === input.collectionId ? { ...collection, updatedAt: now } : collection,
      ),
    }));
    return request;
  }, []);

  const updateRequest = useCallback((id: string, input: SavedRequestInput) => {
    const now = new Date().toISOString();
    commitWorkspace((current) => ({
      ...current,
      requests: current.requests.map((request) =>
        request.id === id ? { ...request, ...input, updatedAt: now } : request,
      ),
      collections: current.collections.map((collection) =>
        collection.id === input.collectionId ? { ...collection, updatedAt: now } : collection,
      ),
    }));
  }, []);

  const duplicateRequest = useCallback((id: string): SavedRequest | null => {
    const source = getWorkspaceSnapshot().data.requests.find((request) => request.id === id);
    if (!source) return null;

    const now = new Date().toISOString();
    const duplicated: SavedRequest = {
      ...source,
      id: createId("request"),
      name: `${source.name} copy`,
      createdAt: now,
      updatedAt: now,
    };
    commitWorkspace((current) => ({
      ...current,
      requests: [duplicated, ...current.requests],
      collections: current.collections.map((collection) =>
        collection.id === source.collectionId ? { ...collection, updatedAt: now } : collection,
      ),
    }));
    return duplicated;
  }, []);

  const deleteRequest = useCallback((id: string) => {
    commitWorkspace((current) => ({
      ...current,
      requests: current.requests.filter((request) => request.id !== id),
    }));
  }, []);

  const moveRequest = useCallback((id: string, collectionId: string, folder: string) => {
    const now = new Date().toISOString();
    commitWorkspace((current) => ({
      ...current,
      requests: current.requests.map((request) =>
        request.id === id ? { ...request, collectionId, folder, updatedAt: now } : request,
      ),
      collections: current.collections.map((collection) =>
        collection.id === collectionId ? { ...collection, updatedAt: now } : collection,
      ),
    }));
  }, []);

  const createEnvironment = useCallback((input: EnvironmentInput): Environment => {
    const now = new Date().toISOString();
    const environment: Environment = {
      id: createId("environment"),
      name: input.name,
      description: input.description,
      variables: [],
      createdAt: now,
      updatedAt: now,
    };
    commitWorkspace((current) => ({
      ...current,
      environments: [environment, ...current.environments],
      activeEnvironmentId: current.activeEnvironmentId ?? environment.id,
    }));
    return environment;
  }, []);

  const importEnvironment = useCallback((input: ImportEnvironmentInput): Environment => {
    const now = new Date().toISOString();
    const environment: Environment = {
      id: createId("environment"),
      name: input.name,
      description: input.description,
      variables: input.variables.map((variable) => ({ ...variable, id: createId("variable") })),
      createdAt: now,
      updatedAt: now,
    };
    commitWorkspace((current) => ({
      ...current,
      environments: [environment, ...current.environments],
    }));
    return environment;
  }, []);

  const updateEnvironment = useCallback((id: string, input: EnvironmentInput) => {
    const now = new Date().toISOString();
    commitWorkspace((current) => ({
      ...current,
      environments: current.environments.map((environment) =>
        environment.id === id ? { ...environment, ...input, updatedAt: now } : environment,
      ),
    }));
  }, []);

  const deleteEnvironment = useCallback((id: string) => {
    commitWorkspace((current) => ({
      ...current,
      environments: current.environments.filter((environment) => environment.id !== id),
      activeEnvironmentId: current.activeEnvironmentId === id ? null : current.activeEnvironmentId,
    }));
  }, []);

  const addVariable = useCallback((environmentId: string, input: EnvironmentVariableInput) => {
    const now = new Date().toISOString();
    const variable: EnvironmentVariable = { ...input, id: createId("variable") };
    commitWorkspace((current) => ({
      ...current,
      environments: current.environments.map((environment) =>
        environment.id === environmentId
          ? {
              ...environment,
              variables: [...environment.variables, variable],
              updatedAt: now,
            }
          : environment,
      ),
    }));
  }, []);

  const updateVariable = useCallback(
    (environmentId: string, variableId: string, input: EnvironmentVariableInput) => {
      const now = new Date().toISOString();
      commitWorkspace((current) => ({
        ...current,
        environments: current.environments.map((environment) =>
          environment.id === environmentId
            ? {
                ...environment,
                variables: environment.variables.map((variable) =>
                  variable.id === variableId ? { ...variable, ...input } : variable,
                ),
                updatedAt: now,
              }
            : environment,
        ),
      }));
    },
    [],
  );

  const deleteVariable = useCallback((environmentId: string, variableId: string) => {
    const now = new Date().toISOString();
    commitWorkspace((current) => ({
      ...current,
      environments: current.environments.map((environment) =>
        environment.id === environmentId
          ? {
              ...environment,
              variables: environment.variables.filter((variable) => variable.id !== variableId),
              updatedAt: now,
            }
          : environment,
      ),
    }));
  }, []);

  const setActiveEnvironment = useCallback((id: string | null) => {
    commitWorkspace((current) => ({ ...current, activeEnvironmentId: id }));
  }, []);

  const openRequest = useCallback((id: string) => {
    setPendingRequest({ id, key: createId("open") });
  }, []);

  const activeEnvironment = useMemo(
    () =>
      snapshot.data.environments.find((environment) => environment.id === snapshot.data.activeEnvironmentId) ??
      null,
    [snapshot.data.activeEnvironmentId, snapshot.data.environments],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      hydrated,
      storageError: snapshot.error,
      clearStorageError,
      collections: snapshot.data.collections,
      requests: snapshot.data.requests,
      environments: snapshot.data.environments,
      activeEnvironmentId: snapshot.data.activeEnvironmentId,
      activeEnvironment,
      pendingRequest,
      createCollection,
      updateCollection,
      deleteCollection,
      importCollection,
      createRequest,
      updateRequest,
      duplicateRequest,
      deleteRequest,
      moveRequest,
      createEnvironment,
      importEnvironment,
      updateEnvironment,
      deleteEnvironment,
      addVariable,
      updateVariable,
      deleteVariable,
      setActiveEnvironment,
      openRequest,
    }),
    [
      activeEnvironment,
      addVariable,
      clearStorageError,
      snapshot.data.collections,
      createCollection,
      createEnvironment,
      createRequest,
      deleteCollection,
      deleteEnvironment,
      deleteRequest,
      deleteVariable,
      duplicateRequest,
      snapshot.data.environments,
      hydrated,
      importCollection,
      importEnvironment,
      moveRequest,
      openRequest,
      pendingRequest,
      snapshot.data.requests,
      setActiveEnvironment,
      snapshot.data.activeEnvironmentId,
      snapshot.error,
      updateCollection,
      updateEnvironment,
      updateRequest,
      updateVariable,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  }
  return context;
}
