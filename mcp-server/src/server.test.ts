import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CrmRepository } from "./crmRepository.js";
import { createCrmMcpServer } from "./server.js";

const closeCallbacks: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (closeCallbacks.length > 0) {
    await closeCallbacks.pop()?.();
  }
});

describe("Civisto CRM MCP server", () => {
  it("exposes the requested CRM tools and invokes kommun_create", async () => {
    const createMunicipality = vi.fn().mockResolvedValue({
      created: true,
      organization: {
        id: 1880,
        name: "Örebro kommun",
        organization_type: "municipality",
        municipality_code: "1880",
      },
    });

    const repository = {
      createMunicipality,
      createCollaborationActor: vi.fn(),
      createContact: vi.fn(),
      setNewsletterSubscription: vi.fn(),
      getContact: vi.fn(),
    } as unknown as CrmRepository;

    const handler = createMcpHandler(() => createCrmMcpServer(repository));
    const client = new Client({ name: "crm-mcp-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(
      new URL("http://localhost/mcp"),
      {
        fetch: (url, init) => handler.fetch(new Request(url, init)),
      },
    );

    await client.connect(transport);
    closeCallbacks.push(async () => {
      await client.close();
      await handler.close();
    });

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "kommun_create",
      "kontakt_create",
      "kontakt_get",
      "kontakt_nyhetsbrev_set",
      "samverkansaktor_create",
    ]);

    const result = await client.callTool({
      name: "kommun_create",
      arguments: {
        name: "Örebro kommun",
        municipality_code: "1880",
      },
    });

    expect(createMunicipality).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Örebro kommun",
        municipality_code: "1880",
        country: "Sweden",
      }),
    );
    expect(result.isError).not.toBe(true);
  });
});
