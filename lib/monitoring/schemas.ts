import { z } from "zod";

import { HTTP_METHODS } from "@/lib/requests/schema";
import {
  analyticsRangeSchema,
  analyticsSortSchema,
  historyRangeSchema,
} from "@/lib/monitoring/types";

export const monitorWriteSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).default(""),
    url: z.string().trim().min(1).max(2048),
    method: z.enum(HTTP_METHODS),
    expectedStatus: z.number().int().min(100).max(599),
    intervalMinutes: z.number().int().min(1).max(1440),
    timeoutSeconds: z.number().int().min(1).max(120),
    isActive: z.boolean(),
    displayPublicly: z.boolean(),
  })
  .strict();

export type MonitorWriteInput = z.output<typeof monitorWriteSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const historyQuerySchema = paginationQuerySchema.extend({
  range: historyRangeSchema.default("24h"),
});

export const idParamSchema = z.object({ id: z.string().min(1) });

export const analyticsRangeQuerySchema = z.object({
  range: analyticsRangeSchema.default("30d"),
});

export const analyticsIncidentsQuerySchema = paginationQuerySchema.extend({
  range: analyticsRangeSchema.default("30d"),
});

export const analyticsMonitorsQuerySchema = paginationQuerySchema.extend({
  range: analyticsRangeSchema.default("30d"),
  sort: analyticsSortSchema.default("name"),
  order: z.enum(["asc", "desc"]).default("asc"),
  search: z.string().trim().max(120).optional(),
});

export const statusRangeQuerySchema = z.object({
  range: historyRangeSchema.default("24h"),
});

export const statusIncidentsQuerySchema = paginationQuerySchema.extend({
  range: historyRangeSchema.default("30d"),
});
