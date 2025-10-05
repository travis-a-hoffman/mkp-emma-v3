create table public.registrants (
  id uuid not null,
  log_id uuid null,
  payment_plan uuid null,
  transaction_log uuid null,
  event_id uuid not null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint registrants_new_pkey primary key (id),
  constraint fk_registrants_person foreign KEY (id) references people (id) on delete CASCADE,
  constraint registrants_new_event_id_fkey foreign KEY (event_id) references events (id) on delete CASCADE,
  constraint registrants_new_log_id_fkey foreign KEY (log_id) references activity_logs (id) on delete set null,
  constraint registrants_new_payment_plan_fkey foreign KEY (payment_plan) references activity_logs (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_registrants_log_id on public.registrants using btree (log_id) TABLESPACE pg_default;

create index IF not exists idx_registrants_payment_plan on public.registrants using btree (payment_plan) TABLESPACE pg_default;

create index IF not exists idx_registrants_transaction_log on public.registrants using btree (transaction_log) TABLESPACE pg_default;

create index IF not exists idx_registrants_event_id on public.registrants using btree (event_id) TABLESPACE pg_default;

create index IF not exists idx_registrants_is_active on public.registrants using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_registrants_created_at on public.registrants using btree (created_at) TABLESPACE pg_default;

create unique INDEX IF not exists idx_registrants_person_event_unique on public.registrants using btree (id, event_id) TABLESPACE pg_default
where
  (is_active = true);
