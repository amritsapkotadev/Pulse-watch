import { z } from "zod";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;
export const AUTH_TYPES = ["none", "bearer", "basic", "apiKey"] as const;
export const BODY_TYPES = ["none", "json", "raw"] as const;
export const API_KEY_LOCATIONS = ["header", "query"] as const;

const headerNamePattern = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

const paramRowSchema = z
  .object({
    id: z.string().max(64),
    key: z.string().max(256),
    value: z.string().max(4096),
    enabled: z.boolean(),
  })
  .strict()
  .superRefine((row, context) => {
    if (row.enabled && !row.key.trim()) {
      context.addIssue({
        code: "custom",
        path: ["key"],
        message: "Enabled parameters need a key.",
      });
    }
  });

const headerRowSchema = z
  .object({
    id: z.string().max(64),
    key: z.string().max(256),
    value: z.string().max(4096),
    enabled: z.boolean(),
  })
  .strict()
  .superRefine((row, context) => {
    if (!row.enabled) return;

    if (!row.key.trim()) {
      context.addIssue({
        code: "custom",
        path: ["key"],
        message: "Enabled headers need a key.",
      });
      return;
    }

    if (!headerNamePattern.test(row.key.trim())) {
      context.addIssue({
        code: "custom",
        path: ["key"],
        message: "Header names cannot contain spaces or special characters.",
      });
    }

    if (/[\r\n]/.test(row.value)) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Header values cannot contain line breaks.",
      });
    }
  });

const authSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }).strict(),
  z.object({ type: z.literal("bearer"), token: z.string().max(4096) }).strict(),
  z
    .object({
      type: z.literal("basic"),
      username: z.string().max(4096),
      password: z.string().max(4096),
    })
    .strict(),
  z
    .object({
      type: z.literal("apiKey"),
      key: z.string().max(256),
      value: z.string().max(4096),
      in: z.enum(API_KEY_LOCATIONS),
    })
    .strict(),
]);

const bodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }).strict(),
  z.object({ type: z.literal("json"), content: z.string().max(65536) }).strict(),
  z
    .object({
      type: z.literal("raw"),
      content: z.string().max(65536),
      contentType: z.string().max(128),
    })
    .strict(),
]);

export const executeRequestSchema = z
  .object({
    method: z.enum(HTTP_METHODS),
    url: z.string().trim().min(1, "Enter a request URL.").max(2048),
    params: z.array(paramRowSchema).max(100),
    headers: z.array(headerRowSchema).max(100),
    auth: authSchema,
    body: bodySchema,
  })
  .strict();

export type HttpMethod = (typeof HTTP_METHODS)[number];
export type AuthType = (typeof AUTH_TYPES)[number];
export type BodyType = (typeof BODY_TYPES)[number];
export type ApiKeyLocation = (typeof API_KEY_LOCATIONS)[number];
export type ParamRow = z.output<typeof paramRowSchema>;
export type HeaderRow = z.output<typeof headerRowSchema>;
export type AuthConfig = z.output<typeof authSchema>;
export type BodyConfig = z.output<typeof bodySchema>;
export type ExecuteRequestPayload = z.output<typeof executeRequestSchema>;

export const EXECUTION_ERROR_CODES = [
  "invalid_request",
  "disabled",
  "rate_limited",
  "unsupported_protocol",
  "unsafe_target",
  "invalid_url",
  "invalid_json_body",
  "timeout",
  "network_error",
  "response_too_large",
  "execution_failed",
] as const;

export type ExecutionErrorCode = (typeof EXECUTION_ERROR_CODES)[number];

export interface ExecutionError {
  code: ExecutionErrorCode;
  message: string;
}

export interface ExecutionResult {
  status: number;
  statusText: string;
  timeMs: number;
  size: number;
  body: string;
  headers: Record<string, string>;
  contentType: string;
  finalUrl: string;
  redirected: boolean;
  truncated: boolean;
}

export type ExecutionResponse =
  | { ok: true; data: ExecutionResult }
  | { ok: false; error: ExecutionError };
