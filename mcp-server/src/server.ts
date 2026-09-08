import { McpServer } from "@modelcontextprotocol/server";

import { CrmRepository, RepositoryError } from "./crmRepository.js";
import {
  collaborationActorCreateSchema,
  contactCreateSchema,
  contactGetSchema,
  municipalityCreateSchema,
  newsletterSetSchema,
} from "./schemas.js";

export const createCrmMcpServer = (repository: CrmRepository) => {
  const server = new McpServer({
    name: "civisto-crm",
    version: "1.0.0",
  });

  server.registerTool(
    "kommun_create",
    {
      description:
        "Skapa en svensk kommun i Civisto CRM. Anropet är dubblettsäkert och returnerar befintlig kommun om kommunkod eller namn redan finns.",
      inputSchema: municipalityCreateSchema,
    },
    async (input) => execute(() => repository.createMunicipality(input)),
  );

  server.registerTool(
    "samverkansaktor_create",
    {
      description:
        "Skapa en samverkansaktör i Civisto CRM, exempelvis länsstyrelse, statlig myndighet, region, universitet, ideell organisation eller kommunalt bolag.",
      inputSchema: collaborationActorCreateSchema,
    },
    async (input) => execute(() => repository.createCollaborationActor(input)),
  );

  server.registerTool(
    "kontakt_create",
    {
      description:
        "Skapa en kontakt kopplad till en befintlig kommun eller samverkansaktör. Nyhetsbrevsprenumeration kan aktiveras med startdatum vid skapandet.",
      inputSchema: contactCreateSchema,
    },
    async (input) => execute(() => repository.createContact(input)),
  );

  server.registerTool(
    "kontakt_nyhetsbrev_set",
    {
      description:
        "Aktivera eller avsluta en kontakts nyhetsbrevsprenumeration. Start- respektive slutdatum sätts till effective_at eller aktuell tid.",
      inputSchema: newsletterSetSchema,
    },
    async (input) => execute(() => repository.setNewsletterSubscription(input)),
  );

  server.registerTool(
    "kontakt_get",
    {
      description:
        "Hämta en CRM-kontakt inklusive organisation och aktuell nyhetsbrevsstatus med start- och slutdatum.",
      inputSchema: contactGetSchema,
    },
    async ({ contact_id }) => execute(() => repository.getContact(contact_id)),
  );

  return server;
};

const execute = async (operation: () => Promise<unknown>) => {
  try {
    const result = await operation();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const normalized =
      error instanceof RepositoryError
        ? { code: error.code, message: error.message }
        : {
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : String(error),
          };

    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(normalized, null, 2),
        },
      ],
    };
  }
};
