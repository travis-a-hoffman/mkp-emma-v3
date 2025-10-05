create table public.activity_logs (
  id uuid not null default gen_random_uuid (),
  log_id uuid not null,
  by_id uuid null,
  name text not null,
  summary text not null,
  details text null,
  data jsonb null,
  ordering integer not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  constraint activity_logs_pkey primary key (id),
  constraint activity_logs_by_id_fkey foreign KEY (by_id) references people (id) on delete set null,
  constraint activity_logs_ordering_check check ((ordering > 0))
) TABLESPACE pg_default;

create index IF not exists idx_activity_logs_log_id on public.activity_logs using btree (log_id) TABLESPACE pg_default;

create index IF not exists idx_activity_logs_by_id on public.activity_logs using btree (by_id) TABLESPACE pg_default;

create index IF not exists idx_activity_logs_created_at on public.activity_logs using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_activity_logs_ordering on public.activity_logs using btree (ordering) TABLESPACE pg_default;

create index IF not exists idx_activity_logs_log_id_ordering on public.activity_logs using btree (log_id, ordering) TABLESPACE pg_default;
