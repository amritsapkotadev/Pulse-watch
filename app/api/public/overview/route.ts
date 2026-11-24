import { connection } from "next/server";

import { apiSuccess, databaseUnavailable, noStoreHeaders, serverError } from "@/lib/api/response";
import { getPublicOverview } from "@/lib/data/public";
import { isDatabaseConfigured } from "@/lib/db";

export async function GET() {
  await connection();
  if (!isDatabaseConfigured()) return databaseUnavailable();
  try {
    const data = await getPublicOverview();
    return apiSuccess(data, { headers: noStoreHeaders() });
  } catch {
    return serverError();
  }
}
