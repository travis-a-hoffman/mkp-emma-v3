create table public.f_groups (
  id uuid not null,
  group_type text null,
  is_accepting_new_facilitators boolean not null default true,
  facilitators jsonb not null default '[]'::jsonb,
  is_accepting_initiated_visitors boolean not null default true,
  is_accepting_uninitiated_visitors boolean not null default false,
  is_requiring_contact_before_visiting boolean not null default true,
  schedule_events jsonb not null default '[]'::jsonb,
  schedule_description text null,
  area_id uuid null,
  community_id uuid null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone null,
  constraint f_groups_pkey primary key (id),
  constraint f_groups_area_id_fkey foreign KEY (area_id) references areas (id) on delete set null,
  constraint f_groups_community_id_fkey foreign KEY (community_id) references communities (id) on delete set null,
  constraint f_groups_id_fkey foreign KEY (id) references groups (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_f_groups_group_type on public.f_groups using btree (group_type) TABLESPACE pg_default;

create index IF not exists idx_f_groups_area_id on public.f_groups using btree (area_id) TABLESPACE pg_default;

create index IF not exists idx_f_groups_community_id on public.f_groups using btree (community_id) TABLESPACE pg_default;

create index IF not exists idx_f_groups_is_active on public.f_groups using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_f_groups_created_at on public.f_groups using btree (created_at desc) TABLESPACE pg_default;
