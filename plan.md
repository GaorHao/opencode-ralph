# opencode-ralph TUI Fix Plan

Critical fixes for TUI rendering, keyboard handling, and process management.

**Problem Summary**: The TUI doesn't update, 'q' doesn't quit, and keyboard events are not being processed. Root causes identified:
1. Subprocess wrapper in `bin/ralph.ts` interferes with OpenTUI's stdin/stdout control
2. Solid's `onMount` lifecycle hook not firing reliably, preventing keyboard event registration
3. Conflicting stdin handlers between ralph and OpenTUI
4. Missing OpenTUI configuration options that opencode uses

---

## Phase 1: Remove Subprocess Wrapper (Root Cause Fix)

The `bin/ralph.ts` file spawns a child process which creates stdin/stdout inheritance issues with OpenTUI.

- [x] **1.1** Backup current `bin/ralph.ts` implementation:
  - Copy current implementation to a comment block for reference
  - Document why subprocess approach was originally used (preload requirement)

- [ ] **1.2** Refactor `bin/ralph.ts` to run directly without subprocess:
  - Remove `spawn()` call entirely
  - Import and call the main entry point directly
  - Example pattern from opencode: direct invocation without subprocess

- [ ] **1.3** Handle the `@opentui/solid/preload` requirement:
  - Option A: Add preload to `bunfig.toml` at package root (already exists)
  - Option B: Use dynamic import after preload is loaded
  - Verify preload is being applied correctly

- [ ] **1.4** Preserve `RALPH_USER_CWD` behavior:
  - The cwd handling in `src/index.ts` should still work
  - Test that `process.cwd()` returns correct directory when run from different locations

- [ ] **1.5** Test the direct execution approach:
  - Run `bun bin/ralph.ts` directly
  - Verify TUI renders
  - Verify keyboard input works

---

## Phase 2: Fix Component Lifecycle and Mount Timing

The `onMount` hook in Solid components isn't firing reliably, which breaks keyboard event registration.

- [ ] **2.1** Research how opencode handles component initialization:
  - Look at `.reference/opencode/packages/opencode/src/cli/cmd/tui/app.tsx`
  - Note they don't await render() and don't use mount promises
  - Document the pattern they use

- [ ] **2.2** Remove the `mountPromise` pattern in `src/app.tsx`:
  - The current code resolves `mountPromise` synchronously during component body
  - This is a workaround that doesn't actually wait for `onMount`
  - Remove `mountResolve` and `mountPromise` variables

- [ ] **2.3** Refactor `startApp()` to not depend on mount timing:
  - Return `stateSetters` immediately after render() completes
  - Trust that Solid's reactive system will handle updates
  - The state setters should work even before `onMount` fires

- [ ] **2.4** Simplify the `globalSetState` pattern:
  - Currently wraps setState with logging and requestRender
  - Consider if this wrapper is necessary
  - Keep the `renderer.requestRender?.()` call as it may help

- [ ] **2.5** Test that state updates trigger re-renders:
  - Add logging to verify setState is being called
  - Verify the TUI visually updates when state changes

---

## Phase 3: Fix Keyboard Event Registration

The `useKeyboard` hook relies on `onMount` which may not be firing.

- [ ] **3.1** Verify `useKeyboard` hook is being called:
  - Add logging inside the `useKeyboard` callback in `App` component
  - Check if the callback is ever invoked

- [ ] **3.2** Check if keyboard events are reaching the renderer:
  - Add logging to verify `renderer.keyInput` exists
  - Add a direct listener to `renderer.keyInput.on("keypress", ...)` for debugging

- [ ] **3.3** Add `useKittyKeyboard` option to render config:
  - OpenCode uses `useKittyKeyboard: {}` in their render options
  - Add this to ralph's render call in `src/app.tsx`:
    ```typescript
    await render(
      () => <App ... />,
      {
        targetFps: 15,
        exitOnCtrlC: false,
        useKittyKeyboard: {},  // ADD THIS
      }
    );
    ```

- [ ] **3.4** Add `renderer.disableStdoutInterception()` call:
  - OpenCode calls this right after getting the renderer
  - Add in `App` component: `renderer.disableStdoutInterception()`
  - This prevents OpenTUI from capturing stdout which may interfere

- [ ] **3.5** Fix keyboard event property access:
  - Current code uses `(e as any).key ?? (e as any).name ?? (e as any).sequence`
  - OpenTUI's `KeyEvent` type has `.name` property
  - Simplify to use `e.name` directly with proper typing

---

## Phase 4: Remove Conflicting stdin Handler

The fallback stdin handler in `src/index.ts` may conflict with OpenTUI's keyboard handling.

- [ ] **4.1** Understand the conflict:
  - OpenTUI sets stdin to raw mode for keyboard handling
  - Ralph's `process.stdin.on("data")` handler may interfere
  - Document which handler should take precedence

- [ ] **4.2** Remove the fallback stdin handler:
  - Delete the `process.stdin.on("data")` block in `src/index.ts`
  - The keyboard handling should be done entirely through OpenTUI's `useKeyboard`

- [ ] **4.3** If fallback is needed, make it conditional:
  - Only add stdin handler if OpenTUI keyboard handling fails
  - Add a flag to detect if keyboard events are being received
  - Fall back to raw stdin only as last resort

- [ ] **4.4** Test keyboard handling without fallback:
  - Remove the stdin handler
  - Verify 'q' and 'p' keys work through OpenTUI

---

## Phase 5: Improve Render Configuration

Match opencode's render configuration for consistency.

- [ ] **5.1** Review opencode's full render options:
  - `targetFps: 60` (ralph uses 15)
  - `gatherStats: false`
  - `exitOnCtrlC: false`
  - `useKittyKeyboard: {}`
  - `consoleOptions` with keybindings

- [ ] **5.2** Update ralph's render options:
  - Increase `targetFps` to 30 or 60 (test performance impact)
  - Add `useKittyKeyboard: {}`
  - Keep `exitOnCtrlC: false` (we handle quit manually)

- [ ] **5.3** Consider adding console options:
  - OpenCode has copy-selection keybindings
  - May not be necessary for ralph but worth noting

---

## Phase 6: Fix the App Exit Flow

Ensure clean shutdown when 'q' is pressed.

- [ ] **6.1** Review current quit flow:
  - `useKeyboard` handler calls `renderer.destroy()` and `props.onQuit()`
  - `onQuit` callback aborts the loop and resolves `exitPromise`
  - Verify this chain is being executed

- [ ] **6.2** Ensure `renderer.destroy()` is called correctly:
  - Current code: `(renderer as any).destroy?.()`
  - The `?` optional chaining may be hiding issues
  - Verify `destroy` method exists on renderer

- [ ] **6.3** Add logging to quit flow:
  - Log when quit key is detected
  - Log when `onQuit` callback is called
  - Log when `exitPromise` resolves

- [ ] **6.4** Test quit flow end-to-end:
  - Start ralph
  - Press 'q'
  - Verify process exits cleanly
  - Check logs for expected sequence

---

## Phase 7: Testing and Validation

Verify all fixes work together.

- [ ] **7.1** Create a test checklist:
  - [ ] TUI renders on startup
  - [ ] Header shows correct status
  - [ ] Log area shows events
  - [ ] Footer shows stats
  - [ ] 'q' key quits the app
  - [ ] 'p' key toggles pause
  - [ ] Ctrl+C quits the app
  - [ ] State updates reflect in UI

- [ ] **7.2** Test on different terminals:
  - Test in Windows Terminal
  - Test in PowerShell
  - Test in CMD (if applicable)
  - Document any terminal-specific issues

- [ ] **7.3** Test the loop integration:
  - Run ralph with a real plan.md
  - Verify iterations are logged
  - Verify progress updates
  - Verify tool events appear

- [ ] **7.4** Test edge cases:
  - Start with no plan.md file
  - Start with invalid config
  - Network errors during loop
  - Rapid key presses

---

## Phase 8: Cleanup and Documentation

Remove debugging code and document findings.

- [ ] **8.1** Remove excessive logging:
  - Keep essential logs for troubleshooting
  - Remove verbose debug logs added during fix
  - Consider log levels (debug vs info)

- [ ] **8.2** Update AGENTS.md with findings:
  - Document OpenTUI configuration requirements
  - Document keyboard handling approach
  - Note any Windows-specific considerations

- [ ] **8.3** Update README if needed:
  - Installation instructions
  - Known issues
  - Terminal compatibility

- [ ] **8.4** Clean up commented code:
  - Remove backup code blocks
  - Remove TODO comments that are resolved
  - Ensure code is production-ready

---

## Quick Reference: Key Files to Modify

| File | Purpose |
|------|---------|
| `bin/ralph.ts` | Entry point - remove subprocess |
| `src/index.ts` | Main logic - remove stdin handler |
| `src/app.tsx` | TUI component - fix keyboard, render config |
| `bunfig.toml` | Bun config - ensure preload is set |

## Quick Reference: OpenTUI Patterns from OpenCode

```typescript
// Render call pattern
render(
  () => <App />,
  {
    targetFps: 60,
    gatherStats: false,
    exitOnCtrlC: false,
    useKittyKeyboard: {},
  }
);

// Inside App component
const renderer = useRenderer();
renderer.disableStdoutInterception();

// Keyboard handling
useKeyboard((evt) => {
  if (evt.name === "q" && !evt.ctrl && !evt.meta) {
    // quit
  }
});
```

---
---

# opencode-ralph Test Suite Implementation Plan (Completed)

Comprehensive test suite for the Ralph TUI harness using Bun's built-in test runner.

---

## Phase 1: Test Infrastructure Setup

- [x] **1.1** Add `bun:test` script to `package.json`:
  - Add script: `"test": "bun test"`
  - Add script: `"test:watch": "bun test --watch"`
  - Add script: `"test:coverage": "bun test --coverage"`

- [x] **1.2** Create `tests/` directory structure:
  ```
  tests/
  ├── unit/
  │   ├── plan.test.ts
  │   ├── time.test.ts
  │   ├── git.test.ts
  │   ├── state.test.ts
  │   ├── lock.test.ts
  │   └── loop.test.ts
  ├── integration/
  │   └── ralph-flow.test.ts
  └── fixtures/
      └── plans/
          ├── empty.md
          ├── all-complete.md
          ├── partial-complete.md
          └── complex-nested.md
  ```

- [x] **1.3** Create test fixtures for plan parsing:
  - `fixtures/plans/empty.md` - Empty file
  - `fixtures/plans/all-complete.md` - All tasks marked `[x]`
  - `fixtures/plans/partial-complete.md` - Mix of `[x]` and `[ ]`
  - `fixtures/plans/complex-nested.md` - Nested lists, code blocks, edge cases

---

## Phase 2: Unit Tests - Plan Parser (`src/plan.ts`)

- [x] **2.1** Test `parsePlan()` with non-existent file:
  - Should return `{ done: 0, total: 0 }`
  - Verify no error thrown

- [x] **2.2** Test `parsePlan()` with empty file:
  - Should return `{ done: 0, total: 0 }`

- [x] **2.3** Test `parsePlan()` with all completed tasks:
  - Given 5 `- [x]` items
  - Should return `{ done: 5, total: 5 }`

- [x] **2.4** Test `parsePlan()` with all incomplete tasks:
  - Given 3 `- [ ]` items
  - Should return `{ done: 0, total: 3 }`

- [x] **2.5** Test `parsePlan()` with mixed task states:
  - Given 3 `- [x]` and 7 `- [ ]` items
  - Should return `{ done: 3, total: 10 }`

- [x] **2.6** Test `parsePlan()` case insensitivity:
  - Given `- [X]` (uppercase)
  - Should count as completed

- [x] **2.7** Test `parsePlan()` ignores checkboxes in code blocks:
  - Given markdown with code blocks containing `- [ ]`
  - Should not count code block checkboxes (or document current behavior)

- [x] **2.8** Test `parsePlan()` handles nested lists:
  - Given nested checkbox items
  - Should count all checkboxes at any nesting level

---

## Phase 3: Unit Tests - Time Utilities (`src/util/time.ts`)

- [x] **3.1** Test `formatDuration()` for seconds only:
  - `formatDuration(5000)` should return `"5s"`
  - `formatDuration(59000)` should return `"59s"`

- [x] **3.2** Test `formatDuration()` for minutes and seconds:
  - `formatDuration(90000)` should return `"1m 30s"`
  - `formatDuration(300000)` should return `"5m 0s"`

- [x] **3.3** Test `formatDuration()` for hours:
  - `formatDuration(3700000)` should return `"1h 1m"`
  - `formatDuration(7200000)` should return `"2h 0m"`

- [x] **3.4** Test `formatDuration()` edge cases:
  - `formatDuration(0)` should return `"0s"`
  - `formatDuration(999)` should return `"0s"` (rounds down)

- [x] **3.5** Test `calculateEta()` with empty array:
  - `calculateEta([], 10)` should return `null`

- [x] **3.6** Test `calculateEta()` with single iteration:
  - `calculateEta([60000], 5)` should return `300000` (5 * 60000)

- [x] **3.7** Test `calculateEta()` with multiple iterations:
  - `calculateEta([60000, 120000, 90000], 4)` should return `360000` (avg 90000 * 4)

- [x] **3.8** Test `calculateEta()` with zero remaining tasks:
  - `calculateEta([60000], 0)` should return `0`

- [x] **3.9** Test `formatEta()` with null:
  - `formatEta(null)` should return `"--:--"`

- [x] **3.10** Test `formatEta()` with valid duration:
  - `formatEta(300000)` should return `"~5m 0s remaining"`

---

## Phase 4: Unit Tests - State Management (`src/state.ts`)

- [x] **4.1** Test `loadState()` when file doesn't exist:
  - Should return `null`
  - Should not throw

- [x] **4.2** Test `loadState()` with valid state file:
  - Create state file with valid JSON
  - Should return parsed `PersistedState`

- [x] **4.3** Test `saveState()` creates valid JSON:
  - Save state, read file, verify valid JSON structure
  - Verify all fields present: `startTime`, `initialCommitHash`, `iterationTimes`, `planFile`

- [x] **4.4** Test `saveState()` overwrites existing state:
  - Save state twice with different values
  - Verify second state is what's persisted

- [x] **4.5** Test state roundtrip:
  - Create state, save it, load it
  - Verify loaded state matches original

---

## Phase 5: Unit Tests - Lock File (`src/lock.ts`)

- [x] **5.1** Test `acquireLock()` when no lock exists:
  - Should return `true`
  - Should create `.ralph-lock` file with current PID

- [x] **5.2** Test `acquireLock()` when lock held by current process:
  - Acquire lock
  - Try to acquire again
  - Should return `false` (same PID, process exists)

- [x] **5.3** Test `acquireLock()` with stale lock (dead PID):
  - Write lock file with non-existent PID
  - Should return `true` (stale lock overwritten)

- [x] **5.4** Test `releaseLock()` removes lock file:
  - Acquire lock
  - Release lock
  - Verify `.ralph-lock` file deleted

- [x] **5.5** Test `releaseLock()` when no lock exists:
  - Should not throw
  - Should complete successfully

---

## Phase 6: Unit Tests - Git Utilities (`src/git.ts`)

- [x] **6.1** Test `getHeadHash()` returns valid hash:
  - Should return 40-character hex string
  - Should match `git rev-parse HEAD` output

- [x] **6.2** Test `getCommitsSince()` with current HEAD:
  - `getCommitsSince(currentHead)` should return `0`

- [x] **6.3** Test `getCommitsSince()` with ancestor commit:
  - Get HEAD~5 hash
  - `getCommitsSince(headMinus5)` should return `5`

- [x] **6.4** Test `getCommitsSince()` with invalid hash:
  - Should return `0` or handle gracefully

---

## Phase 7: Unit Tests - Loop Logic (`src/loop.ts`)

- [x] **7.1** Test `buildPrompt()` template substitution:
  - Given `{plan}` in template
  - Should replace with `options.planFile`
  - Multiple `{plan}` occurrences should all be replaced

- [x] **7.2** Test `buildPrompt()` with custom prompt:
  - Given custom `options.prompt`
  - Should use custom prompt instead of default

- [x] **7.3** Test `buildPrompt()` with default prompt:
  - Given no `options.prompt`
  - Should use `DEFAULT_PROMPT`

- [x] **7.4** Test `parseModel()` with valid format:
  - `parseModel("anthropic/claude-opus-4")` should return `{ providerID: "anthropic", modelID: "claude-opus-4" }`

- [x] **7.5** Test `parseModel()` with opencode provider:
  - `parseModel("opencode/claude-opus-4-5")` should return `{ providerID: "opencode", modelID: "claude-opus-4-5" }`

- [x] **7.6** Test `parseModel()` with invalid format:
  - `parseModel("invalid-no-slash")` should throw with descriptive error

- [x] **7.7** Test `parseModel()` with multiple slashes:
  - `parseModel("provider/model/version")` should return `{ providerID: "provider", modelID: "model/version" }`

---

## Phase 8: Integration Tests

- [x] **8.1** Test complete Ralph iteration cycle (mocked):
  - Mock `createOpencodeServer` and `createOpencodeClient`
  - Verify callbacks called in correct order:
    1. `onIterationStart`
    2. `onEvent` (separator)
    3. `onTasksUpdated`
    4. `onEvent` (tool events)
    5. `onIterationComplete`
    6. `onCommitsUpdated`

- [x] **8.2** Test pause/resume flow:
  - Create `.ralph-pause` file during loop
  - Verify `onPause` callback called
  - Delete `.ralph-pause` file
  - Verify `onResume` callback called

- [x] **8.3** Test completion detection:
  - Create `.ralph-done` file during loop
  - Verify `onComplete` callback called
  - Verify loop exits cleanly

- [x] **8.4** Test abort signal handling:
  - Start loop with AbortController
  - Call `abort()` mid-iteration
  - Verify loop exits without error

- [x] **8.5** Test state persistence across iterations:
  - Run mock iteration
  - Verify `iterationTimes` array updated
  - Verify state file written with correct values

---

## Phase 9: Test Utilities and Cleanup

- [x] **9.1** Create test helper for temporary files:
  - Function to create temp directory for test fixtures
  - Automatic cleanup after tests

- [x] **9.2** Create mock factories for common types:
  - `createMockPersistedState(overrides?)`
  - `createMockLoopOptions(overrides?)`
  - `createMockToolEvent(overrides?)`

- [x] **9.3** Add test cleanup in `afterEach`:
  - Remove `.ralph-lock`, `.ralph-pause`, `.ralph-done`, `.ralph-state.json`
  - Reset any global state

- [x] **9.4** Remove legacy ad-hoc test files:
  - Delete `test-parse-plan.ts`
  - Delete `test-state-persistence.ts`
  - Delete `test-pause-functionality.ts`
  - Delete `test-completion-flow.ts`

---

## Phase 10: Documentation and CI

- [x] **10.1** Update README.md with testing instructions:
  - How to run tests: `bun test`
  - How to run with coverage: `bun test --coverage`
  - How to run in watch mode: `bun test --watch`

- [x] **10.2** Document test structure in README:
  - Explain `tests/unit/` vs `tests/integration/`
  - Explain fixture usage

- [ ] **10.3** Add pre-commit hook for tests (optional):
  - Run `bun test` before commits
  - Or document how to add with husky/lint-staged

---

## Reference: Bun Test API

```typescript
import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";

describe("module", () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it("should do something", () => {
    expect(actual).toBe(expected);
  });

  it("should handle async", async () => {
    const result = await asyncFunction();
    expect(result).toEqual({ key: "value" });
  });
});

// Mocking
const mockFn = mock(() => "mocked");
expect(mockFn).toHaveBeenCalled();
```

## Reference: Test File Naming

- Unit tests: `*.test.ts`
- Integration tests: `*.test.ts` (in integration folder)
- Fixtures: Plain files in `fixtures/` directory
