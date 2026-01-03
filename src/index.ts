#!/usr/bin/env bun
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { acquireLock, releaseLock } from "./lock";

const argv = await yargs(hideBin(process.argv))
  .scriptName("ralph")
  .usage("$0 [options]")
  .option("plan", {
    alias: "p",
    type: "string",
    description: "Path to the plan file",
    default: "plan.md",
  })
  .option("model", {
    alias: "m",
    type: "string",
    description: "Model to use (provider/model format)",
    default: "opencode/claude-opus-4-5",
  })
  .option("prompt", {
    type: "string",
    description: "Custom prompt template (use {plan} as placeholder)",
  })
  .option("reset", {
    alias: "r",
    type: "boolean",
    description: "Reset state and start fresh",
    default: false,
  })
  .help()
  .alias("h", "help")
  .version(false)
  .strict()
  .parse();

// Acquire lock to prevent multiple instances
const lockAcquired = await acquireLock();
if (!lockAcquired) {
  console.error("Another ralph instance is running");
  process.exit(1);
}

// TODO: Implement remaining startup logic in 11.3-11.9
console.log("Ralph starting with options:", {
  plan: argv.plan,
  model: argv.model,
  prompt: argv.prompt,
  reset: argv.reset,
});
