import { Pool, PoolClient, PoolConfig } from "pg";
import { getRuntimeEnv, isCloudflareWorkers } from "@/lib/runtime-env";

/**
 * PostgreSQL Client and Connection Pool for Vercel Serverless, Cloudflare Workers & Supabase Cloud.
 * Configured via process.env.DATABASE_URL.
 */

declare global {
  var __pgPool: Pool | undefined;
  var __pgWorkerFailure: { message: string; until: number } | undefined;
}

function getConnectionString(): string | undefined {
  const cfCtx = (globalThis as any)[Symbol.for("__cloudflare-context__")];
  const hyperdriveUrl = cfCtx?.env?.HYPERDRIVE?.connectionString;
  if (typeof hyperdriveUrl === "string" && hyperdriveUrl.trim() !== "") {
    return hyperdriveUrl;
  }
  return getRuntimeEnv("DATABASE_URL") || getRuntimeEnv("POSTGRES_URL");
}

function isWorkerTransportError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("unknownissuer") ||
    lower.includes("tls handshake failed") ||
    lower.includes("internal error") ||
    lower.includes("econnrefused") ||
    lower.includes("timeout")
  );
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getConnectionString());
}

export function getPool(): Pool {
  if (globalThis.__pgPool) {
    return globalThis.__pgPool;
  }

  const connectionString =
    getConnectionString() ||
    "postgresql://postgres:postgres@localhost:5432/ventas_intranet";

  const isLocalhost =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");

  const inWorkers = isCloudflareWorkers();

  const poolConfig: PoolConfig = {
    connectionString,
    // Supabase and cloud PostgreSQL require SSL
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    // Optimized for Vercel serverless functions, Workers and Supabase pooler
    max: inWorkers ? 3 : process.env.NODE_ENV === "production" ? 10 : 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: inWorkers ? 3000 : 10000,
    statement_timeout: 8000, // Prevent serverless queries from hanging indefinitely
  };

  const poolInstance = new Pool(poolConfig);

  poolInstance.on("error", (err) => {
    console.error("Error inesperado en cliente idle de PostgreSQL / Supabase:", err);
  });

  globalThis.__pgPool = poolInstance;
  return poolInstance;
}

/**
 * Execute a parameterized SQL query returning an array of rows.
 */
export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const inWorkers = isCloudflareWorkers();
  if (inWorkers && globalThis.__pgWorkerFailure && Date.now() < globalThis.__pgWorkerFailure.until) {
    throw new Error(globalThis.__pgWorkerFailure.message);
  }

  const p = getPool();
  try {
    const result = await p.query(text, params);
    return (result.rows as T[]) || [];
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (inWorkers && isWorkerTransportError(msg)) {
      globalThis.__pgWorkerFailure = {
        message: msg,
        until: Date.now() + 60_000,
      };
    }
    console.error("Error ejecutando consulta PostgreSQL:", {
      text,
      params,
      message: msg,
    });
    throw error;
  }
}

/**
 * Execute a query returning the first row or null.
 */
export async function queryRow<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute multiple queries within an isolated transaction.
 */
export async function transaction<T = any>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Diagnostic health check to verify PostgreSQL connectivity.
 */
export async function testConnection(): Promise<{
  ok: boolean;
  message: string;
  version?: string;
  connectedAt?: string;
}> {
  try {
    const res = await query<{ version: string; now: string }>(
      "SELECT version(), NOW() as now"
    );
    if (res.length > 0) {
      return {
        ok: true,
        message: "Conexión exitosa a PostgreSQL",
        version: res[0].version,
        connectedAt: res[0].now,
      };
    }
    return { ok: false, message: "No se obtuvo respuesta del servidor PostgreSQL" };
  } catch (error: any) {
    return {
      ok: false,
      message: error.message || "Error al conectar con PostgreSQL",
    };
  }
}
