-- JUAN PROJECT Workspace — category icon metadata
alter table public.catalog_categories
  add column if not exists icon text not null default 'folder';

update public.catalog_categories
set icon='folder'
where icon is null or btrim(icon)='';
