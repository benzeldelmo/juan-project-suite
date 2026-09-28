-- Harden payment lifecycle helper functions after migration 035.
alter function public.juan_scheduled_overdue_fee(date,date)
  set search_path to 'public';

revoke execute on function public.juan_refresh_financials_before_payment()
  from public, anon, authenticated;
