import type {
  HistoryRange,
  IncidentSeverityValue,
  IncidentStatusValue,
  MonitorStatusValue,
} from "@/lib/monitoring/types";

export type StatusRange = HistoryRange;

export type StatusServiceState = MonitorStatusValue | "DEGRADED";

export type StatusOverallState = "OPERATIONAL" | "DEGRADED" | "OUTAGE" | "NO_DATA";

export type StatusBucketState = "UP" | "DEGRADED" | "DOWN" | "UNKNOWN";

export interface StatusCountInput {
  status: StatusServiceState;
}

export interface StatusUptimeBucketDto {
  bucket: string;
  label: string;
  state: StatusBucketState;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  uptimePercentage: number;
  averageResponseTimeMs: number | null;
}

export interface StatusMonitorDto {
  id: string;
  name: string;
  description: string;
  status: StatusServiceState;
  lastCheckedAt: string | null;
  lastResponseTimeMs: number | null;
  lastSuccessfulCheckAt: string | null;
  recentFailures24h: number;
  determinateChecks24h: number;
  hasHistory: boolean;
  uptime: Record<StatusRange, number>;
  history: StatusUptimeBucketDto[];
}

export interface StatusIncidentUpdateDto {
  id: string;
  label: string;
  at: string;
  detail: string | null;
}

export interface StatusIncidentDto {
  id: string;
  monitorId: string;
  monitorName: string;
  title: string;
  severity: IncidentSeverityValue;
  status: IncidentStatusValue;
  startedAt: string;
  resolvedAt: string | null;
  lastSeenAt: string;
  occurrenceCount: number;
  durationMs: number;
  updates: StatusIncidentUpdateDto[];
}

export interface StatusOverviewDto {
  status: StatusOverallState;
  generatedAt: string;
  latestCheckAt: string | null;
  range: StatusRange;
  counts: {
    total: number;
    operational: number;
    degraded: number;
    down: number;
    noData: number;
  };
  uptimePercentage: number;
  averageResponseTimeMs: number | null;
  activeIncidents: number;
}

export interface StatusSnapshotDto {
  overview: StatusOverviewDto;
  monitors: StatusMonitorDto[];
  incidents: StatusIncidentDto[];
}

export interface StatusIncidentsDto {
  range: StatusRange;
  generatedAt: string;
  total: number;
  page: number;
  pageSize: number;
  incidents: StatusIncidentDto[];
}
