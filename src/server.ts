import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { type InventoryClient } from "./inventory-client.js";

export function createInventoryMcpServer(inventory: InventoryClient): McpServer {
  const server = new McpServer({ name: "koality-inventory", version: "0.2.0" });

  server.registerTool(
    "stock_get_balance",
    {
      description:
        "Retrieve on-hand, allocated, ATP, and in-transit quantities for a SKU. Pass locationId for one bin.",
      inputSchema: {
        skuId: z.string().min(1),
        locationId: z.string().min(1).optional(),
      },
    },
    async ({ skuId, locationId }) => jsonResult(await inventory.getBalance(skuId, locationId)),
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
        confirm: z.boolean().optional(),
      },
    },
    async (args) => {
      const valueCents = Math.abs(args.quantityDelta) * (args.unitCostCents || 0);
      if (valueCents > 100000 && !args.confirm) {
        return {
          content: [
            {
              type: "text",
              text: `PENDING_HUMAN_APPROVAL: Inventory adjustment value ($${(valueCents / 100).toFixed(2)}) exceeds $1,000 threshold. Please request explicit user confirmation and set 'confirm: true' to proceed.`,
            },
          ],
          isError: true,
        };
      }
      return jsonResult(await inventory.adjust(args));
    },
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
        confirm: z.boolean().optional(),
      },
    },
    async (args) => {
      let totalCents = 0;
      for (const line of args.lines) {
        totalCents += line.quantity * line.unitCostCents;
      }
      if (totalCents > 500000 && !args.confirm) {
        return {
          content: [
            {
              type: "text",
              text: `PENDING_HUMAN_APPROVAL: Purchase order value ($${(totalCents / 100).toFixed(2)}) exceeds $5,000 threshold. Please request explicit user confirmation and set 'confirm: true' to proceed.`,
            },
          ],
          isError: true,
        };
      }
      return jsonResult(await inventory.createPurchaseOrder(args));
    },
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

  server.registerTool(
    "stock_get_valuation",
    {
      description:
        "Retrieve inventory asset valuation report broken down by cost layers for a SKU.",
      inputSchema: {
        skuId: z.string().min(1),
      },
    },
    async (args) => jsonResult(await inventory.getValuation(args.skuId)),
  );

  // Resources
  server.resource(
    "stock_balance",
    new ResourceTemplate("inventory://stock/{location_id}/{sku_id}", { list: undefined }),
    async (uri, { location_id, sku_id }) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(await inventory.getBalance(String(sku_id), String(location_id))),
          mimeType: "application/json",
        },
      ],
    }),
  );

  server.resource("locations_facilities", "inventory://locations/facilities", async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify(await inventory.getFacilities()),
        mimeType: "application/json",
      },
    ],
  }));

  server.resource("alerts_low_stock", "inventory://alerts/low-stock", async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify(await inventory.reorderRecommendations()),
        mimeType: "application/json",
      },
    ],
  }));

  // Prompts
  server.prompt(
    "cycle_count_reconciliation",
    "Analyzes physical count variances, highlights high-dollar discrepancies.",
    { cycleId: z.string() },
    ({ cycleId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please fetch the cycle count variance for cycle ID ${cycleId} (use getCycleCountVariance API or evaluate from given data if known). Analyze the physical count variances, highlight high-dollar discrepancies, and recommend whether to approve the adjustments or schedule a recount. Focus on top 20% of variances by value.`,
          },
        },
      ],
    }),
  );

  server.prompt(
    "procurement_replenishment_planner",
    "Evaluates vendor lead times and minimum order quantities to construct PO drafts.",
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please retrieve the current low stock alerts and reorder recommendations. For each item at or below its reorder point, draft an optimal Purchase Order. Take into account any vendor MOQs and group items by vendor. Provide the proposed PO drafts.`,
          },
        },
      ],
    }),
  );

  server.prompt(
    "stockout_triage",
    "Investigates zero-ATP SKUs and recommends expedited actions.",
    { skuId: z.string() },
    ({ skuId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Investigate the stockout for SKU ${skuId}. First, retrieve its current balances across all locations. Then check if there are any incoming shipments or in-transit transfers. Based on your findings, recommend expedited actions (e.g., immediate transfer from a nearby facility or an emergency PO).`,
          },
        },
      ],
    }),
  );

  return server;
}

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}
