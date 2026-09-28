-- JUAN PROJECT payment lifecycle v2
-- Payment due date follows the project end/deadline date.
-- Policy: 1-day grace, ₱500 on day 3, +₱250 on day 7 and each succeeding 7 days.

alter table public.projects
  add column if not exists settled_at timestamptz;

create or replace function public.juan_scheduled_overdue_fee(p_due_date date, p_as_of date)
returns numeric
language sql
immutable
strict
as $$
  select case
    when p_as_of - p_due_date < 3 then 0::numeric
    else (500 + floor((p_as_of - p_due_date) / 7.0) * 250)::numeric
  end
$$;

create or replace function public.juan_project_due_lifecycle()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  now_complete boolean;
  derived_due date;
begin
  now_complete :=
    lower(coalesce(new.status,'')) in ('completed','delivered')
    or lower(coalesce(new.delivery_status,''))='delivered'
    or coalesce(new.tracker_stage,0)>=6;

  if now_complete and new.completed_at is null then
    new.completed_at:=now();
  end if;

  -- The project end/deadline date is the canonical payment due date.
  -- If an older completed record has no deadline, use its completion date.
  derived_due:=coalesce(
    new.deadline_date,
    case when now_complete then new.completed_at::date else null end
  );
  new.payment_due_date:=derived_due;

  if now_complete and new.final_balance_due_set_at is null and derived_due is not null then
    new.final_balance_due_set_at:=now();
  end if;

  if new.payment_due_date is not null then
    new.grace_period_end:=new.payment_due_date + 1;
    new.overdue_started_at:=new.payment_due_date + 2;
  else
    new.grace_period_end:=null;
    new.overdue_started_at:=null;
  end if;
  return new;
end
$$;

drop trigger if exists trg_juan_project_due_lifecycle on public.projects;
create trigger trg_juan_project_due_lifecycle
before insert or update of status,delivery_status,tracker_stage,payment_due_date,deadline_date,completed_at
on public.projects
for each row execute function public.juan_project_due_lifecycle();

create or replace function public.refresh_juan_project_financials(p_project_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  p public.projects%rowtype;
  paid numeric(12,2);
  full_balance_before numeric(12,2);
  full_balance numeric(12,2);
  scheduled_fee numeric(12,2):=0;
  desired_fee numeric(12,2):=0;
  delta_fee numeric(12,2):=0;
  reduction_fee numeric(12,2):=0;
  waived_fee numeric(12,2):=0;
  days_late integer:=0;
  pending_count integer:=0;
  new_status text;
begin
  select * into p from public.projects where id=p_project_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;

  select coalesce(sum(amount_paid),0)::numeric into paid
  from public.payments where project_id=p.id and deleted_at is null;

  full_balance_before:=greatest(coalesce(p.total_amount,0)+coalesce(p.late_fee_total,0)-paid,0);

  if not coalesce(p.overdue_fees_enabled,true) then
    desired_fee:=0;
  elsif p.payment_due_date is null then
    desired_fee:=coalesce(p.late_fee_total,0);
  elsif full_balance_before<=0 then
    -- Once fully settled, preserve fees already charged but never add new ones.
    desired_fee:=coalesce(p.late_fee_total,0);
  else
    days_late:=greatest(current_date-p.payment_due_date,0);
    scheduled_fee:=public.juan_scheduled_overdue_fee(p.payment_due_date,current_date);
    -- Open balances are recalculated from the canonical due date, so correcting
    -- the project end date also corrects an excessive or insufficient old fee.
    desired_fee:=scheduled_fee;
  end if;

  if not coalesce(p.overdue_fees_enabled,true) and coalesce(p.late_fee_total,0)>0 then
    waived_fee:=coalesce(p.late_fee_total,0);
    insert into public.financial_ledger(
      project_id,client_id,entry_type,direction,amount,idempotency_key,note,metadata
    ) values(
      p.id,p.client_id,'adjustment','credit',waived_fee,
      'overdue-fee-waiver:'||p.id||':'||gen_random_uuid()::text,
      'Overdue fees disabled for this project',
      jsonb_build_object('waived_fee',waived_fee,'reason','project_exception')
    );
    insert into public.client_notifications(
      client_id,project_id,type,title,body,severity,event_key
    ) values(
      p.client_id,p.id,'overdue_fee','Overdue fee waived',
      'Overdue fees were disabled for '||coalesce(p.project_code,'this project')||'.',
      'info','overdue-fee-waived:'||p.id||':'||now()::text
    );
  elsif desired_fee<coalesce(p.late_fee_total,0) then
    reduction_fee:=coalesce(p.late_fee_total,0)-desired_fee;
    insert into public.financial_ledger(
      project_id,client_id,entry_type,direction,amount,idempotency_key,note,metadata
    ) values(
      p.id,p.client_id,'adjustment','credit',reduction_fee,
      'overdue-fee-recalc:'||p.id||':'||gen_random_uuid()::text,
      'Overdue fee recalculated after payment due date update',
      jsonb_build_object('previous_fee',coalesce(p.late_fee_total,0),'fee_total_after',desired_fee,'payment_due_date',p.payment_due_date)
    );
  end if;

  if desired_fee>coalesce(p.late_fee_total,0) then
    delta_fee:=desired_fee-coalesce(p.late_fee_total,0);
    insert into public.financial_ledger(project_id,client_id,entry_type,direction,amount,idempotency_key,note,metadata)
    values(
      p.id,p.client_id,'overdue_fee','debit',delta_fee,
      'overdue-fee:'||p.id||':'||coalesce(p.payment_due_date::text,'none')||':'||to_char(desired_fee,'FM9999999990D00'),
      case when coalesce(p.late_fee_total,0)=0 then 'Initial overdue fee' else 'Recurring weekly overdue fee' end,
      jsonb_build_object('days_after_due',days_late,'fee_total_after',desired_fee,'payment_due_date',p.payment_due_date)
    )
    on conflict(idempotency_key) do nothing;

    insert into public.client_notifications(client_id,project_id,type,title,body,severity,event_key)
    values(
      p.client_id,p.id,'overdue_fee','Overdue fee added',
      'An overdue fee of ₱'||to_char(delta_fee,'FM999999990D00')||' was added to '||coalesce(p.project_code,'your project')||'.',
      'error','overdue-fee-notice:'||p.id||':'||coalesce(p.payment_due_date::text,'none')||':'||to_char(desired_fee,'FM9999999990D00')
    )
    on conflict(event_key) do nothing;
  end if;

  full_balance:=greatest(coalesce(p.total_amount,0)+desired_fee-paid,0);

  select count(*) into pending_count
  from public.payment_submissions
  where project_id=p.id and status='pending';

  if full_balance<=0 then
    new_status:='PAID';
  elsif pending_count>0 then
    new_status:='PAYMENT UNDER REVIEW';
  elsif p.payment_due_date is null then
    new_status:=case when paid>0 then 'PARTIALLY PAID' else 'UNPAID' end;
  elsif current_date<=p.payment_due_date then
    new_status:='DUE';
  elsif current_date=p.payment_due_date+1 then
    new_status:='GRACE PERIOD';
  else
    new_status:='OVERDUE';
  end if;

  if new_status is distinct from p.financial_status then
    insert into public.client_notifications(client_id,project_id,type,title,body,severity,event_key)
    values(
      p.client_id,p.id,'financial_status',
      case new_status
        when 'PAID' then 'Balance settled'
        when 'GRACE PERIOD' then 'Payment grace period'
        when 'OVERDUE' then 'Balance overdue'
        when 'PAYMENT UNDER REVIEW' then 'Payment under review'
        else 'Payment status updated'
      end,
      case new_status
        when 'PAID' then coalesce(p.project_code,'Project')||' has no remaining balance.'
        when 'GRACE PERIOD' then 'The remaining balance is within the 1-day grace period.'
        when 'OVERDUE' then case when coalesce(p.overdue_fees_enabled,true)
          then 'The remaining balance is overdue. ₱500 applies on day 3, then ₱250 on day 7 and every succeeding 7 days.'
          else 'The remaining balance is overdue. Overdue fees are waived for this project.'
        end
        when 'PAYMENT UNDER REVIEW' then 'Your submitted payment is awaiting review.'
        else 'Payment status changed to '||new_status||'.'
      end,
      case when new_status='OVERDUE' then 'error' when new_status='GRACE PERIOD' then 'warning' when new_status='PAID' then 'success' else 'info' end,
      'financial-status:'||p.id||':'||new_status||':'||current_date::text
    )
    on conflict(event_key) do nothing;
  end if;

  update public.projects
  set late_fee_total=desired_fee,
      grace_period_end=case when payment_due_date is null then null else payment_due_date+1 end,
      overdue_started_at=case when payment_due_date is null then null else payment_due_date+2 end,
      financial_status=new_status,
      financial_status_updated_at=now(),
      settled_at=case when full_balance<=0 then coalesce(settled_at,now()) else null end,
      updated_at=now()
  where id=p.id;

  update public.invoices
  set amount_paid=paid,
      overdue_fees=desired_fee,
      total=coalesce(p.total_amount,0)+desired_fee,
      balance=full_balance,
      due_date=p.payment_due_date,
      status=case when voided_at is not null then 'void' when full_balance<=0 then 'paid' else 'issued' end
  where project_id=p.id and status<>'void';

  perform public.refresh_juan_loyalty_for_project(p.id);

  return jsonb_build_object(
    'ok',true,
    'project_id',p.id,
    'paid',paid,
    'late_fee_total',desired_fee,
    'overdue_fees_enabled',coalesce(p.overdue_fees_enabled,true),
    'balance',full_balance,
    'status',new_status,
    'payment_due_date',p.payment_due_date,
    'grace_period_end',case when p.payment_due_date is null then null else p.payment_due_date+1 end,
    'overdue_started_at',case when p.payment_due_date is null then null else p.payment_due_date+2 end
  );
end
$$;

-- Any direct payment write must first assess charges that became due before
-- the payment was recorded, preventing a same-day payment from skipping a fee.
create or replace function public.juan_refresh_financials_before_payment()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op='INSERT' then
    perform public.refresh_juan_project_financials(new.project_id);
  elsif tg_op='UPDATE' then
    perform public.refresh_juan_project_financials(old.project_id);
    if new.project_id is distinct from old.project_id then
      perform public.refresh_juan_project_financials(new.project_id);
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists trg_juan_payments_pre_refresh_financials on public.payments;
create trigger trg_juan_payments_pre_refresh_financials
before insert or update of amount_paid,deleted_at,project_id
on public.payments
for each row execute function public.juan_refresh_financials_before_payment();

drop trigger if exists trg_juan_project_financial_fields on public.projects;
create trigger trg_juan_project_financial_fields
after insert or update of deadline_date,payment_due_date,total_amount,status,delivery_status,tracker_stage,completed_at
on public.projects
for each row execute function public.juan_project_financial_fields_trigger();

-- Align existing records with the canonical Project End / Deadline Date.
update public.projects
set payment_due_date=case
      when deadline_date is not null then deadline_date
      when lower(coalesce(status,'')) in ('completed','delivered')
        or lower(coalesce(delivery_status,''))='delivered'
        or coalesce(tracker_stage,0)>=6
        then completed_at::date
      else null
    end,
    updated_at=now();

select public.refresh_all_juan_project_financials();
