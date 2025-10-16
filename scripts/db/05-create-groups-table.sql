create table public.groups (
  id uuid not null default gen_random_uuid (),
  name text not null,
  description text not null,
  url text null,
  members jsonb null default '[]'::jsonb,
  is_accepting_new_members boolean null default false,
  membership_criteria text null,
  venue_id uuid null,
  genders text null,
  is_publicly_listed boolean null default false,
  public_contact_id uuid null,
  primary_contact_id uuid null,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  photo_url text null,
  latitude numeric(10, 6) null,
  longitude numeric(10, 6) null,
  mkpconnect_data jsonb null,
  constraint groups_pkey primary key (id),
  constraint groups_primary_contact_id_fkey foreign KEY (primary_contact_id) references people (id) on delete set null,
  constraint groups_public_contact_id_fkey foreign KEY (public_contact_id) references people (id) on delete set null,
  constraint groups_venue_id_fkey foreign KEY (venue_id) references venues (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_groups_deleted_at on public.groups using btree (deleted_at) TABLESPACE pg_default;

create index IF not exists idx_groups_is_active on public.groups using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_groups_is_publicly_listed on public.groups using btree (is_publicly_listed) TABLESPACE pg_default;

create index IF not exists idx_groups_venue_id on public.groups using btree (venue_id) TABLESPACE pg_default;

create index IF not exists idx_groups_public_contact_id on public.groups using btree (public_contact_id) TABLESPACE pg_default;

create index IF not exists idx_groups_primary_contact_id on public.groups using btree (primary_contact_id) TABLESPACE pg_default;