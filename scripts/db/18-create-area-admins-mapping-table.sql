create table public.area_admins (
  id uuid not null default gen_random_uuid (),
  area_id uuid not null,
  person_id uuid not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint area_admins_pkey primary key (id),
  constraint area_admins_area_id_person_id_key unique (area_id, person_id),
  constraint area_admins_area_id_fkey foreign KEY (area_id) references areas (id) on delete CASCADE,
  constraint area_admins_person_id_fkey foreign KEY (person_id) references people (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_area_admins_area_id on public.area_admins using btree (area_id) TABLESPACE pg_default;

create index IF not exists idx_area_admins_person_id on public.area_admins using btree (person_id) TABLESPACE pg_default;
