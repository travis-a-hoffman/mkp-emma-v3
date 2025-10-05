create table public.nwta_roles (
  id uuid not null default gen_random_uuid (),
  name text not null,
  summary text null,
  nwta_event_id uuid null,
  role_type_id uuid null,
  lead_warrior_id uuid null,
  warriors jsonb null default '[]'::jsonb,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  is_active boolean null default true,
  deleted_at timestamp with time zone null,
  constraint nwta_roles_pkey primary key (id),
  constraint nwta_roles_lead_warrior_id_fkey foreign KEY (lead_warrior_id) references warriors (id) on delete set null,
  constraint nwta_roles_nwta_event_id_fkey foreign KEY (nwta_event_id) references events (id) on delete CASCADE,
  constraint nwta_roles_role_type_id_fkey foreign KEY (role_type_id) references nwta_role_types (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_nwta_roles_name on public.nwta_roles using btree (name) TABLESPACE pg_default;

create index IF not exists idx_nwta_roles_event on public.nwta_roles using btree (nwta_event_id) TABLESPACE pg_default;

create index IF not exists idx_nwta_roles_type on public.nwta_roles using btree (role_type_id) TABLESPACE pg_default;

create index IF not exists idx_nwta_roles_lead on public.nwta_roles using btree (lead_warrior_id) TABLESPACE pg_default;

create index IF not exists idx_nwta_roles_active on public.nwta_roles using btree (is_active) TABLESPACE pg_default;
