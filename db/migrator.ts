import type { Kysely } from "kysely";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FileMigrationProvider, Migrator } from "kysely/migration";

export function createMigrator<T>(db: Kysely<T>) {
  return new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: fileURLToPath(
        new URL("../migrations/", import.meta.url),
      ),
      import: (filePath) => import(pathToFileURL(filePath).href),
    }),
  });
}
