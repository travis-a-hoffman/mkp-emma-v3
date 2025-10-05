create table public.event_types (
  id uuid not null default gen_random_uuid (),
  name character varying(255) not null,
  code character varying(6) not null,
  description text null,
  color character varying(7) null,
  icon character varying(50) null,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  constraint event_types_pkey primary key (id),
  constraint constraint_event_type_code_unique unique (code)
) TABLESPACE pg_default;

create index IF not exists idx_event_types_name on public.event_types using btree (name) TABLESPACE pg_default;

create index IF not exists idx_event_types_code on public.event_types using btree (code) TABLESPACE pg_default;

create index IF not exists idx_event_types_active on public.event_types using btree (is_active) TABLESPACE pg_default;
