import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

// Fresh SQLite file for integration tests (prisma/test.db, throwaway).
export default function setup() {
  const dbFile = path.resolve(__dirname, "../prisma/test.db");
  rmSync(dbFile, { force: true });
  rmSync(`${dbFile}-journal`, { force: true });
  execSync("npx prisma db push --skip-generate", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
