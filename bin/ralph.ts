#!/usr/bin/env bun
import { spawn } from "bun";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// Get the package root (parent of bin directory)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = dirname(__dirname);

// Store the user's current working directory
const userCwd = process.cwd();

// Run the main entry point from the package root
const proc = spawn({
  cmd: ["bun", "run", resolve(packageRoot, "src/index.ts"), "--", ...process.argv.slice(2)],
  cwd: packageRoot,
  env: {
    ...process.env,
    RALPH_USER_CWD: userCwd,
  },
  stdio: ["inherit", "inherit", "inherit"],
});

// Wait for the process and exit with its code
const exitCode = await proc.exited;
process.exit(exitCode);
