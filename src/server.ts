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
    "stock_reorder_recommendations",
    {
      description: "Recommend replenishment quantities where ATP is at or below the reorder point.",
      inputSchema: {},
    },
    async () => jsonResult(await inventory.reorderRecommendations()),
  );

  server.registerTool(
    "stock_create_purchase_order",
    {
      description: "Draft a purchase order for a vendor.",
      inputSchema: {
        vendorId: z.string().min(1),
        lines: z.array(
          z.object({
            skuId: z.string().min(1),
            locationId: z.string().min(1),
            quantity: z.number().int().positive(),
            unitCostCents: z.number().int().nonnegative(),
          }),
        ),
      },
    },
    async (args) => jsonResult(await inventory.createPurchaseOrder(args)),
  );

  server.registerTool(
    "stock_receive_shipment",
    {
      description: "Receive quantity against an approved purchase order line.",
      inputSchema: {
        poId: z.string().min(1),
        lineId: z.string().min(1),
        quantity: z.number().int().positive(),
      },
    },
    async (args) => jsonResult(await inventory.receiveShipment(args)),
  );

  server.registerTool(
    "stock_start_cycle_count",
    {
      description: "Start a blind cycle count for SKUs at a location.",
      inputSchema: {
        locationId: z.string().min(1),
        skuIds: z.array(z.string().min(1)),
      },
    },
    async (args) => jsonResult(await inventory.startCycleCount(args)),
  );

  server.registerTool(
    "stock_record_count",
    {
      description: "Record a blind count quantity for a cycle count line.",
      inputSchema: {
        cycleId: z.string().min(1),
        lineId: z.string().min(1),
        countedQty: z.number().int().nonnegative(),
      },
    },
    async (args) => jsonResult(await inventory.recordCount(args)),
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
