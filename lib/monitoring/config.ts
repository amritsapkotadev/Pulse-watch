export const MONITORING_DEFAULTS = {
  failureThreshold: 2,
  intervalMinutes: 5,
  timeoutSeconds: 10,
  expectedStatus: 200,
  leaseSeconds: 60,
  batchSize: 10,
  maxConcurrentChecks: 3,
  historyLimit: 500,
  pageSize: 25,
  maxPageSize: 100,
} as const;

function positiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function getFailureThreshold(): number {
  return positiveInt(process.env.MONITOR_FAILURE_THRESHOLD, MONITORING_DEFAULTS.failureThreshold, 20);
}

export function getBatchSize(): number {
  return positiveInt(process.env.MONITOR_BATCH_SIZE, MONITORING_DEFAULTS.batchSize, 50);
}

export function getMaxConcurrentChecks(): number {
  return positiveInt(
    process.env.MONITOR_MAX_CONCURRENT_CHECKS,
    MONITORING_DEFAULTS.maxConcurrentChecks,
    10,
  );
}

export function getLeaseSeconds(): number {
  return positiveInt(process.env.MONITOR_LEASE_SECONDS, MONITORING_DEFAULTS.leaseSeconds, 600);
}

export function getCronSecret(): string | null {
  const value = process.env.CRON_SECRET;
  return value && value.length >= 16 ? value : null;
}

export function getAuthSecret(): string | null {
  const value = process.env.AUTH_SECRET;
  return value && value.length >= 32 ? value : null;
}

export function getAppUrl(): string {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return value ? value : "http://localhost:3000";
}
