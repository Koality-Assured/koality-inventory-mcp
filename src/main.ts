import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createInventoryClient } from "./inventory-client.js";
import { createInventoryMcpServer } from "./server.js";
import { assertSupportedTransport } from "./transports.js";

const transportName = assertSupportedTransport(process.argv[2] ?? "stdio");

if (transportName !== "stdio") {
  process.stderr.write(
    "Streamable HTTP is not enabled yet. Use the stdio transport for local agents.\n",
  );
  process.exit(1);
}

const server = createInventoryMcpServer(createInventoryClient(process.env));
await server.connect(new StdioServerTransport());
