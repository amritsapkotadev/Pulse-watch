import { lookup as dnsLookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { Agent, interceptors, request } from "undici";

import {
  buildFinalUrl,
} from "@/lib/requests/url";
import {
  EXECUTION_ERROR_CODES,
  type ExecutionError,
  type ExecutionErrorCode,
  type ExecutionResult,
  type ExecuteRequestPayload,
  type HttpMethod,
} from "@/lib/requests/schema";

const TIMEOUT_MS = 10_000;
const CONNECT_TIMEOUT_MS = 6_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_REDIRECTS = 4;
const MAX_CONCURRENT_REQUESTS = 3;
const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 10_000;

const BLOCKED_HOSTNAMES = new Set([
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "instance-data.ec2.internal",
]);

const BLOCKED_IPV4_RANGES = new Set([
  "unspecified",
  "broadcast",
  "multicast",
  "linkLocal",
  "loopback",
  "carrierGradeNat",
  "private",
  "reserved",
  "benchmarking",
  "amt",
  "as112",
]);

const BLOCKED_IPV6_RANGES = new Set([
  "unspecified",
  "multicast",
  "linkLocal",
  "loopback",
  "uniqueLocal",
  "ipv4Mapped",
  "rfc6145",
  "rfc6052",
  "6to4",
  "teredo",
  "as112v6",
  "orchid2",
  "droneRemoteIdProtocolEntityTags",
  "reserved",
  "benchmarking",
  "amt",
]);

const FORBIDDEN_HEADERS = new Set([
  "connection",
  "content-length",
  "expect",
  "host",
  "keep-alive",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "proxy-authorization"]);

const STATUS_TEXTS: Record<number, string> = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  408: "Request Timeout",
  409: "Conflict",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

let activeRequests = 0;
const rateLimitBuckets = new Map<string, number[]>();

export class RequestExecutionError extends Error {
  readonly code: ExecutionErrorCode;

  constructor(code: ExecutionErrorCode, message: string) {
    super(message);
    this.name = "RequestExecutionError";
    this.code = code;
  }
}

function normalizeHostname(hostname: string): string {
  let value = hostname.trim().toLowerCase();
  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1);
  }
  if (value.endsWith(".")) {
    value = value.slice(0, -1);
  }
  return value;
}

function isBlockedHostname(hostname: string): boolean {
  return (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".test") ||
    hostname.includes("%")
  );
}

function assertSafeIp(address: string): void {
  if (!ipaddr.isValid(address)) {
    throw new RequestExecutionError("unsafe_target", "Resolved address is not a valid IP.");
  }

  let parsed = ipaddr.parse(address);
  if (parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()) {
    parsed = parsed.toIPv4Address();
  }

  const range = parsed.range();
  const blockedRanges = parsed.kind() === "ipv4" ? BLOCKED_IPV4_RANGES : BLOCKED_IPV6_RANGES;

  if (blockedRanges.has(range)) {
    throw new RequestExecutionError(
      "unsafe_target",
      "Requests to private, local, link-local, multicast, reserved, or metadata addresses are blocked.",
    );
  }
}

interface SafeAddress {
  address: string;
  family: 4 | 6;
  ttl: number;
}

async function resolveSafeAddresses(url: URL): Promise<SafeAddress[]> {
  const hostname = normalizeHostname(url.hostname);

  if (!hostname || isBlockedHostname(hostname)) {
    throw new RequestExecutionError(
      "unsafe_target",
      "Requests to local, internal, or metadata hostnames are blocked.",
    );
  }

  let records: SafeAddress[];

  if (ipaddr.isValid(hostname)) {
    assertSafeIp(hostname);
    records = [
      {
        address: ipaddr.parse(hostname).toNormalizedString(),
        family: ipaddr.parse(hostname).kind() === "ipv4" ? 4 : 6,
        ttl: 30,
      },
    ];
  } else {
    const resolved = await dnsLookup(hostname, { all: true, verbatim: true });
    if (resolved.length === 0) {
      throw new RequestExecutionError("unsafe_target", "Target hostname did not resolve.");
    }
    records = resolved.map((entry) => ({
      address: entry.address,
      family: entry.family === 6 ? 6 : 4,
      ttl: 30,
    }));
    for (const record of records) {
      assertSafeIp(record.address);
    }
  }

  return records;
}

function validateTarget(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new RequestExecutionError(
      "unsupported_protocol",
      "Only http and https URLs are supported.",
    );
  }
  if (url.username || url.password) {
    throw new RequestExecutionError(
      "unsafe_target",
      "Credentials embedded in URLs are not allowed; use the Authorization tab.",
    );
  }
}

function buildHeaders(payload: ExecuteRequestPayload, method: HttpMethod) {
  const headers: Record<string, string> = {
    accept: "*/*",
    "accept-encoding": "identity",
    "user-agent": "PulseWatch Request Builder/0.1",
  };

  for (const row of payload.headers) {
    if (!row.enabled || !row.key.trim()) continue;
    const name = row.key.trim().toLowerCase();
    if (FORBIDDEN_HEADERS.has(name)) continue;
    headers[name] = row.value;
  }

  if (payload.auth.type === "bearer" && payload.auth.token) {
    headers.authorization = `Bearer ${payload.auth.token}`;
  }

  if (payload.auth.type === "basic") {
    const credentials = Buffer.from(
      `${payload.auth.username}:${payload.auth.password}`,
      "utf8",
    ).toString("base64");
    headers.authorization = `Basic ${credentials}`;
  }

  if (
    payload.auth.type === "apiKey" &&
    payload.auth.in === "header" &&
    payload.auth.key.trim()
  ) {
    headers[payload.auth.key.trim().toLowerCase()] = payload.auth.value;
  }

  const sendsBody =
    payload.body.type !== "none" && method !== "GET" && method !== "HEAD";
  if (sendsBody && !headers["content-type"]) {
    headers["content-type"] =
      payload.body.type === "json"
        ? "application/json"
        : payload.body.type === "raw" && payload.body.contentType
          ? payload.body.contentType
          : "text/plain";
  }

  return headers;
}

function buildBody(payload: ExecuteRequestPayload, method: HttpMethod): Buffer | null {
  if (payload.body.type === "none" || method === "GET" || method === "HEAD") {
    return null;
  }
  return Buffer.from(payload.body.content, "utf8");
}

function stripSensitiveHeaders(headers: Record<string, string>, crossOrigin: boolean) {
  if (!crossOrigin) return headers;
  const safe: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!SENSITIVE_HEADERS.has(name.toLowerCase())) {
      safe[name] = value;
    }
  }
  return safe;
}

function normalizeResponseHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    result[name] = Array.isArray(value) ? value.join(", ") : value;
  }
  return result;
}

async function readResponseBody(
  body: AsyncIterable<Buffer> & { destroy?: () => void },
): Promise<{ body: string; size: number; truncated: boolean }> {
  const chunks: Buffer[] = [];
  let size = 0;
  let truncated = false;

  for await (const chunk of body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const remaining = MAX_RESPONSE_BYTES - size;

    if (remaining <= 0) {
      truncated = true;
      break;
    }

    if (buffer.length > remaining) {
      chunks.push(buffer.subarray(0, remaining));
      size = MAX_RESPONSE_BYTES;
      truncated = true;
      break;
    }

    chunks.push(buffer);
    size += buffer.length;
  }

  if (truncated) {
    body.destroy?.();
  }

  return {
    body: Buffer.concat(chunks).toString("utf8"),
    size,
    truncated,
  };
}

function mapUndiciError(error: unknown): RequestExecutionError {
  if (error instanceof RequestExecutionError) return error;

  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
  const message = error instanceof Error ? error.message : "The request could not be completed.";

  if (code.includes("TIMEOUT") || error?.toString?.().includes("AbortError")) {
    return new RequestExecutionError("timeout", "The request timed out.");
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return new RequestExecutionError("network_error", "The target hostname could not be resolved.");
  }
  return new RequestExecutionError("network_error", message);
}

function enforceRateLimit(clientKey: string): void {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const recent = (rateLimitBuckets.get(clientKey) ?? []).filter((timestamp) => timestamp > cutoff);

  if (recent.length >= RATE_LIMIT) {
    throw new RequestExecutionError(
      "rate_limited",
      "Too many requests. Please wait a few seconds and try again.",
    );
  }

  recent.push(now);
  rateLimitBuckets.set(clientKey, recent);

  if (rateLimitBuckets.size > 200) {
    for (const [key, timestamps] of rateLimitBuckets.entries()) {
      if (timestamps.every((timestamp) => timestamp <= cutoff)) {
        rateLimitBuckets.delete(key);
      }
    }
  }
}

async function withConcurrency<T>(task: () => Promise<T>): Promise<T> {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    throw new RequestExecutionError(
      "rate_limited",
      "Too many requests are in flight. Please try again shortly.",
    );
  }

  activeRequests += 1;
  try {
    return await task();
  } finally {
    activeRequests -= 1;
  }
}

export function getClientKey(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function getErrorStatus(code: ExecutionErrorCode): number {
  switch (code) {
    case "invalid_request":
    case "invalid_url":
    case "invalid_json_body":
    case "unsupported_protocol":
    case "unsafe_target":
      return 400;
    case "disabled":
      return 403;
    case "rate_limited":
      return 429;
    case "timeout":
      return 408;
    case "response_too_large":
      return 413;
    default:
      return 502;
  }
}

export function toExecutionError(error: unknown): ExecutionError {
  if (error instanceof RequestExecutionError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "execution_failed",
    message: error instanceof Error ? error.message : "The request could not be completed.",
  };
}

export function isExecutionErrorCode(value: string): value is ExecutionErrorCode {
  return (EXECUTION_ERROR_CODES as readonly string[]).includes(value);
}

export async function executeHttpRequest(
  payload: ExecuteRequestPayload,
  clientKey: string,
): Promise<ExecutionResult> {
  enforceRateLimit(clientKey);

  let currentUrl: URL;
  try {
    currentUrl = buildFinalUrl(payload, { includeSensitiveQueryAuth: true });
  } catch {
    throw new RequestExecutionError("invalid_url", "Enter a valid http or https URL.");
  }

  return withConcurrency(async () => {
    let method: HttpMethod = payload.method;
    let body = buildBody(payload, method);
    let headers = buildHeaders(payload, method);
    let redirected = false;

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      validateTarget(currentUrl);
      const addresses = await resolveSafeAddresses(currentUrl);

      const dispatcher = new Agent({
        connect: { timeout: CONNECT_TIMEOUT_MS },
        headersTimeout: TIMEOUT_MS,
        bodyTimeout: TIMEOUT_MS,
        keepAliveTimeout: 1_000,
      });
      const pinnedDispatcher = dispatcher.compose(
        interceptors.dns({
          lookup: (_origin, _options, callback) => {
            callback(null, addresses);
          },
        }),
      );

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const startedAt = performance.now();

      try {
        if (
          payload.body.type === "json" &&
          body &&
          body.length > 0 &&
          method !== "GET" &&
          method !== "HEAD"
        ) {
          try {
            JSON.parse(body.toString("utf8"));
          } catch {
            throw new RequestExecutionError(
              "invalid_json_body",
              "Request body must be valid JSON before sending.",
            );
          }
        }

        const response = await request(currentUrl, {
          method,
          headers,
          body,
          dispatcher: pinnedDispatcher,
          signal: controller.signal,
          headersTimeout: TIMEOUT_MS,
          bodyTimeout: TIMEOUT_MS,
        });

        const location = response.headers.location;
        const status = response.statusCode;
        const isRedirect =
          typeof location === "string" &&
          status >= 300 &&
          status < 400 &&
          redirectCount < MAX_REDIRECTS;

        if (isRedirect) {
          response.body.dump();
          const nextUrl = new URL(location, currentUrl);
          const crossOrigin = nextUrl.origin !== currentUrl.origin;
          headers = stripSensitiveHeaders(headers, crossOrigin);

          if (status === 303 || ((status === 301 || status === 302) && method === "POST")) {
            method = "GET";
            body = null;
            delete headers["content-type"];
          }

          currentUrl = nextUrl;
          redirected = true;
          continue;
        }

        if (
          typeof location === "string" &&
          status >= 300 &&
          status < 400 &&
          redirectCount === MAX_REDIRECTS
        ) {
          throw new RequestExecutionError(
            "unsafe_target",
            "The target redirected too many times.",
          );
        }

        const responseBody = await readResponseBody(response.body);
        const timeMs = Math.round(performance.now() - startedAt);

        return {
          status,
          statusText: response.statusText || STATUS_TEXTS[status] || "",
          timeMs,
          size: responseBody.size,
          body: responseBody.body,
          headers: normalizeResponseHeaders(response.headers),
          contentType:
            (typeof response.headers["content-type"] === "string"
              ? response.headers["content-type"]
              : undefined) ?? "",
          finalUrl: currentUrl.toString(),
          redirected,
          truncated: responseBody.truncated,
        };
      } catch (error) {
        throw mapUndiciError(error);
      } finally {
        clearTimeout(timeout);
        await dispatcher.close().catch(() => undefined);
      }
    }

    throw new RequestExecutionError("unsafe_target", "The target redirected too many times.");
  });
}
