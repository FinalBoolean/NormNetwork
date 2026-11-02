import { createDatabase } from "../db/index.js";
import { createMigrator } from "../db/migrator.js";

let db: ReturnType<typeof createDatabase> | undefined;
try {
  const command = process.argv[2];
  if (!["latest", "down", "status"].includes(command ?? "")) {
    throw new Error(
      "Usage: node --import tsx scripts/migrate.ts <latest|down|status>",
    );
  }
  db = createDatabase();
  const migrator = createMigrator(db);
  if (command === "status") {
    for (const migration of await migrator.getMigrations()) {
      console.log(
        `${migration.name}: ${migration.executedAt ? "applied" : "pending"}`,
      );
    }
  } else {
    const { results, error } = await (command === "latest"
      ? migrator.migrateToLatest()
      : migrator.migrateDown());
    for (const result of results ?? []) {
      console.log(
        `${result.migrationName}: ${result.direction} ${result.status}`,
      );
    }
    if (error) throw error;
    if (!results?.length) console.log("No migrations to run.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db?.destroy();
}
