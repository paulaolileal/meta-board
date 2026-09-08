import "./env.js"; // validates required env vars before anything else runs
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { provider } from "./providerBootstrap.js";
import { registerBoardTools } from "./tools/boards.js";
import { registerCardTools } from "./tools/cards.js";
import { registerPendingTools } from "./tools/pending.js";

const server = new McpServer({ name: "meta-board", version: "0.1.0" });

registerBoardTools(server, provider);
registerCardTools(server, provider);
registerPendingTools(server, provider);

await server.connect(new StdioServerTransport());
