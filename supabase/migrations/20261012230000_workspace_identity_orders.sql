-- JUAN PROJECT Workspace — October 12, 2026
-- Production integrity update for stable client identities and order deletion/reset behavior.

create unique index if not exists clients_active_email_normalized_uidx
on public.clients (lower(btrim(email)))
where archived_at is null and email is not null and btrim(email) <> '';

create or replace function public.reset_juan_order_sequence_if_empty()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_juan_admin() then
    raise exception 'Admin authorization required' using errcode='42501';
  end if;
  if exists (select 1 from public.incoming_orders) then
    return false;
  end if;
  perform setval('public.incoming_orders_order_number_seq', 1, false);
  return true;
end
$$;

create or replace function public.delete_juan_order_request(p_order_id uuid,p_admin_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.incoming_orders%rowtype;
  remaining_count bigint;
begin
  if not public.juan_is_admin_user(p_admin_user) then raise exception 'Admin access required'; end if;
  select * into o from public.incoming_orders where id=p_order_id for update;
  if not found then raise exception 'Order request not found'; end if;
  if o.project_id is not null then raise exception 'Converted order requests cannot be permanently deleted'; end if;
  delete from public.order_request_revisions where order_id=o.id;
  delete from public.incoming_orders where id=o.id;
  select count(*) into remaining_count from public.incoming_orders;
  if remaining_count=0 then perform setval('public.incoming_orders_order_number_seq',1,false); end if;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,before_state)
  values(p_admin_user,'order_deleted','incoming_order',o.id::text,jsonb_build_object('order_code',o.code,'status',o.status));
  return jsonb_build_object('deleted',true,'order_id',o.id,'order_code',o.code,'remaining',remaining_count,'sequence_reset',remaining_count=0);
end
$$;

create or replace function public.delete_all_juan_order_requests(p_admin_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_count bigint;
  deleted_count bigint;
begin
  if not public.juan_is_admin_user(p_admin_user) then raise exception 'Admin access required'; end if;
  perform pg_advisory_xact_lock(hashtext('juan-project-delete-all-orders'));
  select count(*) into linked_count from public.incoming_orders where project_id is not null;
  if linked_count>0 then
    raise exception 'Delete All is blocked because % order request(s) are linked to projects. Linked history must be preserved.',linked_count;
  end if;
  select count(*) into deleted_count from public.incoming_orders;
  delete from public.order_request_revisions;
  delete from public.incoming_orders;
  perform setval('public.incoming_orders_order_number_seq',1,false);
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,after_state)
  values(p_admin_user,'orders_deleted_all','incoming_orders',null,jsonb_build_object('deleted_count',deleted_count,'next_order_code','OR-001'));
  return jsonb_build_object('deleted_count',deleted_count,'sequence_reset',true,'next_order_code','OR-001');
end
$$;

create or replace function public.merge_juan_clients(p_keep_id text,p_merge_id text,p_new_email text,p_admin_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  keep_row public.clients%rowtype;
  merge_row public.clients%rowtype;
  normalized_email text;
  keep_portal public.portal_accounts%rowtype;
  merge_portal public.portal_accounts%rowtype;
  keep_portal_found boolean:=false;
  merge_portal_found boolean:=false;
begin
  if not public.juan_is_admin_user(p_admin_user) then raise exception 'Admin access required'; end if;
  if p_keep_id is null or p_merge_id is null or p_keep_id=p_merge_id then raise exception 'Choose two different client records'; end if;
  perform pg_advisory_xact_lock(hashtext('juan-project-client-merge'));
  select * into keep_row from public.clients where id=p_keep_id for update;
  if not found then raise exception 'Client to keep was not found'; end if;
  select * into merge_row from public.clients where id=p_merge_id for update;
  if not found then raise exception 'Duplicate client was not found'; end if;

  normalized_email:=lower(btrim(coalesce(nullif(p_new_email,''),merge_row.email,keep_row.email)));
  if normalized_email='' then normalized_email:=null; end if;
  if exists(
    select 1 from public.clients
    where id not in(p_keep_id,p_merge_id) and archived_at is null
      and normalized_email is not null and lower(btrim(email))=normalized_email
  ) then raise exception 'That email belongs to another active client'; end if;

  select * into keep_portal from public.portal_accounts where client_id=p_keep_id; keep_portal_found:=found;
  select * into merge_portal from public.portal_accounts where client_id=p_merge_id; merge_portal_found:=found;
  if keep_portal_found and merge_portal_found then
    if merge_portal.portal_enabled or merge_portal.password_set then
      delete from public.portal_accounts where auth_user_id=keep_portal.auth_user_id;
      update public.portal_accounts set client_id=p_keep_id,updated_at=now() where auth_user_id=merge_portal.auth_user_id;
    else
      delete from public.portal_accounts where auth_user_id=merge_portal.auth_user_id;
    end if;
  elsif merge_portal_found then
    update public.portal_accounts set client_id=p_keep_id,updated_at=now() where auth_user_id=merge_portal.auth_user_id;
  end if;

  update public.projects set client_id=p_keep_id where client_id=p_merge_id;
  update public.payments set client_id=p_keep_id where client_id=p_merge_id;
  update public.invoices set client_id=p_keep_id where client_id=p_merge_id;
  update public.incoming_orders set client_id=p_keep_id where client_id=p_merge_id;
  update public.payment_submissions set client_id=p_keep_id where client_id=p_merge_id;
  update public.portal_invitations set client_id=p_keep_id where client_id=p_merge_id;
  update public.financial_ledger set client_id=p_keep_id where client_id=p_merge_id;
  update public.loyalty_ledger set client_id=p_keep_id where client_id=p_merge_id;
  update public.client_notifications set client_id=p_keep_id where client_id=p_merge_id;
  update public.ad_events set client_id=p_keep_id where client_id=p_merge_id;

  update public.clients set email=null,archived_at=coalesce(archived_at,now()),updated_at=now() where id=p_merge_id;
  update public.clients
  set name=coalesce(nullif(merge_row.name,''),keep_row.name),
      email=normalized_email,
      phone=coalesce(merge_row.phone,keep_row.phone),
      address=coalesce(merge_row.address,keep_row.address),
      notes=case
        when btrim(coalesce(keep_row.notes,''))='' then coalesce(merge_row.notes,'')
        when btrim(coalesce(merge_row.notes,''))='' then keep_row.notes
        else keep_row.notes||E'\n'||merge_row.notes end,
      archived_at=null,updated_at=now()
  where id=p_keep_id;

  update public.projects p
  set client_name=c.name,client_email=c.email,client_phone=c.phone,client_address=c.address,updated_at=now()
  from public.clients c
  where p.client_id=p_keep_id and c.id=p_keep_id;

  delete from public.clients where id=p_merge_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,before_state,after_state,metadata)
  values(p_admin_user,'client_merged','client',p_keep_id,
    jsonb_build_object('kept',keep_row.client_code,'merged',merge_row.client_code),
    jsonb_build_object('client_code',keep_row.client_code,'email',normalized_email),
    jsonb_build_object('merged_client_id',p_merge_id));
  return jsonb_build_object('client_id',p_keep_id,'client_code',keep_row.client_code,'merged_client_id',p_merge_id,'released_client_code',merge_row.client_code,'email',normalized_email);
end
$$;

create or replace function public.approve_juan_order_request(p_order_id uuid,p_admin_user uuid,p_note text default ''::text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.incoming_orders%rowtype;
  c public.clients%rowtype;
  normalized_email text;
begin
  if not public.juan_is_admin_user(p_admin_user) then raise exception 'Admin access required'; end if;
  select * into o from public.incoming_orders where id=p_order_id for update;
  if not found then raise exception 'Order request not found'; end if;
  if o.archived_at is not null then raise exception 'Archived order requests cannot be approved'; end if;
  if o.project_id is not null then raise exception 'Order request is already converted'; end if;
  normalized_email:=lower(btrim(o.email));
  if normalized_email='' then raise exception 'Order email is required'; end if;

  if o.client_id is not null then
    select * into c from public.clients where id=o.client_id and archived_at is null for update;
  end if;
  if c.id is null then
    select * into c from public.clients where archived_at is null and lower(btrim(email))=normalized_email limit 1 for update;
  end if;
  if c.id is null then
    insert into public.clients(name,email,phone) values(o.name,normalized_email,o.phone) returning * into c;
  end if;

  update public.incoming_orders
  set status='Approved',approved_at=coalesce(approved_at,now()),client_id=c.id,
      review_note=coalesce(nullif(p_note,''),review_note),updated_at=now()
  where id=o.id returning * into o;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,after_state)
  values(p_admin_user,'order_approved','incoming_order',o.id::text,jsonb_build_object('order_code',o.code,'client_id',c.id,'client_code',c.client_code));
  return jsonb_build_object('order_id',o.id,'order_code',o.code,'client_id',c.id,'client_code',c.client_code);
end
$$;
