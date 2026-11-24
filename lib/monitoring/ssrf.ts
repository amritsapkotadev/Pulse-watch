import { RequestExecutionError, resolveSafeAddresses, validateTarget } from "@/lib/server/request-executor";

export async function validateMonitorTarget(value: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RequestExecutionError("invalid_url", "Enter a valid http or https URL.");
  }

  validateTarget(url);
  await resolveSafeAddresses(url);
  return url;
}

export function isUnsafeTargetError(error: unknown): boolean {
  return (
    error instanceof RequestExecutionError &&
    (error.code === "unsafe_target" || error.code === "unsupported_protocol" || error.code === "invalid_url")
  );
}
