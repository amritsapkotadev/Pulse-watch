import type { ExecuteRequestPayload, ParamRow } from "./schema";

interface BuildUrlOptions {
  includeSensitiveQueryAuth?: boolean;
}

function appendRows(url: URL, rows: ParamRow[]) {
  for (const row of rows) {
    if (!row.enabled || !row.key.trim()) continue;
    url.searchParams.append(row.key.trim(), row.value);
  }
}

export function buildFinalUrl(
  payload: ExecuteRequestPayload,
  options: BuildUrlOptions = {},
): URL {
  const url = new URL(payload.url);
  appendRows(url, payload.params);

  if (
    options.includeSensitiveQueryAuth !== false &&
    payload.auth.type === "apiKey" &&
    payload.auth.in === "query" &&
    payload.auth.key.trim()
  ) {
    url.searchParams.append(payload.auth.key.trim(), payload.auth.value);
  }

  return url;
}
