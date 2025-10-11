"use client"

import { useAuth0 } from "../../lib/auth0-provider"
import { Navigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EmmaPeopleDropdown } from "../../components/emma/people-dropdown"
import { EmmaAreaImageUploadModal } from "../../components/emma/area-image-upload-modal"
import { Map, Plus, Edit, Archive, Loader2, Eye, EyeOff, Save, X, Upload, Crop, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { EmmaTitleBar } from "../../components/emma/titlebar"
import { GoogleMap } from "../../components/emma/google-map"
import type { Area } from "../../types/area"
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

interface AreaApiResponse {
  data: Area | Area[]
  count: number
  message?: string
}

interface PersonApiResponse {
  data: Person | Person[]
  count: number
  message?: string
}

export default function AdminAreas() {
  const { isAuthenticated, isLoading } = useAuth0()
  const [areas, setAreas] = useState<Area[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set())
  const [editFormData, setEditFormData] = useState<Record<string, Partial<Area>>>({})
  const [editAdmins, setEditAdmins] = useState<Record<string, Area["admins"]>>({})
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set())
  const [archiveConfirmation, setArchiveConfirmation] = useState<{ isOpen: boolean; area: Area | null }>({
    isOpen: false,
    area: null,
  })
  const [archivingItems, setArchivingItems] = useState<Set<string>>(new Set())
  const [creatingArea, setCreatingArea] = useState<Area | null>(null)
  const [peopleCache, setPeopleCache] = useState<Record<string, Person>>({})
  const [imageUploadModal, setImageUploadModal] = useState<{
    isOpen: boolean
    areaId: string | null
    cropMode: boolean
  }>({
    isOpen: false,
    areaId: null,
    cropMode: false,
  })

  const filteredAreas = areas.filter((area) => (showArchived ? !area.is_active : area.is_active))
  const displayedAreas = creatingArea && !showArchived ? [creatingArea, ...filteredAreas] : filteredAreas

  const createNationalOverviewMapData = () => {
    const areasWithGeo = filteredAreas.filter((area) => area.geo_json)

    if (areasWithGeo.length === 0) return null

    console.log("[v0] Creating national overview map with", areasWithGeo.length, "areas")

    const features = areasWithGeo
      .map((area) => {
        console.log("[v0] Processing area:", area.name, "geo_json type:", typeof area.geo_json)

        let geometry
        if (area.geo_json.type === "FeatureCollection") {
          // Extract the first feature's geometry from the FeatureCollection
          geometry = area.geo_json.features?.[0]?.geometry
          console.log("[v0] Extracted geometry from FeatureCollection for area:", area.name)
        } else if (area.geo_json.type === "Polygon") {
          // Use the polygon directly
          geometry = area.geo_json
          console.log("[v0] Using direct Polygon for area:", area.name)
        } else {
          console.warn("[v0] Unknown geo_json type for area:", area.name, area.geo_json.type)
          return null
        }

        return {
          type: "Feature",
          properties: {
            name: area.name,
            code: area.code,
            id: area.id,
          },
          geometry: geometry,
        }
      })
      .filter(Boolean)

    const featureCollection = {
      type: "FeatureCollection",
      features: features,
    }

    console.log("[v0] Created national overview FeatureCollection with", features.length, "features")
    return featureCollection
  }

  const nationalOverviewMapData = createNationalOverviewMapData()

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const startEditing = (area: Area) => {
    setExpandedItems((prev) => new Set(prev).add(area.id))
    setEditingItems((prev) => new Set(prev).add(area.id))
    setEditFormData((prev) => ({
      ...prev,
      [area.id]: {
        name: area.name,
        code: area.code,
        description: area.description,
        steward_id: area.steward_id,
        finance_coordinator_id: area.finance_coordinator_id,
        geo_json: area.geo_json,
        image_url: area.image_url,
        is_active: area.is_active,
      },
    }))
    setEditAdmins((prev) => ({
      ...prev,
      [area.id]: area.admins || [],
    }))
  }

  const createNewArea = () => {
    const tempId = `temp-${Date.now()}`
    const newArea: Area = {
      id: tempId,
      name: "",
      code: "",
      description: null,
      steward_id: null,
      finance_coordinator_id: null,
      geo_json: null,
      image_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setCreatingArea(newArea)
    setEditingItems((prev) => new Set(prev).add(tempId))
    setExpandedItems((prev) => new Set(prev).add(tempId))
    setEditFormData((prev) => ({
      ...prev,
      [tempId]: {
        name: "",
        code: "",
        description: "",
        steward_id: null,
        finance_coordinator_id: null,
        geo_json: null,
        image_url: null,
        is_active: true,
      },
    }))
    setEditAdmins((prev) => ({
      ...prev,
      [tempId]: [],
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
    setEditAdmins((prev) => {
      const newData = { ...prev }
      delete newData[id]
      return newData
    })

    if (creatingArea && creatingArea.id === id) {
      setCreatingArea(null)
      setExpandedItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const updateFormData = (id: string, field: keyof Area, value: string | boolean | null) => {
    setEditFormData((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }))
  }

  const saveChanges = async (id: string) => {
    const formData = editFormData[id]
    if (!formData) return

    setSavingItems((prev) => new Set(prev).add(id))

    try {
      const isNewArea = creatingArea && creatingArea.id === id
      const url = isNewArea ? "/api/areas" : `/api/areas/${id}`
      const method = isNewArea ? "POST" : "PUT"

      const cleanedData = {
        name: formData.name || "",
        code: formData.code || "",
        description: formData.description || null,
        steward_id: formData.steward_id || null,
        finance_coordinator_id: formData.finance_coordinator_id || null,
        geo_json: formData.geo_json || null,
        image_url: formData.image_url || null,
        color: formData.color || null,
        is_active: formData.is_active ?? true,
      }

      const body = isNewArea ? cleanedData : { id, ...cleanedData }

      console.log("[v0] Submitting area data:", body)

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("[v0] API Error Response:", errorData)
        throw new Error(`Failed to ${isNewArea ? "create" : "update"} area: ${response.statusText}`)
      }

      const areaApiResponse: AreaApiResponse = await response.json()
      const savedArea = areaApiResponse.data as Area

      const currentAdmins = editAdmins[id] || []
      const adminIds = currentAdmins.map((admin) => admin.id)

      if (!isNewArea && adminIds.length >= 0) {
        try {
          const adminsResponse = await fetch(`/api/areas/${savedArea.id}/admins`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ admin_ids: adminIds }),
          })

          if (!adminsResponse.ok) {
            console.error("[v0] Failed to update area admins")
          }
        } catch (adminError) {
          console.error("[v0] Error updating area admins:", adminError)
        }
      }

      const completeArea = {
        ...savedArea,
        admins: currentAdmins,
      }

      if (isNewArea) {
        if (adminIds.length > 0) {
          try {
            await fetch(`/api/areas/${savedArea.id}/admins`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ admin_ids: adminIds }),
            })
          } catch (adminError) {
            console.error("[v0] Error setting admins for new area:", adminError)
          }
        }

        setAreas((prev) => [completeArea, ...prev])
        setCreatingArea(null)
        setExpandedItems((prev) => {
          const newSet = new Set(prev)
          newSet.delete(id)
          newSet.add(savedArea.id)
          return newSet
        })
      } else {
        setAreas((prev) => prev.map((a) => (a.id === id ? completeArea : a)))
      }

      cancelEditing(id)
    } catch (err) {
      console.error(`[v0] Error ${creatingArea && creatingArea.id === id ? "creating" : "updating"} area:`, err)
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${creatingArea && creatingArea.id === id ? "create" : "update"} area`,
      )
    } finally {
      setSavingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const openImageUpload = (areaId: string, cropMode = false) => {
    if (areaId.startsWith("temp-")) {
      setError("Please save the area first before uploading an image.")
      return
    }
    setImageUploadModal({ isOpen: true, areaId, cropMode })
  }

  const closeImageUpload = () => {
    setImageUploadModal({ isOpen: false, areaId: null, cropMode: false })
  }

  const handleImageUpload = async (file: File, positioning: { x: number; y: number; zoom: number }) => {
    const areaId = imageUploadModal.areaId
    if (!areaId) return

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("positioning", JSON.stringify(positioning))

      const response = await fetch(`/api/areas/${areaId}/image`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Failed to upload image: ${response.statusText}`)
      }

      const result = await response.json()

      // Update the area's image_url in state
      setAreas((prev) => prev.map((a) => (a.id === areaId ? { ...a, image_url: result.url } : a)))

      // Update form data if area is being edited
      if (editingItems.has(areaId)) {
        setEditFormData((prev) => ({
          ...prev,
          [areaId]: {
            ...prev[areaId],
            image_url: result.url,
          },
        }))
      }

      console.log("[v0] Area image uploaded successfully:", result)
    } catch (error) {
      console.error("[v0] Error uploading area image:", error)
      throw error
    }
  }

  const handleImageCrop = async (areaId: string, positioning: { x: number; y: number; zoom: number }) => {
    try {
      const formData = new FormData()
      formData.append("positioning", JSON.stringify(positioning))

      const response = await fetch(`/api/areas/${areaId}/image`, {
        method: "PUT",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Failed to crop image: ${response.statusText}`)
      }

      const result = await response.json()

      // Update the area's image_url in state
      setAreas((prev) => prev.map((a) => (a.id === areaId ? { ...a, image_url: result.url } : a)))

      // Update form data if area is being edited
      if (editingItems.has(areaId)) {
        setEditFormData((prev) => ({
          ...prev,
          [areaId]: {
            ...prev[areaId],
            image_url: result.url,
          },
        }))
      }

      console.log("[v0] Area image cropped successfully:", result)
    } catch (error) {
      console.error("[v0] Error cropping area image:", error)
      throw error
    }
  }

  const handleImageDelete = async (areaId: string) => {
    if (areaId.startsWith("temp-")) {
      setError("Please save the area first before managing images.")
      return
    }

    try {
      const response = await fetch(`/api/areas/${areaId}/image`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error(`Failed to delete image: ${response.statusText}`)
      }

      // Update the area's image_url in state
      setAreas((prev) => prev.map((a) => (a.id === areaId ? { ...a, image_url: null } : a)))

      // Update form data if area is being edited
      if (editingItems.has(areaId)) {
        setEditFormData((prev) => ({
          ...prev,
          [areaId]: {
            ...prev[areaId],
            image_url: null,
          },
        }))
      }

      console.log("[v0] Area image deleted successfully")
    } catch (error) {
      console.error("[v0] Error deleting area image:", error)
      setError(error instanceof Error ? error.message : "Failed to delete image")
    }
  }

  const openArchiveConfirmation = (area: Area) => {
    setArchiveConfirmation({ isOpen: true, area })
  }

  const closeArchiveConfirmation = () => {
    setArchiveConfirmation({ isOpen: false, area: null })
  }

  const archiveArea = async () => {
    const area = archiveConfirmation.area
    if (!area) return

    setArchivingItems((prev) => new Set(prev).add(area.id))

    try {
      const response = await fetch(`/api/areas/${area.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...area,
          is_active: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to archive area: ${response.statusText}`)
      }

      const areaApiResponse: AreaApiResponse = await response.json()
      setAreas((prev) => prev.map((a) => (a.id === area.id ? (areaApiResponse.data as Area) : a)))

      closeArchiveConfirmation()
    } catch (err) {
      console.error("[v0] Error archiving area:", err)
      setError(err instanceof Error ? err.message : "Failed to archive area")
    } finally {
      setArchivingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(area.id)
        return newSet
      })
    }
  }

  const unarchiveArea = async (area: Area) => {
    setArchivingItems((prev) => new Set(prev).add(area.id))

    try {
      const response = await fetch(`/api/areas/${area.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...area,
          is_active: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to unarchive area: ${response.statusText}`)
      }

      const areaApiResponse: AreaApiResponse = await response.json()
      setAreas((prev) => prev.map((a) => (a.id === area.id ? (areaApiResponse.data as Area) : a)))
    } catch (err) {
      console.error("[v0] Error unarchiving area:", err)
      setError(err instanceof Error ? err.message : "Failed to unarchive area")
    } finally {
      setArchivingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(area.id)
        return newSet
      })
    }
  }

  const getPersonName = (personId: string | null | undefined) => {
    if (!personId) return "Not assigned"
    const person = people.find((p) => p.id === personId)
    if (!person) return "Unknown person"
    const parts = [person.first_name, person.middle_name, person.last_name].filter(Boolean)
    return parts.join(" ")
  }

  const getActivePeople = () => {
    return people.filter((person) => person.is_active)
  }

  const getAdminNames = (admins?: Area["admins"]) => {
    if (!admins || admins.length === 0) return "None assigned"

    const displayAdmins = admins.slice(0, 3)
    const adminNames = displayAdmins
      .map((admin) => {
        const parts = [admin.first_name, admin.middle_name, admin.last_name].filter(Boolean)
        return parts.join(" ")
      })
      .join(", ")

    if (admins.length > 3) {
      return `${adminNames}, and ${admins.length - 3} more`
    }

    return adminNames
  }

  const getAdminInitials = (admin: NonNullable<Area["admins"]>[0]) => {
    const firstInitial = admin.first_name?.charAt(0) || ""
    const lastInitial = admin.last_name?.charAt(0) || ""
    return (firstInitial + lastInitial).toUpperCase()
  }

  const getPersonInitials = (person: Person) => {
    const firstInitial = person.first_name?.charAt(0) || ""
    const lastInitial = person.last_name?.charAt(0) || ""
    return (firstInitial + lastInitial).toUpperCase()
  }

  const parsePhotoParams = (photoUrl: string | null | undefined) => {
    if (!photoUrl) return { x: 50, y: 50, zoom: 100 }

    try {
      const url = new URL(photoUrl)
      const x = Number.parseFloat(url.searchParams.get("x") || "50")
      const y = Number.parseFloat(url.searchParams.get("y") || "50")
      const zoom = Number.parseFloat(url.searchParams.get("zoom") || "100")
      return { x, y, zoom }
    } catch {
      return { x: 50, y: 50, zoom: 100 }
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch areas
        const areasResponse = await fetch("/api/areas")
        if (!areasResponse.ok) {
          throw new Error(`Failed to fetch areas: ${areasResponse.statusText}`)
        }
        const areasApiResponse: AreaApiResponse = await areasResponse.json()
        setAreas(areasApiResponse.data as Area[])

        // Fetch people for dropdowns
        const peopleResponse = await fetch("/api/people")
        if (!peopleResponse.ok) {
          throw new Error(`Failed to fetch people: ${peopleResponse.statusText}`)
        }
        const peopleApiResponse: PersonApiResponse = await peopleResponse.json()
        const fetchedPeople = peopleApiResponse.data as Person[]
        setPeople(fetchedPeople)

        // Create a cache of people for quick access
        const peopleCache: Record<string, Person> = {}
        fetchedPeople.forEach((person) => {
          peopleCache[person.id] = person
        })
        setPeopleCache(peopleCache)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data")
        console.error("[v0] Error fetching data:", err)
      } finally {
        setLoading(false)
      }
    }

    if (isAuthenticated) {
      fetchData()
    }
  }, [isAuthenticated])

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <EmmaTitleBar title="Areas Management" backLink={{ href: "/admin", label: "Back to Admin" }} />
        <div className="p-6 pt-20">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mr-2" />
              <span className="text-lg">Loading areas...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const addAdmin = (areaId: string, person: any) => {
    const admin = {
      id: person.id,
      first_name: person.first_name,
      middle_name: person.middle_name || undefined,
      last_name: person.last_name,
      email: "", // Will be populated from API
      photo_url: undefined,
    }

    setEditAdmins((prev) => ({
      ...prev,
      [areaId]: [...(prev[areaId] || []), admin],
    }))
  }

  const removeAdmin = (areaId: string, adminId: string) => {
    setEditAdmins((prev) => ({
      ...prev,
      [areaId]: (prev[areaId] || []).filter((admin) => admin.id !== adminId),
    }))
  }

  const isPersonAlreadyAdmin = (areaId: string, personId: string) => {
    const currentAdmins = editAdmins[areaId] || []
    return currentAdmins.some((admin) => admin.id === personId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted0">
      <EmmaTitleBar title="Areas Management" backLink={{ href: "/admin", label: "Back to Admin" }} />

      <div className="p-6 pt-20">
        <div className="max-w-6xl mx-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
              <Button variant="outline" size="sm" className="mt-2 bg-transparent" onClick={() => setError(null)}>
                Dismiss
              </Button>
            </div>
          )}

          <div className="mb-8 flex justify-between items-center">
            <p className="text-gray-600">Configure and organize different areas in the system</p>
            {!showArchived && (
              <Button onClick={createNewArea} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create New Area
              </Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Areas ({filteredAreas.length})</CardTitle>
                  <CardDescription>Manage areas and their details</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowArchived(!showArchived)}
                          className="flex items-center gap-2"
                        >
                          {showArchived ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{showArchived ? "Switch to active areas" : "Switch to archived areas"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {nationalOverviewMapData && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Map className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">National Overview Map</h3>
                    <Badge variant="outline" className="text-xs">
                      {filteredAreas.filter((area) => area.geo_json).length} areas
                    </Badge>
                  </div>
                  <GoogleMap
                    geoPolygon={nationalOverviewMapData}
                    className="w-full aspect-video rounded border border-gray-300"
                    key={`national-overview-${filteredAreas.filter((area) => area.geo_json).length}`}
                  />
                </div>
              )}

              {displayedAreas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Map className="w-12 h-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {showArchived ? "No archived areas" : "No areas yet"}
                  </h3>
                  <p className="text-gray-500 text-center mb-4">
                    {showArchived
                      ? "There are no archived areas to display."
                      : "Get started by creating your first area."}
                  </p>
                  {!showArchived && (
                    <Button onClick={createNewArea} className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add First Area
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {displayedAreas.map((area) => {
                    const isExpanded = expandedItems.has(area.id)
                    const isEditing = editingItems.has(area.id)
                    const isSaving = savingItems.has(area.id)
                    const isArchiving = archivingItems.has(area.id)
                    const formData = editFormData[area.id] || {}

                    return (
                      <Card key={area.id} className="overflow-hidden">
                        <CardContent className="p-0">
                          {/* Collapsed View */}
                          <div className="flex items-start justify-between p-4">
                            <div className="flex items-center space-x-4 flex-1">
                              <div className="w-20 h-20 rounded-lg overflow-hidden bg-purple-100 flex items-center justify-center">
                                {area.image_url ? (
                                  <img
                                    src={area.image_url || "/placeholder.svg"}
                                    alt={`${area.name} area map`}
                                    className="w-full h-full object-cover"
                                    style={{
                                      objectPosition:
                                        area.image_url?.includes("x=") && area.image_url?.includes("y=")
                                          ? `${new URL(area.image_url).searchParams.get("x") || 50}% ${new URL(area.image_url).searchParams.get("y") || 50}%`
                                          : "center",
                                    }}
                                  />
                                ) : (
                                  <Map className="w-8 h-8 text-purple-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-lg font-semibold text-gray-900 truncate">{area.name}</h3>
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {area.code}
                                  </Badge>
                                  {!area.is_active && <Badge variant="secondary">Archived</Badge>}
                                </div>
                                <div className="text-sm text-gray-600 space-y-1">
                                  <div>
                                    <span className="font-medium">Steward:</span>{" "}
                                    {getPersonName(area.steward_id || undefined)}
                                  </div>
                                  <div>
                                    <span className="font-medium">Finance Coordinator:</span>{" "}
                                    {getPersonName(area.finance_coordinator_id)}
                                  </div>
                                  <div>
                                    <span className="font-medium">Admins:</span>{" "}
                                    {getAdminNames(area.admins || undefined)}
                                  </div>
                                  {area.updated_at && (
                                    <div>
                                      <span className="font-medium">Updated:</span>{" "}
                                      {new Date(area.updated_at).toLocaleString()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => toggleExpanded(area.id)}
                                      disabled={isSaving || isArchiving}
                                      className="text-gray-600 hover:text-gray-700"
                                    >
                                      {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{isExpanded ? "Hide details" : "Show details"}</p>
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => startEditing(area)}
                                      disabled={isArchiving}
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edit area</p>
                                  </TooltipContent>
                                </Tooltip>
                                {area.is_active ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openArchiveConfirmation(area)}
                                        disabled={isArchiving}
                                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 bg-transparent"
                                      >
                                        {isArchiving ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Archive className="w-4 h-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Archive area</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => unarchiveArea(area)}
                                        disabled={isArchiving}
                                        className="text-green-600 hover:text-green-700 hover:bg-green-50 bg-transparent"
                                      >
                                        {isArchiving ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Archive className="w-4 h-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Unarchive area</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </TooltipProvider>
                            </div>
                          </div>

                          {/* Expanded View */}
                          {isExpanded && (
                            <div className="border-t bg-gray-50 p-4">
                              {isEditing ? (
                                /* Edit Form */
                                <div className="space-y-4">
                                  <div className="flex items-center justify-end gap-2 pb-2 border-b">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => saveChanges(area.id)}
                                            disabled={isSaving}
                                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
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
                                            onClick={() => cancelEditing(area.id)}
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

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Name <span className="text-red-500">*</span>
                                      </label>
                                      <Input
                                        value={formData.name || ""}
                                        onChange={(e) => updateFormData(area.id, "name", e.target.value)}
                                        placeholder="Enter area name"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Code <span className="text-red-500">*</span>
                                      </label>
                                      <Input
                                        value={formData.code || ""}
                                        onChange={(e) => updateFormData(area.id, "code", e.target.value)}
                                        placeholder="Enter area code (max 6 chars)"
                                        maxLength={6}
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                                      <div className="flex items-center gap-2">
                                        <Input
                                          type="color"
                                          value={formData.color || "#3B82F6"}
                                          onChange={(e) => updateFormData(area.id, "color", e.target.value)}
                                          className="w-16 h-8"
                                        />
                                        <span className="text-sm text-gray-600 font-mono">
                                          {formData.color || "#3B82F6"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Steward</label>
                                      <EmmaPeopleDropdown
                                        value={formData.steward_id || null}
                                        onValueChange={(value: string | null) =>
                                          updateFormData(area.id, "steward_id", value)
                                        }
                                        placeholder="Search for steward..."
                                        allowClear={true}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Finance Coordinator
                                      </label>
                                      <EmmaPeopleDropdown
                                        value={formData.finance_coordinator_id || null}
                                        onValueChange={(value: string | null) =>
                                          updateFormData(area.id, "finance_coordinator_id", value)
                                        }
                                        placeholder="Search for finance coordinator..."
                                        allowClear={true}
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <Textarea
                                      value={formData.description || ""}
                                      onChange={(e) => updateFormData(area.id, "description", e.target.value)}
                                      placeholder="Enter area description"
                                      rows={3}
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Area Image</label>
                                    <div className="space-y-3">
                                      {/* Current Image Display */}
                                      {(formData.image_url || area.image_url) && (
                                        <div className="flex items-center gap-4 p-3 bg-white rounded-lg border">
                                          <div className="w-16 h-9 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                                            <img
                                              src={formData.image_url || area.image_url || "/placeholder.svg"}
                                              alt="Area preview"
                                              className="w-full h-full object-cover"
                                              style={{
                                                objectPosition:
                                                  (formData.image_url || area.image_url)?.includes("x=") &&
                                                  (formData.image_url || area.image_url)?.includes("y=")
                                                    ? `${new URL(formData.image_url || area.image_url || "").searchParams.get("x") || 50}% ${new URL(formData.image_url || area.image_url || "").searchParams.get("y") || 50}%`
                                                    : "center",
                                              }}
                                            />
                                          </div>
                                          <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-900">Area border image</div>
                                            <div className="text-xs text-gray-500">Click to edit positioning</div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Image Management Buttons */}
                                      <div className="flex items-center gap-2">
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openImageUpload(area.id, false)}
                                                disabled={area.id.startsWith("temp-")}
                                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                              >
                                                <Upload className="w-4 h-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>{area.id.startsWith("temp-") ? "Save area first" : "Upload Image"}</p>
                                            </TooltipContent>
                                          </Tooltip>

                                          {(formData.image_url || area.image_url) && (
                                            <>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openImageUpload(area.id, true)}
                                                    disabled={area.id.startsWith("temp-")}
                                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                  >
                                                    <Crop className="w-4 h-4" />
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>
                                                    {area.id.startsWith("temp-") ? "Save area first" : "Edit Image"}
                                                  </p>
                                                </TooltipContent>
                                              </Tooltip>

                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleImageDelete(area.id)}
                                                    disabled={area.id.startsWith("temp-")}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                  >
                                                    <Trash2 className="w-4 h-4" />
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>
                                                    {area.id.startsWith("temp-") ? "Save area first" : "Remove Image"}
                                                  </p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </>
                                          )}
                                        </TooltipProvider>
                                      </div>

                                      {!formData.image_url && !area.image_url && (
                                        <p className="text-xs text-gray-500">No area image uploaded</p>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Geographic Polygon (JSON)
                                    </label>
                                    <Textarea
                                      value={formData.geo_json ? JSON.stringify(formData.geo_json, null, 2) : ""}
                                      onChange={(e) => {
                                        try {
                                          const parsed = e.target.value ? JSON.parse(e.target.value) : null
                                          updateFormData(area.id, "geo_json", parsed)
                                        } catch {
                                          // Invalid JSON, keep the string value for now
                                          updateFormData(area.id, "geo_json", e.target.value)
                                        }
                                      }}
                                      placeholder="Enter GeoJSON polygon data"
                                      rows={5}
                                      className="h-64 resize-none"
                                    />
                                  </div>
                                </div>
                              ) : (
                                /* Details View */
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                      <h4 className="font-medium text-gray-900 mb-2">Basic Information</h4>
                                      <div className="space-y-2 text-sm">
                                        <div>
                                          <span className="font-medium text-gray-700">Name:</span>
                                          <span className="ml-2 text-gray-900">{area.name}</span>
                                        </div>
                                        <div>
                                          <span className="font-medium text-gray-700">Code:</span>
                                          <span className="ml-2 font-mono text-gray-900">{area.code}</span>
                                        </div>
                                        <div>
                                          <span className="font-medium text-gray-700">Color:</span>
                                          <div className="ml-2 flex items-center gap-2">
                                            <div
                                              className="w-4 h-4 rounded border border-gray-300"
                                              style={{ backgroundColor: area.color || "#3B82F6" }}
                                            />
                                            <span className="font-mono text-gray-900">{area.color || "#3B82F6"}</span>
                                          </div>
                                        </div>
                                        {area.description && (
                                          <div>
                                            <span className="font-medium text-gray-700">Description:</span>
                                            <span className="ml-2 text-gray-900">{area.description}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="font-medium text-gray-900 mb-2">Assignments</h4>
                                      <div className="space-y-2 text-sm">
                                        <div>
                                          <span className="font-medium text-gray-700">Steward:</span>
                                          {area.steward_id && peopleCache[area.steward_id] ? (
                                            <div className="mt-2">
                                              <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center">
                                                  {peopleCache[area.steward_id].photo_url ? (
                                                    <img
                                                      src={
                                                        peopleCache[area.steward_id].photo_url?.split("?")[0] ||
                                                        "/placeholder.svg" ||
                                                        "/placeholder.svg" ||
                                                        "/placeholder.svg" ||
                                                        "/placeholder.svg" ||
                                                        "/placeholder.svg" ||
                                                        "/placeholder.svg" ||
                                                        "/placeholder.svg" ||
                                                        "/placeholder.svg" ||
                                                        "/placeholder.svg"
                                                      }
                                                      alt={getPersonName(area.steward_id)}
                                                      className="w-full h-full object-cover"
                                                      style={{
                                                        objectPosition: `${parsePhotoParams(peopleCache[area.steward_id].photo_url).x}% ${parsePhotoParams(peopleCache[area.steward_id].photo_url).y}%`,
                                                        transform: `scale(${parsePhotoParams(peopleCache[area.steward_id].photo_url).zoom / 100})`,
                                                        transformOrigin: "center",
                                                      }}
                                                    />
                                                  ) : (
                                                    <span className="text-xs font-medium text-blue-600">
                                                      {getPersonInitials(peopleCache[area.steward_id])}
                                                    </span>
                                                  )}
                                                </div>
                                                <div>
                                                  <div className="text-sm font-medium text-gray-900">
                                                    {getPersonName(area.steward_id)}
                                                  </div>
                                                  {peopleCache[area.steward_id].email && (
                                                    <div className="text-xs text-gray-500">
                                                      {peopleCache[area.steward_id].email}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ) : (
                                            <span className="ml-2 text-gray-500 italic">No steward assigned</span>
                                          )}
                                        </div>
                                        <div>
                                          <span className="font-medium text-gray-700">Finance Coordinator:</span>
                                          {area.finance_coordinator_id && peopleCache[area.finance_coordinator_id] ? (
                                            <div className="mt-2">
                                              <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center">
                                                  {peopleCache[area.finance_coordinator_id].photo_url ? (
                                                    <img
                                                      src={
                                                        peopleCache[area.finance_coordinator_id].photo_url?.split(
                                                          "?",
                                                        )[0] || "/placeholder.svg"
                                                      }
                                                      alt={getPersonName(area.finance_coordinator_id)}
                                                      className="w-full h-full object-cover"
                                                      style={{
                                                        objectPosition: `${parsePhotoParams(peopleCache[area.finance_coordinator_id].photo_url).x}% ${parsePhotoParams(peopleCache[area.finance_coordinator_id].photo_url).y}%`,
                                                        transform: `scale(${parsePhotoParams(peopleCache[area.finance_coordinator_id].photo_url).zoom / 100})`,
                                                        transformOrigin: "center",
                                                      }}
                                                    />
                                                  ) : (
                                                    <span className="text-xs font-medium text-blue-600">
                                                      {getPersonInitials(peopleCache[area.finance_coordinator_id])}
                                                    </span>
                                                  )}
                                                </div>
                                                <div>
                                                  <div className="text-sm font-medium text-gray-900">
                                                    {getPersonName(area.finance_coordinator_id)}
                                                  </div>
                                                  {peopleCache[area.finance_coordinator_id].email && (
                                                    <div className="text-xs text-gray-500">
                                                      {peopleCache[area.finance_coordinator_id].email}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ) : (
                                            <span className="ml-2 text-gray-500 italic">
                                              No finance coordinator assigned
                                            </span>
                                          )}
                                        </div>
                                        <div>
                                          <span className="font-medium text-gray-700">Area Admins:</span>
                                          {area.admins && area.admins.length > 0 ? (
                                            <div className="mt-2 space-y-2">
                                              {area.admins.map((admin) => {
                                                const photoParams = parsePhotoParams(admin.photo_url)
                                                const adminName = [admin.first_name, admin.middle_name, admin.last_name]
                                                  .filter(Boolean)
                                                  .join(" ")

                                                return (
                                                  <div key={admin.id} className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center">
                                                      {admin.photo_url ? (
                                                        <img
                                                          src={admin.photo_url.split("?")[0] || "/placeholder.svg"}
                                                          alt={adminName}
                                                          className="w-full h-full object-cover"
                                                          style={{
                                                            objectPosition: `${photoParams.x}% ${photoParams.y}%`,
                                                            transform: `scale(${photoParams.zoom / 100})`,
                                                            transformOrigin: "center",
                                                          }}
                                                        />
                                                      ) : (
                                                        <span className="text-xs font-medium text-blue-600">
                                                          {getAdminInitials(admin)}
                                                        </span>
                                                      )}
                                                    </div>
                                                    <div>
                                                      <div className="text-sm font-medium text-gray-900">
                                                        {adminName}
                                                      </div>
                                                      {admin.email && (
                                                        <div className="text-xs text-gray-500">{admin.email}</div>
                                                      )}
                                                    </div>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          ) : (
                                            <span className="ml-2 text-gray-500 italic">No admins assigned</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  {area.geo_json && (
                                    <div>
                                      <h4 className="font-medium text-gray-900 mb-2">Geographic Data</h4>
                                      <GoogleMap
                                        geoPolygon={area.geo_json}
                                        className="w-full h-128 rounded border border-gray-300"
                                      />
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
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <EmmaAreaImageUploadModal
        isOpen={imageUploadModal.isOpen}
        onClose={closeImageUpload}
        onUpload={handleImageUpload}
        onCrop={handleImageCrop}
        areaId={imageUploadModal.areaId}
        cropMode={imageUploadModal.cropMode}
        existingImageUrl={
          (imageUploadModal.areaId && areas.find((a) => a.id === imageUploadModal.areaId)?.image_url) || null
        }
      />

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveConfirmation.isOpen} onOpenChange={closeArchiveConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Area</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "{archiveConfirmation.area?.name}"? This will hide it from the active
              areas list, but you can restore it later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeArchiveConfirmation}>
              Cancel
            </Button>
            <Button onClick={archiveArea} className="bg-orange-600 hover:bg-orange-700">
              Archive Area
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
