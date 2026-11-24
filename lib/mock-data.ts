export const MOCK_DATA_NOTICE =
  "Demo data only — values shown are illustrative, not live monitoring results.";

export type MonitorStatus = "operational" | "degraded" | "down";
export type IncidentSeverity = "critical" | "high" | "medium" | "low";
export type IncidentStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved";

export interface MonitorRecord {
  id: string;
  name: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  status: MonitorStatus;
  responseTimeMs: number;
  lastChecked: string;
}

export interface IncidentRecord {
  id: string;
  title: string;
  endpoint: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  time: string;
}

export interface ResponseTimePoint {
  time: string;
  responseTime: number;
}

export const dashboardStats = {
  totalMonitors: 24,
  operational: 21,
  down: 2,
  degraded: 1,
  averageResponseTimeMs: 184,
  uptimePercentage: 99.92,
  uptimeChangePercentage: 0.04,
} as const;

export const recentMonitors: MonitorRecord[] = [
  {
    id: "mon-001",
    name: "Portfolio API",
    endpoint: "https://api.acme.dev/v1/portfolio",
    method: "GET",
    status: "operational",
    responseTimeMs: 142,
    lastChecked: "2 min ago",
  },
  {
    id: "mon-002",
    name: "NEPSE Data API",
    endpoint: "https://api.acme.dev/v1/nepse/quotes",
    method: "GET",
    status: "degraded",
    responseTimeMs: 486,
    lastChecked: "3 min ago",
  },
  {
    id: "mon-003",
    name: "Authentication API",
    endpoint: "https://api.acme.dev/v1/auth/token",
    method: "POST",
    status: "operational",
    responseTimeMs: 118,
    lastChecked: "2 min ago",
  },
  {
    id: "mon-004",
    name: "User Service",
    endpoint: "https://api.acme.dev/v1/users/me",
    method: "GET",
    status: "operational",
    responseTimeMs: 176,
    lastChecked: "1 min ago",
  },
  {
    id: "mon-005",
    name: "Payment API",
    endpoint: "https://api.acme.dev/v1/payments/status",
    method: "GET",
    status: "down",
    responseTimeMs: 0,
    lastChecked: "4 min ago",
  },
];

export const recentIncidents: IncidentRecord[] = [
  {
    id: "inc-1042",
    title: "Elevated latency on checkout",
    endpoint: "Payment API",
    severity: "high",
    status: "monitoring",
    time: "18 min ago",
  },
  {
    id: "inc-1041",
    title: "Intermittent timeout on quote sync",
    endpoint: "NEPSE Data API",
    severity: "medium",
    status: "identified",
    time: "1 hr ago",
  },
  {
    id: "inc-1040",
    title: "Token validation failure spike",
    endpoint: "Authentication API",
    severity: "critical",
    status: "investigating",
    time: "3 hrs ago",
  },
  {
    id: "inc-1039",
    title: "Portfolio response delay",
    endpoint: "Portfolio API",
    severity: "low",
    status: "resolved",
    time: "Yesterday",
  },
];

export const responseTimeData: ResponseTimePoint[] = [
  { time: "00:00", responseTime: 172 },
  { time: "01:00", responseTime: 168 },
  { time: "02:00", responseTime: 161 },
  { time: "03:00", responseTime: 158 },
  { time: "04:00", responseTime: 165 },
  { time: "05:00", responseTime: 174 },
  { time: "06:00", responseTime: 183 },
  { time: "07:00", responseTime: 196 },
  { time: "08:00", responseTime: 214 },
  { time: "09:00", responseTime: 228 },
  { time: "10:00", responseTime: 205 },
  { time: "11:00", responseTime: 192 },
  { time: "12:00", responseTime: 188 },
  { time: "13:00", responseTime: 197 },
  { time: "14:00", responseTime: 221 },
  { time: "15:00", responseTime: 243 },
  { time: "16:00", responseTime: 236 },
  { time: "17:00", responseTime: 209 },
  { time: "18:00", responseTime: 198 },
  { time: "19:00", responseTime: 187 },
  { time: "20:00", responseTime: 181 },
  { time: "21:00", responseTime: 176 },
  { time: "22:00", responseTime: 169 },
  { time: "23:00", responseTime: 164 },
];
