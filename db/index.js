import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";

export function createDatabase(connectionString = process.env.DATABASE_URL) {
  if (!connectionString)
    throw new Error(
      "DATABASE_URL is required. Copy .env.example to .env for local development.",
    );
  return new Kysely({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString,
        max: 5,
        connectionTimeoutMillis: 10000,
      }),
    }),
  });
}
