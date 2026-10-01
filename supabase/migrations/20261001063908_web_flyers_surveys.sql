alter table public.promotions
  add column if not exists channel text not null default 'online',
  add column if not exists content_type text not null default 'flyer',
  add column if not exists survey_config jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='promotions_channel_check'
      and conrelid='public.promotions'::regclass
  ) then
    alter table public.promotions
      add constraint promotions_channel_check
      check (channel in ('online','web'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='promotions_content_type_check'
      and conrelid='public.promotions'::regclass
  ) then
    alter table public.promotions
      add constraint promotions_content_type_check
      check (content_type in ('flyer','survey'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='promotions_survey_config_object_check'
      and conrelid='public.promotions'::regclass
  ) then
    alter table public.promotions
      add constraint promotions_survey_config_object_check
      check (jsonb_typeof(survey_config)='object');
  end if;
end $$;

create index if not exists promotions_channel_status_priority_idx
  on public.promotions(channel,status,priority desc,created_at desc);

alter table public.promotions enable row level security;
revoke all on table public.promotions from anon;
grant select on table public.promotions to anon;

drop policy if exists promotions_web_public_read on public.promotions;
create policy promotions_web_public_read
  on public.promotions
  for select
  to anon
  using (
    channel='web'
    and enabled=true
    and status in ('published','scheduled')
    and (start_at is null or start_at <= now())
    and (
      no_expiration=true
      or end_at is null
      or end_at > now()
    )
  );

create table if not exists public.web_survey_responses (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  visitor_id text not null,
  answers jsonb not null,
  source_url text,
  created_at timestamptz not null default now(),
  constraint web_survey_responses_visitor_length_check check (char_length(visitor_id) between 1 and 120),
  constraint web_survey_responses_answers_object_check check (jsonb_typeof(answers)='object'),
  constraint web_survey_responses_answers_size_check check (octet_length(answers::text) <= 20000),
  constraint web_survey_responses_one_per_visitor unique (promotion_id, visitor_id)
);

create index if not exists web_survey_responses_promotion_created_idx
  on public.web_survey_responses(promotion_id,created_at desc);

alter table public.web_survey_responses enable row level security;
revoke all on table public.web_survey_responses from anon, authenticated;
grant insert on table public.web_survey_responses to anon;
grant select on table public.web_survey_responses to authenticated;
grant all on table public.web_survey_responses to service_role;

drop policy if exists web_survey_responses_public_insert on public.web_survey_responses;
create policy web_survey_responses_public_insert
  on public.web_survey_responses
  for insert
  to anon
  with check (
    exists (
      select 1
      from public.promotions p
      where p.id=promotion_id
        and p.channel='web'
        and p.content_type='survey'
        and p.enabled=true
        and p.status in ('published','scheduled')
        and (p.start_at is null or p.start_at <= now())
        and (p.no_expiration=true or p.end_at is null or p.end_at > now())
    )
  );

drop policy if exists web_survey_responses_admin_read on public.web_survey_responses;
create policy web_survey_responses_admin_read
  on public.web_survey_responses
  for select
  to authenticated
  using (is_juan_admin());
