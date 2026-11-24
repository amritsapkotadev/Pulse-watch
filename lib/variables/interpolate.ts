import type {
  AuthConfig,
  BodyConfig,
  ExecuteRequestPayload,
  HeaderRow,
  ParamRow,
} from "@/lib/requests/schema";

export type VariableValues = Record<string, string>;

export interface MissingVariable {
  name: string;
  location: string;
}

export interface InterpolationResult<T> {
  value: T;
  missing: MissingVariable[];
}

const VARIABLE_PATTERN = /{{\s*([^{}]+?)\s*}}/g;

export function interpolateString(
  value: string,
  variables: VariableValues,
): { value: string; missing: string[] } {
  const missing: string[] = [];
  const resolved = value.replace(VARIABLE_PATTERN, (match, rawName: string) => {
    const name = rawName.trim();
    if (!Object.prototype.hasOwnProperty.call(variables, name)) {
      missing.push(name);
      return match;
    }
    return variables[name];
  });
  return { value: resolved, missing };
}

function dedupeMissing(missing: MissingVariable[]): MissingVariable[] {
  const seen = new Set<string>();
  return missing.filter((item) => {
    const key = `${item.name}:${item.location}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function interpolateRequest(
  request: ExecuteRequestPayload,
  variables: VariableValues,
): InterpolationResult<ExecuteRequestPayload> {
  const missing: MissingVariable[] = [];

  function resolve(value: string, location: string): string {
    const result = interpolateString(value, variables);
    for (const name of result.missing) missing.push({ name, location });
    return result.value;
  }

  function resolveParams(rows: ParamRow[]): ParamRow[] {
    return rows.map((row) => ({
      ...row,
      key: resolve(row.key, "query parameters"),
      value: resolve(row.value, "query parameters"),
    }));
  }

  function resolveHeaders(rows: HeaderRow[]): HeaderRow[] {
    return rows.map((row) => ({
      ...row,
      key: resolve(row.key, "headers"),
      value: resolve(row.value, "headers"),
    }));
  }

  function resolveAuth(auth: AuthConfig): AuthConfig {
    switch (auth.type) {
      case "bearer":
        return { ...auth, token: resolve(auth.token, "authorization") };
      case "basic":
        return {
          ...auth,
          username: resolve(auth.username, "authorization"),
          password: resolve(auth.password, "authorization"),
        };
      case "apiKey":
        return {
          ...auth,
          key: resolve(auth.key, "authorization"),
          value: resolve(auth.value, "authorization"),
        };
      default:
        return auth;
    }
  }

  function resolveBody(body: BodyConfig): BodyConfig {
    switch (body.type) {
      case "json":
        return { ...body, content: resolve(body.content, "request body") };
      case "raw":
        return {
          ...body,
          content: resolve(body.content, "request body"),
          contentType: resolve(body.contentType, "request body"),
        };
      default:
        return body;
    }
  }

  return {
    value: {
      ...request,
      url: resolve(request.url, "URL"),
      params: resolveParams(request.params),
      headers: resolveHeaders(request.headers),
      auth: resolveAuth(request.auth),
      body: resolveBody(request.body),
    },
    missing: dedupeMissing(missing),
  };
}
