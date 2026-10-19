import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FileMigrationProvider, Migrator } from "kysely/migration";

export function createMigrator(db) {
  return new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: fileURLToPath(
        new URL("../migrations/", import.meta.url),
      ),
      // Absolute Windows paths must be converted to file URLs for ESM imports.
      import: (filePath) => import(pathToFileURL(filePath).href),
    }),
  });
}
