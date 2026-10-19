import { createDatabase } from "../db/index.js";
import { createMigrator } from "../db/migrator.js";

let db;
try {
  const command = process.argv[2];
  if (!["latest", "down", "status"].includes(command)) {
    throw new Error("Usage: node scripts/migrate.js <latest|down|status>");
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
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db?.destroy();
}
