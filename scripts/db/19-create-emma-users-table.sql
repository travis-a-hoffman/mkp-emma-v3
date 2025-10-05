create table public.emma_users (
  id uuid not null default gen_random_uuid (),
  auth0_user jsonb null,
  civicrm_user jsonb null,
  drupal_user jsonb null,
  person jsonb null,
  other_auth0_users jsonb null default '[]'::jsonb,
  other_civicrm_users jsonb null default '[]'::jsonb,
  other_drupal_users jsonb null default '[]'::jsonb,
  other_people jsonb null default '[]'::jsonb,
  approved_at timestamp with time zone null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint emma_users_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_emma_users_person_id on public.emma_users using btree (((person ->> 'id'::text))) TABLESPACE pg_default;

create index IF not exists idx_emma_users_auth0_email on public.emma_users using btree (((auth0_user ->> 'email'::text))) TABLESPACE pg_default;

create index IF not exists idx_emma_users_civicrm_email on public.emma_users using btree (((civicrm_user ->> 'email_primary'::text))) TABLESPACE pg_default;

create index IF not exists idx_emma_users_drupal_email on public.emma_users using btree (((drupal_user ->> 'email_primary'::text))) TABLESPACE pg_default;

create index IF not exists idx_emma_users_approved_at on public.emma_users using btree (approved_at) TABLESPACE pg_default;

create index IF not exists idx_emma_users_created_at on public.emma_users using btree (created_at) TABLESPACE pg_default;
