#!/usr/bin/env bun
import { spawn } from "bun";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

/*
 * BACKUP: Original subprocess wrapper implementation (for reference)
 * ================================================================
 * 
 * WHY SUBPROCESS APPROACH WAS ORIGINALLY USED:
 * --------------------------------------------
 * 1. The @opentui/solid package requires a preload script to initialize
 *    the Solid runtime before any JSX is parsed
 * 2. When run via `bun bin/ralph.ts`, there's no way to specify --preload
 *    unless you spawn a child process with explicit CLI flags
 * 3. The subprocess pattern ensures the preload runs before src/index.ts
 * 
 * WHY THIS APPROACH CAUSES PROBLEMS:
 * ----------------------------------
 * 1. OpenTUI requires direct control of stdin/stdout for TUI rendering
 * 2. Even with `stdio: ["inherit", "inherit", "inherit"]`, the parent
 *    process still owns the TTY and may interfere with raw mode
 * 3. Keyboard events may not propagate correctly through the subprocess
 * 4. The subprocess pattern creates a process hierarchy that confuses
 *    signal handling (SIGINT, SIGTERM)
 * 
 * SOLUTION:
 * ---------
 * Use `bunfig.toml` with `preload = ["@opentui/solid/preload"]` at the
 * package root. Bun automatically applies this preload when running any
 * script from this package, eliminating the need for subprocess spawning.
 * 
 * ORIGINAL CODE (from git HEAD):
 * ------------------------------
 * const proc = spawn({
 *   cmd: ["bun", "run", resolve(packageRoot, "src/index.ts"), "--", ...process.argv.slice(2)],
 *   cwd: packageRoot,
 *   env: {
 *     ...process.env,
 *     RALPH_USER_CWD: userCwd,
 *   },
 *   stdio: ["inherit", "inherit", "inherit"],
 * });
 * 
 * const exitCode = await proc.exited;
 * process.exit(exitCode);
 */

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
