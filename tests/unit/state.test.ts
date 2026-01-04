import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { loadState, saveState, STATE_FILE, type PersistedState } from "../../src/state";
import { unlink } from "node:fs/promises";

describe("state management", () => {
  // Clean up state file before and after each test
  beforeEach(async () => {
    try {
      await unlink(STATE_FILE);
    } catch {
      // File doesn't exist, that's fine
    }
  });

  afterEach(async () => {
    try {
      await unlink(STATE_FILE);
    } catch {
      // File doesn't exist, that's fine
    }
  });

  describe("loadState()", () => {
    it("should return null when file doesn't exist", async () => {
      const result = await loadState();
      expect(result).toBeNull();
    });

    it("should not throw when file doesn't exist", async () => {
      // This test ensures loadState handles missing file gracefully
      await expect(loadState()).resolves.toBeNull();
    });

    it("should return parsed PersistedState with valid state file", async () => {
      const validState: PersistedState = {
        startTime: 1704067200000, // 2024-01-01T00:00:00.000Z
        initialCommitHash: "abc123def456789012345678901234567890abcd",
        iterationTimes: [60000, 120000, 90000],
        planFile: "plan.md",
      };

      // Create the state file with valid JSON
      await Bun.write(STATE_FILE, JSON.stringify(validState, null, 2));

      const result = await loadState();

      expect(result).not.toBeNull();
      expect(result).toEqual(validState);
      expect(result!.startTime).toBe(1704067200000);
      expect(result!.initialCommitHash).toBe("abc123def456789012345678901234567890abcd");
      expect(result!.iterationTimes).toEqual([60000, 120000, 90000]);
      expect(result!.planFile).toBe("plan.md");
    });
  });

  describe("saveState()", () => {
    it("should create valid JSON with all required fields", async () => {
      const state: PersistedState = {
        startTime: 1704067200000,
        initialCommitHash: "abc123def456789012345678901234567890abcd",
        iterationTimes: [60000, 120000],
        planFile: "plan.md",
      };

      await saveState(state);

      // Read the file as text to verify it's valid JSON
      const file = Bun.file(STATE_FILE);
      const exists = await file.exists();
      expect(exists).toBe(true);

      const content = await file.text();

      // Should be valid JSON (won't throw)
      const parsed = JSON.parse(content);

      // Verify all required fields are present
      expect(parsed).toHaveProperty("startTime");
      expect(parsed).toHaveProperty("initialCommitHash");
      expect(parsed).toHaveProperty("iterationTimes");
      expect(parsed).toHaveProperty("planFile");

      // Verify values are correct
      expect(parsed.startTime).toBe(1704067200000);
      expect(parsed.initialCommitHash).toBe("abc123def456789012345678901234567890abcd");
      expect(parsed.iterationTimes).toEqual([60000, 120000]);
      expect(parsed.planFile).toBe("plan.md");
    });

    it("should overwrite existing state with new values", async () => {
      const firstState: PersistedState = {
        startTime: 1704067200000,
        initialCommitHash: "abc123def456789012345678901234567890abcd",
        iterationTimes: [60000],
        planFile: "old-plan.md",
      };

      const secondState: PersistedState = {
        startTime: 1704153600000, // Different timestamp
        initialCommitHash: "def456789012345678901234567890abcdef12",
        iterationTimes: [90000, 120000, 150000],
        planFile: "new-plan.md",
      };

      // Save first state
      await saveState(firstState);

      // Save second state (should overwrite)
      await saveState(secondState);

      // Load and verify the second state is what's persisted
      const loaded = await loadState();

      expect(loaded).not.toBeNull();
      expect(loaded!.startTime).toBe(secondState.startTime);
      expect(loaded!.initialCommitHash).toBe(secondState.initialCommitHash);
      expect(loaded!.iterationTimes).toEqual(secondState.iterationTimes);
      expect(loaded!.planFile).toBe(secondState.planFile);

      // Also verify the first state values are NOT present
      expect(loaded!.startTime).not.toBe(firstState.startTime);
      expect(loaded!.initialCommitHash).not.toBe(firstState.initialCommitHash);
      expect(loaded!.iterationTimes).not.toEqual(firstState.iterationTimes);
      expect(loaded!.planFile).not.toBe(firstState.planFile);
    });
  });

  describe("state roundtrip", () => {
    it("should preserve all state fields through save/load cycle", async () => {
      const originalState: PersistedState = {
        startTime: 1704067200000,
        initialCommitHash: "abc123def456789012345678901234567890abcd",
        iterationTimes: [60000, 120000, 90000],
        planFile: "plan.md",
      };

      // Save the state
      await saveState(originalState);

      // Load it back
      const loadedState = await loadState();

      // Verify loaded state matches original exactly
      expect(loadedState).not.toBeNull();
      expect(loadedState).toEqual(originalState);
    });

    it("should preserve empty iterationTimes array through roundtrip", async () => {
      const originalState: PersistedState = {
        startTime: 1704067200000,
        initialCommitHash: "abc123def456789012345678901234567890abcd",
        iterationTimes: [],
        planFile: "plan.md",
      };

      await saveState(originalState);
      const loadedState = await loadState();

      expect(loadedState).toEqual(originalState);
      expect(loadedState!.iterationTimes).toEqual([]);
    });

    it("should preserve large iterationTimes array through roundtrip", async () => {
      const largeIterationTimes = Array.from({ length: 100 }, (_, i) => (i + 1) * 10000);
      const originalState: PersistedState = {
        startTime: 1704067200000,
        initialCommitHash: "abc123def456789012345678901234567890abcd",
        iterationTimes: largeIterationTimes,
        planFile: "plan.md",
      };

      await saveState(originalState);
      const loadedState = await loadState();

      expect(loadedState).toEqual(originalState);
      expect(loadedState!.iterationTimes).toHaveLength(100);
    });

    it("should preserve special characters in planFile through roundtrip", async () => {
      const originalState: PersistedState = {
        startTime: 1704067200000,
        initialCommitHash: "abc123def456789012345678901234567890abcd",
        iterationTimes: [60000],
        planFile: "plans/feature-plan (v2).md",
      };

      await saveState(originalState);
      const loadedState = await loadState();

      expect(loadedState).toEqual(originalState);
      expect(loadedState!.planFile).toBe("plans/feature-plan (v2).md");
    });
  });
});
