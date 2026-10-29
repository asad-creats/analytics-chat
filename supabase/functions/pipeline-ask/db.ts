import type { Db } from "./agent.ts";

/**
 * Calls the pipeline_* database functions through the Supabase API with the
 * service key. The functions themselves enforce read-only access.
 */
export function supabaseDb(url: string, serviceKey: string) {
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.message ?? `database error ${res.status}`);
    return body;
  };

  const db: Db & { consumeQuota(client: string, perClient: number, siteTotal: number): Promise<Quota> } = {
    overview: () => rpc("pipeline_overview", {}),
    runQuery: async (sql) => (await rpc("pipeline_run_query", { q: sql })) ?? [],
    consumeQuota: (client, perClient, siteTotal) =>
      rpc("pipeline_consume_quota", { client, per_client: perClient, site_total: siteTotal }),
  };
  return db;
}

export interface Quota {
  allowed: boolean;
  used: number;
  limit: number;
  site_full?: boolean;
}
