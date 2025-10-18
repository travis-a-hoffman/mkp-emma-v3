import { useState, useEffect } from "react"

interface NearbyStats {
  radius_miles: number
  latitude: number
  longitude: number
  active: number
  inactive: number
  total: number
  accepting_initiated_visitors?: number
  accepting_uninitiated_visitors?: number
}

interface AreaStats {
  id: string
  name: string
  code: string
  active: number
  inactive: number
  total: number
  accepting_initiated_visitors?: number
  accepting_uninitiated_visitors?: number
}

interface CommunityStats {
  id: string
  name: string
  code: string
  active: number
  inactive: number
  total: number
  accepting_initiated_visitors?: number
  accepting_uninitiated_visitors?: number
}

export interface GroupStatsData {
  total: number
  active: number
  inactive: number
  nearby?: NearbyStats | null
  area?: AreaStats | null
  community?: CommunityStats | null
  accepting_initiated_visitors?: number
  accepting_uninitiated_visitors?: number
}

interface GroupStatsResponse {
  success: boolean
  data: GroupStatsData
}

export interface UseGroupStatsResult {
  stats: GroupStatsData | null
  isLoading: boolean
  error: string | null
}

/**
 * Custom hook to fetch group statistics based on geolocation
 * @param latitude - User's latitude
 * @param longitude - User's longitude
 * @param isAuthenticated - Whether user is authenticated (determines endpoint)
 * @param radiusMiles - Radius in miles for nearby search (default: 25)
 */
export function useGroupStats(
  latitude: string | number | null | undefined,
  longitude: string | number | null | undefined,
  isAuthenticated: boolean,
  radiusMiles: number = 25,
): UseGroupStatsResult {
  const [stats, setStats] = useState<GroupStatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Determine which endpoint to use
        const endpoint = isAuthenticated ? "/api/i-groups/stats" : "/api/groups/stats"

        // Build query parameters
        const params = new URLSearchParams()

        // Only add geolocation params if we have them
        if (latitude && longitude) {
          params.append("lat", String(latitude))
          params.append("lon", String(longitude))
          params.append("rad", `${radiusMiles}mi`)
        }

        const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint

        console.log(`[useGroupStats] Fetching from: ${url}`)

        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Failed to fetch group stats: ${response.status}`)
        }

        const result: GroupStatsResponse = await response.json()

        if (result.success && result.data) {
          setStats(result.data)
        } else {
          throw new Error("Invalid response format from stats API")
        }
      } catch (err) {
        console.error("[useGroupStats] Error:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch group statistics")
        setStats(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [latitude, longitude, isAuthenticated, radiusMiles])

  return { stats, isLoading, error }
}
