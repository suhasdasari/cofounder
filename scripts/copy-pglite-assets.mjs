#!/usr/bin/env node
/**
 * Nitro bundles @electric-sql/pglite JS but not pglite.data / wasm. Vercel then
 * 500s with ENOENT /var/task/_libs/pglite.data. Copy the companion files next
 * to the bundled module after `vite build`.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("@electric-sql/pglite"));
const files = ["pglite.data", "pglite.wasm", "initdb.wasm", "initdb.js"];

const dests = [
  join(process.cwd(), ".vercel/output/functions/__server.func/_libs"),
  join(process.cwd(), ".vercel/output/functions/__server.func"),
];

let copied = 0;
for (const dest of dests) {
  if (!existsSync(dirname(dest))) continue;
  mkdirSync(dest, { recursive: true });
  for (const file of files) {
    const from = join(dist, file);
    if (!existsSync(from)) continue;
    copyFileSync(from, join(dest, file));
    copied += 1;
  }
}

if (copied === 0) {
  console.log("[pglite-assets] no Vercel function output — skipped");
} else {
  console.log(`[pglite-assets] copied ${copied} file(s) next to the server function`);
}
