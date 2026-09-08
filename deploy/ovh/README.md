# OVHCloud-deployment: Civisto Atomic CRM, PostgreSQL och MCP

**Författare:** Manus AI  
**Status:** Implementationsklar, deployment återstår  
**Målmiljö:** OVHCloud VPS med Docker Compose

## 1. Målbild

Den här runbooken flyttar Civisto Atomic CRM till OVHCloud och driftsätter CRM-frontenden, self-hosted Supabase/PostgreSQL och ett autentiserat MCP-gränssnitt. Lösningen behåller Supabase som applikationslager eftersom nuvarande frontend använder Supabase Auth, PostgREST, Storage och Edge Functions. Supabase anger Docker som den enklaste vägen för self-hosting och rekommenderar minst **4 kärnor, 8 GB RAM och 80 GB SSD** för en liten till medelstor produktionsmiljö.[1]

| Publik adress | Tjänst | Exponering |
|---|---|---|
| `https://crm.<domän>` | React/Vite-frontend i Nginx | Publik via Caddy |
| `https://api.crm.<domän>` | Supabase API-gateway | Publik via Caddy |
| `https://mcp.crm.<domän>/mcp` | Civisto CRM MCP | Publik via Caddy, kräver Bearer-token |
| PostgreSQL | Supabase PostgreSQL | Endast internt Docker-nät/localhost |

> **Viktigt:** Om en annan Civisto-applikation redan använder port 80/443 på samma OVHCloud-server ska endast **en** edge-proxy äga dessa portar. Lägg då in CRM-, API- och MCP-domänerna i den befintliga Caddy-/Nginx-konfigurationen och starta inte den medföljande Caddy-tjänsten parallellt.

## 2. Implementerade funktioner

Datamodellen använder fortsatt tabellen `companies`, men den representerar nu alla typer av organisationer. Detta undviker en riskfylld omskrivning av Atomic CRMs dataprovider.

| Område | Implementerat |
|---|---|
| Kommuner | `organization_type = municipality`, valfri fyrsiffrig `municipality_code` och verktyget `kommun_create`. |
| Samverkansaktörer | Länsstyrelse, statlig myndighet, region, kommunalt bolag, ideell organisation, universitet/högskola, privat bolag och annan organisation. |
| Nyhetsbrev | `has_newsletter`, `newsletter_subscribed_at` och `newsletter_unsubscribed_at` på kontaktnivå. |
| Datakonsistens | PostgreSQL-trigger sätter start- och slutdatum oavsett om ändringen sker från CRM, PostgREST eller MCP. |
| MCP | Streamable HTTP-server med fem verktyg, Zod-validering, Bearer-token och auditlogg. |
| Audit | `mcp_audit_log` lagrar verktyg, resultat och berörd post utan hemligheter eller fullständig persondata. |

## 3. MCP-verktyg

MCP-servern bygger på den officiella TypeScript-SDK:n, som stöder både lokala och fjärranslutna transporter samt typade verktyg.[3]

| Verktyg | Användning |
|---|---|
| `kommun_create` | Skapar eller återanvänder en kommun baserat på kommunkod eller namn. |
| `samverkansaktor_create` | Skapar eller återanvänder exempelvis en länsstyrelse eller statlig myndighet. |
| `kontakt_create` | Skapar en kontakt kopplad till en organisation; kan starta nyhetsbrev direkt. |
| `kontakt_nyhetsbrev_set` | Aktiverar eller avslutar prenumeration med valfritt ikraftträdandedatum. |
| `kontakt_get` | Hämtar kontakt, organisation och nyhetsbrevsstatus. |

Exempel på MCP-argument för Örebro kommun:

```json
{
  "name": "Örebro kommun",
  "municipality_code": "1880",
  "website": "https://www.orebro.se",
  "city": "Örebro",
  "idempotency_key": "orebro-kommun-1880-v1"
}
```

Exempel för Länsstyrelsen i Örebro län:

```json
{
  "name": "Länsstyrelsen i Örebro län",
  "organization_type": "county_administrative_board",
  "website": "https://www.lansstyrelsen.se/orebro.html",
  "city": "Örebro",
  "idempotency_key": "lansstyrelsen-orebro-v1"
}
```

Exempel för Naturvårdsverket:

```json
{
  "name": "Naturvårdsverket",
  "organization_type": "government_agency",
  "website": "https://www.naturvardsverket.se",
  "idempotency_key": "naturvardsverket-v1"
}
```

Exempel för att starta nyhetsbrev:

```json
{
  "contact_id": 123,
  "subscribed": true,
  "effective_at": "2026-09-08T09:00:00+02:00",
  "source": "explicit_consent",
  "idempotency_key": "newsletter-contact-123-20260908"
}
```

## 4. Serverförberedelser

Skapa DNS-poster för `crm`, `api.crm` och `mcp.crm` mot OVHCloud-servern. Installera Docker Engine och Compose-plugin, aktivera automatisk säkerhetsuppdatering och tillåt endast SSH, HTTP och HTTPS i brandväg/security group. PostgreSQL-port 5432 ska inte publiceras.

Rekommenderad katalogstruktur:

```text
/opt/civisto/
├── supabase-project/          # Officiell self-hosted Supabase-stack
├── civisto-atomic-crm/        # Detta repository
└── backups/                   # Lokala, krypterade mellanlagringar
```

Skapa en dedikerad driftanvändare och begränsa hemlighetsfiler:

```bash
sudo useradd --system --create-home --shell /bin/bash civisto
sudo mkdir -p /opt/civisto/{supabase-project,civisto-atomic-crm,backups}
sudo chown -R civisto:civisto /opt/civisto
sudo chmod 700 /opt/civisto/backups
```

## 5. Installera self-hosted Supabase

Använd en **pinnad self-hosted-release**, inte en flytande `master`. Supabase publicerar Docker-konfigurationen i sitt repository och beskriver både automatiserad och manuell installation.[1]

```bash
cd /opt/civisto
git clone --depth 1 --branch self-hosted/v0.8.0 \
  https://github.com/supabase/supabase.git supabase-source
cp -a supabase-source/docker/. supabase-project/
cd supabase-project
cp .env.example .env
printf 'ref=self-hosted/v0.8.0\n' > .supabase-version
sh utils/generate-keys.sh
sh utils/add-new-auth-keys.sh
chmod 600 .env
```

Anpassa minst följande värden:

```dotenv
SUPABASE_PUBLIC_URL=https://api.crm.example.se
API_EXTERNAL_URL=https://api.crm.example.se/auth/v1
SITE_URL=https://crm.example.se
ADDITIONAL_REDIRECT_URLS=https://crm.example.se/**
```

Supabase använder API-gateway på port 8000 och rekommenderar en reverse proxy med giltigt TLS-certifikat framför den i produktion.[1] Bind gatewayporten endast till localhost i Supabase Compose-konfigurationen:

```yaml
ports:
  - "127.0.0.1:8000:8000"
```

Starta ännu inte skarp trafik. Starta stacken för initiering och verifiera att samtliga tjänster blir healthy:

```bash
cd /opt/civisto/supabase-project
sh run.sh start
docker compose ps
```

## 6. Fullständig datamigrering

### 6.1 Förbered och ta backup

Meddela användarna om ett kort skrivstopp. Sätt CRM och andra skrivande Civisto-klienter i maintenance/read-only innan slutdumpen. Ta dessutom en plattformsbackup innan migreringen.

Supabase dokumenterar separata CLI-dumpar för roller, schema och data samt `--single-transaction` och `ON_ERROR_STOP` vid återställning.[2]

```bash
export OLD_DB_URL='postgresql://...'
mkdir -p /opt/civisto/backups/final
cd /opt/civisto/backups/final

supabase db dump --db-url "$OLD_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$OLD_DB_URL" -f schema.sql
supabase db dump --db-url "$OLD_DB_URL" -f data.sql --use-copy --data-only \
  -x "storage.buckets_vectors" -x "storage.vector_indexes"

supabase db dump --db-url "$OLD_DB_URL" -f history_schema.sql \
  --schema supabase_migrations
supabase db dump --db-url "$OLD_DB_URL" -f history_data.sql --use-copy \
  --data-only --schema supabase_migrations

sha256sum *.sql > SHA256SUMS
```

### 6.2 Hantera delad Civisto-databas

CRM och Civistos övriga applikationer delar databas. Kör därför **inte** respektive repositories fulla historik blint efter en komplett schemaåterställning. Återställ först källdatabasens schema, data och migrationshistorik. Applicera därefter endast migrationer vars versionsnummer inte redan finns i `supabase_migrations.schema_migrations`.

Kontrollera status före varje ny migration:

```sql
select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 50;
```

Den nya CRM-migrationen i detta repository är:

```text
supabase/migrations/20260908090000_organizations_newsletter_mcp.sql
```

### 6.3 Återställ PostgreSQL

Hämta lokalt PostgreSQL-lösenord från `/opt/civisto/supabase-project/.env` utan att skriva ut det i loggar. Testa återställningen i en separat tillfällig databas först. Vid skarp återställning använder du den lokala direkta anslutningen, aldrig en internetexponerad 5432-port.

```bash
export NEW_DB_URL='postgresql://postgres:<lösenord>@127.0.0.1:5432/postgres'
cd /opt/civisto/backups/final

psql --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$NEW_DB_URL"

psql --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file history_schema.sql \
  --file history_data.sql \
  --dbname "$NEW_DB_URL"
```

`roles.sql` ska sparas men granskas innan import till self-hosted Supabase. Stacken skapar egna systemroller; importera endast projektunika roller som saknas för att undvika att skriva över `anon`, `authenticated`, `service_role`, `supabase_admin` eller `postgres`.

Applicera den nya CRM-migrationen exakt en gång:

```bash
psql --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file /opt/civisto/civisto-atomic-crm/supabase/migrations/20260908090000_organizations_newsletter_mcp.sql \
  --dbname "$NEW_DB_URL"
```

### 6.4 Auth, Edge Functions och Storage

Databasdumpen flyttar databasinnehåll, men binära Storage-objekt måste migreras separat. Supabase beskriver en process som listar buckets, laddar ned varje objekt från källan och laddar upp det till målet med service credentials.[2] Kör detta under skrivstoppet och jämför antal buckets, objekt och total storlek före öppning.

Edge Functions i repositoryt kopieras till self-hosted Supabase:

```bash
rsync -a --delete \
  /opt/civisto/civisto-atomic-crm/supabase/functions/ \
  /opt/civisto/supabase-project/volumes/functions/

cd /opt/civisto/supabase-project
sh run.sh recreate functions
```

Kontrollera särskilt funktionerna `users`, `updatePassword` och `postmark`, deras secrets och eventuella webhook-URL:er. Rotera webhook-hemligheter efter flytten.

## 7. Driftsätt CRM och MCP

```bash
cd /opt/civisto
git clone https://github.com/johanlido/civisto-atomic-crm.git
cd civisto-atomic-crm/deploy/ovh
cp .env.example .env
chmod 600 .env
```

Fyll i `.env`. Använd Supabase **publishable/anon key** för frontenden och **secret/service-role key** endast för MCP-containern. Generera MCP-nyckeln lokalt:

```bash
openssl rand -hex 32
```

Starta med:

```bash
./deploy.sh
```

Deploymentskriptet validerar obligatoriska variabler, bygger bilderna, startar stacken och väntar på hälsokontroller. Om en gemensam edge-proxy redan används startas endast `frontend` och `mcp`, och motsvarande routes läggs manuellt i den befintliga proxyn.

## 8. Anslut MCP

MCP-URL:

```text
https://mcp.crm.example.se/mcp
```

HTTP-header:

```text
Authorization: Bearer <MCP_API_KEY>
```

Skapa en Custom MCP-connector med Streamable HTTP till URL:en ovan och lagra Bearer-token i connectorns säkra credential-fält. Lägg aldrig service-role key i connectorn; den finns endast mellan MCP-containern och Supabase.

## 9. Verifiering före trafiköppning

| Kontroll | Förväntat resultat |
|---|---|
| `GET https://crm.<domän>/health` | HTTP 200 och `ok`. |
| `GET https://mcp.crm.<domän>/health` | HTTP 200 och `{"status":"ok","database":"ok"}`. |
| `/mcp` utan token | HTTP 401. |
| MCP `listTools` | Fem verktyg inklusive `kommun_create` och `kontakt_nyhetsbrev_set`. |
| Skapa testkommun två gånger | Första svaret `created: true`, andra `created: false`. |
| Skapa samverkansaktör | Rätt `organization_type` i `companies`. |
| Starta nyhetsbrev | `has_newsletter=true`, startdatum satt, slutdatum null. |
| Avsluta nyhetsbrev | `has_newsletter=false`, startdatum bevarat, slutdatum satt. |
| CRM-formulär | Nya organisations- och nyhetsbrevsfält syns och sparas. |
| Auth | Befintliga användare kan logga in. |
| Storage | Samtliga buckets och objekt kan läsas enligt RLS. |
| Edge Functions | `users`, `updatePassword` och `postmark` fungerar. |

Datakontroller efter restore:

```sql
select count(*) from companies;
select count(*) from contacts;
select count(*) from deals;
select count(*) from tasks;
select count(*) from auth.users;
select count(*) from storage.objects;

select organization_type, count(*)
from companies
group by organization_type
order by organization_type;

select has_newsletter, count(*)
from contacts
group by has_newsletter;
```

## 10. Cutover och rollback

Sänk DNS TTL minst ett dygn i förväg. När verifieringen är godkänd uppdateras DNS till OVHCloud och skrivtrafiken öppnas. Behåll källmiljön i read-only-läge tills en full arbetsdag har verifierats.

Rollback utlöses vid misslyckad auth, ofullständig data, Storage-fel, kritiska RLS-problem eller MCP-skrivningar mot fel databas. Stoppa då OVHClouds skrivande klienter, återställ tidigare DNS och återöppna källmiljön. Om data har skrivits i OVHCloud efter cutover måste dessa ändringar exporteras och manuellt reconcileras innan rollback.

## 11. Backup och drift

Ta daglig krypterad `pg_dump`, kopiera Storage-volym/objekt och skicka backup off-site till ett separat OVH Object Storage-projekt eller annan leverantör. Testa återställning kvartalsvis. Säkerhetsuppdatera operativsystemet löpande och uppgradera self-hosted Supabase endast mellan pinnade releaser efter stagingtest.

Separera följande:

| Driftobjekt | Regel |
|---|---|
| CRM- och MCP-images | Byggs från detta repository och versionsmärks med Git SHA. |
| Supabase-stack | Pinnad self-hosted-release, uppgraderas separat. |
| Databasmigrationer | Gemensam migrationshistorik för alla Civisto-appar. |
| Edge Functions | Ett gemensamt target; samma funktionsnamn får inte deployas från flera pipelines utan ägarskap. |
| Mobil-/appstorebyggen | Ska endast peka om API-bas-URL och publishable key; de påverkas inte av CRM-containerbygget. |
| Hemligheter | Endast serverlokala `.env`/secret store med `0600`; aldrig i Git eller frontend. |

## 12. Verifierad lokal teststatus

| Test | Resultat |
|---|---|
| CRM TypeScript + Vite production build | Godkänt |
| CRM Vitest | Godkänt |
| MCP TypeScript build/typecheck | Godkänt |
| MCP-protokolltest (`listTools` + `kommun_create`) | Godkänt |
| MCP schemas | 5 tester godkända |
| PostgreSQL migration + triggerassertions | Godkänt mot PostgreSQL 16 |
| Compose `config --quiet` | Godkänt |
| MCP endpoint utan Bearer-token | HTTP 401, godkänt |
| Docker image build i sandbox | Ej slutfört på grund av sandboxens kernel/iptables-begränsning; ska köras på OVHCloud staging före produktion |

## Referenser

[1]: https://supabase.com/docs/guides/self-hosting/docker "Supabase: Self-Hosting with Docker"
[2]: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore "Supabase: Backup and Restore using the CLI"
[3]: https://modelcontextprotocol.io/docs/2026-07-28/sdk "Model Context Protocol: Official SDKs"
