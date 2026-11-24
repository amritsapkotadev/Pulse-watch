import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { MonitorWriteInput } from "@/lib/monitoring/schemas";
import { validateMonitorTarget } from "@/lib/monitoring/ssrf";
import {
  WORKSPACE_SCHEMA_VERSION,
  workspaceDataSchema,
  type WorkspaceData,
} from "@/lib/storage/schema";
import { deserializeWorkspaceData } from "@/lib/storage/secrets";

export async function listAdminMonitors() {
  return prisma.monitor.findMany({
    include: {
      lease: true,
      _count: { select: { checks: true, incidents: true } },
      incidents: {
        where: { status: "ACTIVE" },
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAdminMonitor(id: string) {
  return prisma.monitor.findUnique({
    where: { id },
    include: {
      lease: true,
      incidents: { orderBy: { startedAt: "desc" }, take: 20 },
    },
  });
}

export async function createMonitor(input: MonitorWriteInput) {
  await validateMonitorTarget(input.url);
  return prisma.monitor.create({ data: input });
}

export async function updateMonitor(id: string, input: MonitorWriteInput) {
  await validateMonitorTarget(input.url);
  return prisma.monitor.update({ where: { id }, data: input });
}

export async function deleteMonitor(id: string): Promise<void> {
  await prisma.monitor.delete({ where: { id } });
}

export async function getAdminChecks(monitorId: string, page: number, pageSize: number) {
  const [total, checks] = await Promise.all([
    prisma.monitorCheck.count({ where: { monitorId } }),
    prisma.monitorCheck.findMany({
      where: { monitorId },
      orderBy: { checkedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { total, checks };
}

export async function importWorkspace(
  raw: unknown,
): Promise<{ collections: number; requests: number; environments: number }> {
  const parsed = deserializeWorkspaceData(raw);
  if (!parsed.ok) throw new Error(parsed.error);
  const workspace = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.savedRequest.deleteMany({
      where: { collectionId: { notIn: workspace.collections.map((item) => item.id) } },
    });
    await tx.collection.deleteMany({
      where: { id: { notIn: workspace.collections.map((item) => item.id) } },
    });
    await tx.environmentVariable.deleteMany({
      where: { environmentId: { notIn: workspace.environments.map((item) => item.id) } },
    });
    await tx.environment.deleteMany({
      where: { id: { notIn: workspace.environments.map((item) => item.id) } },
    });

    for (const collection of workspace.collections) {
      await tx.collection.upsert({
        where: { id: collection.id },
        update: {
          name: collection.name,
          description: collection.description,
          updatedAt: parseDate(collection.updatedAt),
        },
        create: {
          id: collection.id,
          name: collection.name,
          description: collection.description,
          createdAt: parseDate(collection.createdAt),
          updatedAt: parseDate(collection.updatedAt),
        },
      });
    }

    for (const savedRequest of workspace.requests) {
      await tx.savedRequest.upsert({
        where: { id: savedRequest.id },
        update: {
          collectionId: savedRequest.collectionId,
          folder: savedRequest.folder,
          name: savedRequest.name,
          description: savedRequest.description,
          request: savedRequest.request as Prisma.InputJsonValue,
          updatedAt: parseDate(savedRequest.updatedAt),
        },
        create: {
          id: savedRequest.id,
          collectionId: savedRequest.collectionId,
          folder: savedRequest.folder,
          name: savedRequest.name,
          description: savedRequest.description,
          request: savedRequest.request as Prisma.InputJsonValue,
          createdAt: parseDate(savedRequest.createdAt),
          updatedAt: parseDate(savedRequest.updatedAt),
        },
      });
    }

    for (const environment of workspace.environments) {
      await tx.environment.upsert({
        where: { id: environment.id },
        update: {
          name: environment.name,
          description: environment.description,
          updatedAt: parseDate(environment.updatedAt),
        },
        create: {
          id: environment.id,
          name: environment.name,
          description: environment.description,
          createdAt: parseDate(environment.createdAt),
          updatedAt: parseDate(environment.updatedAt),
        },
      });

      const variableIds = environment.variables.map((variable) => variable.id);
      await tx.environmentVariable.deleteMany({
        where: {
          environmentId: environment.id,
          id: { notIn: variableIds },
        },
      });

      for (const variable of environment.variables) {
        await tx.environmentVariable.upsert({
          where: {
            environmentId_key: { environmentId: environment.id, key: variable.key },
          },
          update: { id: variable.id, value: variable.value, secret: variable.secret },
          create: {
            id: variable.id,
            environmentId: environment.id,
            key: variable.key,
            value: variable.value,
            secret: variable.secret,
          },
        });
      }
    }

    const activeEnvironmentId = workspace.environments.some(
      (environment) => environment.id === workspace.activeEnvironmentId,
    )
      ? workspace.activeEnvironmentId
      : null;
    await tx.workspaceState.upsert({
      where: { id: "singleton" },
      update: { activeEnvironmentId },
      create: { id: "singleton", activeEnvironmentId },
    });
  });

  return {
    collections: workspace.collections.length,
    requests: workspace.requests.length,
    environments: workspace.environments.length,
  };
}

export async function getStoredWorkspace(): Promise<WorkspaceData> {
  const [collections, requests, environments, state] = await Promise.all([
    prisma.collection.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.savedRequest.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.environment.findMany({
      include: { variables: { orderBy: { key: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workspaceState.findUnique({ where: { id: "singleton" } }),
  ]);

  return workspaceDataSchema.parse({
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    collections: collections.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    requests: requests.map((item) => ({
      id: item.id,
      collectionId: item.collectionId,
      folder: item.folder,
      name: item.name,
      description: item.description,
      request: item.request,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    environments: environments.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      variables: item.variables.map((variable) => ({
        id: variable.id,
        key: variable.key,
        value: variable.value,
        secret: variable.secret,
      })),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    activeEnvironmentId: state?.activeEnvironmentId ?? null,
  });
}

function parseDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
