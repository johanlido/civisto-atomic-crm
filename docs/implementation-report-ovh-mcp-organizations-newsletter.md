# Leveransrapport: OVHCloud, organisationsmodell och CRM-MCP

**Datum:** 2026-09-08  
**Författare:** Manus AI  
**Repository:** `johanlido/civisto-atomic-crm`  
**Gren:** `feat/ovh-mcp-organizations-newsletter`  
**Commits:** `99174fa`, `7e6cf51`

## Sammanfattning

Civisto Atomic CRM har utökats för att hantera kommuner och samverkansaktörer, spåra nyhetsbrevsprenumerationer med start- och slutdatum samt styra funktionerna via ett autentiserat MCP-gränssnitt. Deploymentfiler och en komplett migreringsrunbook för OVHCloud med Docker och self-hosted Supabase/PostgreSQL ingår.

## Levererade funktioner

| Del | Resultat |
|---|---|
| Organisationsmodell | `companies` har fått `organization_type`, `municipality_code` och `organization_number`. |
| Kommuner | Egen typ och dubblettsäkert MCP-verktyg `kommun_create`. |
| Samverkansaktörer | Stöd för länsstyrelse, statlig myndighet, region, kommunalt bolag, ideell organisation, universitet/högskola, privat bolag och annan organisation. |
| Kontakter | `newsletter_subscribed_at` och `newsletter_unsubscribed_at` har lagts till. |
| Datakonsistens | PostgreSQL-trigger normaliserar nyhetsbrevsstatus och datum för alla skrivvägar. |
| CRM-frontend | Nya organisationsfält och nyhetsbrevsdatum kan redigeras och visas. CSV-import/-export stöder nya fält. |
| MCP | Fem verktyg: `kommun_create`, `samverkansaktor_create`, `kontakt_create`, `kontakt_nyhetsbrev_set` och `kontakt_get`. |
| MCP-säkerhet | Bearer-token, Host-allowlist, Zod-validering, service-role endast på servern och `mcp_audit_log`. |
| OVHCloud | Dockerfiler för frontend och MCP, Compose, Caddy, Nginx, miljömall och deployskript. |
| Migrering | Runbook för PostgreSQL, Auth, Storage, Edge Functions, migrationshistorik, cutover och rollback. |

## Verifiering

| Test | Resultat |
|---|---|
| CRM Vitest | 57 av 57 tester godkända. |
| CRM TypeScript + Vite production build | Godkänt. |
| MCP Vitest | 6 av 6 tester godkända. |
| MCP typecheck och build | Godkänt. |
| MCP-protokolltest | `listTools` och `kommun_create` godkända med officiell klient. |
| PostgreSQL-migration | Godkänd mot PostgreSQL 16 med assertions för klassificering och nyhetsbrevslivscykel. |
| Compose-validering | `docker compose config --quiet` godkänd. |
| MCP auth smoke test | `/mcp` utan Bearer-token returnerade HTTP 401. |
| Hemlighetskontroll | Inga verkliga tokens eller nycklar har lagts i Git. |

Docker image build kunde inte slutföras i sandboxen eftersom dess kernel saknade den iptables-funktion som Docker bridge-nätet krävde. Compose-definitionen är syntaktiskt verifierad och bilderna ska byggas som ett obligatoriskt stagingsteg på OVHCloud före produktion.

## Viktiga filer

| Fil | Syfte |
|---|---|
| `supabase/migrations/20260908090000_organizations_newsletter_mcp.sql` | Produktionsmigration. |
| `supabase/tests/organizations_newsletter_mcp.sql` | Isolerat SQL-test; körs inte som migration. |
| `mcp-server/` | MCP-server, tester och container. |
| `deploy/ovh/README.md` | Fullständig deployment- och datamigreringsrunbook. |
| `deploy/ovh/docker-compose.yml` | Frontend, MCP och edge proxy. |
| `docs/ovh-mcp-data-model.md` | Datamodell och MCP-kontrakt. |

## Kvarvarande produktionssteg

Ingen skarp OVHCloud-deployment eller databasändring har gjorts från denna arbetsmiljö. Före cutover ska Civisto:

1. provisionera eller bekräfta OVHCloud-servern och DNS-domänerna,
2. ta slutbackup av nuvarande Supabase-projekt och flytta Storage-objekten,
3. återställa data i en staginginstans,
4. applicera migrationen exakt en gång i den gemensamma Civisto-databasen,
5. bygga Docker-images på staging,
6. köra verifieringstabellen i `deploy/ovh/README.md`, och
7. konfigurera MCP-connectorn med `https://mcp.crm.<domän>/mcp` och separat Bearer-token.

## Referenser

[1]: https://supabase.com/docs/guides/self-hosting/docker "Supabase: Self-Hosting with Docker"
[2]: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore "Supabase: Backup and Restore using the CLI"
[3]: https://modelcontextprotocol.io/docs/2026-07-28/sdk "Model Context Protocol: Official SDKs"
