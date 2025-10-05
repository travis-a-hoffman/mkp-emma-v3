create table public.transaction_logs (
  id uuid not null default gen_random_uuid (),
  log_id uuid not null,
  payor_person_id uuid null,
  payor_name text null,
  payee_person_id uuid null,
  payee_name text null,
  type text not null,
  name text not null,
  details text null,
  data jsonb null,
  amount integer not null,
  method text not null,
  ordering integer not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  happened_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  constraint transaction_logs_pkey primary key (id),
  constraint transaction_logs_payee_person_id_fkey foreign KEY (payee_person_id) references people (id) on delete set null,
  constraint transaction_logs_payor_person_id_fkey foreign KEY (payor_person_id) references people (id) on delete set null,
  constraint transaction_logs_amount_check check ((amount > 0)),
  constraint transaction_logs_type_check check (
    (
      type = any (
        array[
          'Payment'::text,
          'Refund'::text,
          'Expense'::text,
          'Reimbursement'::text
        ]
      )
    )
  ),
  constraint transaction_logs_method_check check (
    (
      method = any (
        array[
          'Cash'::text,
          'Check'::text,
          'Credit'::text,
          'Debit'::text,
          'Transfer'::text,
          'Other'::text
        ]
      )
    )
  ),
  constraint transaction_logs_ordering_check check ((ordering > 0))
) TABLESPACE pg_default;

create index IF not exists idx_transaction_logs_log_id on public.transaction_logs using btree (log_id) TABLESPACE pg_default;

create index IF not exists idx_transaction_logs_payor_person_id on public.transaction_logs using btree (payor_person_id) TABLESPACE pg_default;

create index IF not exists idx_transaction_logs_payor_name on public.transaction_logs using btree (payor_name) TABLESPACE pg_default;

create index IF not exists idx_transaction_logs_payee_person_id on public.transaction_logs using btree (payee_person_id) TABLESPACE pg_default;

create index IF not exists idx_transaction_logs_payee_name on public.transaction_logs using btree (payee_name) TABLESPACE pg_default;

create index IF not exists idx_transaction_logs_transaction_type on public.transaction_logs using btree (type) TABLESPACE pg_default;

create index IF not exists idx_transaction_logs_method on public.transaction_logs using btree (method) TABLESPACE pg_default;

create index IF not exists idx_transaction_logs_created_at on public.transaction_logs using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_transaction_logs_ordering on public.transaction_logs using btree (ordering) TABLESPACE pg_default;

create index IF not exists idx_transaction_logs_log_id_ordering on public.transaction_logs using btree (log_id, ordering) TABLESPACE pg_default;

create index IF not exists idx_transaction_logs_happened_at on public.transaction_logs using btree (happened_at) TABLESPACE pg_default;
