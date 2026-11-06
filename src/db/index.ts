import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import fs from 'fs';
import path from 'path';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

function getDetectedCloudSqlSocket(): string | null {
  const cloudSqlDirs = ['/app/cloudsql', '/cloudsql'];
  for (const dir of cloudSqlDirs) {
    try {
      if (fs.existsSync(dir)) {
        const entries = fs.readdirSync(dir).filter((name) => !name.startsWith('.'));
        if (entries.length > 0) {
          return path.join(dir, entries[0]);
        }
      }
    } catch {
      // Ignore fs check errors
    }
  }
  return null;
}

function resolveCloudSqlSocketIfAvailable(configuredHost: string): string {
  if (configuredHost.startsWith('/')) {
    return configuredHost;
  }
  return getDetectedCloudSqlSocket() || configuredHost;
}

/**
 * Builds the PostgreSQL Pool configuration using the credentials defined in .env / .env.example.
 * Supports:
 * 1. Custom Remote PostgreSQL URI via DATABASE_URL (Supabase, Neon, Railway, etc.), or local PostgreSQL when running on a local machine
 * 2. Cloud SQL Unix socket (/app/cloudsql/...) when running in the Cloud Run / AI Studio container
 */
export function buildPostgresPoolConfig(): PoolConfig {
  const rawDatabaseUrl = (process.env.DATABASE_URL || '').trim();
  const customDatabaseUrl = rawDatabaseUrl.replace(/:(\[)([^\]]+)(\])@/, ':$2@');
  const cloudSqlSocket = getDetectedCloudSqlSocket();
  const isLocalhostUrl =
    customDatabaseUrl.includes('@localhost') || customDatabaseUrl.includes('@127.0.0.1');

  if (
    customDatabaseUrl &&
    customDatabaseUrl.startsWith('postgres') &&
    !customDatabaseUrl.includes('YOUR_POSTGRES_PASSWORD') &&
    !customDatabaseUrl.includes('password_anda') &&
    !(isLocalhostUrl && cloudSqlSocket)
  ) {
    const useSsl =
      process.env.SQL_SSL === 'true' ||
      customDatabaseUrl.includes('sslmode=require') ||
      customDatabaseUrl.includes('neon.tech') ||
      customDatabaseUrl.includes('supabase.co') ||
      customDatabaseUrl.includes('supabase.com');

    return {
      connectionString: customDatabaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      connectionTimeoutMillis: 15000,
    };
  }

  const rawHost = process.env.SQL_HOST || 'localhost';
  const sqlHost = resolveCloudSqlSocketIfAvailable(rawHost);
  const isUnixSocket = sqlHost.startsWith('/');
  const sqlPort = Number(process.env.SQL_PORT || 5432);
  const useSsl = process.env.SQL_SSL === 'true';

  return {
    host: sqlHost,
    ...(isUnixSocket ? {} : { port: Number.isNaN(sqlPort) ? 5432 : sqlPort }),
    user: process.env.SQL_USER || 'postgres',
    password: process.env.SQL_PASSWORD || '',
    database: process.env.SQL_DB_NAME || 'postgres',
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    connectionTimeoutMillis: 15000,
  };
}

export const createPool = () => {
  if (!global._postgresPool) {
    const poolConfig = buildPostgresPoolConfig();
    global._postgresPool = new Pool(poolConfig);

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });



