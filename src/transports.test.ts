import { describe, expect, it } from "vitest";

import { SUPPORTED_TRANSPORTS, assertSupportedTransport } from "./transports.js";

describe("MCP transports", () => {
  it("allows stdio and Streamable HTTP only", () => {
    expect([...SUPPORTED_TRANSPORTS]).toEqual(["stdio", "streamable-http"]);
    expect(assertSupportedTransport("stdio")).toBe("stdio");
    expect(assertSupportedTransport("streamable-http")).toBe("streamable-http");
  });

  it("rejects the deprecated HTTP+SSE dual connection", () => {
    expect(() => assertSupportedTransport("sse")).toThrow(/deprecated/);
    expect(() => assertSupportedTransport("http+sse")).toThrow(/deprecated/);
  });
});
