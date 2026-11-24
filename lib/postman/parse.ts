import { z } from "zod";

import {
  HTTP_METHODS,
  type BodyConfig,
  type HeaderRow,
  type HttpMethod,
  type ParamRow,
} from "@/lib/requests/schema";
import type {
  CollectionInput,
  EnvironmentInput,
  EnvironmentVariableInput,
  SavedRequestInput,
} from "@/lib/storage/schema";

const postmanDescriptionSchema = z.union([
  z.string(),
  z.looseObject({ content: z.string().optional() }),
]);

const postmanVariableSchema = z.looseObject({
  key: z.string(),
  value: z.unknown(),
});

const postmanCollectionSchema = z.looseObject({
  info: z.looseObject({
    name: z.string().min(1),
    description: postmanDescriptionSchema.optional(),
    schema: z.string().optional(),
  }),
  item: z.array(z.unknown()),
  variable: z.array(postmanVariableSchema).optional(),
  event: z.array(z.unknown()).optional(),
});

type JsonRecord = Record<string, unknown>;

interface ImportedEnvironment extends EnvironmentInput {
  variables: EnvironmentVariableInput[];
}

export interface PostmanImportResult {
  collection: CollectionInput;
  requests: Array<Omit<SavedRequestInput, "collectionId">>;
  environment: ImportedEnvironment | null;
  warnings: string[];
  skipped: number;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDescription(value: unknown): string {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.content === "string") return value.content;
  return "";
}

function partToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.filter((part): part is string => typeof part === "string").join("/");
  }
  return "";
}

function parseUrl(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (!isRecord(raw)) return "";

  if (typeof raw.raw === "string" && raw.raw.trim()) return raw.raw;

  const protocol = typeof raw.protocol === "string" ? raw.protocol : "https";
  const host = partToString(raw.host).replace(/^\/+|\/+$/g, "");
  const path = partToString(raw.path).replace(/^\/+/, "");
  let url = `${protocol}://${host}${path ? `/${path}` : ""}`;

  if (Array.isArray(raw.query)) {
    const params = new URLSearchParams();
    for (const item of raw.query) {
      if (!isRecord(item) || typeof item.key !== "string" || item.disabled === true) continue;
      params.append(item.key, typeof item.value === "string" ? item.value : "");
    }
    const query = params.toString();
    if (query) url += `?${query}`;
  }

  return host ? url : "";
}

function parseParams(raw: unknown): ParamRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((item, index) => ({
    id: `param-import-${index}`,
    key: typeof item.key === "string" ? item.key : "",
    value: typeof item.value === "string" ? item.value : "",
    enabled: item.disabled !== true,
  }));
}

function parseHeaders(raw: unknown): HeaderRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((item, index) => ({
    id: `header-import-${index}`,
    key: typeof item.key === "string" ? item.key : "",
    value: typeof item.value === "string" ? item.value : "",
    enabled: item.disabled !== true,
  }));
}

function authValue(auth: JsonRecord, name: string): string {
  const entries = auth[name];
  if (!Array.isArray(entries)) return "";
  const entry = entries.find(
    (item) => isRecord(item) && typeof item.key === "string" && item.key.toLowerCase() === name,
  );
  if (!isRecord(entry) || typeof entry.value !== "string") return "";
  return entry.value;
}

function parseAuth(raw: unknown, name: string, warnings: string[]) {
  if (!isRecord(raw) || typeof raw.type !== "string" || raw.type === "noauth") {
    return { type: "none" } as const;
  }

  switch (raw.type) {
    case "bearer":
      return { type: "bearer", token: authValue(raw, "bearer") || authValue(raw, "token") } as const;
    case "basic":
      return {
        type: "basic",
        username: authValue(raw, "username"),
        password: authValue(raw, "password"),
      } as const;
    case "apikey": {
      let location: "header" | "query" = "header";
      const entries = raw.apikey;
      if (Array.isArray(entries)) {
        const locationEntry = entries.find(
          (item) => isRecord(item) && typeof item.key === "string" && item.key.toLowerCase() === "in",
        );
        if (isRecord(locationEntry) && locationEntry.value === "query") location = "query";
      }
      return {
        type: "apiKey",
        key: authValue(raw, "key"),
        value: authValue(raw, "value"),
        in: location,
      } as const;
    }
    default:
      warnings.push(`"${name}": ${raw.type} authorization is not supported; imported without auth.`);
      return { type: "none" } as const;
  }
}

function parseBody(raw: unknown, headers: HeaderRow[], name: string, warnings: string[]): BodyConfig {
  if (!isRecord(raw) || typeof raw.mode !== "string") return { type: "none" };

  const contentTypeHeader = headers.find(
    (header) => header.key.trim().toLowerCase() === "content-type",
  );
  const contentType = contentTypeHeader?.value ?? "";

  if (raw.mode === "raw") {
    const content = typeof raw.raw === "string" ? raw.raw : "";
    const language =
      isRecord(raw.options) && isRecord(raw.options.raw) && typeof raw.options.raw.language === "string"
        ? raw.options.raw.language
        : "";
    const isJson = contentType.toLowerCase().includes("json") || language === "json";
    return isJson
      ? { type: "json", content }
      : { type: "raw", content, contentType: contentType || "text/plain" };
  }

  if (raw.mode === "urlencoded" && Array.isArray(raw.urlencoded)) {
    const params = new URLSearchParams();
    for (const item of raw.urlencoded) {
      if (!isRecord(item) || typeof item.key !== "string" || item.disabled === true) continue;
      params.append(item.key, typeof item.value === "string" ? item.value : "");
    }
    warnings.push(`"${name}": urlencoded body was converted to raw text.`);
    return { type: "raw", content: params.toString(), contentType: "application/x-www-form-urlencoded" };
  }

  if (raw.mode === "formdata" || raw.mode === "file" || raw.mode === "graphql") {
    warnings.push(
      `"${name}": ${raw.mode} request bodies are not supported and were not imported.`,
    );
  }

  return { type: "none" };
}

function parseVariables(raw: unknown, warnings: string[]): EnvironmentVariableInput[] {
  if (!Array.isArray(raw)) return [];

  const variables: EnvironmentVariableInput[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.key !== "string" || !item.key.trim()) continue;
    const key = item.key.trim();
    const secret = /token|secret|password|api[_-]?key/i.test(key);
    variables.push({
      key,
      value: typeof item.value === "string" ? item.value : "",
      secret,
    });
  }

  if (variables.length > 0) {
    warnings.push("Collection variables were imported as a new environment but were not activated.");
  }
  return variables;
}

function parseRequest(
  raw: unknown,
  name: string,
  folder: string,
  warnings: string[],
): Omit<SavedRequestInput, "collectionId"> | null {
  let request: JsonRecord;
  if (typeof raw === "string") {
    request = { method: "GET", url: raw };
  } else if (isRecord(raw)) {
    request = raw;
  } else {
    warnings.push(`"${name}": request definition was not recognized and was skipped.`);
    return null;
  }

  const method = (typeof request.method === "string" ? request.method : "GET").toUpperCase();
  if (!(HTTP_METHODS as readonly string[]).includes(method)) {
    warnings.push(`"${name}": ${method} is not supported and was skipped.`);
    return null;
  }

  const headers = parseHeaders(request.header);
  const params = parseParams(isRecord(request.url) ? request.url.query : undefined);
  const url = parseUrl(request.url);
  if (!url.trim()) {
    warnings.push(`"${name}": no valid URL was found and it was skipped.`);
    return null;
  }

  return {
    name,
    description: parseDescription(request.description),
    folder,
    request: {
      method: method as HttpMethod,
      url,
      params,
      headers,
      auth: parseAuth(request.auth, name, warnings),
      body: parseBody(request.body, headers, name, warnings),
    },
  };
}

export function parsePostmanCollection(text: string): PostmanImportResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Uploaded file is not valid JSON.");
  }

  const parsed = postmanCollectionSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("File does not look like a Postman Collection v2.1 collection.");
  }

  const warnings: string[] = [];
  const requests: Array<Omit<SavedRequestInput, "collectionId">> = [];
  let skipped = 0;

  if (parsed.data.info.schema && !parsed.data.info.schema.includes("postman-collection")) {
    warnings.push("Collection schema metadata did not match Postman Collection v2.1.");
  }
  if (parsed.data.event?.length) {
    warnings.push("Collection scripts and events were not imported.");
  }

  const variables = parseVariables(parsed.data.variable, warnings);
  const description = parseDescription(parsed.data.info.description);

  function walk(items: unknown[], folders: string[]): void {
    for (const item of items) {
      if (!isRecord(item)) {
        skipped += 1;
        continue;
      }

      const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Untitled";
      if (Array.isArray(item.item)) {
        walk(item.item, [...folders, name]);
        continue;
      }

      if (Array.isArray(item.event) && item.event.length > 0) {
        warnings.push(`"${name}": request scripts were not imported.`);
      }

      if (!("request" in item)) {
        skipped += 1;
        warnings.push(`"${name}": no request definition was found and it was skipped.`);
        continue;
      }

      const request = parseRequest(item.request, name, folders.join(" / ") || "Imported", warnings);
      if (request) requests.push(request);
      else skipped += 1;
    }
  }

  walk(parsed.data.item, []);

  return {
    collection: {
      name: parsed.data.info.name,
      description: description || `Imported Postman collection: ${parsed.data.info.name}`,
    },
    requests,
    environment:
      variables.length > 0
        ? {
            name: `${parsed.data.info.name} variables`,
            description: `Variables imported from ${parsed.data.info.name}.`,
            variables,
          }
        : null,
    warnings,
    skipped,
  };
}
