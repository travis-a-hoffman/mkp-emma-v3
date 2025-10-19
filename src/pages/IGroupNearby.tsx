"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { MapPin, Calendar, Users, Loader2 } from "lucide-react"
import { EmmaTitleBar } from "../components/emma/titlebar"
import { EmmaAreaTag } from "../components/emma/area-tag"
import { EmmaCommunityTag } from "../components/emma/community-tag"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useEmma } from "../lib/emma-provider"
import type { IGroupWithRelations } from "../types/group"

interface IGroupWithDistance extends IGroupWithRelations {
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

export default function IGroupNearby() {
  const { location, isLocationLoading } = useEmma()
  const navigate = useNavigate()
  const [groups, setGroups] = useState<IGroupWithDistance[]>([])
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
      const url = `/api/i-groups?lat=${location.latitude}&lon=${location.longitude}&rad=25mi`
      console.log("[IGroupNearby] Fetching from:", url)

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error("Failed to fetch i-groups")
      }

      const data = await response.json()

      if (data.success && data.data) {
        setGroups(data.data)
      } else {
        throw new Error(data.error || "Failed to load i-groups")
      }
    } catch (err) {
      console.error("Error fetching i-groups:", err)
      setError(err instanceof Error ? err.message : "Failed to load i-groups")
    } finally {
      setLoading(false)
    }
  }

  const handleGroupClick = (groupId: string) => {
    // TODO: Create i-group detail page
    console.log("Navigate to i-group:", groupId)
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
              We need your location to show I-Groups near you. Please enable location services and refresh the page.
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
          <h1 className="text-center text-3xl font-bold mb-2">I-Groups Near You</h1>
          <p className="text-center text-muted-foreground mb-8">
            Within 25 miles of {location.city && location.state ? `${location.city}, ${location.state}` : "your location"}
          </p>

          {loading && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Loading I-Groups...</p>
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
              <h2 className="text-xl font-semibold mb-2">No I-Groups Found</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                There are no I-Groups within 25 miles of your location. Try checking back later or expanding your search
                area.
              </p>
            </div>
          )}

          {!loading && !error && groups.length > 0 && (
            <div className="space-y-4">
              <p className="text-muted-foreground mb-4">
                Found {groups.length} I-Group{groups.length !== 1 ? "s" : ""}
              </p>

              {groups.map((group) => (
                <Card
                  key={group.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleGroupClick(group.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col space-y-3">
                      {/* Header with name and visitor tags */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-semibold flex-1">{group.name}</h3>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {group.is_accepting_initiated_visitors && (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">
                              Initiated
                            </Badge>
                          )}
                          {group.is_accepting_uninitiated_visitors && (
                            <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 text-xs">
                              Uninitiated
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Area and Community tags */}
                      {(group.area || group.community) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {group.area && <EmmaAreaTag area={group.area} />}
                          {group.community && <EmmaCommunityTag community={group.community} />}
                        </div>
                      )}

                      {/* Description */}
                      {group.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{group.description}</p>
                      )}

                      {/* Active since */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>Active since {formatActiveSince(group.created_at)}</span>
                      </div>

                      {/* Schedule description */}
                      {group.schedule_description && (
                        <div className="p-2 bg-muted rounded-md">
                          <p className="text-sm text-muted-foreground">{group.schedule_description}</p>
                        </div>
                      )}

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
