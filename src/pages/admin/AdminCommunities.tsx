"use client"

import { useAuth0 } from "../../lib/auth0-provider"
import { Navigate } from "react-router-dom"
import { EmmaTitleBar } from "../../components/emma/titlebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Eye, EyeOff, Edit, Plus, Save, X, Users, MapPin } from "lucide-react"
import { EmmaPeopleDropdown } from "../../components/emma/people-dropdown"
import { GoogleMap } from "../../components/emma/google-map"
import type { AreaBasic } from "../../types/area"
import type { Community } from "../../types/community"
import { useState, useEffect } from "react"

interface Person {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  is_active: boolean
  email?: string
  photo_url?: string
}

export default function AdminCommunities() {
  const { isAuthenticated, isLoading } = useAuth0()
  const [communities, setCommunities] = useState<Community[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [areas, setAreas] = useState<AreaBasic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set())
  const [editFormData, setEditFormData] = useState<Record<string, Partial<Community>>>({})
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set())
  const [archiveConfirmation, setArchiveConfirmation] = useState<{ isOpen: boolean; community: Community | null }>({
    isOpen: false,
    community: null,
  })
  const [archivingItems, setArchivingItems] = useState<Set<string>>(new Set())
  const [peopleCache, setPeopleCache] = useState<Record<string, Person>>({})
  const [areasCache, setAreasCache] = useState<Record<string, AreaBasic>>({})
  const [imageUploadModal, setImageUploadModal] = useState<{
    isOpen: boolean
    communityId: string | null
    cropMode: boolean
  }>({
    isOpen: false,
    communityId: null,
    cropMode: false,
  })

  useEffect(() => {
    if (isAuthenticated) {
      fetchCommunities()
      fetchPeople()
      fetchAreas()
    }
  }, [isAuthenticated, showArchived])

  const fetchCommunities = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/communities?archived=${showArchived}`)
      if (!response.ok) throw new Error(`Failed to fetch communities: ${response.statusText}`)
      const result = await response.json()
      const communitiesData = Array.isArray(result.data) ? result.data : [result.data]
      setCommunities(communitiesData)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to fetch communities")
    } finally {
      setLoading(false)
    }
  }

  const fetchPeople = async () => {
    try {
      const response = await fetch("/api/people")
      if (!response.ok) throw new Error(`Failed to fetch people: ${response.statusText}`)
      const result = await response.json()
      const peopleData = Array.isArray(result.data) ? result.data : [result.data]
      setPeople(peopleData.filter((person: Person) => person.is_active))
      const cache: Record<string, Person> = {}
      peopleData.forEach((person: Person) => {
        cache[person.id] = person
      })
      setPeopleCache(cache)
    } catch (error) {
      console.error("Error fetching people:", error)
    }
  }

  const fetchAreas = async () => {
    try {
      const response = await fetch("/api/areas")
      if (!response.ok) throw new Error(`Failed to fetch areas: ${response.statusText}`)
      const result = await response.json()
      const areasData = Array.isArray(result.data) ? result.data : [result.data]
      setAreas(areasData.filter((area: AreaBasic) => area.is_active))
      const cache: Record<string, AreaBasic> = {}
      areasData.forEach((area: AreaBasic) => {
        cache[area.id] = area
      })
      setAreasCache(cache)
    } catch (error) {
      console.error("Error fetching areas:", error)
    }
  }

  const toggleExpanded = (id: string) => {
    const newExpandedId = id === expandedItem ? null : id
    setExpandedItem(newExpandedId)

    // Close editing mode when collapsing
    if (!newExpandedId) {
      setEditingItems((prevEdit) => {
        const newEditSet = new Set(prevEdit)
        newEditSet.delete(id)
        return newEditSet
      })
    }

    return newExpandedId
  }

  const startEditing = (community: Community) => {
    setExpandedItem(community.id)
    setEditingItems((prev) => new Set(prev).add(community.id))
    setEditFormData((prev) => ({
      ...prev,
      [community.id]: { ...community },
    }))
  }

  const cancelEditing = (id: string) => {
    setEditingItems((prev) => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
    setEditFormData((prev) => {
      const newData = { ...prev }
      delete newData[id]
      return newData
    })
    setExpandedItem(null)
  }

  const createNewCommunity = () => {
    const tempId = `temp-${Date.now()}`
    const newCommunity: Community = {
      id: tempId,
      name: "",
      code: "",
      description: null,
      area_id: null,
      coordinator_id: null,
      geo_json: null,
      image_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      color: "#3B82F6", // Default color
    }
    setCommunities((prev) => [newCommunity, ...prev])
    startEditing(newCommunity)
  }

  const saveChanges = async (id: string) => {
    const formData = editFormData[id]
    if (!formData) return

    if (!formData.name?.trim() || !formData.code?.trim()) {
      setError("Name and code are required")
      return
    }

    try {
      setSavingItems((prev) => new Set(prev).add(id))
      setError(null)

      const isNewCommunity = id.startsWith("temp-")
      const url = isNewCommunity ? "/api/communities" : `/api/communities/${id}`
      const method = isNewCommunity ? "POST" : "PUT"

      console.log("[v0] Saving community with geo_json:", formData.geo_json)

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${isNewCommunity ? "create" : "update"} community`)
      }

      const result = await response.json()
      const savedCommunity = result.data

      console.log("[v0] Received saved community with geo_json:", savedCommunity.geo_json)

      setCommunities((prev) => {
        const updatedCommunities = isNewCommunity
          ? prev.map((c) => (c.id === id ? savedCommunity : c))
          : prev.map((c) => (c.id === id ? savedCommunity : c))

        console.log(
          "[v0] Updated communities state, communities with geo_json:",
          updatedCommunities.filter((c) => c.geo_json).length,
        )

        return updatedCommunities
      })

      cancelEditing(id)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to save community")
    } finally {
      setSavingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const getPersonName = (personId: string | null | undefined) => {
    if (!personId) return "Not assigned"
    const person = peopleCache[personId]
    if (!person) return "Unknown person"
    return `${person.first_name} ${person.last_name}`
  }

  const getAreaName = (areaId: string | null | undefined) => {
    if (!areaId) return "Not assigned"
    const area = areasCache[areaId]
    if (!area) return "Unknown area"
    return area.name
  }

  // Helper function to create FeatureCollection from multiple polygons
  const createOverviewMapData = () => {
    const communitiesWithGeo = communities.filter((c) => c.geo_json)

    console.log("[v0] Creating overview map data for", communitiesWithGeo.length, "communities")

    if (communitiesWithGeo.length === 0) return null

    communitiesWithGeo.forEach((community, index) => {
      console.log(`[v0] Community ${index + 1} (${community.name}):`, {
        id: community.id,
        geo_json_type: typeof community.geo_json,
        geo_json_structure: community.geo_json,
        has_type: community.geo_json?.type,
        has_coordinates: community.geo_json?.coordinates ? "yes" : "no",
      })
    })

    // Create a FeatureCollection from all community polygons
    const features = communitiesWithGeo
      .map((community) => {
        let geometry = null

        // Extract the actual Polygon geometry from the community's geo_json
        if (community.geo_json?.type === "FeatureCollection" && community.geo_json.features?.length > 0) {
          // If it's a FeatureCollection, get the geometry from the first feature
          geometry = community.geo_json.features[0].geometry
        } else if (community.geo_json?.type === "Polygon") {
          // If it's already a Polygon, use it directly
          geometry = community.geo_json
        } else if (community.geo_json?.type === "Feature") {
          // If it's a Feature, get its geometry
          geometry = community.geo_json.geometry
        }

        const feature = {
          type: "Feature",
          properties: {
            id: community.id,
            name: community.name,
            code: community.code,
            color: community.color, // Include color in properties
          },
          geometry: geometry,
        }

        console.log("[v0] Created feature for", community.name, ":", {
          geometry_type: feature.geometry?.type,
          has_coordinates: feature.geometry?.coordinates ? "yes" : "no",
          coordinates_length: feature.geometry?.coordinates?.[0]?.length || 0,
        })

        return feature
      })
      .filter((feature) => feature.geometry) // Only include features with valid geometry

    const featureCollection = {
      type: "FeatureCollection",
      features: features,
    }

    console.log("[v0] Final FeatureCollection:", {
      type: featureCollection.type,
      features_count: featureCollection.features.length,
      first_feature_geometry: featureCollection.features[0]?.geometry,
    })

    return featureCollection
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const filteredCommunities = communities.filter((community) =>
    showArchived ? !community.is_active : community.is_active,
  )

  const activeCommunityCount = communities.filter((c) => c.is_active).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <EmmaTitleBar title="Communities Management" backLink={{ href: "/admin", label: "Back to Admin" }} />

      <div className="p-6 pt-20">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <p className="text-gray-600">Configure and organize different communities in the system</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900">
                    Communities ({activeCommunityCount})
                  </CardTitle>
                  <CardDescription>Manage communities and their details</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
                    <label htmlFor="show-archived" className="text-sm text-gray-600">
                      Show archived
                    </label>
                  </div>
                  <Button onClick={createNewCommunity} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Community
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {loading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Loading communities...</div>
                </div>
              ) : filteredCommunities.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <div className="text-gray-500">
                    {showArchived ? "No archived communities found" : "No active communities found"}
                  </div>
                  {!showArchived && (
                    <Button onClick={createNewCommunity} className="mt-4">
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Community
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredCommunities.some((c) => c.geo_json) && (
                    <div className="border rounded-lg overflow-hidden bg-gray-50">
                      <div className="p-3 bg-white border-b">
                        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Communities Overview Map ({filteredCommunities.filter((c) => c.geo_json).length}{" "}
                          communities)
                        </h4>
                      </div>
                      <GoogleMap
                        key={`overview-${filteredCommunities
                          .filter((c) => c.geo_json)
                          .map((c) => c.id)
                          .join("-")}`}
                        geoPolygon={createOverviewMapData()}
                        className="w-full aspect-video"
                      />
                    </div>
                  )}

                  <div className="space-y-4">
                    {filteredCommunities.map((community) => {
                      const isExpanded = expandedItem === community.id
                      const isEditing = editingItems.has(community.id)
                      const isSaving = savingItems.has(community.id)
                      const formData = editFormData[community.id] || community

                      return (
                        <Card key={community.id} className={`${!community.is_active ? "opacity-60" : ""}`}>
                          <CardContent className="p-0">
                            <div className="flex items-start justify-between p-4">
                              <div className="flex items-center space-x-4 flex-1">
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  {community.image_url ? (
                                    <img
                                      src={community.image_url || "/placeholder.svg"}
                                      alt={community.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Users className="w-6 h-6 text-gray-400" />
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-medium text-gray-900 truncate">{community.name}</h3>
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                      {community.code}
                                    </span>
                                    {community.area_id && areasCache[community.area_id] && (
                                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                        {areasCache[community.area_id].code}
                                      </span>
                                    )}
                                    {!community.is_active && (
                                      <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                                        Archived
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-500 space-y-1">
                                    <div>Coordinator: {getPersonName(community.coordinator_id)}</div>
                                    {community.updated_at && (<div>Updated: {new Date(community.updated_at).toLocaleString()}</div>)}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 ml-4">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleExpanded(community.id)}
                                        className="text-gray-500 hover:text-gray-700"
                                      >
                                        {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{isExpanded ? "Hide Details" : "Show Details"}</p>
                                    </TooltipContent>
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => startEditing(community)}
                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Edit Community</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="border-t bg-gray-50 p-4">
                                {isEditing ? (
                                  <div className="space-y-6">
                                    <div className="flex items-center justify-end gap-2 pb-2 border-b">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => saveChanges(community.id)}
                                              disabled={isSaving}
                                              className="text-green-600 hover:text-green-700 hover:bg-green-50 bg-transparent"
                                            >
                                              {isSaving ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                              ) : (
                                                <Save className="w-4 h-4" />
                                              )}
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Save changes</p>
                                          </TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => cancelEditing(community.id)}
                                              disabled={isSaving}
                                              className="text-gray-600 hover:text-gray-700"
                                            >
                                              <X className="w-4 h-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Cancel editing</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div className="space-y-4">
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Community Name *
                                          </label>
                                          <Input
                                            value={formData.name || ""}
                                            onChange={(e) =>
                                              setEditFormData((prev) => ({
                                                ...prev,
                                                [community.id]: { ...prev[community.id], name: e.target.value },
                                              }))
                                            }
                                            placeholder="Enter community name"
                                            className="w-full"
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-2">Code *</label>
                                          <Input
                                            value={formData.code || ""}
                                            onChange={(e) =>
                                              setEditFormData((prev) => ({
                                                ...prev,
                                                [community.id]: { ...prev[community.id], code: e.target.value },
                                              }))
                                            }
                                            placeholder="Enter unique code (6 chars max)"
                                            maxLength={6}
                                            className="w-full"
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                                          <div className="flex items-center gap-2">
                                            <Input
                                              type="color"
                                              value={formData.color || "#3B82F6"}
                                              onChange={(e) =>
                                                setEditFormData((prev) => ({
                                                  ...prev,
                                                  [community.id]: { ...prev[community.id], color: e.target.value },
                                                }))
                                              }
                                              className="w-16 h-8"
                                            />
                                            <span className="text-sm text-gray-600 font-mono">
                                              {formData.color || "#3B82F6"}
                                            </span>
                                          </div>
                                        </div>

                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Description
                                          </label>
                                          <Textarea
                                            value={formData.description || ""}
                                            onChange={(e) =>
                                              setEditFormData((prev) => ({
                                                ...prev,
                                                [community.id]: { ...prev[community.id], description: e.target.value },
                                              }))
                                            }
                                            placeholder="Enter community description"
                                            rows={3}
                                            className="w-full"
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Geographic Area (GeoJSON)
                                          </label>
                                          <Textarea
                                            value={
                                              formData.geo_json ? JSON.stringify(formData.geo_json, null, 2) : ""
                                            }
                                            onChange={(e) => {
                                              let geoValue: any | null = null
                                              if (e.target.value.trim()) {
                                                try {
                                                  geoValue = JSON.parse(e.target.value)
                                                } catch {
                                                  // Keep the raw string if JSON is invalid
                                                  geoValue = e.target.value
                                                }
                                              }
                                              setEditFormData((prev) => ({
                                                ...prev,
                                                [community.id]: {
                                                  ...prev[community.id],
                                                  geo_json: geoValue,
                                                },
                                              }))
                                            }}
                                            placeholder="Enter GeoJSON polygon data (e.g., {'type': 'Polygon', 'coordinates': [...]})"
                                            rows={8}
                                            className="w-full font-mono text-xs"
                                            style={{ height: "200px", resize: "vertical" }}
                                          />
                                          <p className="text-xs text-gray-500 mt-1">
                                            Enter valid GeoJSON polygon data to define the community's geographic
                                            boundaries
                                          </p>
                                        </div>
                                      </div>

                                      <div className="space-y-4">
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-2">Area</label>
                                          <Select
                                            value={formData.area_id || "none"}
                                            onValueChange={(value) =>
                                              setEditFormData((prev) => ({
                                                ...prev,
                                                [community.id]: {
                                                  ...prev[community.id],
                                                  area_id: value === "none" ? null : value,
                                                },
                                              }))
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select area" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="none">No area assigned</SelectItem>
                                              {areas.map((area) => (
                                                <SelectItem key={area.id} value={area.id}>
                                                  {area.name} ({area.code})
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Coordinator
                                          </label>
                                          <EmmaPeopleDropdown
                                            value={formData.coordinator_id || ""}
                                            onValueChange={(value) =>
                                              setEditFormData((prev) => ({
                                                ...prev,
                                                [community.id]: {
                                                  ...prev[community.id],
                                                  coordinator_id: value || null,
                                                },
                                              }))
                                            }
                                            placeholder="Select coordinator"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div className="space-y-4">
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                          <div className="text-sm text-gray-900">{community.name}</div>
                                        </div>

                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                                          <div className="text-sm text-gray-900">{community.code}</div>
                                        </div>

                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                                          <div className="flex items-center gap-2">
                                            <div
                                              className="w-4 h-4 rounded border border-gray-300"
                                              style={{ backgroundColor: community.color || "#3B82F6" }}
                                            />
                                            <span className="text-sm font-mono text-gray-900">
                                              {community.color || "#3B82F6"}
                                            </span>
                                          </div>
                                        </div>

                                        {community.description && (
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                              Description
                                            </label>
                                            <div className="text-sm text-gray-900">{community.description}</div>
                                          </div>
                                        )}
                                      </div>

                                      <div className="space-y-4">
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                                          <div className="text-sm text-gray-900 flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-gray-400" />
                                            {getAreaName(community.area_id)}
                                          </div>
                                        </div>

                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Coordinator
                                          </label>
                                          <div className="text-sm text-gray-900 flex items-center gap-2">
                                            <Users className="w-4 h-4 text-gray-400" />
                                            {getPersonName(community.coordinator_id)}
                                          </div>
                                        </div>

                                        {community.created_at && (
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                              Created
                                            </label>
                                            <div className="text-sm text-gray-900">
                                              {new Date(community.created_at).toLocaleString()}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {community.geo_json && (
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          Geographic Area
                                        </label>
                                        <div className="border rounded-lg overflow-hidden">
                                          <GoogleMap
                                            geoPolygon={community.geo_json}
                                            className="w-full aspect-video"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
