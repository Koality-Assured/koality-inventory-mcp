import { assertSupportedTransport } from "./transports.js";

const transport = assertSupportedTransport(process.argv[2] ?? "stdio");

if (transport === "stdio") {
  process.stderr.write(
    "koality-inventory-mcp stdio transport is scaffolded. Tools land in a later slice.\n",
  );
} else {
  process.stderr.write(
    "koality-inventory-mcp Streamable HTTP transport is scaffolded. The endpoint lands in a later slice.\n",
  );
}
