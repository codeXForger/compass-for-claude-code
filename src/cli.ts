import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { Command } from "commander";
import getPort from "get-port";
import open from "open";
import { startServer } from "./server/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// package.json sits one level up from both src/cli.ts (dev) and dist/cli.js (build)
function readVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, "../package.json"), "utf8"),
    );
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const program = new Command();

program
  .name("ccc")
  .description(
    "Compass for Claude Code — local web dashboard for the current project's Claude setup.",
  )
  .option("-p, --port <number>", "port to bind (default: first free from 4180)")
  .option("--no-open", "don't open the browser automatically")
  .option(
    "-c, --cwd <path>",
    "project directory to scope to (default: process.cwd())",
  )
  .version(readVersion())
  .action(async (opts) => {
    const cwd = resolve(opts.cwd ?? process.cwd());
    if (!existsSync(cwd)) {
      console.error(`✗ cwd does not exist: ${cwd}`);
      process.exit(1);
    }

    const port = opts.port
      ? Number(opts.port)
      : await getPort({ port: [4180, 4181, 4182, 4183, 4184, 4185] });

    // dist/web sits next to dist/cli.js after build
    const webDir = resolve(__dirname, "web");

    const url = `http://localhost:${port}`;
    console.log(`\n  Compass for Claude Code`);
    console.log(`  cwd:  ${cwd}`);
    console.log(`  url:  ${url}\n`);

    await startServer({ port, cwd, webDir });

    if (opts.open !== false) {
      open(url).catch(() => {
        /* user can click the URL */
      });
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
