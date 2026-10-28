// `npm run build`. Local builds use the SQLite schema as-is. When
// DATABASE_URL is a Postgres URL (e.g. Vercel + Neon), derive a Postgres
// copy of the schema, generate the client from it, sync the tables and seed
// the demo stores, then build. One schema file stays the source of truth.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const run = (cmd) => execSync(cmd, { stdio: "inherit", env: process.env });
const url = process.env.DATABASE_URL ?? "";

if (/^postgres(ql)?:\/\//.test(url)) {
  let schema = readFileSync("prisma/schema.prisma", "utf8").replace('provider = "sqlite"', 'provider = "postgresql"');
  // Neon's pooled URL can't run schema changes; use the direct one if given.
  if (process.env.DATABASE_URL_UNPOOLED) {
    schema = schema.replace('url      = env("DATABASE_URL")', 'url       = env("DATABASE_URL")\n  directUrl = env("DATABASE_URL_UNPOOLED")');
  }
  writeFileSync("prisma/schema.postgres.prisma", schema);
  const s = "--schema prisma/schema.postgres.prisma";
  run(`npx prisma generate ${s}`);
  // Prototype: push the schema instead of running migrations.
  run(`npx prisma db push ${s} --skip-generate`);
  run("npx tsx prisma/seed.ts");
} else {
  run("npx prisma generate");
}

run("npx next build");
