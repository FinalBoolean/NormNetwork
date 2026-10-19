import { createApp } from "./app.js";
import { createDatabase } from "./db/index.js";

const port = Number(process.env.PORT ?? 3000);
const db = createDatabase();
const app = createApp({ db });

const server = app.listen(port, () => {
  console.log(`Norm's Network running at http://localhost:${port}`);
});

// Close the server and database pool cleanly on Ctrl+C or container stop
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(async () => {
      await db.destroy();
      process.exit(0);
    });
  });
}
