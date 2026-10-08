# koality-inventory-mcp

Standalone Model Context Protocol server for [koality-inventory](https://github.com/Koality-Assured/koality-inventory).

Local agents connect over **stdio**. Remote enterprise deployments use a single **Streamable HTTP** endpoint. The deprecated HTTP+SSE dual connection is not implemented.

Local agents launch the server over stdio. Point it at a running inventory API:

```bash
set KOALITY_INVENTORY_API_URL=http://127.0.0.1:3000
set KOALITY_INVENTORY_TOKEN=<access-token>
npm start
```

Slice 2 tools: `stock_get_balance`, `stock_search_catalog`, `stock_adjust`, `stock_transfer`.

```bash
npm ci
npm test
```

Node.js 24 or newer is required.
