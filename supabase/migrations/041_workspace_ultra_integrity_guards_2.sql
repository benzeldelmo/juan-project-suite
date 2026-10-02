-- JUAN PROJECT Workspace Ultra — additional integrity guards
-- Applied to production Supabase on 2026-10-02.

do $$
begin
  if not exists (select 1 from pg_constraint where conname='clients_name_not_blank') then
    alter table public.clients
      add constraint clients_name_not_blank check (btrim(name) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname='project_items_quantities_positive') then
    alter table public.project_items
      add constraint project_items_quantities_positive check (qty > 0 and quantity > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='catalog_package_items_quantity_positive') then
    alter table public.catalog_package_items
      add constraint catalog_package_items_quantity_positive check (quantity > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='projects_money_nonnegative') then
    alter table public.projects
      add constraint projects_money_nonnegative check (
        coalesce(total_amount,0) >= 0 and
        coalesce(subtotal_amount,0) >= 0 and
        coalesce(discount_amount,0) >= 0 and
        coalesce(rush_fee,0) >= 0 and
        coalesce(system_maintenance_fee,0) >= 0 and
        coalesce(workload_surcharge,0) >= 0 and
        coalesce(late_fee_total,0) >= 0
      );
  end if;
  if not exists (select 1 from pg_constraint where conname='invoices_money_nonnegative') then
    alter table public.invoices
      add constraint invoices_money_nonnegative check (
        coalesce(total,0) >= 0 and coalesce(amount_paid,0) >= 0 and coalesce(balance,0) >= 0
      );
  end if;
  if not exists (select 1 from pg_constraint where conname='invoices_balance_consistent') then
    alter table public.invoices
      add constraint invoices_balance_consistent check (
        abs((coalesce(total,0)-coalesce(amount_paid,0))-coalesce(balance,0)) <= 0.01
      );
  end if;
end $$;
