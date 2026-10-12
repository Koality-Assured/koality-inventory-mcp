import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

describe("Streamable HTTP transport", () => {
  it("fails closed if MCP_TOKEN is unset", async () => {
    try {
      await execFileAsync("tsx", ["src/main.ts", "streamable-http"], {
        env: { ...process.env, MCP_TOKEN: "" },
      });
      expect.fail("Should have exited with non-zero");
    } catch (err: unknown) {
      const error = err as { code: number; stderr: string };
      expect(error.code).toBe(1);
      expect(error.stderr).toContain("MCP_TOKEN environment variable must be set");
    }
  });
});
