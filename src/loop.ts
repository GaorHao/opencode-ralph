import { createOpencodeServer, createOpencodeClient } from "@opencode-ai/sdk";
import type { LoopOptions, PersistedState, ToolEvent } from "./state.js";
import { getHeadHash, getCommitsSince } from "./git.js";
import { parsePlan } from "./plan.js";

const DEFAULT_PROMPT = `READ all of {plan}. Pick ONE task. If needed, verify via web/code search. Complete task. Commit change (update the plan.md in the same commit). ONLY do one task unless GLARINGLY OBVIOUS steps should run together. Update {plan}. If you learn a critical operational detail, update AGENTS.md. When ALL tasks complete, create .ralph-done and exit. NEVER GIT PUSH. ONLY COMMIT.`;

export function buildPrompt(options: LoopOptions): string {
  const template = options.prompt || DEFAULT_PROMPT;
  return template.replace(/\{plan\}/g, options.planFile);
}

export function parseModel(model: string): { providerID: string; modelID: string } {
  const slashIndex = model.indexOf("/");
  if (slashIndex === -1) {
    throw new Error(
      `Invalid model format: "${model}". Expected "provider/model" (e.g., "anthropic/claude-opus-4")`
    );
  }
  return {
    providerID: model.slice(0, slashIndex),
    modelID: model.slice(slashIndex + 1),
  };
}

export type LoopCallbacks = {
  onIterationStart: (iteration: number) => void;
  onEvent: (event: ToolEvent) => void;
  onIterationComplete: (
    iteration: number,
    duration: number,
    commits: number,
  ) => void;
  onTasksUpdated: (done: number, total: number) => void;
  onCommitsUpdated: (commits: number) => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onError: (error: string) => void;
};
