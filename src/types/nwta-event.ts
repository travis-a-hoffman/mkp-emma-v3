import type { Event } from "./event"
import type { Transaction } from "../../src/types/transaction"

export interface NwtaEvent extends Event {
  // NWTA-specific fields
  rookies: string[]
  elders: string[]
  mos: string[]
}

export interface NwtaEventWithRelations extends NwtaEvent {
  // EventWithRelations-specific fields
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

  // NWTA-specific fields
  roles: Array<{
    id: string
    name: string
    summary?: string
    role_type?: {
      name: string
      experience_level: number
    }
    lead_warrior?: {
      person: {
        first_name: string
        last_name: string
      }
    }
  }>
  transactions: Array<Transaction>
}
