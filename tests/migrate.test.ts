import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { LATEST_VERSION, migrate, openPglite, SCHEMA, type Db } from "../lib/db.ts";

function wrap(pg: PGlite): Db {
  const make = (r: { query: PGlite["query"]; exec: PGlite["exec"] }, inTx: boolean): Db => ({
    q: async (t, p = []) => (await r.query(t, p)).rows as never,
    tx: (fn) => (inTx ? fn(make(r, true)) : pg.transaction((t) => fn(make(t as never, true)))),
    exec: async (s) => void (await r.exec(s)),
  });
  return make(pg, false);
}

test("upgrades a database created before migrations existed", async () => {
  const pg = new PGlite();
  await pg.exec(SCHEMA); // what the live site had
  await pg.query("INSERT INTO users (name, email, password_hash) VALUES ('Owner', 'o@x.pk', 'h'), ('Other', 'b@x.pk', 'h')");
  const d = wrap(pg);
  await migrate(d);
  await migrate(d); // running twice is harmless
  const users = await d.q<{ email: string; is_admin: boolean }>("SELECT email, is_admin FROM users ORDER BY id");
  assert.deepEqual(users.map((u) => u.is_admin), [true, false]);
  const [{ v }] = await d.q<{ v: number }>("SELECT MAX(version) AS v FROM schema_migrations");
  assert.equal(v, LATEST_VERSION);
});

test("new database gets every update", async () => {
  const d = await openPglite();
  const [{ v }] = await d.q<{ v: number }>("SELECT MAX(version) AS v FROM schema_migrations");
  assert.equal(v, LATEST_VERSION);
  const cols = await d.q<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
  assert.ok(cols.some((c) => c.column_name === "recovery_hash"));
});
