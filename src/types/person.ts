import type { EventBasic } from "../types/event"

export interface Person {
  id: string
  first_name: string
  middle_name?: string | null
  last_name: string
  email?: string | null
  phone?: string | null
  billing_address_id?: string | null
  mailing_address_id?: string | null
  physical_address_id?: string | null
  notes?: string | null
  photo_url?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Prospect extends Person {
  log_id?: string
  balked_events: string[]
}

export interface Registrant<E extends EventBasic> extends Person {
  event_id?: string
  log_id?: string
  payment_plan?: string
  transaction_log?: string
  status: "potential" | "committed" | "waitlist"
  event?: E
  position?: number // for ordered lists (potential and waitlist)
}

export interface Warrior<E extends EventBasic> extends Person {
  log_id: string | null
  initiation_id: string | null
  initiation_on: string | null
  status: string
  training_events: string[]
  staffed_events: string[]
  lead_events: string[]
  mos_events: string[]
  area_id: string | null
  community_id: string | null
  initiation_event?: E
  inner_essence_name?: string | null
}
