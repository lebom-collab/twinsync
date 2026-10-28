import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/globalSetup.ts"],
    env: {
      DATABASE_URL: "file:./test.db",
      DEV_MODE: "false",
      PROXIMITY_MODE: "store",
      MAX_DEALS_PER_DEVICE_PER_DAY: "1",
      SYNC_TOKEN_TTL_SECONDS: "60",
      VOUCHER_TTL_SECONDS: "600",
      DEAL_PRICE_CENTS: "5990",
    },
    // Integration tests share one SQLite file; keep them sequential.
    fileParallelism: false,
  },
});
