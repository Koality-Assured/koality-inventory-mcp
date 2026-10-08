import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { type InventoryClient } from "./inventory-client.js";

export function createInventoryMcpServer(inventory: InventoryClient): McpServer {
  const server = new McpServer({ name: "koality-inventory", version: "0.2.0" });

  server.registerTool(
    "stock_get_balance",
    {
      description: "Retrieve on-hand, allocated, ATP, and in-transit quantities for a SKU.",
      inputSchema: { skuId: z.string().min(1) },
    },
    async ({ skuId }) => jsonResult(await inventory.getBalance(skuId)),
  );

  server.registerTool(
    "stock_search_catalog",
    {
      description: "Search the item master and SKU catalog.",
      inputSchema: { query: z.string() },
    },
    async ({ query }) => jsonResult(await inventory.searchCatalog(query)),
  );

  server.registerTool(
    "stock_adjust",
    {
      description: "Post an inventory adjustment. Positive deltas increase on-hand.",
      inputSchema: {
        skuId: z.string().min(1),
        locationId: z.string().min(1),
        quantityDelta: z.number().int(),
        reason: z.string().min(1),
        unitCostCents: z.number().int().nonnegative().optional(),
      },
    },
    async (args) => jsonResult(await inventory.adjust(args)),
  );

  server.registerTool(
    "stock_transfer",
    {
      description: "Move on-hand stock into in-transit toward another location.",
      inputSchema: {
        skuId: z.string().min(1),
        fromLocationId: z.string().min(1),
        toLocationId: z.string().min(1),
        quantity: z.number().int().positive(),
      },
    },
    async (args) => jsonResult(await inventory.transfer(args)),
  );

  return server;
}

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}
