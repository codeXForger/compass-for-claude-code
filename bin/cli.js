#!/usr/bin/env node
import("../dist/cli.js").catch((err) => {
  console.error("Failed to start compass-for-claude-code (ccc):");
  console.error(err);
  process.exit(1);
});
