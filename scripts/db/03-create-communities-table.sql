create table public.communities (
  id uuid not null default gen_random_uuid (),
  name text not null,
  code text not null,
  description text null,
  area_id uuid null,
  coordinator_id uuid null,
  image_url text null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  geo_json jsonb null,
  geo_definition jsonb null,
  color text null default '#10B981'::text,
  deleted_at timestamp with time zone null,
  constraint communities_pkey primary key (id),
  constraint communities_code_key unique (code),
  constraint communities_area_id_fkey foreign KEY (area_id) references areas (id) on delete set null,
  constraint communities_coordinator_id_fkey foreign KEY (coordinator_id) references people (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_communities_area_id on public.communities using btree (area_id) TABLESPACE pg_default;

create index IF not exists idx_communities_coordinator_id on public.communities using btree (coordinator_id) TABLESPACE pg_default;

create index IF not exists idx_communities_code on public.communities using btree (code) TABLESPACE pg_default;

create index IF not exists idx_communities_is_active on public.communities using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_communities_geo_json on public.communities using gin (geo_json) TABLESPACE pg_default;
