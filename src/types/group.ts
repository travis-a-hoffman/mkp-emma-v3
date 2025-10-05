import type { Person } from "./person"
import type { Venue } from "./venue"
import type { Area } from "./area"
import type { Community } from "./community"
import type { EventTime } from "./event"
import type { Warrior } from "./person"

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
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface GroupWithRelations extends Group {
  venue?: Venue | null
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
  area?: Area | null
  community?: Community | null
}

export interface IGroupWithRelations extends IGroup {
  venue?: Venue | null
  public_contact?: Person | null
  primary_contact?: Person | null
  area: Area | null
  community: Community | null
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
