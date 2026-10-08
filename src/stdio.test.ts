import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";

const clients: Client[] = [];
const servers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("stdio MCP tools", () => {
  it("calls stock tools over stdio against a local inventory API", async () => {
    const api = await listen();
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url)),
        "src/main.ts",
      ],
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: {
        ...getDefaultEnvironment(),
        KOALITY_INVENTORY_API_URL: api.url,
        KOALITY_INVENTORY_TOKEN: "test-token",
      },
      stderr: "pipe",
    });
    const client = new Client({ name: "koality-inventory-test", version: "0.0.0" });
    clients.push(client);
    await client.connect(transport);

    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual([
      "stock_adjust",
      "stock_create_purchase_order",
      "stock_get_balance",
      "stock_receive_shipment",
      "stock_record_count",
      "stock_reorder_recommendations",
      "stock_search_catalog",
      "stock_start_cycle_count",
      "stock_transfer",
    ]);

    const balance = await client.callTool({
      name: "stock_get_balance",
      arguments: { skuId: "sku_test" },
    });
    expect(textOf(balance)).toContain('"atp":2');

    const search = await client.callTool({
      name: "stock_search_catalog",
      arguments: { query: "widget" },
    });
    expect(textOf(search)).toContain("Widget");

    const adjustment = await client.callTool({
      name: "stock_adjust",
      arguments: {
        skuId: "sku_test",
        locationId: "loc_test",
        quantityDelta: -1,
        reason: "cycle variance",
      },
    });
    expect(textOf(adjustment)).toContain("cycle variance");

    const transfer = await client.callTool({
      name: "stock_transfer",
      arguments: {
        skuId: "sku_test",
        fromLocationId: "loc_a",
        toLocationId: "loc_b",
        quantity: 2,
      },
    });
    expect(textOf(transfer)).toContain("trn_test");
  });
});

function textOf(result: unknown): string {
  if (!result || typeof result !== "object" || !("content" in result)) {
    return "";
  }
  const content = result.content;
  if (!Array.isArray(content)) {
    return "";
  }
  for (const entry of content) {
    if (entry && typeof entry === "object" && "text" in entry && typeof entry.text === "string") {
      return entry.text;
    }
  }
  return "";
}

function listen(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((request, response) => {
    if (request.headers.authorization !== "Bearer test-token") {
      response.writeHead(401).end();
      return;
    }
    const url = request.url ?? "";
    if (url.startsWith("/api/v1/stock/balances")) {
      json(response, { balance: { skuId: "sku_test", onHand: 4, atp: 2 } });
      return;
    }
    if (url.startsWith("/api/v1/items")) {
      json(response, { items: [{ id: "itm_test", name: "Widget" }] });
      return;
    }
    if (request.method === "POST" && url === "/api/v1/stock/adjustments") {
      readJson(request).then((body) => {
        json(response, { adjustmentId: "adj_test", reason: body.reason });
      });
      return;
    }
    if (request.method === "POST" && url === "/api/v1/stock/transfers") {
      json(response, { transferId: "trn_test" });
      return;
    }
    response.writeHead(404).end();
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      const handle = {
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((done, reject) => {
            server.close((error) => (error ? reject(error) : done()));
          }),
      };
      servers.push(handle);
      resolve(handle);
    });
  });
}

function json(response: import("node:http").ServerResponse, body: unknown) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function readJson(request: import("node:http").IncomingMessage): Promise<{ reason?: string }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as { reason?: string });
    });
  });
}
