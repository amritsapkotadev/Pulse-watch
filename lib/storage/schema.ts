import { z } from "zod";

import { executeRequestSchema } from "@/lib/requests/schema";

export const WORKSPACE_STORAGE_KEY = "pulsewatch.workspace.v1";
export const WORKSPACE_SCHEMA_VERSION = 1;

export const collectionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(80),
    description: z.string().max(500),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const savedRequestSchema = z
  .object({
    id: z.string().min(1),
    collectionId: z.string().min(1),
    folder: z.string().max(80),
    name: z.string().min(1).max(120),
    description: z.string().max(500),
    request: executeRequestSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

const variableNamePattern = /^[A-Za-z_][A-Za-z0-9_.]*$/;

export const environmentVariableSchema = z
  .object({
    id: z.string().min(1),
    key: z.string().min(1).max(100),
    value: z.string().max(4096),
    secret: z.boolean(),
  })
  .strict()
  .superRefine((variable, context) => {
    if (!variableNamePattern.test(variable.key)) {
      context.addIssue({
        code: "custom",
        path: ["key"],
        message: "Use letters, numbers, dots, and underscores; start with a letter or underscore.",
      });
    }
  });

export const environmentSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(80),
    description: z.string().max(500),
    variables: z.array(environmentVariableSchema).max(200),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const workspaceDataSchema = z
  .object({
    schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
    collections: z.array(collectionSchema).max(200),
    requests: z.array(savedRequestSchema).max(1000),
    environments: z.array(environmentSchema).max(100),
    activeEnvironmentId: z.string().nullable(),
  })
  .strict();

export type Collection = z.output<typeof collectionSchema>;
export type SavedRequest = z.output<typeof savedRequestSchema>;
export type EnvironmentVariable = z.output<typeof environmentVariableSchema>;
export type Environment = z.output<typeof environmentSchema>;
export type WorkspaceData = z.output<typeof workspaceDataSchema>;

export interface CollectionInput {
  name: string;
  description: string;
}

export interface SavedRequestInput {
  collectionId: string;
  folder: string;
  name: string;
  description: string;
  request: SavedRequest["request"];
}

export interface EnvironmentInput {
  name: string;
  description: string;
}

export interface EnvironmentVariableInput {
  key: string;
  value: string;
  secret: boolean;
}
