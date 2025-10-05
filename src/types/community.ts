export interface Community {
  id: string
  name: string
  code: string
  description?: string | null
  area_id?: string | null
  coordinator_id?: string | null
  geo_polygon?: any
  image_url?: string | null
  color?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

// Utility types for different use cases
export type CommunityBasic = Pick<Community, "id" | "name" | "code" | "is_active">
export type CommunityWithColor = Pick<Community, "id" | "name" | "code" | "color">
