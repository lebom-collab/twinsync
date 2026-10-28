// Runs before `npm run dev`: makes a fresh clone work with zero manual steps.
// 1) create .env from .env.example if missing, 2) sync the SQLite schema,
// 3) upsert the demo stores (idempotent).
import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env from .env.example");
}
const run = (cmd) => execSync(cmd, { stdio: "inherit" });
run("npx prisma db push --skip-generate");
run("npx tsx prisma/seed.ts");
