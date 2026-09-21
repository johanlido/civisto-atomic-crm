-- Civisto Sale Power Dialer fields.
-- Do NOT modify CRM sales `status` (cold/warm/hot/…). Dial state lives in dial_* / last_call_*.

alter table public.contacts
  add column if not exists dial_status text,
  add column if not exists dial_priority integer not null default 100,
  add column if not exists dialing_started_at timestamptz,
  add column if not exists last_call_at timestamptz,
  add column if not exists last_call_disposition text,
  add column if not exists last_call_sid text,
  add column if not exists last_call_duration_seconds integer,
  add column if not exists last_call_phone text;

comment on column public.contacts.dial_status is
  'Dial queue: queued | dialing | no_answer | busy | voicemail | connected | failed | skipped';
comment on column public.contacts.dial_priority is
  'Lower number = higher priority in get-next-number';

update public.contacts
set dial_status = 'queued'
where dial_status is null
  and phone_jsonb is not null
  and jsonb_array_length(phone_jsonb) > 0
  and exists (
    select 1
    from jsonb_array_elements(phone_jsonb) as p
    where coalesce(p->>'number', '') <> ''
  );

create index if not exists contacts_dial_queue_idx
  on public.contacts (dial_status, dial_priority asc, first_seen asc nulls last)
  where dial_status in ('queued', 'no_answer', 'busy', 'voicemail');

create or replace function public.claim_next_dial_contact(
  stale_after interval default interval '5 minutes'
)
returns table (
  contact_id bigint,
  phone text,
  name text,
  company text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  picked_id bigint;
  picked_phone text;
begin
  update public.contacts
  set dial_status = 'queued',
      dialing_started_at = null
  where dial_status = 'dialing'
    and dialing_started_at is not null
    and dialing_started_at < now() - stale_after;

  select c.id
  into picked_id
  from public.contacts c
  where c.dial_status in ('queued', 'no_answer', 'busy', 'voicemail')
    and c.phone_jsonb is not null
    and jsonb_array_length(c.phone_jsonb) > 0
    and exists (
      select 1
      from jsonb_array_elements(c.phone_jsonb) as p
      where coalesce(p->>'number', '') <> ''
    )
  order by c.dial_priority asc, c.first_seen asc nulls last, c.id asc
  for update skip locked
  limit 1;

  if picked_id is null then
    return;
  end if;

  select p->>'number'
  into picked_phone
  from public.contacts c,
       lateral jsonb_array_elements(c.phone_jsonb) as p
  where c.id = picked_id
    and coalesce(p->>'number', '') <> ''
  order by case p->>'type'
    when 'Work' then 1
    when 'Mobile' then 2
    when 'Home' then 3
    else 4
  end
  limit 1;

  update public.contacts
  set dial_status = 'dialing',
      dialing_started_at = now(),
      last_call_phone = picked_phone
  where id = picked_id;

  return query
  select
    c.id,
    picked_phone,
    trim(both from concat_ws(' ', c.first_name, c.last_name)),
    co.name
  from public.contacts c
  left join public.companies co on co.id = c.company_id
  where c.id = picked_id;
end;
$$;

revoke all on function public.claim_next_dial_contact(interval) from public;
grant execute on function public.claim_next_dial_contact(interval) to service_role;
