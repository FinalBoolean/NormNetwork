import type { Database } from "../../db/types.js";
import type { PostgresPoolClient } from "kysely";
import { Kysely, PostgresDialect } from "kysely";
import { PGlite } from "@electric-sql/pglite";
import { createDatabase } from "../../db/index.js";

/**
 * Database for tests. CI sets TEST_DATABASE_URL to a real PostgreSQL service;
 * locally each call gets its own isolated in-memory PostgreSQL (PGlite).
 *
 * Note: with TEST_DATABASE_URL every test file shares one database, which is
 * why `npm test` runs files one at a time (--test-concurrency=1) and each file
 * rolls its migrations back when it finishes.
 */
export function createTestDatabase() {
  if (process.env.TEST_DATABASE_URL)
    return createDatabase(process.env.TEST_DATABASE_URL);
  const embedded = new PGlite();
  const client = {
    async query<R>(text: string, parameters: readonly unknown[]) {
      const result = await embedded.query<R>(text, [...parameters]);
      return { ...result, rowCount: result.affectedRows ?? result.rows.length };
    },
    release() {},
  };
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: {
        options: {},
        async connect() {
          // PGlite supports ordinary queries; these tests never use pg cursors.
          return client as unknown as PostgresPoolClient;
        },
        async end() {
          await embedded.close();
        },
      },
    }),
  });
}
