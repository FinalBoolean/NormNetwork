import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createApp } from "../app.js";

// Starts the app on a random free port; no database is needed for these tests.
let server: Server;
let baseUrl: string;

before(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(
  () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    ),
);

describe("app", () => {
  test("React page data escapes script tags and never includes submitted passwords", async () => {
    const login = '</script><script>alert("test")</script>';
    const res = await fetch(`${baseUrl}/login`, {
      method: "POST",
      body: new URLSearchParams({ login, password: "", next: "/profile" }),
    });
    assert.equal(res.status, 400);
    const html = await res.text();
    const payload = html.match(/<script id="page-data" type="application\/json">(.*?)<\/script>/s)?.[1];
    assert.ok(payload);
    assert.ok(!payload.includes("<"));
    const data = JSON.parse(payload);
    assert.equal(data.values.login, login);
    assert.equal(data.next, "/profile");
    assert.ok(!("password" in data.values));
    assert.ok(!("db" in data));
    assert.match(html, /<div id="root">/);
  });

  test("home page renders", async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type")!, /text\/html/);
    assert.match(await res.text(), /Norm(?:'|&#x27;)s Network/);
  });

  test("every public nav page renders", async () => {
    for (const path of [
      "/login",
      "/signup",
      "/finder/friends",
      "/finder/study",
      "/finder/gaming",
      "/threads",
    ]) {
      const res = await fetch(`${baseUrl}${path}`);
      assert.equal(res.status, 200, `${path} should return 200`);
    }
  });

  test("pages for logged-in users redirect to login", async () => {
    for (const path of ["/profile", "/friends"]) {
      const res = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
      assert.equal(res.status, 302, path);
      assert.equal(
        res.headers.get("location"),
        `/login?next=${encodeURIComponent(path)}`,
      );
    }
  });

  test("logged-out nav offers sign up and log in", async () => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    assert.match(html, /href="\/signup"/);
    assert.match(html, /href="\/login"/);
    assert.doesNotMatch(html, /action="\/logout"/);
  });

  test("/finder redirects to the friend finder", async () => {
    const res = await fetch(`${baseUrl}/finder`, { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/finder/friends");
  });

  test("static files are served from public/", async () => {
    const res = await fetch(`${baseUrl}/css/styles.css`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type")!, /text\/css/);
  });

  test("unknown pages get a 404 page", async () => {
    const res = await fetch(`${baseUrl}/does-not-exist`);
    assert.equal(res.status, 404);
    assert.match(await res.text(), /Page not found/);
  });

  test("/health reports the database as unavailable when none is connected", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      status: "ok",
      database: "unavailable",
    });
  });
});
