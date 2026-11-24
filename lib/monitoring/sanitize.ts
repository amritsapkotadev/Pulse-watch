const SENSITIVE_QUERY_KEY = /(api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|signature)/i;
const SENSITIVE_ASSIGNMENT = /\b(authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|cookie)\b\s*[:=]\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s,;]+)/gi;
const BEARER_TOKEN = /\bbearer\s+[A-Za-z0-9._~+/=-]+/gi;
const BASIC_TOKEN = /\bbasic\s+[A-Za-z0-9+/=]+/gi;
const URL_CREDENTIALS = /(\b[a-z][a-z\d+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi;

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_QUERY_KEY.test(key)) url.searchParams.set(key, "[REDACTED]");
    }
    return url.toString();
  } catch {
    return value;
  }
}

export function sanitizeErrorMessage(input: unknown, maxLength = 500): string {
  if (typeof input !== "string") return "The monitor check failed.";
  let value = input.replace(URL_CREDENTIALS, "$1[REDACTED]@");
  value = value.replace(SENSITIVE_ASSIGNMENT, "$1=[REDACTED]");
  value = value.replace(BEARER_TOKEN, "Bearer [REDACTED]");
  value = value.replace(BASIC_TOKEN, "Basic [REDACTED]");
  value = value.replace(/https?:\/\/[^\s"']+/gi, (match) => redactUrl(match));
  value = value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  if (!value) return "The monitor check failed.";
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export function sanitizePublicText(input: string, maxLength = 500): string {
  return sanitizeErrorMessage(input, maxLength);
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      /(authorization|cookie|token|secret|key)/i.test(key) ? "[REDACTED]" : value,
    ]),
  );
}
