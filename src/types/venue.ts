export interface Venue {
  id: string
  name: string
  phone?: string
  email?: string
  website?: string
  timezone: string
  physical_address_id?: string
  primary_contact_id?: string
  facility_contact_id?: string
  supported_event_types?: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}
