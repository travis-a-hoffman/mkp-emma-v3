"use client"

import { useAuth0 } from "../../lib/auth0-provider"
import { Navigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmmaPersonModal } from "../../components/emma/person-modal"
import { EmmaAddress } from "../../components/emma/address"
import { MapPin, Plus, Edit, Archive, Loader2, Eye, EyeOff, Save, X, Globe, Phone, Mail, User } from "lucide-react"
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
import { VenueMap, type VenueMapRef } from "../../components/emma/venue-map"
import type { Area } from "../../types/area"
import type { Person } from "../../types/person"
import { EmmaAreaTag } from "../../components/emma/area-tag"
import { useState, useEffect, useRef } from "react"

interface Venue {
  id: string
  name: string
  description?: string
  email?: string
  phone?: string
  website?: string
  mailing_address_id?: string
  physical_address_id?: string
  event_types: any[]
  primary_contact_id?: string
  latitude?: number
  longitude?: number
  area_id?: string
  community_id?: string
  nudity_note?: string
  rejected_note?: string
  is_nudity: boolean
  is_rejected: boolean
  is_active: boolean
  timezone?: string
  created_at: string
  updated_at: string
  mailing_address?: {
    id: string
    address_1: string
    address_2?: string
    city: string
    state: string
    postal_code: string
    country: string
  }
  physical_address?: {
    id: string
    address_1: string
    address_2?: string
    city: string
    state: string
    postal_code: string
    country: string
    street_address?: string
  }
  primary_contact?: {
    id: string
    first_name: string
    last_name: string
    email?: string
    phone?: string
    photo_url?: string
  }
  area?: {
    id: string
    name: string
    code: string
    color: string
  }
  community?: {
    id: string
    name: string
    code: string
    color: string
  }
}

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Mountain Time - Arizona (MST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
  { value: "America/Puerto_Rico", label: "Atlantic Time - Puerto Rico (AST)" },
]

interface EventType {
  id: string
  name: string
  code: string
  color?: string
  is_active: boolean
}

interface Community {
  id: string
  name: string
  code: string
  is_active: boolean
}

interface VenueApiResponse {
  data: Venue | Venue[]
  count: number
  message?: string
}

interface PersonApiResponse {
  data: Person | Person[]
  count: number
  message?: string
}

interface EventTypeApiResponse {
  data: EventType | EventType[]
  count: number
  message?: string
}

interface AreaApiResponse {
  data: Area | Area[]
  count: number
  message?: string
}

interface CommunityApiResponse {
  data: Community | Community[]
  count: number
  message?: string
}

export default function AdminVenues() {
  const { isAuthenticated, isLoading } = useAuth0()
  const [venues, setVenues] = useState<Venue[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [personModalOpen, setPersonModalOpen] = useState(false)
  const [currentPersonForModal, setCurrentPersonForModal] = useState<Person | null>(null)
  const [editingVenueForPerson, setEditingVenueForPerson] = useState<string | null>(null)
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set())
  const [editFormData, setEditFormData] = useState<Record<string, Partial<Venue>>>({})
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set())
  const [archiveConfirmation, setArchiveConfirmation] = useState<{ isOpen: boolean; venue: Venue | null }>({
    isOpen: false,
    venue: null,
  })
  const [archivingItems, setArchivingItems] = useState<Set<string>>(new Set())
  const [creatingVenue, setCreatingVenue] = useState<Venue | null>(null)
  const [eventTypesCache, setEventTypesCache] = useState<Record<string, EventType>>({})
  const venueMapRef = useRef<VenueMapRef>(null)

  const filteredVenues = venues.filter((venue) => (showArchived ? !venue.is_active : venue.is_active))
  const displayedVenues = creatingVenue && !showArchived ? [creatingVenue, ...filteredVenues] : filteredVenues

  const createVenuesOverviewMapData = () => {
    const venuesWithCoords = filteredVenues.filter((venue) => venue.latitude != null && venue.longitude != null)

    console.log("[v0] Venues overview map data:", {
      total_venues: filteredVenues.length,
      venues_with_coordinates: venuesWithCoords.length,
      venues: venuesWithCoords.map((v) => ({
        id: v.id,
        name: v.name,
        has_coordinates: !!(v.latitude && v.longitude),
        area_id: v.area_id,
      })),
    })

    return venuesWithCoords
  }

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set<string>()
      if (!prev.has(id)) {
        newSet.add(id)
        if (venueMapRef.current) {
          venueMapRef.current.centerOnVenue(id)
        }
      } else {
        if (venueMapRef.current) {
          venueMapRef.current.fitAllMarkers()
        }
      }
      return newSet
    })
  }

  const startEditing = (venue: Venue) => {
    console.log("[v0] startEditing called for venue:", venue.id)
    if (venueMapRef.current) {
      console.log("[v0] Calling centerOnVenue from startEditing")
      venueMapRef.current.centerOnVenue(venue.id)
    }

    if (editingItems.size > 0 && !editingItems.has(venue.id)) {
      return
    }

    setExpandedItems((prev) => new Set([venue.id]))
    setEditingItems((prev) => new Set(prev).add(venue.id))
    setEditFormData((prev) => ({
      ...prev,
      [venue.id]: {
        name: venue.name || "",
        description: venue.description || "",
        email: venue.email || "",
        phone: venue.phone || "",
        website: venue.website || "",
        mailing_address_id: venue.mailing_address_id || "",
        physical_address_id: venue.physical_address_id || "",
        event_types: venue.event_types || [],
        primary_contact_id: venue.primary_contact_id || "",
        latitude: venue.latitude,
        longitude: venue.longitude,
        area_id: venue.area_id || "",
        community_id: venue.community_id || "",
        nudity_note: venue.nudity_note || "",
        rejected_note: venue.rejected_note || "",
        is_nudity: venue.is_nudity || false,
        is_rejected: venue.is_rejected || false,
        is_active: venue.is_active !== false,
        timezone: venue.timezone || "America/New_York",
      },
    }))

    if (venueMapRef.current) {
      venueMapRef.current.centerOnVenue(venue.id)
    }
  }

  const createNewVenue = () => {
    const tempId = `temp-${Date.now()}`
    const newVenue: Venue = {
      id: tempId,
      name: "",
      description: "",
      email: "",
      phone: "",
      website: "",
      mailing_address_id: "",
      physical_address_id: "",
      event_types: [],
      primary_contact_id: "",
      latitude: undefined,
      longitude: undefined,
      area_id: "",
      community_id: "",
      nudity_note: "",
      rejected_note: "",
      is_nudity: false,
      is_rejected: false,
      is_active: true,
      timezone: "America/New_York",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setCreatingVenue(newVenue)
    setEditingItems((prev) => new Set(prev).add(tempId))
    setExpandedItems((prev) => new Set(prev).add(tempId))
    setEditFormData((prev) => ({
      ...prev,
      [tempId]: {
        name: "",
        description: "",
        email: "",
        phone: "",
        website: "",
        mailing_address_id: "",
        physical_address_id: "",
        event_types: [],
        primary_contact_id: "",
        latitude: undefined,
        longitude: undefined,
        area_id: "",
        community_id: "",
        nudity_note: "",
        rejected_note: "",
        is_nudity: false,
        is_rejected: false,
        is_active: true,
        timezone: "America/New_York",
      },
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

    setExpandedItems((prev) => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })

    if (creatingVenue && creatingVenue.id === id) {
      setCreatingVenue(null)
    }

    if (venueMapRef.current) {
      venueMapRef.current.fitAllMarkers()
    }
  }

  const updateFormData = (id: string, field: keyof Venue, value: string | boolean | number | null | any[]) => {
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
      const isNewVenue = creatingVenue && creatingVenue.id === id
      const url = isNewVenue ? "/api/venues" : `/api/venues/${id}`
      const method = isNewVenue ? "POST" : "PUT"

      const cleanedData = {
        name: formData.name || "",
        description: formData.description || null,
        email: formData.email || null,
        phone: formData.phone || null,
        website: formData.website || null,
        mailing_address_id: formData.mailing_address_id || null,
        physical_address_id: formData.physical_address_id || null,
        event_types: formData.event_types || [],
        primary_contact_id: formData.primary_contact_id || null,
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        area_id: formData.area_id || null,
        community_id: formData.community_id || null,
        nudity_note: formData.nudity_note || null,
        rejected_note: formData.rejected_note || null,
        is_nudity: formData.is_nudity ?? false,
        is_rejected: formData.is_rejected ?? false,
        is_active: formData.is_active ?? true,
        timezone: formData.timezone || "America/New_York",
      }

      const body = isNewVenue ? cleanedData : { id, ...cleanedData }

      console.log("[v0] Submitting venue data:", body)

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
        throw new Error(`Failed to ${isNewVenue ? "create" : "update"} venue: ${response.statusText}`)
      }

      const venueApiResponse: VenueApiResponse = await response.json()
      const savedVenue = venueApiResponse.data as Venue

      if (isNewVenue) {
        setVenues((prev) => [savedVenue, ...prev])
        setCreatingVenue(null)
        setExpandedItems((prev) => {
          const newSet = new Set(prev)
          newSet.delete(id)
          newSet.add(savedVenue.id)
          return newSet
        })
      } else {
        setVenues((prev) => prev.map((v) => (v.id === id ? savedVenue : v)))
      }

      cancelEditing(id)
    } catch (err) {
      console.error(`[v0] Error ${creatingVenue && creatingVenue.id === id ? "creating" : "updating"} venue:`, err)
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${creatingVenue && creatingVenue.id === id ? "create" : "update"} venue`,
      )
    } finally {
      setSavingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const openArchiveConfirmation = (venue: Venue) => {
    setArchiveConfirmation({ isOpen: true, venue })
  }

  const closeArchiveConfirmation = () => {
    setArchiveConfirmation({ isOpen: false, venue: null })
  }

  const archiveVenue = async () => {
    const venue = archiveConfirmation.venue
    if (!venue) return

    setArchivingItems((prev) => new Set(prev).add(venue.id))

    try {
      const response = await fetch(`/api/venues/${venue.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...venue,
          is_active: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to archive venue: ${response.statusText}`)
      }

      const venueApiResponse: VenueApiResponse = await response.json()
      setVenues((prev) => prev.map((v) => (v.id === venue.id ? (venueApiResponse.data as Venue) : v)))

      closeArchiveConfirmation()
    } catch (err) {
      console.error("[v0] Error archiving venue:", err)
      setError(err instanceof Error ? err.message : "Failed to archive venue")
    } finally {
      setArchivingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(venue.id)
        return newSet
      })
    }
  }

  const unarchiveVenue = async (venue: Venue) => {
    setArchivingItems((prev) => new Set(prev).add(venue.id))

    try {
      const response = await fetch(`/api/venues/${venue.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...venue,
          is_active: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to unarchive venue: ${response.statusText}`)
      }

      const venueApiResponse: VenueApiResponse = await response.json()
      setVenues((prev) => prev.map((v) => (v.id === venue.id ? (venueApiResponse.data as Venue) : v)))
    } catch (err) {
      console.error("[v0] Error unarchiving venue:", err)
      setError(err instanceof Error ? err.message : "Failed to unarchive venue")
    } finally {
      setArchivingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(venue.id)
        return newSet
      })
    }
  }

  const getContrastingTextColor = (backgroundColor: string): string => {
    // Remove # if present
    const hex = backgroundColor.replace("#", "")

    // Convert to RGB
    const r = Number.parseInt(hex.substr(0, 2), 16)
    const g = Number.parseInt(hex.substr(2, 2), 16)
    const b = Number.parseInt(hex.substr(4, 2), 16)

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

    // Return white for dark colors, black for light colors
    return luminance > 0.7 ? "#000000" : "#ffffff"
  }

  const getEventTypeWithColor = (eventTypeId: string) => {
    const eventType = eventTypesCache[eventTypeId] || eventTypes.find((et) => et.id === eventTypeId)
    return eventType || { id: eventTypeId, code: "UNK", color: "#6B7280" }
  }

  const getEventTypeCode = (eventTypeId: string) => {
    const eventType = eventTypesCache[eventTypeId] || eventTypes.find((et) => et.id === eventTypeId)
    return eventType?.code || "UNK"
  }

  const getEventTypeCodes = (eventTypeIds: any[]) => {
    if (!eventTypeIds || eventTypeIds.length === 0) return []
    return eventTypeIds.map((id) => getEventTypeWithColor(id)).filter((eventType) => eventType.code !== "UNK")
  }

  const getEventTypeName = (eventTypeId: string) => {
    const eventType = eventTypesCache[eventTypeId] || eventTypes.find((et) => et.id === eventTypeId)
    return eventType?.name || "Unknown Event Type"
  }

  const getEventTypeNames = (eventTypeIds: any[]) => {
    if (!eventTypeIds || eventTypeIds.length === 0) return "None specified"

    const names = eventTypeIds.map((id) => getEventTypeName(id)).filter((name) => name !== "Unknown Event Type")

    if (names.length === 0) return "None specified"
    if (names.length <= 3) return names.join(", ")
    return `${names.slice(0, 3).join(", ")}, and ${names.length - 3} more`
  }

  const PersonDisplay = ({
    personId,
    showAvatar = false,
    showContactInfo = false,
  }: { personId: string | null | undefined; showAvatar?: boolean; showContactInfo?: boolean }) => {
    if (!personId) return <span className="text-gray-500">Not assigned</span>

    const person = people.find((p) => p.id === personId)
    if (!person) return <span className="text-gray-500">Unknown person</span>

    const fullName = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ")

    if (!showAvatar) return <span>{fullName}</span>

    const getPersonInitials = (person: Person) => {
      const firstInitial = person.first_name?.charAt(0) || ""
      const lastInitial = person.last_name?.charAt(0) || ""
      return (firstInitial + lastInitial).toUpperCase()
    }

    const parsePhotoParams = (photoUrl: string | null) => {
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

    return (
      <div className="flex items-center gap-2">
        {person.photo_url ? (
          <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
            <img
              src={person.photo_url.split("?")[0] || "/placeholder.svg"}
              alt={fullName}
              className="w-full h-full object-cover"
              style={{
                objectPosition: `${parsePhotoParams(person.photo_url).x}% ${parsePhotoParams(person.photo_url).y}%`,
                transform: `scale(${parsePhotoParams(person.photo_url).zoom / 100})`,
                transformOrigin: "center",
              }}
            />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
            {getPersonInitials(person)}
          </div>
        )}
        <div className="flex flex-col">
          {showContactInfo ? (
            <div className="flex items-center gap-3">
              <span>{fullName}</span>
              {person.phone && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Phone className="w-3 h-3" />
                  <span>{person.phone}</span>
                </div>
              )}
              {person.email && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Mail className="w-3 h-3" />
                  <span>{person.email}</span>
                </div>
              )}
            </div>
          ) : (
            <span>{fullName}</span>
          )}
        </div>
      </div>
    )
  }

  const formatAddressShort = (address?: Venue["mailing_address"]) => {
    if (!address) return "Not specified"
    return `${address.city}, ${address.state}`
  }

  const formatAddress = (address?: Venue["mailing_address"]) => {
    if (!address) return "Not specified"
    const parts = [
      address.address_1,
      address.address_2,
      `${address.city}, ${address.state} ${address.postal_code}`,
      address.country,
    ].filter(Boolean)
    return parts.join(", ")
  }

  const getAreaName = (areaId?: string) => {
    if (!areaId) return "Not assigned"
    const area = areas.find((a) => a.id === areaId)
    return area ? `${area.name} (${area.code})` : "Unknown area"
  }

  const getCommunityName = (communityId?: string) => {
    if (!communityId) return "Not assigned"
    const community = communities.find((c) => c.id === communityId)
    return community ? `${community.name} (${community.code})` : "Unknown community"
  }

  const getAreaCode = (areaId: string) => {
    const area = areas.find((a) => a.id === areaId)
    return area?.code || "UNK"
  }

  const getCommunityCode = (communityId: string) => {
    const community = communities.find((c) => c.id === communityId)
    return community?.code || "UNK"
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch venues
        const venuesResponse = await fetch("/api/venues")
        if (!venuesResponse.ok) {
          throw new Error(`Failed to fetch venues: ${venuesResponse.statusText}`)
        }
        const venuesApiResponse: VenueApiResponse = await venuesResponse.json()
        setVenues(venuesApiResponse.data as Venue[])

        // Fetch people for dropdowns
        const peopleResponse = await fetch("/api/people")
        if (!peopleResponse.ok) {
          throw new Error(`Failed to fetch people: ${peopleResponse.statusText}`)
        }
        const peopleApiResponse: PersonApiResponse = await peopleResponse.json()
        setPeople(peopleApiResponse.data as Person[])

        // Fetch event types
        const eventTypesResponse = await fetch("/api/event-types")
        if (!eventTypesResponse.ok) {
          throw new Error(`Failed to fetch event types: ${eventTypesResponse.statusText}`)
        }
        const eventTypesApiResponse: EventTypeApiResponse = await eventTypesResponse.json()
        const eventTypesData = eventTypesApiResponse.data as EventType[]
        setEventTypes(eventTypesData)

        const cache: Record<string, EventType> = {}
        eventTypesData.forEach((et) => {
          cache[et.id] = et
        })
        setEventTypesCache(cache)

        const areasResponse = await fetch("/api/areas")
        if (!areasResponse.ok) {
          throw new Error(`Failed to fetch areas: ${areasResponse.statusText}`)
        }
        const areasApiResponse: AreaApiResponse = await areasResponse.json()
        setAreas(areasApiResponse.data as Area[])

        const communitiesResponse = await fetch("/api/communities")
        if (!communitiesResponse.ok) {
          throw new Error(`Failed to fetch communities: ${communitiesResponse.statusText}`)
        }
        const communitiesApiResponse: CommunityApiResponse = await communitiesResponse.json()
        setCommunities(communitiesApiResponse.data as Community[])
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

  const handleOpenPersonModal = (venueId: string, currentPersonId?: string) => {
    const currentPerson = currentPersonId ? people.find((p) => p.id === currentPersonId) || null : null
    setCurrentPersonForModal(currentPerson)
    setEditingVenueForPerson(venueId)
    setPersonModalOpen(true)
  }

  const handlePersonSelect = (person: Person | null) => {
    if (editingVenueForPerson) {
      updateFormData(editingVenueForPerson, "primary_contact_id", person?.id || null)

      if (person && !people.find((p) => p.id === person.id)) {
        setPeople((prev) => [person, ...prev])
      }
    }
    setPersonModalOpen(false)
    setCurrentPersonForModal(null)
    setEditingVenueForPerson(null)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <EmmaTitleBar title="Venues Management" backLink={{ href: "/admin", label: "Back to Admin" }} />
        <div className="p-6 pt-20">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mr-2" />
              <span className="text-lg">Loading venues...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <EmmaTitleBar title="Venues Management" backLink={{ href: "/admin", label: "Back to Admin" }} />

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
            <p className="text-gray-600">Manage event venues and locations</p>
            {!showArchived && (
              <Button onClick={createNewVenue} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create New Venue
              </Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Venues ({filteredVenues.length})</CardTitle>
                  <CardDescription>Manage venues and their details</CardDescription>
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
                        <p>{showArchived ? "Switch to active venues" : "Switch to archived venues"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const venuesWithCoords = createVenuesOverviewMapData()
                return venuesWithCoords.length > 0 ? (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-semibold">Venues Overview Map</h3>
                      <span className="text-sm text-gray-500">
                        ({venuesWithCoords.length} venue{venuesWithCoords.length !== 1 ? "s" : ""} with coordinates)
                      </span>
                    </div>
                    <VenueMap ref={venueMapRef} venues={createVenuesOverviewMapData()} areas={areas} />
                    <div className="border-b mt-6"></div>
                  </div>
                ) : null
              })()}

              {displayedVenues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <MapPin className="w-12 h-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {showArchived ? "No archived venues" : "No venues yet"}
                  </h3>
                  <p className="text-gray-500 text-center mb-4">
                    {showArchived
                      ? "There are no archived venues to display."
                      : "Get started by creating your first venue to track event locations."}
                  </p>
                  {!showArchived && (
                    <Button onClick={createNewVenue} className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Create New Venue
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {displayedVenues.map((venue) => {
                    const isExpanded = expandedItems.has(venue.id)
                    const isEditing = editingItems.has(venue.id)
                    const isSaving = savingItems.has(venue.id)
                    const isArchiving = archivingItems.has(venue.id)
                    const formData = editFormData[venue.id] || {}

                    return (
                      <Card key={venue.id} className="overflow-hidden">
                        <CardContent className="p-0">
                          {/* Collapsed View */}
                          <div className="flex items-start justify-between p-4">
                            <div className="flex items-center space-x-4 flex-1">
                              <div className="w-20 h-20 rounded-lg overflow-hidden bg-blue-100 flex items-center justify-center">
                                <MapPin className="w-8 h-8 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-lg font-semibold text-gray-900 truncate">{venue.name}</h3>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <EmmaAreaTag area={areas.find((a) => a.id === venue.area_id)} />
                                    {venue.community_id && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs bg-green-50 text-green-700 border-green-200"
                                      >
                                        {getCommunityCode(venue.community_id)}
                                      </Badge>
                                    )}
                                    {venue.is_nudity && (
                                      <Badge variant="outline" className="text-xs">
                                        Nudity✓
                                      </Badge>
                                    )}
                                    {getEventTypeCodes(venue.event_types).map((eventType) => {
                                      const backgroundColor = eventType.color || "#6B7280"
                                      const textColor = getContrastingTextColor(backgroundColor)
                                      return (
                                        <span
                                          key={eventType.code}
                                          className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium border"
                                          style={{
                                            borderColor: backgroundColor,
                                            backgroundColor: backgroundColor,
                                            color: textColor,
                                          }}
                                        >
                                          {eventType.code}
                                        </span>
                                      )
                                    })}
                                    {venue.is_rejected && (
                                      <Badge variant="destructive" className="text-xs">
                                        Rejected✓
                                      </Badge>
                                    )}
                                    {!venue.is_active && <Badge variant="secondary">Archived</Badge>}
                                  </div>
                                </div>
                                <div className="text-sm text-gray-600 space-y-1">
                                  {(venue.phone || venue.email || venue.website) && (
                                    <div className="flex items-center gap-4 flex-wrap">
                                      <span className="font-medium">Facility Contact:</span>
                                      {venue.phone && (
                                        <div className="flex items-center gap-1">
                                          <Phone className="w-3 h-3" />
                                          <span>{venue.phone}</span>
                                        </div>
                                      )}
                                      {venue.email && (
                                        <div className="flex items-center gap-1">
                                          <Mail className="w-3 h-3" />
                                          <span>{venue.email}</span>
                                        </div>
                                      )}
                                      {venue.website && (
                                        <div className="flex items-center gap-1">
                                          <Globe className="w-3 h-3" />
                                          <span className="truncate">{venue.website}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {venue.primary_contact_id && (
                                    <div className="flex items-center gap-1">
                                      <span className="font-medium">Primary Contact:</span>
                                      <PersonDisplay
                                        personId={venue.primary_contact_id}
                                        showAvatar={true}
                                        showContactInfo={true}
                                      />
                                    </div>
                                  )}
                                  {venue.physical_address && (
                                    <div className="flex items-center gap-1">
                                      <span className="font-medium">Location:</span>
                                      <MapPin className="w-3 h-3" />
                                      <span className="truncate">
                                        {[
                                          venue.physical_address.address_1,
                                          venue.physical_address.city,
                                          venue.physical_address.state,
                                          venue.physical_address.postal_code,
                                        ]
                                          .filter(Boolean)
                                          .join(", ")}
                                      </span>
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-medium">Updated:</span>{" "}
                                    {new Date(venue.updated_at).toLocaleString()}
                                  </div>
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
                                      onClick={() => toggleExpanded(venue.id)}
                                      disabled={
                                        isSaving ||
                                        isArchiving ||
                                        (editingItems.size > 0 && !editingItems.has(venue.id))
                                      }
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
                                      onClick={() => startEditing(venue)}
                                      disabled={
                                        isSaving ||
                                        isArchiving ||
                                        (editingItems.size > 0 && !editingItems.has(venue.id))
                                      }
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edit venue</p>
                                  </TooltipContent>
                                </Tooltip>
                                {venue.is_active ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openArchiveConfirmation(venue)}
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
                                      <p>Archive venue</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => unarchiveVenue(venue)}
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
                                      <p>Unarchive venue</p>
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
                                            onClick={() => saveChanges(venue.id)}
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
                                            onClick={() => cancelEditing(venue.id)}
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
                                        onChange={(e) => updateFormData(venue.id, "name", e.target.value)}
                                        placeholder="Enter venue name"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                      <Input
                                        type="email"
                                        value={formData.email || ""}
                                        onChange={(e) => updateFormData(venue.id, "email", e.target.value)}
                                        placeholder="Enter email address"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                      <Input
                                        value={formData.phone || ""}
                                        onChange={(e) => updateFormData(venue.id, "phone", e.target.value)}
                                        placeholder="Enter phone number"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                                      <Input
                                        type="url"
                                        value={formData.website || ""}
                                        onChange={(e) => updateFormData(venue.id, "website", e.target.value)}
                                        placeholder="Enter website URL"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <Textarea
                                      value={formData.description || ""}
                                      onChange={(e) => updateFormData(venue.id, "description", e.target.value)}
                                      placeholder="Enter venue description"
                                      rows={3}
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <EmmaAddress
                                      label="Mailing Address"
                                      addressId={formData.mailing_address_id}
                                      onAddressChange={(addressId) =>
                                        updateFormData(venue.id, "mailing_address_id", addressId)
                                      }
                                    />
                                    <EmmaAddress
                                      label="Physical Address"
                                      addressId={formData.physical_address_id}
                                      onAddressChange={(addressId) =>
                                        updateFormData(venue.id, "physical_address_id", addressId)
                                      }
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Primary Contact
                                      </label>
                                      <div className="flex gap-2">
                                        <Button
                                          variant="outline"
                                          onClick={() =>
                                            handleOpenPersonModal(venue.id, formData.primary_contact_id || undefined)
                                          }
                                          className="flex-1 justify-start"
                                        >
                                          <User className="w-4 h-4 mr-2" />
                                          {formData.primary_contact_id ? (
                                            <PersonDisplay personId={formData.primary_contact_id} showAvatar={false} />
                                          ) : (
                                            "Select Primary Contact"
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                                      <Select
                                        value={formData.area_id || "none"}
                                        onValueChange={(value) =>
                                          updateFormData(venue.id, "area_id", value === "none" ? null : value)
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select area" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">No area assigned</SelectItem>
                                          {areas
                                            .filter((area) => area.is_active)
                                            .map((area) => (
                                              <SelectItem key={area.id} value={area.id}>
                                                {area.name} ({area.code})
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Community</label>
                                      <Select
                                        value={formData.community_id || "none"}
                                        onValueChange={(value) =>
                                          updateFormData(venue.id, "community_id", value === "none" ? null : value)
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select community" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">No community assigned</SelectItem>
                                          {communities
                                            .filter((community) => community.is_active)
                                            .map((community) => (
                                              <SelectItem key={community.id} value={community.id}>
                                                {community.name} ({community.code})
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Timezone <span className="text-red-500">*</span>
                                      </label>
                                      <Select
                                        value={formData.timezone || "America/New_York"}
                                        onValueChange={(value) => updateFormData(venue.id, "timezone", value)}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select timezone" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {US_TIMEZONES.map((tz) => (
                                            <SelectItem key={tz.value} value={tz.value}>
                                              {tz.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Supported Event Types
                                    </label>
                                    <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                                      {eventTypes.map((eventType) => (
                                        <div key={eventType.id} className="flex items-center space-x-2">
                                          <input
                                            type="checkbox"
                                            id={`event-type-${venue.id}-${eventType.id}`}
                                            checked={(formData.event_types || []).includes(eventType.id)}
                                            onChange={(e) => {
                                              const currentTypes = formData.event_types || []
                                              const newTypes = e.target.checked
                                                ? [...currentTypes, eventType.id]
                                                : currentTypes.filter((id) => id !== eventType.id)
                                              updateFormData(venue.id, "event_types", newTypes)
                                            }}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                          />
                                          <label
                                            htmlFor={`event-type-${venue.id}-${eventType.id}`}
                                            className="text-sm text-gray-700 cursor-pointer"
                                          >
                                            ({eventType.code}) - {eventType.name}
                                          </label>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-6">
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`nudity-${venue.id}`}
                                        checked={formData.is_nudity || false}
                                        onCheckedChange={(checked) => updateFormData(venue.id, "is_nudity", checked)}
                                      />
                                      <label
                                        htmlFor={`nudity-${venue.id}`}
                                        className="text-sm font-medium text-gray-700"
                                      >
                                        Nudity?
                                      </label>
                                    </div>
                                    {formData.is_nudity && (
                                      <div>
                                        <Input
                                          value={formData.nudity_note || ""}
                                          onChange={(e) => updateFormData(venue.id, "nudity_note", e.target.value)}
                                          placeholder="Add a note about the nudity situation..."
                                        />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-6">
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`rejected-${venue.id}`}
                                        checked={formData.is_rejected || false}
                                        onCheckedChange={(checked) => updateFormData(venue.id, "is_rejected", checked)}
                                      />
                                      <label
                                        htmlFor={`rejected-${venue.id}`}
                                        className="text-sm font-medium text-gray-700"
                                      >
                                        Rejected?
                                      </label>
                                    </div>
                                    {formData.is_rejected && (
                                      <div>
                                        <Input
                                          value={formData.rejected_note || ""}
                                          onChange={(e) => updateFormData(venue.id, "rejected_note", e.target.value)}
                                          placeholder="Add a note about the reason for rejection..."
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                /* Read-only View */
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                      </label>
                                      <p className="text-sm text-gray-900">
                                        {venue.description || "No description provided"}
                                      </p>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                                      <p className="text-sm text-gray-900">
                                        {venue.timezone
                                          ? US_TIMEZONES.find((tz) => tz.value === venue.timezone)?.label ||
                                            venue.timezone
                                          : "Eastern Time (ET)"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                                      <div className="flex items-center gap-2">
                                        <EmmaAreaTag area={areas.find((a) => a.id === venue.area_id)} />
                                        <span className="text-sm text-gray-600">{getAreaName(venue.area_id)}</span>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Community</label>
                                      <p className="text-sm text-gray-900">{getCommunityName(venue.community_id)}</p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Mailing Address
                                      </label>
                                      <p className="text-sm text-gray-900">{formatAddress(venue.mailing_address)}</p>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Physical Address
                                      </label>
                                      <p className="text-sm text-gray-900">{formatAddress(venue.physical_address)}</p>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Primary Contact
                                      </label>
                                      <PersonDisplay personId={venue.primary_contact_id} showAvatar={true} />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Settings</label>
                                      <div className="flex gap-2">
                                        {venue.is_nudity && <Badge variant="outline">Nudity✓</Badge>}
                                        {venue.is_rejected && <Badge variant="destructive">Rejected✓</Badge>}
                                        {!venue.is_nudity && !venue.is_rejected && (
                                          <span className="text-sm text-gray-500">No special settings</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {(venue.nudity_note || venue.rejected_note) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {venue.nudity_note && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Nudity Note
                                          </label>
                                          <p className="text-sm text-gray-900">{venue.nudity_note}</p>
                                        </div>
                                      )}
                                      {venue.rejected_note && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Rejection Reason
                                          </label>
                                          <p className="text-sm text-gray-900">{venue.rejected_note}</p>
                                        </div>
                                      )}
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

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveConfirmation.isOpen} onOpenChange={closeArchiveConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Venue</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "{archiveConfirmation.venue?.name}"? This will hide it from the active
              venues list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeArchiveConfirmation}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={archiveVenue}>
              Archive Venue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmmaPersonModal
        isOpen={personModalOpen}
        onClose={() => {
          setPersonModalOpen(false)
          setCurrentPersonForModal(null)
          setEditingVenueForPerson(null)
        }}
        onPersonSelect={handlePersonSelect}
        currentPerson={currentPersonForModal}
        title="Manage Primary Contact"
      />
    </div>
  )
}
