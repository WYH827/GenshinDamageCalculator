import { spawnSync } from "node:child_process";

// Ignore static-host settings even if the preceding build targeted GitHub Pages.
const env = {
  ...process.env,
  VITE_STATIC_HOST: "false",
  VITE_ENKA_API_BASE: "",
  VITE_SITE_PUBLISHED: "true",
};
for (const args of [
  ["node_modules/vitest/vitest.mjs", "run", "src/official-presets.test.ts"],
  ["node_modules/typescript/bin/tsc", "-b"],
  ["node_modules/typescript/bin/tsc", "-p", "tsconfig.worker.json"],
  ["node_modules/vite/bin/vite.js", "build"],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
