# Civisto CRM MCP Server

MCP-servern exponerar säkra skriv- och läsverktyg för Civisto Atomic CRM. Den är avsedd att köras på OVHCloud bakom HTTPS och använder self-hosted Supabase/PostgREST mot PostgreSQL.

## Verktyg

| Namn | Beskrivning |
|---|---|
| `kommun_create` | Skapar eller hittar en svensk kommun. |
| `samverkansaktor_create` | Skapar eller hittar en annan organisationstyp. |
| `kontakt_create` | Skapar eller hittar en kontakt via primär e-postadress. |
| `kontakt_nyhetsbrev_set` | Startar eller avslutar nyhetsbrevsprenumeration. |
| `kontakt_get` | Läser kontakt och nyhetsbrevsstatus. |

## Miljövariabler

| Variabel | Krav |
|---|---|
| `SUPABASE_URL` | Intern eller publik URL till OVHClouds Supabase API-gateway. |
| `SUPABASE_SERVICE_ROLE_KEY` | Serverhemlighet, minst 32 tecken. Får aldrig exponeras i frontend. |
| `MCP_API_KEY` | Slumpmässig Bearer-token, minst 32 tecken. |
| `MCP_ALLOWED_HOSTS` | Kommaseparerad allowlist, exempelvis `mcp.crm.example.se`. |
| `HOST` | Standard `0.0.0.0`. |
| `PORT` | Standard `3000`. |

## Utveckling

```bash
npm install
npm test
npm run typecheck
npm run build
```

Starta lokalt först när databasens migration har applicerats:

```bash
SUPABASE_URL=http://127.0.0.1:8000 \
SUPABASE_SERVICE_ROLE_KEY='<service-role-key>' \
MCP_API_KEY='<minst-32-slumptecken>' \
MCP_ALLOWED_HOSTS='localhost:3000' \
npm start
```

Endpointen är `http://localhost:3000/mcp`. Hälsokontrollen finns på `http://localhost:3000/health` och kräver inte token, men returnerar ingen känslig information.

## Säkerhet

Alla MCP-anrop till `/mcp` kräver `Authorization: Bearer <MCP_API_KEY>`. Token jämförs i konstant tid. MCP-servern är den enda komponenten som känner till Supabase service-role key. PostgreSQL-migrationen aktiverar RLS på auditloggen och nekar `anon` samt vanliga autentiserade användare åtkomst.

Skrivoperationer loggas i `mcp_audit_log`. Loggen innehåller verktygsnamn, resultat, berörd post och ett begränsat inputsammandrag; e-postadresser, full persondata och hemligheter ska inte lagras där.

Se [OVHCloud-runbooken](../deploy/ovh/README.md) för deployment, datamigrering och connectorinställning.

## Referenser

[1]: https://modelcontextprotocol.io/docs/2026-07-28/sdk "Model Context Protocol: Official SDKs"
