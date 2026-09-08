-- Civisto CRM: organization taxonomy, newsletter lifecycle and MCP audit log.
-- Designed for the shared Civisto PostgreSQL database on OVHCloud.

begin;

-- ---------------------------------------------------------------------------
-- Organizations (kept in public.companies for Atomic CRM compatibility)
-- ---------------------------------------------------------------------------

alter table public.companies
    add column if not exists organization_type text,
    add column if not exists municipality_code text,
    add column if not exists organization_number text;

-- Classify existing records conservatively. Unclear records become
-- private_company and can be corrected in the CRM.
update public.companies
set organization_type = case
    when name ~* '(^|[[:space:]])kommun($|[[:space:]])'
        or sector ilike '%municipal%'
        then 'municipality'
    when name ilike 'Länsstyrelsen%'
        or name ilike 'Lansstyrelsen%'
        then 'county_administrative_board'
    when name ilike 'Naturvårdsverket%'
        or name ilike 'Naturvardsverket%'
        then 'government_agency'
    when name ~* '(^|[[:space:]])region($|[[:space:]])'
        then 'region'
    when sector ilike '%university%'
        or sector ilike '%educational%'
        then 'university'
    when sector ilike '%government%'
        then 'government_agency'
    else 'private_company'
end
where organization_type is null;

alter table public.companies
    alter column organization_type set default 'private_company',
    alter column organization_type set not null;

alter table public.companies
    drop constraint if exists companies_organization_type_check;

alter table public.companies
    add constraint companies_organization_type_check check (
        organization_type in (
            'municipality',
            'county_administrative_board',
            'government_agency',
            'region',
            'municipal_company',
            'nonprofit',
            'university',
            'private_company',
            'other'
        )
    );

alter table public.companies
    drop constraint if exists companies_municipality_code_check;

alter table public.companies
    add constraint companies_municipality_code_check check (
        municipality_code is null
        or (
            organization_type = 'municipality'
            and municipality_code ~ '^[0-9]{4}$'
        )
    );

create unique index if not exists companies_municipality_code_uidx
    on public.companies (municipality_code)
    where municipality_code is not null;

create unique index if not exists companies_organization_number_uidx
    on public.companies (lower(organization_number))
    where organization_number is not null
      and btrim(organization_number) <> '';

comment on column public.companies.organization_type is
    'Organization taxonomy used by CRM and MCP. municipality is reserved for Swedish municipalities.';
comment on column public.companies.municipality_code is
    'Four-digit Swedish municipality code. Only valid when organization_type=municipality.';
comment on column public.companies.organization_number is
    'Optional organization or registration number used for duplicate detection.';

-- ---------------------------------------------------------------------------
-- Newsletter lifecycle on contacts
-- ---------------------------------------------------------------------------

alter table public.contacts
    add column if not exists newsletter_subscribed_at timestamp with time zone,
    add column if not exists newsletter_unsubscribed_at timestamp with time zone;

update public.contacts
set has_newsletter = false
where has_newsletter is null;

alter table public.contacts
    alter column has_newsletter set default false,
    alter column has_newsletter set not null;

-- Existing active subscribers intentionally keep a null start date if no
-- verified historical date exists. The migration does not invent consent data.
create or replace function public.normalize_contact_newsletter_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if tg_op = 'INSERT' then
        if new.has_newsletter then
            new.newsletter_subscribed_at := coalesce(
                new.newsletter_subscribed_at,
                now()
            );
            new.newsletter_unsubscribed_at := null;
        else
            new.newsletter_unsubscribed_at := null;
        end if;
        return new;
    end if;

    if new.has_newsletter is distinct from old.has_newsletter then
        if new.has_newsletter then
            new.newsletter_subscribed_at := coalesce(
                new.newsletter_subscribed_at,
                now()
            );
            new.newsletter_unsubscribed_at := null;
        else
            new.newsletter_unsubscribed_at := coalesce(
                new.newsletter_unsubscribed_at,
                now()
            );
        end if;
    elsif new.has_newsletter then
        new.newsletter_unsubscribed_at := null;
    end if;

    return new;
end;
$$;

drop trigger if exists contacts_newsletter_lifecycle on public.contacts;
create trigger contacts_newsletter_lifecycle
before insert or update of has_newsletter, newsletter_subscribed_at,
    newsletter_unsubscribed_at
on public.contacts
for each row
execute function public.normalize_contact_newsletter_lifecycle();

alter table public.contacts
    drop constraint if exists contacts_newsletter_state_check;

alter table public.contacts
    add constraint contacts_newsletter_state_check check (
        not has_newsletter or newsletter_unsubscribed_at is null
    );

comment on column public.contacts.newsletter_subscribed_at is
    'Start of the current or latest newsletter subscription period. Null means historical start date is unknown.';
comment on column public.contacts.newsletter_unsubscribed_at is
    'End of the latest newsletter subscription period; null for active subscriptions.';

-- Recreate the summary view so the new lifecycle fields are exposed through
-- PostgREST and the Atomic CRM data provider.
drop view if exists public.contacts_summary;
create view public.contacts_summary
with (security_invoker = on)
as
select
    co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.email_jsonb,
    jsonb_path_query_array(co.email_jsonb, '$[*].email')::text as email_fts,
    co.phone_jsonb,
    jsonb_path_query_array(co.phone_jsonb, '$[*].number')::text as phone_fts,
    co.background,
    co.avatar,
    co.first_seen,
    co.last_seen,
    co.has_newsletter,
    co.status,
    co.tags,
    co.company_id,
    co.sales_id,
    co.linkedin_url,
    co.newsletter_subscribed_at,
    co.newsletter_unsubscribed_at,
    c.name as company_name,
    count(distinct t.id) as nb_tasks
from public.contacts co
left join public.tasks t on co.id = t.contact_id
left join public.companies c on co.company_id = c.id
group by co.id, c.name;

grant select on public.contacts_summary to authenticated;
grant select on public.contacts_summary to service_role;

-- ---------------------------------------------------------------------------
-- MCP audit log (service-role only)
-- ---------------------------------------------------------------------------

create table if not exists public.mcp_audit_log (
    id bigint generated by default as identity primary key,
    created_at timestamp with time zone not null default now(),
    tool_name text not null,
    success boolean not null,
    entity_table text,
    entity_id text,
    idempotency_key text,
    input_summary jsonb not null default '{}'::jsonb,
    error_code text,
    error_message text
);

alter table public.mcp_audit_log enable row level security;

revoke all on table public.mcp_audit_log from anon;
revoke all on table public.mcp_audit_log from authenticated;
grant all on table public.mcp_audit_log to service_role;
grant usage, select on sequence public.mcp_audit_log_id_seq to service_role;

create index if not exists mcp_audit_log_created_at_idx
    on public.mcp_audit_log (created_at desc);
create index if not exists mcp_audit_log_tool_name_idx
    on public.mcp_audit_log (tool_name, created_at desc);
create index if not exists mcp_audit_log_idempotency_key_idx
    on public.mcp_audit_log (idempotency_key)
    where idempotency_key is not null;

comment on table public.mcp_audit_log is
    'Audit trail for authenticated CRM MCP calls. Never store secrets or full personal data in input_summary.';

commit;
