export interface Area {
  id: string
  name: string
  code: string
  description?: string | null
  steward_id?: string | null
  finance_coordinator_id?: string | null
  geo_json?: any
  geo_definition?: any
  image_url?: string | null
  color?: string
  is_active: boolean
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  admins?: Array<{
    id: string
    first_name: string
    middle_name?: string
    last_name: string
    email?: string
    photo_url?: string
  }>
}

// Utility types for different use cases
export type AreaBasic = Pick<Area, "id" | "name" | "code" | "is_active">
export type AreaWithColor = Pick<Area, "id" | "name" | "code" | "color">
