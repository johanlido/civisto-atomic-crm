# Design: organisationer, nyhetsbrev och MCP på OVHCloud

## Syfte

Den här ändringen gör Civisto Atomic CRM kapabelt att hantera både svenska kommuner och andra samverkansaktörer, samtidigt som nyhetsbrevsprenumerationer får spårbara start- och slutdatum. Alla centrala skrivoperationer ska kunna utföras via ett autentiserat MCP-gränssnitt på OVHCloud.

## Driftalternativ

| Alternativ | Konsekvenser | Löpande kostnad | Komplexitet |
|---|---|---:|---:|
| **A. Self-hosted Supabase på OVHCloud** | Behåller befintlig Supabase-klient, PostgREST, Auth, Storage och Edge Functions. Minsta förändring i CRM-frontenden och stöd för delad Civisto-databas. | OVHCloud VPS och backup/objektlagring | Medel |
| **B. Ren PostgreSQL med egen REST/Auth/Storage-backend** | Färre containrar men kräver omskrivning av data provider, autentisering, fillagring och användarhantering. | OVHCloud VPS och backup/objektlagring | Hög |

Implementationens huvudspår är **alternativ A**, eftersom CRM-koden redan använder Supabase Auth, PostgREST, Storage och Edge Functions. Supabase rekommenderar Docker för self-hosting och tillhandahåller PostgreSQL, PostgREST, Auth, Storage och Edge Runtime som separata tjänster i stacken.[1]

## Organisationsmodell

Den befintliga tabellen `companies` behålls för bakåtkompatibilitet, men får semantiskt representera alla organisationer. Följande fält läggs till:

| Fält | Typ | Regel |
|---|---|---|
| `organization_type` | text | Obligatoriskt. Tillåtna värden: `municipality`, `county_administrative_board`, `government_agency`, `region`, `municipal_company`, `nonprofit`, `university`, `private_company`, `other`. |
| `municipality_code` | text | Valfritt. Exakt fyra siffror och endast relevant för `municipality`. |
| `organization_number` | text | Valfritt svenskt organisationsnummer eller annan registreringsidentifierare. |

Det generella MCP-verktyget `samverkansaktor_create` använder samma tabell och tillåter alla organisationstyper utom `municipality`. Det separata verktyget `kommun_create` ger en tydlig och strikt ingång för kommuner.

## Nyhetsbrevsmodell

Kontakttabellen kompletteras med följande fält:

| Fält | Typ | Betydelse |
|---|---|---|
| `has_newsletter` | boolean, ej null | Aktuell prenumerationsstatus. |
| `newsletter_subscribed_at` | timestamptz, nullable | Tidpunkt då nuvarande prenumerationsperiod startade. |
| `newsletter_unsubscribed_at` | timestamptz, nullable | Tidpunkt då den senaste prenumerationen avslutades. |

En databas-trigger normaliserar statusen oavsett om ändringen kommer från CRM-frontenden, PostgREST eller MCP:

| Händelse | Databasbeteende |
|---|---|
| Ny kontakt med `has_newsletter = true` | `newsletter_subscribed_at` sätts till angiven tid eller `now()`; avslutsdatum rensas. |
| Övergång från ej prenumerant till prenumerant | Nytt startdatum sätts; tidigare avslutsdatum rensas. |
| Övergång från prenumerant till ej prenumerant | `newsletter_unsubscribed_at` sätts till angiven tid eller `now()`; startdatum bevaras. |
| Befintlig aktiv prenumerant från äldre data | Startdatum lämnas null om det inte kan verifieras; migrationen uppfinner inte historik. |

## MCP-kontrakt

MCP-servern använder officiell MCP TypeScript SDK v2 och Streamable HTTP, vilket är den rekommenderade fjärrtransporten i SDK:n.[2] Den kör som en separat Docker-container och anropar OVHCloud-instansens Supabase API med en service-role-nyckel som endast finns på serversidan.

| Verktyg | Syfte | Idempotens/validering |
|---|---|---|
| `kommun_create` | Skapar en kommun i `companies`. | Matchar befintlig kommun på kommunkod eller normaliserat namn innan ny post skapas. |
| `samverkansaktor_create` | Skapar exempelvis länsstyrelse, Naturvårdsverket, region, universitet eller ideell aktör. | Matchar på organisationsnummer eller normaliserat namn och organisationstyp. |
| `kontakt_create` | Skapar kontakt kopplad till en organisation och kan sätta nyhetsbrev från start. | Kräver organisationens id; kontrollerar befintlig primär e-post innan skapande. |
| `kontakt_nyhetsbrev_set` | Startar eller avslutar prenumeration med valfritt ikraftträdandedatum. | Uppdaterar via databasens normaliseringsregler och returnerar resulterande status/datum. |
| `kontakt_get` | Läser kontakt inklusive organisation och aktuell nyhetsbrevsstatus. | Endast läsning. |

Alla MCP-anrop skyddas av Bearer-token (`MCP_API_KEY`), valideras med Zod och loggas i `mcp_audit_log` med verktygsnamn, resultatstatus och berörd post. Hemligheter skrivs aldrig till auditloggen.

## OVHCloud-routing

| URL | Container/tjänst |
|---|---|
| `https://crm.<domän>/` | CRM-frontend via Nginx |
| `https://api.crm.<domän>/` | Self-hosted Supabase API-gateway |
| `https://mcp.crm.<domän>/mcp` | MCP-serverns Streamable HTTP-endpoint |

Caddy terminerar TLS och proxar endast respektive publik endpoint. PostgreSQL-porten publiceras inte mot internet. MCP-serverns service-role-nyckel och `MCP_API_KEY` lagras i en serverlokal `.env` med filrättighet `0600`.

## Referenser

[1]: https://supabase.com/docs/guides/self-hosting/docker "Supabase: Self-Hosting with Docker"
[2]: https://github.com/modelcontextprotocol/typescript-sdk "Model Context Protocol: Official TypeScript SDK"
