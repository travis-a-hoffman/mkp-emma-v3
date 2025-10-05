create table public.prospects (
  id uuid not null,
  log_id uuid null,
  balked_events jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint prospects_new_pkey primary key (id),
  constraint fk_prospects_person foreign KEY (id) references people (id) on delete CASCADE,
  constraint prospects_new_log_id_fkey foreign KEY (log_id) references activity_logs (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_prospects_log_id on public.prospects using btree (log_id) TABLESPACE pg_default;

create index IF not exists idx_prospects_is_active on public.prospects using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_prospects_created_at on public.prospects using btree (created_at) TABLESPACE pg_default;
