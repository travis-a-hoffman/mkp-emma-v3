create table public.i_groups (
  id uuid not null,
  log_id uuid null,
  is_accepting_initiated_visitors boolean not null default false,
  is_accepting_uninitiated_visitors boolean not null default false,
  is_requiring_contact_before_visiting boolean not null default false,
  schedule_events jsonb not null default '[]'::jsonb,
  schedule_description text null,
  area_id uuid null,
  community_id uuid null,
  contact_email text null,
  status character varying(50) null,
  affiliation character varying(50) null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint i_groups_pkey primary key (id),
  constraint i_groups_area_id_fkey foreign KEY (area_id) references areas (id) on delete set null,
  constraint i_groups_community_id_fkey foreign KEY (community_id) references communities (id) on delete set null,
  constraint i_groups_id_fkey foreign KEY (id) references groups (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_i_groups_area_id on public.i_groups using btree (area_id) TABLESPACE pg_default;

create index IF not exists idx_i_groups_community_id on public.i_groups using btree (community_id) TABLESPACE pg_default;

create index IF not exists idx_i_groups_is_active on public.i_groups using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_i_groups_log_id on public.i_groups using btree (log_id) TABLESPACE pg_default;
