import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createApp } from "../app.js";

// Starts the app on a random free port; no database is needed for these tests.
let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

describe("app", () => {
  test("home page renders", async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/html/);
    assert.match(await res.text(), /Norm's Network/);
  });

  test("every nav page renders", async () => {
    for (const path of [
      "/login",
      "/signup",
      "/profile",
      "/finder/friends",
      "/finder/study",
      "/finder/gaming",
      "/threads",
      "/friends",
    ]) {
      const res = await fetch(`${baseUrl}${path}`);
      assert.equal(res.status, 200, `${path} should return 200`);
    }
  });

  test("/finder redirects to the friend finder", async () => {
    const res = await fetch(`${baseUrl}/finder`, { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/finder/friends");
  });

  test("static files are served from public/", async () => {
    const res = await fetch(`${baseUrl}/css/styles.css`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/css/);
  });

  test("unknown pages get a 404 page", async () => {
    const res = await fetch(`${baseUrl}/does-not-exist`);
    assert.equal(res.status, 404);
    assert.match(await res.text(), /Page not found/);
  });

  test("/health reports the database as unavailable when none is connected", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok", database: "unavailable" });
  });
});
