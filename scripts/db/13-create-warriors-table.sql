create table public.warriors (
  id uuid not null default gen_random_uuid (),
  log_id uuid null default gen_random_uuid (),
  transaction_id uuid null default gen_random_uuid (),
  initiation_id uuid null,
  initiation_on date null,
  initiation_text text null,
  status character varying(50) null,
  training_events jsonb null default '[]'::jsonb,
  staffed_events jsonb null default '[]'::jsonb,
  lead_events jsonb null default '[]'::jsonb,
  mos_events jsonb null default '[]'::jsonb,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  is_active boolean null default true,
  area_id uuid null,
  community_id uuid null,
  deleted_at timestamp with time zone null,
  constraint warriors_pkey primary key (id),
  constraint warriors_area_id_fkey foreign KEY (area_id) references areas (id),
  constraint warriors_community_id_fkey foreign KEY (community_id) references communities (id),
  constraint warriors_id_fkey foreign KEY (id) references people (id) on delete CASCADE,
  constraint warriors_initiation_id_fkey foreign KEY (initiation_id) references events (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_warriors_area_id on public.warriors using btree (area_id) TABLESPACE pg_default;

create index IF not exists idx_warriors_community_id on public.warriors using btree (community_id) TABLESPACE pg_default;

create index IF not exists idx_warriors_log_id on public.warriors using btree (log_id) TABLESPACE pg_default;

create index IF not exists idx_warriors_initiation_id on public.warriors using btree (initiation_id) TABLESPACE pg_default;

create index IF not exists idx_warriors_status on public.warriors using btree (status) TABLESPACE pg_default;

create index IF not exists idx_warriors_is_active on public.warriors using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_warriors_id on public.warriors using btree (id) TABLESPACE pg_default;
