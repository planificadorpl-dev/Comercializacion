import { Pool, PoolClient } from "pg";

/**
 * Native PostgreSQL Client and Connection Pool for Corporate Intranet.
 * Configured via process.env.DATABASE_URL.
 */

let poolInstance: Pool | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== "");
}

export function getPool(): Pool {
  if (!poolInstance) {
    const connectionString =
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/ventas_intranet";

    poolInstance = new Pool({
      connectionString,
      max: 20, // Max clients in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 6000,
    });

    poolInstance.on("error", (err) => {
      console.error("Error inesperado en cliente idle de PostgreSQL:", err);
    });
  }
  return poolInstance;
}

/**
 * Execute a parameterized SQL query returning an array of rows.
 */
export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const p = getPool();
  try {
    const result = await p.query(text, params);
    return (result.rows as T[]) || [];
  } catch (error: any) {
    console.error("Error ejecutando consulta PostgreSQL:", {
      text,
      params,
      message: error.message,
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
