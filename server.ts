import express from "express";
import { readFileSync, existsSync } from "node:fs";
import { createApp } from "./app.js";
import { createDatabase } from "./db/index.js";

const port = Number(process.env.PORT ?? 3000);
const db = createDatabase();
const production = process.env.NODE_ENV === "production";
let vite: import("vite").ViteDevServer | undefined;
let clientScript: string;
if (production) {
  const manifestPath = new URL("./dist/.vite/manifest.json", import.meta.url);
  if (!existsSync(manifestPath))
    throw new Error("Run npm run build before starting in production.");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  clientScript = `/${manifest["src/main.tsx"].file}`;
} else {
  const { createServer } = await import("vite");
  vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
  });
  clientScript = "/src/main.tsx";
}
const app = createApp({
  db,
  assets: vite?.middlewares as express.RequestHandler | undefined,
  clientScript,
});

const server = app.listen(port, () => {
  console.log(`Norm's Network running at http://localhost:${port}`);
});

// Close the server and database pool cleanly on Ctrl+C or container stop
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(async () => {
      await vite?.close();
      await db.destroy();
      process.exit(0);
    });
  });
}
