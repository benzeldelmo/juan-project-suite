-- JUAN PROJECT Workspace Ultra — data integrity guards
-- Applied to production Supabase on 2026-10-02.

do $$
begin
  if not exists (select 1 from pg_constraint where conname='catalog_services_price_nonnegative') then
    alter table public.catalog_services
      add constraint catalog_services_price_nonnegative check (price >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='catalog_services_name_not_blank') then
    alter table public.catalog_services
      add constraint catalog_services_name_not_blank check (btrim(name) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname='catalog_packages_prices_nonnegative') then
    alter table public.catalog_packages
      add constraint catalog_packages_prices_nonnegative check (original_price >= 0 and new_price >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='catalog_packages_name_not_blank') then
    alter table public.catalog_packages
      add constraint catalog_packages_name_not_blank check (btrim(name) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname='catalog_categories_name_not_blank') then
    alter table public.catalog_categories
      add constraint catalog_categories_name_not_blank check (btrim(name) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname='payments_amount_positive') then
    alter table public.payments
      add constraint payments_amount_positive check (amount_paid > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='payment_submissions_amount_positive') then
    alter table public.payment_submissions
      add constraint payment_submissions_amount_positive check (submitted_amount > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='projects_title_not_blank') then
    alter table public.projects
      add constraint projects_title_not_blank check (btrim(title) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname='projects_date_order_valid') then
    alter table public.projects
      add constraint projects_date_order_valid check (start_date is null or deadline_date is null or deadline_date >= start_date);
  end if;
  if not exists (select 1 from pg_constraint where conname='deliverables_name_not_blank') then
    alter table public.deliverables
      add constraint deliverables_name_not_blank check (btrim(item_name) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname='deliverables_progress_range') then
    alter table public.deliverables
      add constraint deliverables_progress_range check (progress >= 0 and progress <= 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='project_items_name_not_blank') then
    alter table public.project_items
      add constraint project_items_name_not_blank check (btrim(name) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname='project_items_prices_nonnegative') then
    alter table public.project_items
      add constraint project_items_prices_nonnegative check (price >= 0 and unit_price >= 0);
  end if;
end $$;

create or replace function public.jp_sync_project_due_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.deadline_date is distinct from old.deadline_date then
    new.payment_due_date := new.deadline_date;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jp_sync_project_due_date on public.projects;
create trigger trg_jp_sync_project_due_date
before insert or update of deadline_date on public.projects
for each row execute function public.jp_sync_project_due_date();
