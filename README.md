# koality-inventory-mcp

Standalone Model Context Protocol server for [koality-inventory](https://github.com/Koality-Assured/koality-inventory).

Local agents connect over **stdio**. Remote enterprise deployments use a single **Streamable HTTP** endpoint. The deprecated HTTP+SSE dual connection is not implemented.

Slice 0 scaffolds the TypeScript package, lint, and CI. Tool handlers connect to a running inventory API in a later slice.

```bash
npm ci
npm test
```

Node.js 24 or newer is required.
