import { deserializeWorkspaceData, serializeWorkspaceData } from "@/lib/storage/secrets";
import {
  WORKSPACE_SCHEMA_VERSION,
  WORKSPACE_STORAGE_KEY,
  type WorkspaceData,
} from "@/lib/storage/schema";

export interface WorkspaceLoadResult {
  data: WorkspaceData;
  error: string | null;
  recovered: boolean;
}

export function createEmptyWorkspace(): WorkspaceData {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    collections: [],
    requests: [],
    environments: [],
    activeEnvironmentId: null,
  };
}

function backupCorruptedValue(raw: string): void {
  try {
    window.localStorage.setItem(`${WORKSPACE_STORAGE_KEY}.corrupt.${Date.now()}`, raw);
  } catch {
    return;
  }
}

export function loadWorkspace(): WorkspaceLoadResult {
  if (typeof window === "undefined") {
    return { data: createEmptyWorkspace(), error: null, recovered: false };
  }

  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) {
      return { data: createEmptyWorkspace(), error: null, recovered: false };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      backupCorruptedValue(raw);
      return {
        data: createEmptyWorkspace(),
        error: "Stored workspace data was corrupted and has been reset. A backup was kept in localStorage.",
        recovered: true,
      };
    }

    const result = deserializeWorkspaceData(parsed);
    if (!result.ok) {
      backupCorruptedValue(raw);
      return {
        data: createEmptyWorkspace(),
        error: `${result.error} The workspace was reset and a backup was kept in localStorage.`,
        recovered: true,
      };
    }

    return { data: result.data, error: null, recovered: false };
  } catch {
    return {
      data: createEmptyWorkspace(),
      error: "Browser storage is unavailable. Changes will not persist.",
      recovered: false,
    };
  }
}

export function saveWorkspace(data: WorkspaceData): string | null {
  if (typeof window === "undefined") return null;

  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(serializeWorkspaceData(data)));
    return null;
  } catch {
    return "Could not save workspace data. Browser storage may be full or unavailable.";
  }
}
