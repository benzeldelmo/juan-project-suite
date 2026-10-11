-- JUAN PROJECT client code gap reuse — 2026-10-11
-- CL-001..CL-045 remain the historical baseline. Post-baseline client codes
-- may be reused only after a client is archived and its code is released.

create or replace function public.assign_juan_client_code()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  next_no integer;
begin
  if new.client_code is null or btrim(new.client_code) = '' then
    perform pg_advisory_xact_lock(hashtext('juan-project-client-code'));

    with used as (
      select (substring(client_code from '^CL-([0-9]+)$'))::integer as n
      from public.clients
      where client_code ~ '^CL-[0-9]+$'
    ),
    bounds as (
      select greatest(46, coalesce(max(n),45) + 1) as upper_no
      from used
    )
    select min(candidate)
      into next_no
    from generate_series(46, (select upper_no from bounds)) as candidate
    where not exists (select 1 from used where used.n = candidate);

    new.client_code := 'CL-' || lpad(next_no::text,3,'0');
  end if;

  if new.email is not null then
    new.email := lower(btrim(new.email));
  end if;
  return new;
end
$function$;

create or replace function public.release_juan_client_code_on_archive()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  code_no integer;
begin
  if old.archived_at is null
     and new.archived_at is not null
     and old.client_code ~ '^CL-[0-9]+$' then
    code_no := (substring(old.client_code from '^CL-([0-9]+)$'))::integer;
    if code_no > 45 then
      new.client_code := old.client_code || '-ARCHIVED-' || upper(substr(md5(new.id || new.archived_at::text),1,6));
    end if;
  end if;
  return new;
end
$function$;

drop trigger if exists release_juan_client_code_on_archive_trigger on public.clients;
create trigger release_juan_client_code_on_archive_trigger
before update of archived_at on public.clients
for each row
execute function public.release_juan_client_code_on_archive();

-- Release the two archived post-baseline codes currently occupying the gap.
update public.clients
set client_code = 'CL-046-ARCHIVED'
where client_code = 'CL-046' and archived_at is not null;

update public.clients
set client_code = 'CL-047-ARCHIVED'
where client_code = 'CL-047' and archived_at is not null;

-- Preserve the client's UUID and every relationship; only correct the display code.
update public.clients
set client_code = 'CL-046'
where client_code = 'CL-048' and archived_at is null;
