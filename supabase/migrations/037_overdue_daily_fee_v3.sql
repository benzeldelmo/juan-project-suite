-- JUAN PROJECT overdue fee policy v3
-- 1-day grace; ₱35/day beginning on day 2; +₱500 on day 3;
-- +₱250 on day 7 and each succeeding 7-day interval.
-- Daily charges are cumulative and stop when the balance is fully settled.

create or replace function public.juan_scheduled_overdue_fee(p_due_date date, p_as_of date)
returns numeric
language sql
immutable
strict
set search_path to 'public'
as $
  with d as (
    select greatest(p_as_of - p_due_date,0)::integer as days_after_due
  )
  select case
    when days_after_due <= 1 then 0::numeric
    else (
      ((days_after_due - 1) * 35)
      + case when days_after_due >= 3 then 500 else 0 end
      + floor(days_after_due / 7.0) * 250
    )::numeric
  end
  from d
$;

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
      case when coalesce(p.late_fee_total,0)=0 then 'Initial overdue fee accrual' else 'Overdue fee accrual' end,
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
          then 'The remaining balance is overdue. A ₱35 daily charge begins on day 2, ₱500 is added on day 3, then ₱250 is added on day 7 and every succeeding 7 days.'
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

select public.refresh_all_juan_project_financials();
