import type { MonitorStatusValue } from "@/lib/monitoring/types";
import type {
  StatusBucketState,
  StatusCountInput,
  StatusOverallState,
  StatusServiceState,
} from "@/lib/status/types";

export function deriveServiceState(
  currentStatus: MonitorStatusValue,
  failedChecks24h: number,
  hasChecks: boolean,
): StatusServiceState {
  if (currentStatus === "DOWN") return "DOWN";
  if (currentStatus !== "UP" || !hasChecks) return "UNKNOWN";
  return failedChecks24h > 0 ? "DEGRADED" : "UP";
}

export function deriveOverallState(monitors: StatusCountInput[]): StatusOverallState {
  if (monitors.length === 0) return "NO_DATA";
  if (monitors.some((monitor) => monitor.status === "DOWN")) return "OUTAGE";
  if (monitors.every((monitor) => monitor.status === "UNKNOWN")) return "NO_DATA";
  if (monitors.some((monitor) => monitor.status === "DEGRADED" || monitor.status === "UNKNOWN")) {
    return "DEGRADED";
  }
  return "OPERATIONAL";
}

export function deriveBucketState(
  successfulChecks: number,
  failedChecks: number,
  totalChecks: number,
): StatusBucketState {
  if (totalChecks === 0 || successfulChecks + failedChecks === 0) return "UNKNOWN";
  if (failedChecks === 0) return "UP";
  if (successfulChecks === 0) return "DOWN";
  return "DEGRADED";
}

export function statusLabel(state: StatusServiceState | StatusOverallState | StatusBucketState): string {
  switch (state) {
    case "UP":
    case "OPERATIONAL":
      return "Operational";
    case "DEGRADED":
      return "Degraded";
    case "DOWN":
    case "OUTAGE":
      return "Outage";
    case "UNKNOWN":
    case "NO_DATA":
      return "No data";
  }
}

export function overallStatusMessage(state: StatusOverallState): string {
  switch (state) {
    case "OPERATIONAL":
      return "All Systems Operational.";
    case "DEGRADED":
      return "Partial System Degradation.";
    case "OUTAGE":
      return "Major System Outage.";
    case "NO_DATA":
      return "Monitoring Data Delayed.";
  }
}
