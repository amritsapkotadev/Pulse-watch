import { z } from "zod";

export const historyRangeSchema = z.enum(["24h", "7d", "30d"]);
export type HistoryRange = z.output<typeof historyRangeSchema>;

export const monitorStatusSchema = z.enum(["UP", "DOWN", "UNKNOWN"]);
export type MonitorStatusValue = z.output<typeof monitorStatusSchema>;

export const incidentSeveritySchema = z.enum(["INFO", "WARNING", "CRITICAL"]);
export type IncidentSeverityValue = z.output<typeof incidentSeveritySchema>;

export const incidentStatusSchema = z.enum(["ACTIVE", "RESOLVED"]);
export type IncidentStatusValue = z.output<typeof incidentStatusSchema>;

export const publicIncidentSchema = z.object({
  id: z.string(),
  monitorId: z.string(),
  monitorName: z.string(),
  title: z.string(),
  description: z.string(),
  severity: incidentSeveritySchema,
  status: incidentStatusSchema,
  startedAt: z.string(),
  resolvedAt: z.string().nullable(),
});
export type PublicIncidentDto = z.output<typeof publicIncidentSchema>;

export const publicMonitorSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  currentStatus: monitorStatusSchema,
  lastCheckedAt: z.string().nullable(),
  lastResponseTime: z.number().nullable(),
  uptimePercentage: z.number(),
  isActive: z.boolean(),
});
export type PublicMonitorDto = z.output<typeof publicMonitorSchema>;

export const overviewSchema = z.object({
  totalMonitors: z.number(),
  operationalMonitors: z.number(),
  downMonitors: z.number(),
  unknownMonitors: z.number(),
  uptimePercentage: z.number(),
  averageResponseTimeMs: z.number(),
  recentIncidents: z.array(publicIncidentSchema),
});
export type OverviewDto = z.output<typeof overviewSchema>;

export const historyPointSchema = z.object({
  checkedAt: z.string(),
  status: monitorStatusSchema,
  statusCode: z.number().nullable(),
  responseTime: z.number(),
});
export type HistoryPointDto = z.output<typeof historyPointSchema>;

export const monitorHistorySchema = z.object({
  monitorId: z.string(),
  range: historyRangeSchema,
  points: z.array(historyPointSchema),
  totalChecks: z.number(),
  uptimePercentage: z.number(),
  averageResponseTimeMs: z.number(),
});
export type MonitorHistoryDto = z.output<typeof monitorHistorySchema>;

export const publicMonitorsResponseSchema = z.object({
  monitors: z.array(publicMonitorSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type PublicMonitorsResponse = z.output<typeof publicMonitorsResponseSchema>;

export const publicIncidentsResponseSchema = z.object({
  incidents: z.array(publicIncidentSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type PublicIncidentsResponse = z.output<typeof publicIncidentsResponseSchema>;

export interface DashboardData {
  generatedAt: string;
  stats: {
    totalMonitors: number;
    operationalMonitors: number;
    downMonitors: number;
    unknownMonitors: number;
    averageResponseTimeMs: number;
    uptimePercentage: number;
  };
  monitors: PublicMonitorDto[];
  incidents: PublicIncidentDto[];
  history: Array<{ label: string; responseTime: number; status: MonitorStatusValue }>;
  hasData: boolean;
}
