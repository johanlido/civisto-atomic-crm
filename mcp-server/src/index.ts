import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createClient } from "@supabase/supabase-js";
import * as z from "zod/v4";

import { CrmRepository } from "./crmRepository.js";
import { createCrmMcpServer } from "./server.js";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  HOST: z.string().default("0.0.0.0"),
  MCP_API_KEY: z.string().min(32),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(32),
  MCP_ALLOWED_HOSTS: z.string().optional(),
});

const env = envSchema.parse(process.env);
const allowedHosts = new Set(
  (env.MCP_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const repository = new CrmRepository(supabase);
const mcpHandler = createMcpHandler(() => createCrmMcpServer(repository));
const nodeMcpHandler = toNodeHandler(mcpHandler);

const httpServer = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (url.pathname === "/health" && request.method === "GET") {
    const { error } = await supabase
      .from("companies")
      .select("id", { count: "exact", head: true });
    response.writeHead(error ? 503 : 200, {
      "Content-Type": "application/json",
    });
    response.end(
      JSON.stringify({
        status: error ? "unhealthy" : "ok",
        database: error ? "unavailable" : "ok",
      }),
    );
    return;
  }

  if (url.pathname !== "/mcp") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
    return;
  }

  if (!isAllowedHost(request.headers.host)) {
    response.writeHead(421, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "misdirected_request" }));
    return;
  }

  if (!hasValidBearerToken(request.headers.authorization)) {
    response.writeHead(401, {
      "Content-Type": "application/json",
      "WWW-Authenticate": "Bearer",
    });
    response.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  await nodeMcpHandler(request, response);
});

httpServer.listen(env.PORT, env.HOST, () => {
  console.log(`Civisto CRM MCP listening on ${env.HOST}:${env.PORT}`);
});

const shutdown = async () => {
  httpServer.close();
  await mcpHandler.close();
};

process.on("SIGINT", () => void shutdown().finally(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown().finally(() => process.exit(0)));

function hasValidBearerToken(authorization: string | undefined) {
  if (!authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(env.MCP_API_KEY);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

function isAllowedHost(hostHeader: string | undefined) {
  if (allowedHosts.size === 0) return true;
  if (!hostHeader) return false;
  return allowedHosts.has(hostHeader.toLowerCase());
}
