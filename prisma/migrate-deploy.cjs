const { spawnSync } = require("node:child_process");
const prismaCli = require.resolve("prisma");

// Neon may retain Prisma's session-level migration lock after the CLI exits.
const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  env: {
    ...process.env,
    PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
  },
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
