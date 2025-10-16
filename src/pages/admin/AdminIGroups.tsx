"use client"

import { useAuth0 } from "../../lib/auth0-provider"
import { Navigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmmaPeopleDropdown } from "../../components/emma/people-dropdown"
import { Users, Plus, Edit, Archive, Loader2, Eye, EyeOff, Save, X, MapPin, Calendar } from "lucide-react"
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
import type { IGroup } from "../../types/group"
import type { Person } from "../../types/person"
import type { Venue } from "../../types/venue"
import type { Area } from "../../types/area"
import type { Community } from "../../types/community"
import { useState, useEffect } from "react"

interface IGroupWithRelations extends IGroup {
  venue?: Venue | null
  public_contact?: Person | null
  primary_contact?: Person | null
  area?: Area | null
  community?: Community | null
}

export default function AdminIGroups() {
  const { isAuthenticated, isLoading } = useAuth0()
  const [igroups, setIGroups] = useState<IGroupWithRelations[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set())
  const [editFormData, setEditFormData] = useState<Record<string, Partial<IGroup>>>({})
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set())
  const [archiveConfirmation, setArchiveConfirmation] = useState<{ isOpen: boolean; igroup: IGroupWithRelations | null }>(
    {
      isOpen: false,
      igroup: null,
    },
  )
  const [archivingItems, setArchivingItems] = useState<Set<string>>(new Set())
  const [creatingIGroup, setCreatingIGroup] = useState<IGroupWithRelations | null>(null)

  const filteredIGroups = igroups.filter((igroup) => (showArchived ? !igroup.is_active : igroup.is_active))
  const displayedIGroups = creatingIGroup && !showArchived ? [creatingIGroup, ...filteredIGroups] : filteredIGroups

  const activeIGroupCount = igroups.filter((g) => g.is_active).length

  const createNationalMapData = () => {
    const igroupsWithLocation = filteredIGroups.filter((igroup) => {
      return igroup.latitude != null && igroup.longitude != null
    })

    if (igroupsWithLocation.length === 0) return null

    return igroupsWithLocation.map((igroup) => ({
      lat: igroup.latitude!,
      lng: igroup.longitude!,
      title: igroup.name,
      id: igroup.id,
      info: `
        <div class="p-2 max-w-xs">
          <h3 class="font-semibold text-base mb-1">${igroup.name}</h3>
          <p class="text-sm text-gray-600 mb-2">${igroup.description || "No description"}</p>
          <div class="text-xs text-gray-500 space-y-1">
            ${igroup.status ? `<div><strong>Status:</strong> ${igroup.status}</div>` : ""}
            ${igroup.area?.name ? `<div><strong>Area:</strong> ${igroup.area.name}</div>` : ""}
            ${igroup.community?.name ? `<div><strong>Community:</strong> ${igroup.community.name}</div>` : ""}
            ${igroup.is_accepting_initiated_visitors && !igroup.is_requiring_contact_before_visiting ? '<div class="text-green-600">✓ Accepting initiated visitors</div>' : ""}
            ${igroup.is_accepting_uninitiated_visitors && !igroup.is_requiring_contact_before_visiting ? '<div class="text-green-600">✓ Accepting uninitiated visitors</div>' : ""}
            ${igroup.is_accepting_new_members ? '<div class="text-green-600">✓ Accepting new members</div>' : ""}
            ${igroup.is_publicly_listed ? "<div>Public listing</div>" : "<div>Private</div>"}
          </div>
        </div>
      `,
    }))
  }

  const nationalMapData = createNationalMapData()

  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [isAuthenticated, showArchived])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch i-groups
      const igroupsResponse = await fetch(`/api/i-groups?active=${!showArchived}`)
      if (!igroupsResponse.ok) throw new Error(`Failed to fetch i-groups: ${igroupsResponse.statusText}`)
      const igroupsResult = await igroupsResponse.json()
      const igroupsData = Array.isArray(igroupsResult.data) ? igroupsResult.data : [igroupsResult.data]
      setIGroups(igroupsData)

      // Fetch related data
      const [peopleRes, venuesRes, areasRes, communitiesRes] = await Promise.all([
        fetch("/api/people"),
        fetch("/api/venues"),
        fetch("/api/areas"),
        fetch("/api/communities"),
      ])

      if (peopleRes.ok) {
        const result = await peopleRes.json()
        setPeople(Array.isArray(result.data) ? result.data : [result.data])
      }
      if (venuesRes.ok) {
        const result = await venuesRes.json()
        setVenues(Array.isArray(result.data) ? result.data : [result.data])
      }
      if (areasRes.ok) {
        const result = await areasRes.json()
        setAreas(Array.isArray(result.data) ? result.data : [result.data])
      }
      if (communitiesRes.ok) {
        const result = await communitiesRes.json()
        setCommunities(Array.isArray(result.data) ? result.data : [result.data])
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to fetch data")
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (id: string) => {
    const newExpandedId = id === expandedItem ? null : id
    setExpandedItem(newExpandedId)
    return newExpandedId
  }

  const startEditing = (igroup: IGroupWithRelations) => {
    setExpandedItem(igroup.id)
    setEditingItems((prev) => new Set(prev).add(igroup.id))
    setEditFormData((prev) => ({
      ...prev,
      [igroup.id]: {
        name: igroup.name,
        description: igroup.description,
        url: igroup.url,
        is_accepting_new_members: igroup.is_accepting_new_members,
        membership_criteria: igroup.membership_criteria,
        venue_id: igroup.venue_id,
        genders: igroup.genders,
        is_publicly_listed: igroup.is_publicly_listed,
        public_contact_id: igroup.public_contact_id,
        primary_contact_id: igroup.primary_contact_id,
        is_accepting_initiated_visitors: igroup.is_accepting_initiated_visitors,
        is_accepting_uninitiated_visitors: igroup.is_accepting_uninitiated_visitors,
        is_requiring_contact_before_visiting: igroup.is_requiring_contact_before_visiting,
        schedule_events: igroup.schedule_events,
        schedule_description: igroup.schedule_description,
        area_id: igroup.area_id,
        community_id: igroup.community_id,
        contact_email: igroup.contact_email,
        status: igroup.status,
        affiliation: igroup.affiliation,
        is_active: igroup.is_active,
      },
    }))
  }

  const createNewIGroup = () => {
    const tempId = `temp-${Date.now()}`
    const newIGroup: IGroupWithRelations = {
      id: tempId,
      name: "",
      description: "",
      url: null,
      members: [],
      is_accepting_new_members: false,
      membership_criteria: null,
      venue_id: null,
      genders: null,
      is_publicly_listed: false,
      public_contact_id: null,
      primary_contact_id: null,
      is_accepting_initiated_visitors: false,
      is_accepting_uninitiated_visitors: false,
      is_requiring_contact_before_visiting: false,
      schedule_events: [],
      schedule_description: null,
      area_id: null,
      community_id: null,
      contact_email: null,
      status: null,
      affiliation: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setCreatingIGroup(newIGroup)
    setEditingItems((prev) => new Set(prev).add(tempId))
    setExpandedItem(tempId)
    setEditFormData((prev) => ({
      ...prev,
      [tempId]: {
        name: "",
        description: "",
        url: null,
        is_accepting_new_members: false,
        membership_criteria: null,
        venue_id: null,
        genders: null,
        is_publicly_listed: false,
        public_contact_id: null,
        primary_contact_id: null,
        is_accepting_initiated_visitors: false,
        is_accepting_uninitiated_visitors: false,
        is_requiring_contact_before_visiting: false,
        schedule_events: [],
        schedule_description: null,
        area_id: null,
        community_id: null,
        contact_email: null,
        status: null,
        affiliation: null,
        is_active: true,
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
    setExpandedItem(null)

    if (creatingIGroup && creatingIGroup.id === id) {
      setCreatingIGroup(null)
    }
  }

  const updateFormData = (id: string, field: keyof IGroup, value: any) => {
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

    if (!formData.name?.trim() || !formData.description?.trim()) {
      setError("Name and description are required")
      return
    }

    setSavingItems((prev) => new Set(prev).add(id))
    setError(null)

    try {
      const isNewIGroup = creatingIGroup && creatingIGroup.id === id
      const url = isNewIGroup ? "/api/i-groups" : `/api/i-groups/${id}`
      const method = isNewIGroup ? "POST" : "PUT"

      const cleanedData = {
        name: formData.name || "",
        description: formData.description || "",
        url: formData.url || null,
        is_accepting_new_members: formData.is_accepting_new_members ?? false,
        membership_criteria: formData.membership_criteria || null,
        venue_id: formData.venue_id || null,
        genders: formData.genders || null,
        is_publicly_listed: formData.is_publicly_listed ?? false,
        public_contact_id: formData.public_contact_id || null,
        primary_contact_id: formData.primary_contact_id || null,
        is_accepting_initiated_visitors: formData.is_accepting_initiated_visitors ?? false,
        is_accepting_uninitiated_visitors: formData.is_accepting_uninitiated_visitors ?? false,
        is_requiring_contact_before_visiting: formData.is_requiring_contact_before_visiting ?? false,
        schedule_events: formData.schedule_events || [],
        schedule_description: formData.schedule_description || null,
        area_id: formData.area_id || null,
        community_id: formData.community_id || null,
        is_active: formData.is_active ?? true,
      }

      const body = isNewIGroup ? cleanedData : { id, ...cleanedData }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Failed to ${isNewIGroup ? "create" : "update"} i-group: ${response.statusText}`)
      }

      const result = await response.json()
      const savedIGroup = result.data as IGroupWithRelations

      if (isNewIGroup) {
        setIGroups((prev) => [savedIGroup, ...prev])
        setCreatingIGroup(null)
        setExpandedItem(savedIGroup.id)
      } else {
        setIGroups((prev) => prev.map((g) => (g.id === id ? savedIGroup : g)))
      }

      cancelEditing(id)
    } catch (err) {
      console.error(`[v0] Error ${creatingIGroup && creatingIGroup.id === id ? "creating" : "updating"} i-group:`, err)
      setError(err instanceof Error ? err.message : "Failed to save changes")
    } finally {
      setSavingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const confirmArchive = (igroup: IGroupWithRelations) => {
    setArchiveConfirmation({
      isOpen: true,
      igroup: igroup,
    })
  }

  const archiveIGroup = async () => {
    if (!archiveConfirmation.igroup) return

    const igroup = archiveConfirmation.igroup
    setArchivingItems((prev) => new Set(prev).add(igroup.id))

    try {
      const response = await fetch(`/api/i-groups/${igroup.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...igroup,
          is_active: false,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to archive i-group")
      }

      setIGroups((prev) => prev.map((g) => (g.id === igroup.id ? { ...g, is_active: false } : g)))

      setArchiveConfirmation({
        isOpen: false,
        igroup: null,
      })
    } catch (err) {
      console.error("[v0] Error archiving i-group:", err)
      setError("Failed to archive i-group")
    } finally {
      setArchivingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(igroup.id)
        return newSet
      })
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <EmmaTitleBar title="I-Groups Management" backLink={{ href: "/admin", label: "Back to Admin" }} />

      <div className="p-6 pt-20">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <p className="text-gray-600">Configure and manage all Integration Groups in the system</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900">I-Groups ({activeIGroupCount})</CardTitle>
                  <CardDescription>Manage I-Groups and their details</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
                    <label htmlFor="show-archived" className="text-sm text-gray-600">
                      Show archived
                    </label>
                  </div>
                  <Button onClick={createNewIGroup} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add I-Group
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

              {!loading && nationalMapData && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">National Overview Map</h3>
                    <Badge variant="outline" className="text-xs">
                      {nationalMapData.length} i-groups with locations
                    </Badge>
                  </div>
                  <GoogleMap
                    markers={nationalMapData}
                    className="w-full aspect-video rounded border border-gray-300"
                  />
                </div>
              )}

              {loading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Loading i-groups...</div>
                </div>
              ) : displayedIGroups.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <div className="text-gray-500">
                    {showArchived ? "No archived i-groups found" : "No active i-groups found"}
                  </div>
                  {!showArchived && (
                    <Button onClick={createNewIGroup} className="mt-4">
                      <Plus className="w-4 h-4 mr-2" />
                      Create First I-Group
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {displayedIGroups.map((igroup) => {
                    const isExpanded = expandedItem === igroup.id
                    const isEditing = editingItems.has(igroup.id)
                    const isSaving = savingItems.has(igroup.id)
                    const isArchiving = archivingItems.has(igroup.id)
                    const formData = editFormData[igroup.id] || {}

                    return (
                      <Card key={igroup.id} className={`${!igroup.is_active ? "opacity-60" : ""}`}>
                        <CardContent className="p-0">
                          <div className="flex items-start justify-between p-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium text-gray-900">{igroup.name}</h3>
                                {igroup.status && (
                                  <Badge
                                    variant={igroup.status.toLowerCase() === "open" ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {igroup.status}
                                  </Badge>
                                )}
                                {igroup.area && (
                                  <Badge variant="outline" className="text-xs" style={{ borderColor: igroup.area.color || "#gray" }}>
                                    {igroup.area.code}
                                  </Badge>
                                )}
                                {igroup.community && (
                                  <Badge variant="outline" className="text-xs" style={{ borderColor: igroup.community.color || "#gray" }}>
                                    {igroup.community.code}
                                  </Badge>
                                )}
                                {!igroup.is_active && (
                                  <Badge variant="destructive" className="text-xs">
                                    Archived
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 space-y-1">
                                <div>{igroup.description}</div>
                                <div className="flex items-center gap-4">
                                  <span>Members: {igroup.members?.length || 0}</span>
                                  {igroup.is_accepting_initiated_visitors && (
                                    <Badge variant="outline" className="text-xs bg-green-50">
                                      Initiated ✓
                                    </Badge>
                                  )}
                                  {igroup.is_accepting_uninitiated_visitors && (
                                    <Badge variant="outline" className="text-xs bg-blue-50">
                                      Uninitiated ✓
                                    </Badge>
                                  )}
                                  {igroup.schedule_description && <span>{igroup.schedule_description}</span>}
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
                                      onClick={() => toggleExpanded(igroup.id)}
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
                                      onClick={() => startEditing(igroup)}
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edit I-Group</p>
                                  </TooltipContent>
                                </Tooltip>

                                {igroup.is_active && !igroup.id.startsWith("temp-") && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => confirmArchive(igroup)}
                                        disabled={isArchiving}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        {isArchiving ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Archive className="w-4 h-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Archive I-Group</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
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
                                            onClick={() => saveChanges(igroup.id)}
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
                                            onClick={() => cancelEditing(igroup.id)}
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
                                          I-Group Name *
                                        </label>
                                        <Input
                                          value={formData.name || ""}
                                          onChange={(e) => updateFormData(igroup.id, "name", e.target.value)}
                                          placeholder="Enter i-group name"
                                          className="w-full"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          Description *
                                        </label>
                                        <Textarea
                                          value={formData.description || ""}
                                          onChange={(e) => updateFormData(igroup.id, "description", e.target.value)}
                                          placeholder="Enter i-group description"
                                          rows={3}
                                          className="w-full"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          Schedule Description
                                        </label>
                                        <Textarea
                                          value={formData.schedule_description || ""}
                                          onChange={(e) =>
                                            updateFormData(igroup.id, "schedule_description", e.target.value || null)
                                          }
                                          placeholder="e.g., Weekly on Monday at 7:00 PM"
                                          rows={2}
                                          className="w-full"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          Contact Email
                                        </label>
                                        <Input
                                          value={formData.contact_email || ""}
                                          onChange={(e) => updateFormData(igroup.id, "contact_email", e.target.value || null)}
                                          placeholder="contact@example.com"
                                          className="w-full"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                                        <Input
                                          value={formData.status || ""}
                                          onChange={(e) => updateFormData(igroup.id, "status", e.target.value || null)}
                                          placeholder="e.g., Open, Closed"
                                          className="w-full"
                                        />
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-700">
                                          Accepting Initiated Visitors
                                        </label>
                                        <Switch
                                          checked={formData.is_accepting_initiated_visitors ?? false}
                                          onCheckedChange={(checked) =>
                                            updateFormData(igroup.id, "is_accepting_initiated_visitors", checked)
                                          }
                                        />
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-700">
                                          Accepting Uninitiated Visitors
                                        </label>
                                        <Switch
                                          checked={formData.is_accepting_uninitiated_visitors ?? false}
                                          onCheckedChange={(checked) =>
                                            updateFormData(igroup.id, "is_accepting_uninitiated_visitors", checked)
                                          }
                                        />
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-700">
                                          Requires Contact Before Visiting
                                        </label>
                                        <Switch
                                          checked={formData.is_requiring_contact_before_visiting ?? false}
                                          onCheckedChange={(checked) =>
                                            updateFormData(igroup.id, "is_requiring_contact_before_visiting", checked)
                                          }
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-4">
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Area</label>
                                        <Select
                                          value={formData.area_id || "none"}
                                          onValueChange={(value) =>
                                            updateFormData(igroup.id, "area_id", value === "none" ? null : value)
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select area" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">No area</SelectItem>
                                            {areas.map((area) => (
                                              <SelectItem key={area.id} value={area.id}>
                                                {area.name} ({area.code})
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Community</label>
                                        <Select
                                          value={formData.community_id || "none"}
                                          onValueChange={(value) =>
                                            updateFormData(igroup.id, "community_id", value === "none" ? null : value)
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select community" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">No community</SelectItem>
                                            {communities.map((community) => (
                                              <SelectItem key={community.id} value={community.id}>
                                                {community.name} ({community.code})
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Venue</label>
                                        <Select
                                          value={formData.venue_id || "none"}
                                          onValueChange={(value) =>
                                            updateFormData(igroup.id, "venue_id", value === "none" ? null : value)
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select venue" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">No venue</SelectItem>
                                            {venues.map((venue) => (
                                              <SelectItem key={venue.id} value={venue.id}>
                                                {venue.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          Public Contact
                                        </label>
                                        <EmmaPeopleDropdown
                                          value={formData.public_contact_id || ""}
                                          onValueChange={(value) =>
                                            updateFormData(igroup.id, "public_contact_id", value || null)
                                          }
                                          placeholder="Select public contact"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          Primary Contact
                                        </label>
                                        <EmmaPeopleDropdown
                                          value={formData.primary_contact_id || ""}
                                          onValueChange={(value) =>
                                            updateFormData(igroup.id, "primary_contact_id", value || null)
                                          }
                                          placeholder="Select primary contact"
                                        />
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-700">
                                          Accepting New Members
                                        </label>
                                        <Switch
                                          checked={formData.is_accepting_new_members ?? false}
                                          onCheckedChange={(checked) =>
                                            updateFormData(igroup.id, "is_accepting_new_members", checked)
                                          }
                                        />
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-700">Publicly Listed</label>
                                        <Switch
                                          checked={formData.is_publicly_listed ?? false}
                                          onCheckedChange={(checked) =>
                                            updateFormData(igroup.id, "is_publicly_listed", checked)
                                          }
                                        />
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-700">Active</label>
                                        <Switch
                                          checked={formData.is_active ?? true}
                                          onCheckedChange={(checked) => updateFormData(igroup.id, "is_active", checked)}
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
                                        <div className="text-sm text-gray-900">{igroup.name}</div>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          Description
                                        </label>
                                        <div className="text-sm text-gray-900">{igroup.description}</div>
                                      </div>

                                      {igroup.schedule_description && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                            <Calendar className="w-4 h-4" />
                                            Schedule
                                          </label>
                                          <div className="text-sm text-gray-900">{igroup.schedule_description}</div>
                                        </div>
                                      )}

                                      {igroup.contact_email && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Contact Email
                                          </label>
                                          <div className="text-sm text-gray-900">{igroup.contact_email}</div>
                                        </div>
                                      )}

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          Visitor Acceptance
                                        </label>
                                        <div className="flex gap-2">
                                          {igroup.is_accepting_initiated_visitors && (
                                            <Badge variant="outline" className="bg-green-50">
                                              Initiated
                                            </Badge>
                                          )}
                                          {igroup.is_accepting_uninitiated_visitors && (
                                            <Badge variant="outline" className="bg-blue-50">
                                              Uninitiated
                                            </Badge>
                                          )}
                                          {igroup.is_requiring_contact_before_visiting && (
                                            <Badge variant="outline" className="bg-yellow-50">
                                              Contact Required
                                            </Badge>
                                          )}
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Members</label>
                                        <div className="text-sm text-gray-900">{igroup.members?.length || 0}</div>
                                      </div>
                                    </div>

                                    <div className="space-y-4">
                                      {igroup.area && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                                          <div className="text-sm text-gray-900 flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-gray-400" />
                                            {igroup.area.name} ({igroup.area.code})
                                          </div>
                                        </div>
                                      )}

                                      {igroup.community && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Community
                                          </label>
                                          <div className="text-sm text-gray-900 flex items-center gap-2">
                                            <Users className="w-4 h-4 text-gray-400" />
                                            {igroup.community.name} ({igroup.community.code})
                                          </div>
                                        </div>
                                      )}

                                      {igroup.venue && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                                          <div className="text-sm text-gray-900 flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-gray-400" />
                                            {igroup.venue.name}
                                          </div>
                                        </div>
                                      )}

                                      {igroup.public_contact && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Public Contact
                                          </label>
                                          <div className="text-sm text-gray-900">
                                            {igroup.public_contact.first_name} {igroup.public_contact.last_name}
                                          </div>
                                          {igroup.public_contact.email && (
                                            <div className="text-sm text-gray-500">{igroup.public_contact.email}</div>
                                          )}
                                        </div>
                                      )}

                                      {igroup.primary_contact && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Primary Contact
                                          </label>
                                          <div className="text-sm text-gray-900">
                                            {igroup.primary_contact.first_name} {igroup.primary_contact.last_name}
                                          </div>
                                          {igroup.primary_contact.email && (
                                            <div className="text-sm text-gray-500">{igroup.primary_contact.email}</div>
                                          )}
                                        </div>
                                      )}

                                      {igroup.created_at && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                                          <div className="text-sm text-gray-900">
                                            {new Date(igroup.created_at).toLocaleString()}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
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
      <Dialog open={archiveConfirmation.isOpen} onOpenChange={(isOpen) => setArchiveConfirmation({ isOpen, igroup: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive I-Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "{archiveConfirmation.igroup?.name}"? This will hide the i-group from
              active listings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveConfirmation({ isOpen: false, igroup: null })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={archiveIGroup}>
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
