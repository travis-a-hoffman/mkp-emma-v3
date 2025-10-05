"use client"

import { useAuth0 } from "../../lib/auth0-provider"
import { Navigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tags, Plus, Edit, Archive, Loader2, Eye, EyeOff, Save, X } from "lucide-react"
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
import { EmmaEventTypeTag } from "../../components/emma/eventtype"
import type { EventTypeApiResponse } from "@/api/event-types"
import { useState, useEffect } from "react"

interface EventType {
  id: string
  name: string
  description: string | null
  color: string | null
  code: string // Added code field to interface
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function AdminEventTypes() {
  const { isAuthenticated, isLoading } = useAuth0()
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set())
  const [editFormData, setEditFormData] = useState<Record<string, Partial<EventType>>>({})
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set())
  const [archiveConfirmation, setArchiveConfirmation] = useState<{ isOpen: boolean; eventType: EventType | null }>({
    isOpen: false,
    eventType: null,
  })
  const [archivingItems, setArchivingItems] = useState<Set<string>>(new Set())
  const [createDialog, setCreateDialog] = useState({ isOpen: false })
  const [createFormData, setCreateFormData] = useState({
    name: "",
    description: "",
    code: "",
    color: "#6366f1",
    is_active: true,
  })
  const [creating, setCreating] = useState(false)

  const filteredEventTypes = eventTypes.filter((eventType) =>
    showArchived ? !eventType.is_active : eventType.is_active,
  )

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

  const startEditing = (eventType: EventType) => {
    setEditingItems((prev) => new Set(prev).add(eventType.id))
    setEditFormData((prev) => ({
      ...prev,
      [eventType.id]: {
        name: eventType.name,
        description: eventType.description,
        color: eventType.color,
        code: eventType.code,
        is_active: eventType.is_active,
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
  }

  const updateFormData = (id: string, field: keyof EventType, value: string | boolean) => {
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
      const response = await fetch(`/api/event-types/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          ...formData,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to update event type: ${response.statusText}, id: ${id}`)
      }

      const etApiResponse: EventTypeApiResponse = await response.json()

      console.log("[v0] updatedEventType: ", etApiResponse.data)

      setEventTypes((prev) => prev.map((et) => (et.id === id ? (etApiResponse.data as EventType) : et)))

      cancelEditing(id)
    } catch (err) {
      console.error("[v0] Error updating event type:", err)
      setError(err instanceof Error ? err.message : "Failed to update event type")
    } finally {
      setSavingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const openArchiveConfirmation = (eventType: EventType) => {
    setArchiveConfirmation({ isOpen: true, eventType })
  }

  const closeArchiveConfirmation = () => {
    setArchiveConfirmation({ isOpen: false, eventType: null })
  }

  const archiveEventType = async () => {
    const eventType = archiveConfirmation.eventType
    if (!eventType) return

    setArchivingItems((prev) => new Set(prev).add(eventType.id))

    try {
      const response = await fetch(`/api/event-types/${eventType.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: eventType.id,
          name: eventType.name,
          description: eventType.description,
          color: eventType.color,
          code: eventType.code,
          is_active: false, // Mark as inactive instead of deleting
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to archive event type: ${response.statusText}`)
      }

      const etApiResponse: EventTypeApiResponse = await response.json()
      setEventTypes((prev) => prev.map((et) => (et.id === eventType.id ? (etApiResponse.data as EventType) : et)))

      closeArchiveConfirmation()
    } catch (err) {
      console.error("[v0] Error archiving event type:", err)
      setError(err instanceof Error ? err.message : "Failed to archive event type")
    } finally {
      setArchivingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(eventType.id)
        return newSet
      })
    }
  }

  const unarchiveEventType = async (eventType: EventType) => {
    setArchivingItems((prev) => new Set(prev).add(eventType.id))

    try {
      const response = await fetch(`/api/event-types/${eventType.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: eventType.id,
          name: eventType.name,
          description: eventType.description,
          color: eventType.color,
          code: eventType.code,
          is_active: true, // Mark as active to unarchive
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to unarchive event type: ${response.statusText}`)
      }

      const etApiResponse: EventTypeApiResponse = await response.json()
      setEventTypes((prev) => prev.map((et) => (et.id === eventType.id ? (etApiResponse.data as EventType) : et)))
    } catch (err) {
      console.error("[v0] Error unarchiving event type:", err)
      setError(err instanceof Error ? err.message : "Failed to unarchiving event type")
    } finally {
      setArchivingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(eventType.id)
        return newSet
      })
    }
  }

  const openCreateDialog = () => {
    setCreateDialog({ isOpen: true })
    setCreateFormData({
      name: "",
      description: "",
      code: "",
      color: "#6366f1",
      is_active: true,
    })
  }

  const closeCreateDialog = () => {
    setCreateDialog({ isOpen: false })
    setCreateFormData({
      name: "",
      description: "",
      code: "",
      color: "#6366f1",
      is_active: true,
    })
  }

  const updateCreateFormData = (field: string, value: string | boolean) => {
    setCreateFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const createEventType = async () => {
    if (!createFormData.name.trim() || !createFormData.code.trim()) {
      setError("Name and code are required")
      return
    }

    setCreating(true)

    try {
      const response = await fetch("/api/event-types", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createFormData),
      })

      if (!response.ok) {
        throw new Error(`Failed to create event type: ${response.statusText}`)
      }

      const etApiResponse: EventTypeApiResponse = await response.json()
      setEventTypes((prev) => [etApiResponse.data as EventType, ...prev])
      closeCreateDialog()
    } catch (err) {
      console.error("[v0] Error creating event type:", err)
      setError(err instanceof Error ? err.message : "Failed to create event type")
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/event-types")
        if (!response.ok) {
          throw new Error(`Failed to fetch event types: ${response.statusText}`)
        }
        const etApiResponse: EventTypeApiResponse = await response.json()
        console.log("[v0] Event types: eventTypes[", etApiResponse.count, "] = ", etApiResponse.data)
        setEventTypes(etApiResponse.data as EventType[])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch event types")
        console.error("[v0] Error fetching event types:", err)
      } finally {
        setLoading(false)
      }
    }

    if (isAuthenticated) {
      fetchEventTypes()
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <EmmaTitleBar title="Event Types" backLink={{ href: "/admin", label: "Back to Admin" }} />

      <div className="p-6 pt-20">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex justify-between items-center">
            <p className="text-gray-600">Manage event categories and types</p>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Create New Event Type
            </Button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Event Types ({filteredEventTypes.length})</CardTitle>
                  <CardDescription>Configure and organize different types of events in your system</CardDescription>
                </div>
                <Button variant="outline" onClick={() => setShowArchived(!showArchived)} className="ml-4">
                  {showArchived ? "Show Active" : "Show Archived"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-indigo-600 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Loading event types...</p>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <Tags className="w-16 h-16 text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Event Types</h3>
                  <p className="text-red-600 mb-4">{error}</p>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    Try Again
                  </Button>
                </div>
              ) : filteredEventTypes.length === 0 ? (
                <div className="text-center py-12">
                  <Tags className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {showArchived ? "No Archived Event Types" : "No Active Event Types Found"}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {showArchived
                      ? "No event types have been archived yet."
                      : "Get started by creating your first event type to categorize your events."}
                  </p>
                  {!showArchived && (
                    <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={openCreateDialog}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Event Type
                    </Button>
                  )}
                </div>
              ) : (
                <TooltipProvider>
                  <div className="space-y-4">
                    {filteredEventTypes.map((eventType) => {
                      const isExpanded = expandedItems.has(eventType.id)
                      const isEditing = editingItems.has(eventType.id)
                      const isSaving = savingItems.has(eventType.id)
                      const isArchiving = archivingItems.has(eventType.id)
                      const formData = editFormData[eventType.id] || eventType

                      return (
                        <div key={eventType.id} className="border rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between p-4">
                            <div className="flex items-center space-x-4 flex-1">
                              <EmmaEventTypeTag
                                code={isEditing ? formData.code || eventType.code : eventType.code}
                                color={(isEditing ? formData.color || eventType.color : eventType.color) || "#6366f1"}
                              />
                              <div className="flex-1">
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <Input
                                      value={formData.code || ""}
                                      onChange={(e) => updateFormData(eventType.id, "code", e.target.value)}
                                      placeholder="Event code"
                                      className="text-sm"
                                    />
                                    <Input
                                      value={formData.name || ""}
                                      onChange={(e) => updateFormData(eventType.id, "name", e.target.value)}
                                      placeholder="Event name"
                                      className="font-semibold"
                                    />
                                    <Input
                                      value={formData.description || ""}
                                      onChange={(e) => updateFormData(eventType.id, "description", e.target.value)}
                                      placeholder="Description (optional)"
                                      className="text-sm"
                                    />
                                    <div className="flex items-center space-x-2">
                                      <Input
                                        type="color"
                                        value={formData.color || "#6366f1"}
                                        onChange={(e) => updateFormData(eventType.id, "color", e.target.value)}
                                        className="w-16 h-8"
                                      />
                                      <label className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          checked={formData.is_active ?? true}
                                          onChange={(e) => updateFormData(eventType.id, "is_active", e.target.checked)}
                                          className="rounded"
                                        />
                                        <span className="text-sm">Active</span>
                                      </label>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <h4 className="font-semibold text-gray-900">{eventType.name}</h4>
                                    {eventType.description && (
                                      <p className="text-sm text-gray-600">{eventType.description}</p>
                                    )}
                                    <div className="flex items-center space-x-2 mt-1">
                                      <Badge variant={eventType.is_active ? "default" : "secondary"}>
                                        {eventType.is_active ? "Active" : "Inactive"}
                                      </Badge>
                                      <span className="text-xs text-gray-500">
                                        Created {new Date(eventType.created_at).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {isEditing ? (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => saveChanges(eventType.id)}
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
                                        onClick={() => cancelEditing(eventType.id)}
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
                                </>
                              ) : (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => toggleExpanded(eventType.id)}
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
                                        onClick={() => startEditing(eventType)}
                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Edit event type</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  {eventType.is_active ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => openArchiveConfirmation(eventType)}
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
                                        <p>Archive event type</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => unarchiveEventType(eventType)}
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
                                        <p>Unarchive event type</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {isExpanded && !isEditing && (
                            <div className="px-4 pb-4 border-t bg-gray-50/50">
                              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">ID</label>
                                    <p className="text-sm text-gray-600 font-mono">{eventType.id}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">Code</label>
                                    <p className="text-sm text-gray-900">{eventType.code}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">Name</label>
                                    <p className="text-sm text-gray-900">{eventType.name}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">Description</label>
                                    <p className="text-sm text-gray-900">
                                      {eventType.description || "No description provided"}
                                    </p>
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">Color</label>
                                    <div className="flex items-center space-x-2">
                                      <div
                                        className="w-4 h-4 rounded border"
                                        style={{ backgroundColor: eventType.color || "#6366f1" }}
                                      />
                                      <p className="text-sm text-gray-900 font-mono">{eventType.color || "#6366f1"}</p>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">Status</label>
                                    <p className="text-sm text-gray-900">
                                      {eventType.is_active ? "Active" : "Inactive"}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">Created</label>
                                    <p className="text-sm text-gray-900">
                                      {new Date(eventType.created_at).toLocaleString()}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">Last Updated</label>
                                    <p className="text-sm text-gray-900">
                                      {new Date(eventType.updated_at).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </TooltipProvider>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={createDialog.isOpen} onOpenChange={closeCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Event Type</DialogTitle>
            <DialogDescription>
              Add a new event type to categorize and organize your events. All fields except description are required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Code *</label>
                <Input
                  value={createFormData.code}
                  onChange={(e) => updateCreateFormData("code", e.target.value)}
                  placeholder="e.g., WS, TR, SOC"
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Color</label>
                <Input
                  type="color"
                  value={createFormData.color}
                  onChange={(e) => updateCreateFormData("color", e.target.value)}
                  className="w-full h-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Name *</label>
              <Input
                value={createFormData.name}
                onChange={(e) => updateCreateFormData("name", e.target.value)}
                placeholder="e.g., Workshop, Training, Social Event"
                className="font-semibold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <Input
                value={createFormData.description}
                onChange={(e) => updateCreateFormData("description", e.target.value)}
                placeholder="Optional description of this event type"
                className="text-sm"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={createFormData.is_active}
                onChange={(e) => updateCreateFormData("is_active", e.target.checked)}
                className="rounded"
              />
              <label className="text-sm font-medium text-gray-700">Active</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCreateDialog}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={createEventType}
              disabled={creating || !createFormData.name.trim() || !createFormData.code.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Event Type
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={archiveConfirmation.isOpen} onOpenChange={closeArchiveConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Event Type</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "{archiveConfirmation.eventType?.name}"? This will mark it as inactive
              but preserve all data. You can reactivate it later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeArchiveConfirmation}>
              Cancel
            </Button>
            <Button
              onClick={archiveEventType}
              disabled={archivingItems.has(archiveConfirmation.eventType?.id || "")}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {archivingItems.has(archiveConfirmation.eventType?.id || "") ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Archiving...
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
