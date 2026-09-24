import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Integration tests against the local Supabase stack. Requires `npx supabase start`. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    globalSetup: ["tests/db/globalSetup.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
