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
  });
});
