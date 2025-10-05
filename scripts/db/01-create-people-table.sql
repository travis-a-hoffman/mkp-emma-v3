create table public.people (
  id uuid not null default gen_random_uuid (),
  first_name text not null,
  middle_name text null,
  last_name text not null,
  email text null,
  phone text null,
  billing_address_id uuid null,
  mailing_address_id uuid null,
  physical_address_id uuid null,
  notes text null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  photo_url text null,
  deleted_at timestamp with time zone null,
  constraint people_pkey primary key (id),
  constraint people_billing_address_id_fkey foreign KEY (billing_address_id) references addresses (id) on delete set null,
  constraint people_mailing_address_id_fkey foreign KEY (mailing_address_id) references addresses (id) on delete set null,
  constraint people_physical_address_id_fkey foreign KEY (physical_address_id) references addresses (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_people_email on public.people using btree (email) TABLESPACE pg_default;

create index IF not exists idx_people_last_name on public.people using btree (last_name) TABLESPACE pg_default;

create index IF not exists idx_people_billing_address on public.people using btree (billing_address_id) TABLESPACE pg_default;

create index IF not exists idx_people_mailing_address on public.people using btree (mailing_address_id) TABLESPACE pg_default;

create index IF not exists idx_people_physical_address on public.people using btree (physical_address_id) TABLESPACE pg_default;

create index IF not exists idx_people_photo_url on public.people using btree (photo_url) TABLESPACE pg_default
where
  (photo_url is not null);
