create table public.nwta_role_types (
  id uuid not null default gen_random_uuid (),
  name text not null,
  summary text null,
  needs_experience text null,
  experience_level integer null default 0,
  work_points integer null default 0,
  preparation_points integer null default 0,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  is_active boolean null default true,
  deleted_at timestamp with time zone null,
  constraint nwta_role_types_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_nwta_role_types_name on public.nwta_role_types using btree (name) TABLESPACE pg_default;

create index IF not exists idx_nwta_role_types_experience_level on public.nwta_role_types using btree (experience_level) TABLESPACE pg_default;

create index IF not exists idx_nwta_role_types_active on public.nwta_role_types using btree (is_active) TABLESPACE pg_default;
