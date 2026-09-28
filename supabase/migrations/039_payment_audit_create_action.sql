-- Expand payment audit actions to include new payment creation.
-- Workspace records CREATE / EDIT / DELETE events in payment_audit_logs.

alter table public.payment_audit_logs
  drop constraint if exists payment_audit_logs_action_check;

alter table public.payment_audit_logs
  add constraint payment_audit_logs_action_check
  check (action = any (array['CREATE'::text,'EDIT'::text,'DELETE'::text]));
