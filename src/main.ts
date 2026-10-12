import { createServer } from "node:http";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createInventoryClient } from "./inventory-client.js";
import { createInventoryMcpServer } from "./server.js";
import { assertSupportedTransport } from "./transports.js";

const transportName = assertSupportedTransport(process.argv[2] ?? "stdio");

const server = createInventoryMcpServer(createInventoryClient(process.env));

if (transportName === "stdio") {
  await server.connect(new StdioServerTransport());
} else if (transportName === "streamable-http") {
  const token = process.env.MCP_TOKEN;
  if (!token) {
    process.stderr.write(
      "MCP_TOKEN environment variable must be set for streamable-http transport.\n",
    );
    process.exit(1);
  }

  const port = parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "127.0.0.1";

  const transport = new StreamableHTTPServerTransport();

  const httpServer = createServer(async (req, res) => {
    // DNS rebinding protection
    const hostHeader = req.headers.host;
    const allowedHosts = [
      `localhost:${port}`,
      `127.0.0.1:${port}`,
      `[::1]:${port}`,
      host,
      `${host}:${port}`,
    ];
    if (hostHeader && !allowedHosts.includes(hostHeader)) {
      res.writeHead(403);
      res.end("Invalid Host header");
      return;
    }

    // Origin validation
    const origin = req.headers.origin;
    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (!allowedHosts.includes(originUrl.host)) {
          res.writeHead(403);
          res.end("Invalid Origin");
          return;
        }
      } catch {
        res.writeHead(403);
        res.end("Invalid Origin");
        return;
      }
    }

    // Bearer token authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${token}`) {
      res.writeHead(401);
      res.end("Unauthorized");
      return;
    }

    try {
      await transport.handleRequest(req, res);
    } catch {
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Internal error");
      }
    }
  });

  await server.connect(transport as unknown as Transport);

  httpServer.listen(port, host, () => {
    console.log(`MCP server listening on http://${host}:${port}`);
  });

  const shutdown = () => {
    httpServer.close(async () => {
      await transport.close();
      await server.close();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
