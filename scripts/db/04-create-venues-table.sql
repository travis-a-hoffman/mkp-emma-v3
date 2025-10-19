create table public.venues (
  id uuid not null default gen_random_uuid (),
  name text not null,
  description text null,
  email text null,
  phone text null,
  website text null,
  mailing_address_id uuid null,
  physical_address_id uuid null,
  event_types jsonb null default '[]'::jsonb,
  primary_contact_id uuid null,
  latitude numeric(10, 8) null,
  longitude numeric(11, 8) null,
  is_nudity boolean not null default false,
  is_rejected boolean not null default false,
  is_private_residence boolean not null default false,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  area_id uuid null,
  community_id uuid null,
  nudity_note text null,
  rejected_note text null,
  timezone character varying(50) null default 'America/New_York'::character varying,
  deleted_at timestamp with time zone null,
  constraint venues_pkey primary key (id),
  constraint venues_area_id_fkey foreign KEY (area_id) references areas (id) on delete set null,
  constraint venues_community_id_fkey foreign KEY (community_id) references communities (id) on delete set null,
  constraint venues_mailing_address_id_fkey foreign KEY (mailing_address_id) references addresses (id) on delete set null,
  constraint venues_physical_address_id_fkey foreign KEY (physical_address_id) references addresses (id) on delete set null,
  constraint venues_primary_contact_id_fkey foreign KEY (primary_contact_id) references people (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_venues_name on public.venues using btree (name) TABLESPACE pg_default;

create index IF not exists idx_venues_email on public.venues using btree (email) TABLESPACE pg_default;

create index IF not exists idx_venues_mailing_address on public.venues using btree (mailing_address_id) TABLESPACE pg_default;

create index IF not exists idx_venues_physical_address on public.venues using btree (physical_address_id) TABLESPACE pg_default;

create index IF not exists idx_venues_primary_contact on public.venues using btree (primary_contact_id) TABLESPACE pg_default;

create index IF not exists idx_venues_location on public.venues using btree (latitude, longitude) TABLESPACE pg_default;

create index IF not exists idx_venues_is_active on public.venues using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_venues_is_rejected on public.venues using btree (is_rejected) TABLESPACE pg_default;

create index IF not exists idx_venues_is_private_residence on public.venues using btree (is_private_residence) TABLESPACE pg_default;

create index IF not exists idx_venues_area on public.venues using btree (area_id) TABLESPACE pg_default;

create index IF not exists idx_venues_community on public.venues using btree (community_id) TABLESPACE pg_default;
