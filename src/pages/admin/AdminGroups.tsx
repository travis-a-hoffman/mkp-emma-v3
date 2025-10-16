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
import { Users, Plus, Edit, Archive, Loader2, Eye, EyeOff, Save, X, MapPin } from "lucide-react"
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
import type { Group } from "../../types/group"
import type { Person } from "../../types/person"
import type { Venue } from "../../types/venue"
import { useState, useEffect } from "react"

interface GroupWithRelations extends Group {
  venue?: Venue | null
  public_contact?: Person | null
  primary_contact?: Person | null
}

export default function AdminGroups() {
  const { isAuthenticated, isLoading } = useAuth0()
  const [groups, setGroups] = useState<GroupWithRelations[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set())
  const [editFormData, setEditFormData] = useState<Record<string, Partial<Group>>>({})
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set())
  const [archiveConfirmation, setArchiveConfirmation] = useState<{ isOpen: boolean; group: GroupWithRelations | null }>(
    {
      isOpen: false,
      group: null,
    },
  )
  const [archivingItems, setArchivingItems] = useState<Set<string>>(new Set())
  const [creatingGroup, setCreatingGroup] = useState<GroupWithRelations | null>(null)

  const filteredGroups = groups.filter((group) => (showArchived ? !group.is_active : group.is_active))
  const displayedGroups = creatingGroup && !showArchived ? [creatingGroup, ...filteredGroups] : filteredGroups

  const activeGroupCount = groups.filter((g) => g.is_active).length

  const createNationalMapData = () => {
    const groupsWithLocation = filteredGroups.filter((group) => {
      return group.latitude != null && group.longitude != null
    })

    if (groupsWithLocation.length === 0) return null

    return groupsWithLocation.map((group) => ({
      lat: group.latitude!,
      lng: group.longitude!,
      title: group.name,
      id: group.id,
      info: `
        <div class="p-2 max-w-xs">
          <h3 class="font-semibold text-base mb-1">${group.name}</h3>
          <p class="text-sm text-gray-600 mb-2">${group.description || "No description"}</p>
          <div class="text-xs text-gray-500 space-y-1">
            ${group.genders ? `<div><strong>Type:</strong> ${group.genders}</div>` : ""}
            ${group.is_accepting_new_members ? '<div class="text-green-600">✓ Accepting new members</div>' : ""}
            ${group.is_publicly_listed ? "<div>Public listing</div>" : "<div>Private</div>"}
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

      // Fetch groups
      const groupsResponse = await fetch(`/api/groups?active=${!showArchived}`)
      if (!groupsResponse.ok) throw new Error(`Failed to fetch groups: ${groupsResponse.statusText}`)
      const groupsResult = await groupsResponse.json()
      const groupsData = Array.isArray(groupsResult.data) ? groupsResult.data : [groupsResult.data]
      setGroups(groupsData)

      // Fetch related data
      const [peopleRes, venuesRes] = await Promise.all([fetch("/api/people"), fetch("/api/venues")])

      if (peopleRes.ok) {
        const result = await peopleRes.json()
        setPeople(Array.isArray(result.data) ? result.data : [result.data])
      }
      if (venuesRes.ok) {
        const result = await venuesRes.json()
        setVenues(Array.isArray(result.data) ? result.data : [result.data])
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

  const startEditing = (group: GroupWithRelations) => {
    setExpandedItem(group.id)
    setEditingItems((prev) => new Set(prev).add(group.id))
    setEditFormData((prev) => ({
      ...prev,
      [group.id]: {
        name: group.name,
        description: group.description,
        url: group.url,
        is_accepting_new_members: group.is_accepting_new_members,
        membership_criteria: group.membership_criteria,
        venue_id: group.venue_id,
        genders: group.genders,
        is_publicly_listed: group.is_publicly_listed,
        public_contact_id: group.public_contact_id,
        primary_contact_id: group.primary_contact_id,
        is_active: group.is_active,
      },
    }))
  }

  const createNewGroup = () => {
    const tempId = `temp-${Date.now()}`
    const newGroup: GroupWithRelations = {
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
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setCreatingGroup(newGroup)
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

    if (creatingGroup && creatingGroup.id === id) {
      setCreatingGroup(null)
    }
  }

  const updateFormData = (id: string, field: keyof Group, value: string | boolean | null) => {
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
      const isNewGroup = creatingGroup && creatingGroup.id === id
      const url = isNewGroup ? "/api/groups" : `/api/groups/${id}`
      const method = isNewGroup ? "POST" : "PUT"

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
        is_active: formData.is_active ?? true,
      }

      const body = isNewGroup ? cleanedData : { id, ...cleanedData }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Failed to ${isNewGroup ? "create" : "update"} group: ${response.statusText}`)
      }

      const result = await response.json()
      const savedGroup = result.data as GroupWithRelations

      if (isNewGroup) {
        setGroups((prev) => [savedGroup, ...prev])
        setCreatingGroup(null)
        setExpandedItem(savedGroup.id)
      } else {
        setGroups((prev) => prev.map((g) => (g.id === id ? savedGroup : g)))
      }

      cancelEditing(id)
    } catch (err) {
      console.error(`[v0] Error ${creatingGroup && creatingGroup.id === id ? "creating" : "updating"} group:`, err)
      setError(err instanceof Error ? err.message : "Failed to save changes")
    } finally {
      setSavingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const confirmArchive = (group: GroupWithRelations) => {
    setArchiveConfirmation({
      isOpen: true,
      group: group,
    })
  }

  const archiveGroup = async () => {
    if (!archiveConfirmation.group) return

    const group = archiveConfirmation.group
    setArchivingItems((prev) => new Set(prev).add(group.id))

    try {
      const response = await fetch(`/api/groups/${group.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...group,
          is_active: false,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to archive group")
      }

      setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, is_active: false } : g)))

      setArchiveConfirmation({
        isOpen: false,
        group: null,
      })
    } catch (err) {
      console.error("[v0] Error archiving group:", err)
      setError("Failed to archive group")
    } finally {
      setArchivingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(group.id)
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
      <EmmaTitleBar title="Groups Management" backLink={{ href: "/admin", label: "Back to Admin" }} />

      <div className="p-6 pt-20">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <p className="text-gray-600">Configure and manage all groups in the system</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900">Groups ({activeGroupCount})</CardTitle>
                  <CardDescription>Manage groups and their details</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
                    <label htmlFor="show-archived" className="text-sm text-gray-600">
                      Show archived
                    </label>
                  </div>
                  <Button onClick={createNewGroup} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Group
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
                      {nationalMapData.length} groups with locations
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
                  <div className="text-gray-500">Loading groups...</div>
                </div>
              ) : displayedGroups.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <div className="text-gray-500">
                    {showArchived ? "No archived groups found" : "No active groups found"}
                  </div>
                  {!showArchived && (
                    <Button onClick={createNewGroup} className="mt-4">
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Group
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {displayedGroups.map((group) => {
                    const isExpanded = expandedItem === group.id
                    const isEditing = editingItems.has(group.id)
                    const isSaving = savingItems.has(group.id)
                    const isArchiving = archivingItems.has(group.id)
                    const formData = editFormData[group.id] || {}

                    return (
                      <Card key={group.id} className={`${!group.is_active ? "opacity-60" : ""}`}>
                        <CardContent className="p-0">
                          <div className="flex items-start justify-between p-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium text-gray-900">{group.name}</h3>
                                {group.genders && (
                                  <Badge variant="secondary" className="text-xs">
                                    {group.genders}
                                  </Badge>
                                )}
                                {group.is_accepting_new_members && (
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                    Accepting Members
                                  </Badge>
                                )}
                                {!group.is_active && (
                                  <Badge variant="destructive" className="text-xs">
                                    Archived
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 space-y-1">
                                <div>{group.description}</div>
                                <div className="flex items-center gap-4">
                                  <span>Members: {group.members?.length || 0}</span>
                                  {group.venue && <span>Venue: {group.venue.name}</span>}
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
                                      onClick={() => toggleExpanded(group.id)}
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
                                      onClick={() => startEditing(group)}
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edit Group</p>
                                  </TooltipContent>
                                </Tooltip>

                                {group.is_active && !group.id.startsWith("temp-") && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => confirmArchive(group)}
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
                                      <p>Archive Group</p>
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
                                            onClick={() => saveChanges(group.id)}
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
                                            onClick={() => cancelEditing(group.id)}
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
                                          Group Name *
                                        </label>
                                        <Input
                                          value={formData.name || ""}
                                          onChange={(e) => updateFormData(group.id, "name", e.target.value)}
                                          placeholder="Enter group name"
                                          className="w-full"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          Description *
                                        </label>
                                        <Textarea
                                          value={formData.description || ""}
                                          onChange={(e) => updateFormData(group.id, "description", e.target.value)}
                                          placeholder="Enter group description"
                                          rows={3}
                                          className="w-full"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">URL</label>
                                        <Input
                                          value={formData.url || ""}
                                          onChange={(e) => updateFormData(group.id, "url", e.target.value || null)}
                                          placeholder="https://example.com"
                                          className="w-full"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Genders</label>
                                        <Input
                                          value={formData.genders || ""}
                                          onChange={(e) => updateFormData(group.id, "genders", e.target.value || null)}
                                          placeholder="e.g., Men's, Mixed Gender"
                                          className="w-full"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          Membership Criteria
                                        </label>
                                        <Textarea
                                          value={formData.membership_criteria || ""}
                                          onChange={(e) =>
                                            updateFormData(group.id, "membership_criteria", e.target.value || null)
                                          }
                                          placeholder="Enter membership requirements"
                                          rows={3}
                                          className="w-full"
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-4">
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Venue</label>
                                        <Select
                                          value={formData.venue_id || "none"}
                                          onValueChange={(value) =>
                                            updateFormData(group.id, "venue_id", value === "none" ? null : value)
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
                                            updateFormData(group.id, "public_contact_id", value || null)
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
                                            updateFormData(group.id, "primary_contact_id", value || null)
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
                                            updateFormData(group.id, "is_accepting_new_members", checked)
                                          }
                                        />
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-700">Publicly Listed</label>
                                        <Switch
                                          checked={formData.is_publicly_listed ?? false}
                                          onCheckedChange={(checked) =>
                                            updateFormData(group.id, "is_publicly_listed", checked)
                                          }
                                        />
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-700">Active</label>
                                        <Switch
                                          checked={formData.is_active ?? true}
                                          onCheckedChange={(checked) => updateFormData(group.id, "is_active", checked)}
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
                                        <div className="text-sm text-gray-900">{group.name}</div>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          Description
                                        </label>
                                        <div className="text-sm text-gray-900">{group.description}</div>
                                      </div>

                                      {group.url && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                                          <a
                                            href={group.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-600 hover:underline"
                                          >
                                            {group.url}
                                          </a>
                                        </div>
                                      )}

                                      {group.membership_criteria && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Membership Criteria
                                          </label>
                                          <div className="text-sm text-gray-900">{group.membership_criteria}</div>
                                        </div>
                                      )}

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Members</label>
                                        <div className="text-sm text-gray-900">{group.members?.length || 0}</div>
                                      </div>
                                    </div>

                                    <div className="space-y-4">
                                      {group.venue && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                                          <div className="text-sm text-gray-900 flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-gray-400" />
                                            {group.venue.name}
                                          </div>
                                        </div>
                                      )}

                                      {group.public_contact && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Public Contact
                                          </label>
                                          <div className="text-sm text-gray-900">
                                            {group.public_contact.first_name} {group.public_contact.last_name}
                                          </div>
                                          {group.public_contact.email && (
                                            <div className="text-sm text-gray-500">{group.public_contact.email}</div>
                                          )}
                                        </div>
                                      )}

                                      {group.primary_contact && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Primary Contact
                                          </label>
                                          <div className="text-sm text-gray-900">
                                            {group.primary_contact.first_name} {group.primary_contact.last_name}
                                          </div>
                                          {group.primary_contact.email && (
                                            <div className="text-sm text-gray-500">{group.primary_contact.email}</div>
                                          )}
                                        </div>
                                      )}

                                      {group.created_at && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                                          <div className="text-sm text-gray-900">
                                            {new Date(group.created_at).toLocaleString()}
                                          </div>
                                        </div>
                                      )}

                                      {group.updated_at && (
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Updated</label>
                                          <div className="text-sm text-gray-900">
                                            {new Date(group.updated_at).toLocaleString()}
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
      <Dialog open={archiveConfirmation.isOpen} onOpenChange={(isOpen) => setArchiveConfirmation({ isOpen, group: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "{archiveConfirmation.group?.name}"? This will hide the group from active
              listings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveConfirmation({ isOpen: false, group: null })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={archiveGroup}>
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
