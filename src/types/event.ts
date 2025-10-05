import type { Transaction } from "@/src/types/transaction"

export interface EventBasic {
  id: string
  name: string
  event_type_id: string | null
  area_id: string | null
  community_id: string | null
  venue_id: string | null
  start_at: string | null // ISO timestamp with timezone
  end_at: string | null // ISO timestamp with timezone
  is_published: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// Centralized Event type definitions
export interface Event extends EventBasic {
  description: string | null
  transaction_log_id: string
  staff_cost: number // stored in cents
  staff_capacity: number // maximum number of staff slots
  potential_staff: string[] // array of person UUIDs
  committed_staff: string[] // array of person UUIDs
  alternate_staff: string[] // array of person UUIDs
  participant_cost: number // stored in cents
  participant_capacity: number
  potential_participants: string[] // ordered array of person UUIDs
  committed_participants: string[] // array of person UUIDs
  waitlist_participants: string[] // ordered array of person UUIDs
  primary_leader_id: string | null
  leaders: string[] // array of person UUIDs
  participant_schedule: EventTime[] // array of time periods for participants
  staff_schedule: EventTime[] // array of time periods for staff (typically earlier)
  participant_published_time: EventTime | null // when participants can apply
  staff_published_time: EventTime | null // when staff can apply
}

export interface EventTime {
  start: string // ISO timestamp with timezone
  end: string // ISO timestamp with timezone
}

export interface EventWithRelations extends Event {
  event_type?: {
    id: string
    name: string
    code: string
    color: string
    is_active: boolean
  }
  area?: {
    id: string
    name: string
    code: string
    color: string
    is_active: boolean
  }
  community?: {
    id: string
    name: string
    code: string
    color: string
    is_active: boolean
  }
  venue?: {
    id: string
    name: string
    phone: string | null
    email: string | null
    timezone: string | null
    website: string | null
    physical_address?: {
      id: string
      address_1: string
      address_2: string | null
      city: string
      state: string
      postal_code: string
      country: string
    }
  }
  primary_leader?: {
    id: string
    first_name: string
    last_name: string
  }
  transactions: Transaction[]
}

export interface EventType {
  id: string
  name: string
  code: string
  color: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}
