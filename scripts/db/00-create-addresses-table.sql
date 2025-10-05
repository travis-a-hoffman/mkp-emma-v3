create table public.addresses (
  id uuid not null default gen_random_uuid (),
  address_1 text not null,
  address_2 text null,
  city text not null,
  state text not null,
  country text not null default 'United States'::text,
  postal_code text not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  constraint addresses_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_addresses_city_state on public.addresses using btree (city, state) TABLESPACE pg_default;

create index IF not exists idx_addresses_postal_code on public.addresses using btree (postal_code) TABLESPACE pg_default;
