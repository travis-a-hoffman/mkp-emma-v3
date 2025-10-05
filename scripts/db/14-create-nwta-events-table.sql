create table public.nwta_events (
  id uuid not null,
  rookies jsonb null default '[]'::jsonb,
  elders jsonb null default '[]'::jsonb,
  mos jsonb null default '[]'::jsonb,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone null,
  constraint nwta_events_pkey primary key (id),
  constraint nwta_events_id_fkey foreign KEY (id) references events (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_nwta_events_rookies on public.nwta_events using gin (rookies) TABLESPACE pg_default;

create index IF not exists idx_nwta_events_elders on public.nwta_events using gin (elders) TABLESPACE pg_default;

create index IF not exists idx_nwta_events_mos on public.nwta_events using gin (mos) TABLESPACE pg_default;
