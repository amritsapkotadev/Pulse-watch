import type { ExecutionResponse, ExecuteRequestPayload } from "./schema";

export async function executeRequest(
  payload: ExecuteRequestPayload,
): Promise<ExecutionResponse> {
  try {
    const response = await fetch("/api/requests/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as ExecutionResponse | null;

    if (!data || typeof data !== "object" || !("ok" in data)) {
      return {
        ok: false,
        error: {
          code: "execution_failed",
          message: `Request failed with status ${response.status}.`,
        },
      };
    }

    return data;
  } catch {
    return {
      ok: false,
      error: {
        code: "network_error",
        message: "Could not reach the PulseWatch request executor.",
      },
    };
  }
}
