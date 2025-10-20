import type { Person } from "./person"
import type { Venue } from "./venue"
import type { Area } from "./area"
import type { Community } from "./community"
import type { EventTime } from "./event"
import type { Warrior } from "./person"

interface MkpConnectIGroup {
  mkp_connect_id: number
  igroup_name: string | null
  about: string | null
  igroup_type: string | null
  igroup_status: string | null
  igroup_class: string | null
  // Address fields
  address: string | null
  city: string | null
  postal_code: string | null
  state_province: string | null
  country: string | null
  // Relationships (names)
  community_name: string | null
  area_name: string | null
  owner_name: string | null
  // Relationships (IDs)
  community_id: number | null
  area_id: number | null
  owner_id: number | null
  // Meeting details
  meeting_night: string | null
  meeting_time: string | null
  meeting_frequency: string | null
  // Location
  latitude: string | null
  longitude: string | null
  // Flags/Settings
  is_accepting_initiated_visitors: string | null
  is_accepting_uninitiated_visitors: string | null
  is_accepting_new_members: string | null
  igroup_is_private: string | null
  is_public_display: string | null
  igroup_email: string | null
  igroup_is_mixed_gender: string | null
  igroup_mkpi: string | null
  // Contact information
  mkp_connect_contact_uid: number | null
  mkp_connect_contact_name: string | null
  mkp_connect_contact_email: string | null
  // Import details
  imported_at: string | null
  imported_from: string | null
}

export interface Group {
  id: string
  name: string
  description: string
  url?: string | null
  members: Person[]
  is_accepting_new_members: boolean
  membership_criteria?: string | null
  venue_id?: string | null
  genders?: string | null
  is_publicly_listed: boolean
  public_contact_id?: string | null
  primary_contact_id?: string | null
  latitude?: number | null
  longitude?: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at?: string | null
  established_on?: string | null
  // TODO Do I need to genericize this? Or make it "any" type?
  mkpconnect_data?: MkpConnectIGroup | null
}

export interface GroupWithRelations extends Group {
  venue?: {
    id: string
    name: string
    phone?: string | null
    email?: string | null
    timezone: string
    website?: string | null
    physical_address?: {
      id: string
      address_1: string
      address_2: string | null
      city: string
      state: string
      postal_code: string
      country: string
    } | null
  } | null
  public_contact?: Person | null
  primary_contact?: Person | null
}

export type GroupBasic = Pick<Group, "id" | "name" | "is_active">

export interface IGroup extends Group {
  is_accepting_initiated_visitors: boolean
  is_accepting_uninitiated_visitors: boolean
  is_requiring_contact_before_visiting: boolean
  schedule_events: EventTime[]
  schedule_description: string | null
  area_id: string | null
  community_id: string | null
  contact_email?: string | null
  status?: string | null
  affiliation?: string | null
  area?: Area | null
  community?: Community | null
}

export interface IGroupWithRelations extends IGroup {
  venue?: {
    id: string
    name: string
    phone?: string | null
    email?: string | null
    timezone: string
    website?: string | null
    physical_address?: {
      id: string
      address_1: string
      address_2: string | null
      city: string
      state: string
      postal_code: string
      country: string
    } | null
  } | null
  public_contact?: Person | null
  primary_contact?: Person | null
  area: Area | null
  community: Community | null
  member_ids?: string[] // Original UUID array from database
}

export interface FGroup<W = any> extends Group {
  group_type: "Men's" | "Mixed Gender" | "Open Men's" | "Closed Men's"
  is_accepting_new_facilitators: boolean
  facilitators: W[]
  is_accepting_initiated_visitors: boolean
  is_accepting_uninitiated_visitors: boolean
  is_requiring_contact_before_visiting: boolean
  schedule_events: EventTime[]
  schedule_description: string | null
  area_id: string | null
  community_id: string | null
  contact_email?: string | null
  status?: string | null
  affiliation?: string | null
  area?: Area | null
  community?: Community | null
}

export interface FGroupWithRelations extends FGroup<Warrior<any>> {
  venue?: Venue | null
  public_contact?: Person | null
  primary_contact?: Person | null
  area: Area | null
  community: Community | null
}
