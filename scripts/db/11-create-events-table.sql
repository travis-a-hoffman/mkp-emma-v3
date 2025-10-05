create table public.events (
  id uuid not null default gen_random_uuid (),
  event_type_id uuid null,
  name text not null,
  description text null,
  area_id uuid null,
  community_id uuid null,
  venue_id uuid null,
  staff_cost integer null default 0,
  potential_staff jsonb null default '[]'::jsonb,
  committed_staff jsonb null default '[]'::jsonb,
  alternate_staff jsonb null default '[]'::jsonb,
  participant_cost integer null default 0,
  participant_capacity integer null default 0,
  potential_participants jsonb null default '[]'::jsonb,
  committed_participants jsonb null default '[]'::jsonb,
  waitlist_participants jsonb null default '[]'::jsonb,
  primary_leader_id uuid null,
  leaders jsonb null default '[]'::jsonb,
  participant_schedule jsonb null default '[]'::jsonb,
  is_published boolean null default false,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  staff_capacity integer null default 0,
  transaction_log_id uuid null default gen_random_uuid (),
  staff_schedule jsonb null default '[]'::jsonb,
  participant_published_time jsonb null,
  staff_published_time jsonb null,
  start_at timestamp with time zone null,
  end_at timestamp with time zone null,
  deleted_at timestamp with time zone null,
  constraint events_pkey primary key (id),
  constraint events_area_id_fkey foreign KEY (area_id) references areas (id),
  constraint events_community_id_fkey foreign KEY (community_id) references communities (id),
  constraint events_event_type_id_fkey foreign KEY (event_type_id) references event_types (id),
  constraint events_primary_leader_id_fkey foreign KEY (primary_leader_id) references people (id),
  constraint events_venue_id_fkey foreign KEY (venue_id) references venues (id)
) TABLESPACE pg_default;

create index IF not exists idx_events_staff_schedule on public.events using gin (staff_schedule) TABLESPACE pg_default;

create index IF not exists idx_events_participant_published_time on public.events using gin (participant_published_time) TABLESPACE pg_default;

create index IF not exists idx_events_staff_published_time on public.events using gin (staff_published_time) TABLESPACE pg_default;

create index IF not exists idx_events_start_at on public.events using btree (start_at) TABLESPACE pg_default;

create index IF not exists idx_events_end_at on public.events using btree (end_at) TABLESPACE pg_default;

create index IF not exists idx_events_event_type_id on public.events using btree (event_type_id) TABLESPACE pg_default;

create index IF not exists idx_events_area_id on public.events using btree (area_id) TABLESPACE pg_default;

create index IF not exists idx_events_community_id on public.events using btree (community_id) TABLESPACE pg_default;

create index IF not exists idx_events_venue_id on public.events using btree (venue_id) TABLESPACE pg_default;

create index IF not exists idx_events_primary_leader_id on public.events using btree (primary_leader_id) TABLESPACE pg_default;

create index IF not exists idx_events_is_published on public.events using btree (is_published) TABLESPACE pg_default;

create index IF not exists idx_events_is_active on public.events using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_events_created_at on public.events using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_events_start_at_end_at on public.events using btree (start_at, end_at) TABLESPACE pg_default;

create index IF not exists idx_events_transaction_log_id on public.events using btree (transaction_log_id) TABLESPACE pg_default;
