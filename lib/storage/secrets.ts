import {
  type AuthConfig,
  type HeaderRow,
} from "@/lib/requests/schema";
import {
  workspaceDataSchema,
  type Environment,
  type WorkspaceData,
} from "@/lib/storage/schema";

const SECRET_PREFIX = "obf1:";
const SECRET_MASK = "pulsewatch-local-mvp-v1";

export function isSensitiveHeaderName(name: string): boolean {
  const value = name.trim().toLowerCase();
  return (
    value === "authorization" ||
    value === "cookie" ||
    value === "proxy-authorization" ||
    value.includes("api-key") ||
    value.includes("apikey") ||
    value.includes("token") ||
    value.includes("secret")
  );
}

export function obfuscateSecret(value: string): string {
  if (!value || value.startsWith(SECRET_PREFIX)) return value;

  const bytes = new TextEncoder().encode(value);
  const masked = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) {
    masked[index] = bytes[index] ^ SECRET_MASK.charCodeAt(index % SECRET_MASK.length);
  }

  let binary = "";
  for (const byte of masked) {
    binary += String.fromCharCode(byte);
  }
  return `${SECRET_PREFIX}${btoa(binary)}`;
}

export function deobfuscateSecret(value: string): string {
  if (!value.startsWith(SECRET_PREFIX)) return value;

  try {
    const binary = atob(value.slice(SECRET_PREFIX.length));
    const masked = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      masked[index] = binary.charCodeAt(index);
    }
    const bytes = new Uint8Array(masked.length);
    for (let index = 0; index < masked.length; index += 1) {
      bytes[index] = masked[index] ^ SECRET_MASK.charCodeAt(index % SECRET_MASK.length);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function encodeAuth(auth: AuthConfig): AuthConfig {
  switch (auth.type) {
    case "bearer":
      return { ...auth, token: obfuscateSecret(auth.token) };
    case "basic":
      return { ...auth, password: obfuscateSecret(auth.password) };
    case "apiKey":
      return { ...auth, value: obfuscateSecret(auth.value) };
    default:
      return auth;
  }
}

function decodeAuth(auth: AuthConfig): AuthConfig {
  switch (auth.type) {
    case "bearer":
      return { ...auth, token: deobfuscateSecret(auth.token) };
    case "basic":
      return { ...auth, password: deobfuscateSecret(auth.password) };
    case "apiKey":
      return { ...auth, value: deobfuscateSecret(auth.value) };
    default:
      return auth;
  }
}

function encodeHeaders(rows: HeaderRow[]): HeaderRow[] {
  return rows.map((row) =>
    isSensitiveHeaderName(row.key) ? { ...row, value: obfuscateSecret(row.value) } : row,
  );
}

function decodeHeaders(rows: HeaderRow[]): HeaderRow[] {
  return rows.map((row) =>
    isSensitiveHeaderName(row.key) ? { ...row, value: deobfuscateSecret(row.value) } : row,
  );
}

function encodeEnvironment(environment: Environment): Environment {
  return {
    ...environment,
    variables: environment.variables.map((variable) =>
      variable.secret ? { ...variable, value: obfuscateSecret(variable.value) } : variable,
    ),
  };
}

function decodeEnvironment(environment: Environment): Environment {
  return {
    ...environment,
    variables: environment.variables.map((variable) =>
      variable.secret ? { ...variable, value: deobfuscateSecret(variable.value) } : variable,
    ),
  };
}

export function serializeWorkspaceData(data: WorkspaceData): WorkspaceData {
  return {
    ...data,
    requests: data.requests.map((savedRequest) => ({
      ...savedRequest,
      request: {
        ...savedRequest.request,
        headers: encodeHeaders(savedRequest.request.headers),
        auth: encodeAuth(savedRequest.request.auth),
      },
    })),
    environments: data.environments.map(encodeEnvironment),
  };
}

export function deserializeWorkspaceData(
  value: unknown,
): { ok: true; data: WorkspaceData } | { ok: false; error: string } {
  const parsed = workspaceDataSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: "Stored workspace data has an invalid structure." };
  }

  return {
    ok: true,
    data: {
      ...parsed.data,
      requests: parsed.data.requests.map((savedRequest) => ({
        ...savedRequest,
        request: {
          ...savedRequest.request,
          headers: decodeHeaders(savedRequest.request.headers),
          auth: decodeAuth(savedRequest.request.auth),
        },
      })),
      environments: parsed.data.environments.map(decodeEnvironment),
    },
  };
}
