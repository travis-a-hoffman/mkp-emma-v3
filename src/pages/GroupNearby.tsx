"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { MapPin, Calendar, Users, Loader2 } from "lucide-react"
import { EmmaTitleBar } from "../components/emma/titlebar"
import { Card, CardContent } from "@/components/ui/card"
import { useEmma } from "../lib/emma-provider"
import type { GroupWithRelations } from "../types/group"

interface GroupWithDistance extends GroupWithRelations {
  distance?: number
  distance_units?: string
}

function formatActiveSince(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function formatDistance(meters: number | undefined): string {
  if (!meters) return ""
  const miles = meters / 1609.34
  return `${miles.toFixed(1)} mi away`
}

export default function GroupNearby() {
  const { location, isLocationLoading } = useEmma()
  const navigate = useNavigate()
  const [groups, setGroups] = useState<GroupWithDistance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (location?.latitude && location?.longitude) {
      fetchGroups()
    }
  }, [location])

  const fetchGroups = async () => {
    if (!location?.latitude || !location?.longitude) {
      setError("Location not available")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const url = `/api/groups?lat=${location.latitude}&lon=${location.longitude}&rad=25mi`
      console.log("[GroupNearby] Fetching from:", url)

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error("Failed to fetch groups")
      }

      const data = await response.json()

      if (data.success && data.data) {
        setGroups(data.data)
      } else {
        throw new Error(data.error || "Failed to load groups")
      }
    } catch (err) {
      console.error("Error fetching groups:", err)
      setError(err instanceof Error ? err.message : "Failed to load groups")
    } finally {
      setLoading(false)
    }
  }

  const handleGroupClick = (groupId: string) => {
    // TODO: Create group detail page
    console.log("Navigate to group:", groupId)
  }

  if (isLocationLoading) {
    return (
      <div className="min-h-screen bg-background">
        <EmmaTitleBar />
        <div className="pt-20 container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Getting your location...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!location?.latitude || !location?.longitude) {
    return (
      <div className="min-h-screen bg-background">
        <EmmaTitleBar />
        <div className="pt-20 container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Location Required</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              We need your location to show groups near you. Please enable location services and refresh the page.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <EmmaTitleBar />
      <div className="pt-20 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-center text-3xl font-bold mb-2">Groups Near You</h1>
          <p className="text-center text-muted-foreground mb-8">
            Within 25 miles of {location.city && location.state ? `${location.city}, ${location.state}` : "your location"}
          </p>

          {loading && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Loading groups...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-destructive">{error}</p>
            </div>
          )}

          {!loading && !error && groups.length === 0 && (
            <div className="text-center py-12">
              <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Groups Found</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                There are no groups within 25 miles of your location. Try checking back later or expanding your search
                area.
              </p>
            </div>
          )}

          {!loading && !error && groups.length > 0 && (
            <div className="space-y-4">
              <p className="text-muted-foreground mb-4">
                Found {groups.length} group{groups.length !== 1 ? "s" : ""}
              </p>

              {groups.map((group) => (
                <Card
                  key={group.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleGroupClick(group.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-semibold">{group.name}</h3>
                      </div>

                      {/* Description */}
                      {group.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{group.description}</p>
                      )}

                      {/* Active since */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>Active since {formatActiveSince(group.created_at)}</span>
                      </div>

                      {/* Footer: Members and Distance */}
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 flex-shrink-0" />
                          <span>{group.members?.length || 0} member{group.members?.length !== 1 ? "s" : ""}</span>
                        </div>

                        {group.distance && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span>{formatDistance(group.distance)}</span>
                          </div>
                        )}

                        {group.venue && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">
                              {group.venue.name}
                              {group.venue.physical_address && (
                                <span>
                                  , {group.venue.physical_address.city}, {group.venue.physical_address.state}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
