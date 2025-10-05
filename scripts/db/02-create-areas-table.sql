create table public.areas (
  id uuid not null default gen_random_uuid (),
  name text not null,
  code text not null,
  description text null,
  steward_id uuid null,
  finance_coordinator_id uuid null,
  geo_polygon jsonb null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  image_url text null,
  color text null default '#3B82F6'::text,
  deleted_at timestamp with time zone null,
  constraint areas_pkey primary key (id),
  constraint areas_code_key unique (code),
  constraint areas_finance_coordinator_id_fkey foreign KEY (finance_coordinator_id) references people (id),
  constraint areas_steward_id_fkey foreign KEY (steward_id) references people (id),
  constraint areas_code_check check ((length(code) <= 6))
) TABLESPACE pg_default;

create index IF not exists idx_areas_code on public.areas using btree (code) TABLESPACE pg_default;

create index IF not exists idx_areas_name on public.areas using btree (name) TABLESPACE pg_default;

create index IF not exists idx_areas_steward_id on public.areas using btree (steward_id) TABLESPACE pg_default;

create index IF not exists idx_areas_finance_coordinator_id on public.areas using btree (finance_coordinator_id) TABLESPACE pg_default;

create index IF not exists idx_areas_is_active on public.areas using btree (is_active) TABLESPACE pg_default;
