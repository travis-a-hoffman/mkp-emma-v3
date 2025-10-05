"use client"

import type React from "react"
import { useState } from "react"

import { Archive, Crown, Hourglass, Loader2, Plus, Save, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { EmmaPersonDisplay } from "@/src/components/emma/person-display"
import { EmmaCalendar } from "../../components/emma/calendar"
import { EmmaTimeline } from "../../components/emma/timeline"
import { EmmaTransactionTable } from "../../components/emma/transaction-table"
import type { NwtaEventWithRelations } from "../../types/nwta-event"
import type { Area } from "../../types/area"
import type { Community } from "../../types/community"
import type { Person } from "../../types/person"
import type { Transaction } from "../../types/transaction"

interface EventType {
  id: string
  name: string
  code: string
  color: string
  is_active: boolean
}

interface Venue {
  id: string
  name: string
  phone?: string
  email?: string
  website?: string
  timezone?: string
  is_active: boolean
}

interface AdminNwtaEventEditViewProps {
  event: NwtaEventWithRelations
  isSaving: boolean
  isArchiving: boolean
  saveChanges: (id: string) => Promise<void>
  cancelEditing: (id: string) => void
  openArchiveConfirmation: (event: NwtaEventWithRelations) => void
  openStaffModal: (eventId: string) => void
  handleOpenLeaderPersonModal: (eventId: string, currentPersonId?: string) => void
  openParticipantModal: (eventId: string) => void
  moveStaffMember: (
    eventId: string,
    personId: string,
    fromList: "potential_staff" | "committed_staff" | "alternate_staff",
    toList: "potential_staff" | "committed_staff" | "alternate_staff",
  ) => void
  removeStaffMember: (
    eventId: string,
    personId: string,
    fromList: "potential_staff" | "committed_staff" | "alternate_staff",
  ) => void
  formData: Partial<NwtaEventWithRelations>
  setEditFormData: React.Dispatch<React.SetStateAction<Record<string, Partial<NwtaEventWithRelations>>>>
  eventTypes: EventType[]
  areas: Area[]
  communities: Community[]
  venues: Venue[]
  people: Person[]
}

export default function AdminNwtaEventEditView({
  event,
  isSaving,
  isArchiving,
  saveChanges,
  cancelEditing,
  openArchiveConfirmation,
  openStaffModal,
  handleOpenLeaderPersonModal,
  openParticipantModal,
  moveStaffMember,
  removeStaffMember,
  formData,
  setEditFormData,
  eventTypes,
  areas,
  communities,
  venues,
  people,
}: AdminNwtaEventEditViewProps) {
  const [error, setError] = useState<string | null>(null)
  const [selectedTimelineEvents, setSelectedTimelineEvents] = useState<Record<string, number>>({})

  console.log("[v0] AdminNwtaEventEditView formData:", formData)
  console.log("[v0] staff_published_time:", formData.staff_published_time)
  console.log("[v0] participant_published_time:", formData.participant_published_time)

  const getPersonById = (personId: string) => {
    return people.find((p) => p.id === personId)
  }

  const addStaffToLeaders = (eventId: string, personId: string) => {
    if (!event) return

    // Don't add if person is already primary leader
    if (event.primary_leader_id === personId) return

    const updatedEvent = { ...event }
    if (!updatedEvent.leaders.includes(personId)) {
      updatedEvent.leaders = [...updatedEvent.leaders, personId]
    }

    setEditFormData((prev) => {
      if (prev[eventId]) {
        const currentFormData = prev[eventId]
        const currentLeaders = currentFormData.leaders || []

        return {
          ...prev,
          [eventId]: {
            ...currentFormData,
            leaders: currentLeaders.includes(personId) ? currentLeaders : [...currentLeaders, personId],
          },
        }
      }
      return prev
    })
  }

  const handleTransactionCreate = async (
    ev: NwtaEventWithRelations,
    newTransaction: Omit<Transaction, "id" | "created_at" | "updated_at">,
  ) => {
    try {
      newTransaction.log_id = ev.transaction_log_id
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTransaction),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create transaction")
      }

      const createdTransaction = await response.json()
      console.log("[v0] Transaction created successfully:", createdTransaction.data)
    } catch (error) {
      console.error("[v0] Error creating transaction:", error)
      setError(error instanceof Error ? error.message : "Failed to create transaction")
    }
  }

  const handleTransactionUpdate = async (eventId: string, updatedTransaction: Transaction) => {
    try {
      const response = await fetch(`/api/transactions/${updatedTransaction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTransaction),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update transaction")
      }

      const updated = await response.json()
      console.log("[v0] Transaction updated successfully:", updated.data)
    } catch (error) {
      console.error("[v0] Error updating transaction:", error)
      setError(error instanceof Error ? error.message : "Failed to update transaction")
    }
  }

  const handleTransactionDelete = async (eventId: string, transactionId: string) => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete transaction")
      }

      console.log("[v0] Transaction deleted successfully:", transactionId)
    } catch (error) {
      console.error("[v0] Error deleting transaction:", error)
      setError(error instanceof Error ? error.message : "Failed to delete transaction")
    }
  }

  const moveParticipantMember = (
    eventId: string,
    personId: string,
    fromList: "potential_participants" | "committed_participants" | "waitlist_participants",
    toList: "potential_participants" | "committed_participants" | "waitlist_participants",
  ) => {
    setEditFormData((prev) => {
      if (prev[eventId]) {
        const currentFormData = prev[eventId]
        const currentFromList = currentFormData[fromList] || []
        const currentToList = currentFormData[toList] || []

        return {
          ...prev,
          [eventId]: {
            ...currentFormData,
            [fromList]: currentFromList.filter((id: string) => id !== personId),
            [toList]: currentToList.includes(personId) ? currentToList : [...currentToList, personId],
          },
        }
      }
      return prev
    })
  }

  const removeParticipantMember = (
    eventId: string,
    personId: string,
    fromList: "potential_participants" | "committed_participants" | "waitlist_participants",
  ) => {
    setEditFormData((prev) => {
      if (prev[eventId]) {
        const currentFormData = prev[eventId]
        const currentFromList = currentFormData[fromList] || []

        return {
          ...prev,
          [eventId]: {
            ...currentFormData,
            [fromList]: currentFromList.filter((id: string) => id !== personId),
          },
        }
      }
      return prev
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2 pb-2 border-b">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            console.log("[v0] About to save, current formData:", formData)
            console.log("[v0] staff_published_time before save:", formData.staff_published_time)
            console.log("[v0] participant_published_time before save:", formData.participant_published_time)
            saveChanges(event.id)
          }}
          disabled={isSaving}
          className="text-green-600 hover:text-green-700 hover:bg-green-50 bg-transparent"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => cancelEditing(event.id)}
          disabled={isSaving}
          className="text-gray-600 hover:text-gray-700"
        >
          <X className="w-4 h-4" />
        </Button>
        {event.is_active && (
          <Button size="sm" variant="outline" onClick={() => openArchiveConfirmation(event)} disabled={isArchiving}>
            {isArchiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Event Name *</label>
            <Input
              value={formData.name || ""}
              onChange={(e) =>
                setEditFormData((prev) => ({
                  ...prev,
                  [event.id]: { ...prev[event.id], name: e.target.value },
                }))
              }
              placeholder="Enter event name"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <Textarea
              value={formData.description || ""}
              onChange={(e) =>
                setEditFormData((prev) => ({
                  ...prev,
                  [event.id]: { ...prev[event.id], description: e.target.value },
                }))
              }
              placeholder="Enter event description"
              rows={3}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
            <Select
              value={formData.event_type_id || "none"}
              onValueChange={(value: string) =>
                setEditFormData((prev) => ({
                  ...prev,
                  [event.id]: { ...prev[event.id], event_type_id: value },
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No event type</SelectItem>
                {eventTypes
                  .filter((et) => et.is_active && et.code !== "NWTA")
                  .map((eventType) => (
                    <SelectItem key={eventType.id} value={eventType.id}>
                      ({eventType.code}) - {eventType.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Area</label>
            <Select
              value={formData.area_id || "none"}
              onValueChange={(value: string) =>
                setEditFormData((prev) => ({
                  ...prev,
                  [event.id]: { ...prev[event.id], area_id: value },
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No area assigned</SelectItem>
                {areas
                  .filter((a) => a.is_active)
                  .map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name} {area.code ? `(${area.code})` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Community</label>
            <Select
              value={formData.community_id || "none"}
              onValueChange={(value: string) =>
                setEditFormData((prev) => ({
                  ...prev,
                  [event.id]: { ...prev[event.id], community_id: value },
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select community" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No community assigned</SelectItem>
                {communities
                  .filter((c) => c.is_active)
                  .map((community) => (
                    <SelectItem key={community.id} value={community.id}>
                      {community.name} {community.code ? `(${community.code})` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Venue</label>
            <Select
              value={formData.venue_id || "none"}
              onValueChange={(value: string) =>
                setEditFormData((prev) => ({
                  ...prev,
                  [event.id]: { ...prev[event.id], venue_id: value },
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select venue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No venue assigned</SelectItem>
                {venues
                  .filter((v) => v.is_active)
                  .map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                id={`published-${event.id}`}
                checked={formData.is_published || false}
                onCheckedChange={(checked) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    [event.id]: {
                      ...prev[event.id],
                      is_published: checked,
                    },
                  }))
                }
              />
              <label htmlFor={`published-${event.id}`} className="text-sm font-medium">
                Published
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-lg font-medium text-gray-900">Publication Management</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Staff Open Application Dates */}
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h5 className="font-medium text-blue-900">Staff Open Application Dates</h5>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={
                    formData.staff_published_time?.start
                      ? new Date(formData.staff_published_time.start).toISOString().slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const newStart = e.target.value ? new Date(e.target.value).toISOString() : null
                    const currentEnd = formData.staff_published_time?.end || null
                    const eventStartTime = event.participant_schedule?.[0]?.start

                    if (newStart && currentEnd && new Date(newStart) >= new Date(currentEnd)) {
                      setError("Staff application start date must be before end date")
                      return
                    }

                    if (newStart && eventStartTime && new Date(newStart) >= new Date(eventStartTime)) {
                      setError("Staff application start date must be before event start time")
                      return
                    }

                    setError(null)
                    const newPublishedTime =
                      newStart || currentEnd
                        ? {
                            start: newStart || "",
                            end: currentEnd || "",
                          }
                        : null

                    console.log("[v0] Setting staff_published_time:", newPublishedTime)

                    setEditFormData((prev) => ({
                      ...prev,
                      [event.id]: {
                        ...prev[event.id],
                        staff_published_time: newPublishedTime,
                      },
                    }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date & Time</label>
                <input
                  type="datetime-local"
                  value={
                    formData.staff_published_time?.end
                      ? new Date(formData.staff_published_time.end).toISOString().slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const newEnd = e.target.value ? new Date(e.target.value).toISOString() : null
                    const currentStart = formData.staff_published_time?.start || null
                    const eventStartTime = event.participant_schedule?.[0]?.start

                    if (newEnd && currentStart && new Date(newEnd) <= new Date(currentStart)) {
                      setError("Staff application end date must be after start date")
                      return
                    }

                    if (newEnd && eventStartTime && new Date(newEnd) >= new Date(eventStartTime)) {
                      setError("Staff application end date must be before event start time")
                      return
                    }

                    setError(null)
                    const newPublishedTime =
                      currentStart || newEnd
                        ? {
                            start: currentStart || "",
                            end: newEnd || "",
                          }
                        : null

                    console.log("[v0] Setting staff_published_time:", newPublishedTime)

                    setEditFormData((prev) => ({
                      ...prev,
                      [event.id]: {
                        ...prev[event.id],
                        staff_published_time: newPublishedTime,
                      },
                    }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Participant Open Application Dates */}
          <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <h5 className="font-medium text-green-900">Participant Open Application Dates</h5>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={
                    formData.participant_published_time?.start
                      ? new Date(formData.participant_published_time.start).toISOString().slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const newStart = e.target.value ? new Date(e.target.value).toISOString() : null
                    const currentEnd = formData.participant_published_time?.end || null
                    const eventStartTime = event.participant_schedule?.[0]?.start

                    if (newStart && currentEnd && new Date(newStart) >= new Date(currentEnd)) {
                      setError("Participant application start date must be before end date")
                      return
                    }

                    if (newStart && eventStartTime && new Date(newStart) >= new Date(eventStartTime)) {
                      setError("Participant application start date must be before event start time")
                      return
                    }

                    setError(null)
                    const newPublishedTime =
                      newStart || currentEnd
                        ? {
                            start: newStart || "",
                            end: currentEnd || "",
                          }
                        : null

                    console.log("[v0] Setting participant_published_time:", newPublishedTime)

                    setEditFormData((prev) => ({
                      ...prev,
                      [event.id]: {
                        ...prev[event.id],
                        participant_published_time: newPublishedTime,
                      },
                    }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date & Time</label>
                <input
                  type="datetime-local"
                  value={
                    formData.participant_published_time?.end
                      ? new Date(formData.participant_published_time.end).toISOString().slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const newEnd = e.target.value ? new Date(e.target.value).toISOString() : null
                    const currentStart = formData.participant_published_time?.start || null
                    const eventStartTime = event.participant_schedule?.[0]?.start

                    if (newEnd && currentStart && new Date(newEnd) <= new Date(currentStart)) {
                      setError("Participant application end date must be after start date")
                      return
                    }

                    if (newEnd && eventStartTime && new Date(newEnd) >= new Date(eventStartTime)) {
                      setError("Participant application end date must be before event start time")
                      return
                    }

                    setError(null)
                    const newPublishedTime =
                      currentStart || newEnd
                        ? {
                            start: currentStart || "",
                            end: newEnd || "",
                          }
                        : null

                    console.log("[v0] Setting participant_published_time:", newPublishedTime)

                    setEditFormData((prev) => ({
                      ...prev,
                      [event.id]: {
                        ...prev[event.id],
                        participant_published_time: newPublishedTime,
                      },
                    }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium text-gray-900">Staff Management</h4>
        <Button onClick={() => openStaffModal(event.id)} size="sm" className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Staff
        </Button>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-3 gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Staff Cost</label>
            <Input
              type="number"
              value={formData.staff_cost ? formData.staff_cost / 100 : 0}
              onChange={(e) =>
                setEditFormData((prev) => ({
                  ...prev,
                  [event.id]: {
                    ...prev[event.id],
                    staff_cost: Math.round(Number.parseFloat(e.target.value || "0") * 100),
                  },
                }))
              }
              placeholder="0.00"
              step="0.01"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Staff Capacity</label>
            <Input
              type="number"
              value={formData.staff_capacity || 0}
              onChange={(e) =>
                setEditFormData((prev) => ({
                  ...prev,
                  [event.id]: {
                    ...prev[event.id],
                    staff_capacity: Number.parseInt(e.target.value || "0"),
                  },
                }))
              }
              placeholder="0"
              className="w-full"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Primary Leader</label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenLeaderPersonModal(event.id, formData.primary_leader_id || undefined)}
              className="flex-1 justify-start"
            >
              {formData.primary_leader_id ? (
                <EmmaPersonDisplay
                  personId={formData.primary_leader_id}
                  people={people}
                  showAvatar={true}
                  size="w-6 h-6"
                />
              ) : (
                "Select Primary Leader"
              )}
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="font-medium text-gray-700">Co-Leaders</h5>
            <Badge variant="outline" className="text-xs">
              {event.leaders.length}
            </Badge>
          </div>
          <div className="space-y-2 min-h-[100px] bg-gray-50 rounded-lg p-3">
            {event.leaders.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4">No event co-leaders chosen</div>
            ) : (
              event.leaders.map((personId) => {
                const person = getPersonById(personId)
                if (!person) return null
                return (
                  <div key={personId} className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <EmmaPersonDisplay personId={personId} people={people} showAvatar={true} size="w-6 h-6" />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-medium text-gray-700">Potential Staff</h5>
              <Badge variant="outline" className="text-xs">
                {event.potential_staff.length}
              </Badge>
            </div>
            <div className="space-y-2 min-h-[100px] bg-gray-50 rounded-lg p-3">
              {event.potential_staff.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No potential staff</div>
              ) : (
                event.potential_staff.map((personId) => {
                  const person = getPersonById(personId)
                  if (!person) return null
                  return (
                    <div key={personId} className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                      <div className="flex items-center gap-2">
                        <EmmaPersonDisplay person={person} size="w-6 h-6" showAvatar={true} />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveStaffMember(event.id, personId, "potential_staff", "committed_staff")}
                          className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                          title="Move to Committed"
                        >
                          ✓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveStaffMember(event.id, personId, "potential_staff", "alternate_staff")}
                          className="h-6 w-6 p-0 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                          title="Move to Alternate"
                        >
                          <Hourglass className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeStaffMember(event.id, personId, "potential_staff")}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Remove"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-medium text-gray-700">Committed Staff</h5>
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                {event.committed_staff.length}
                {event.staff_capacity > 0 && ` / ${event.staff_capacity}`}
              </Badge>
            </div>
            <div className="space-y-2 min-h-[100px] bg-green-50 rounded-lg p-3">
              {event.committed_staff.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No committed staff</div>
              ) : (
                event.committed_staff.map((personId) => {
                  const person = getPersonById(personId)
                  if (!person) return null
                  return (
                    <div key={personId} className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                      <div className="flex items-center gap-2">
                        <EmmaPersonDisplay person={person} size="w-6 h-6" showAvatar={true} />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveStaffMember(event.id, personId, "committed_staff", "potential_staff")}
                          className="h-6 w-6 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                          title="Move to Potential"
                        >
                          ?
                        </Button>
                        {formData.primary_leader_id !== personId && !event.leaders.includes(personId) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addStaffToLeaders(event.id, personId)}
                            className="h-6 w-6 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            title="Add to Leaders"
                          >
                            <Crown className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveStaffMember(event.id, personId, "committed_staff", "alternate_staff")}
                          className="h-6 w-6 p-0 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                          title="Move to Alternate"
                        >
                          <Hourglass className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeStaffMember(event.id, personId, "committed_staff")}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Remove"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-medium text-gray-700">Alternate Staff</h5>
              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                {event.alternate_staff.length}
              </Badge>
            </div>
            <div className="space-y-2 min-h-[100px] bg-yellow-50 rounded-lg p-3">
              {event.alternate_staff.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No alternate staff</div>
              ) : (
                event.alternate_staff.map((personId) => {
                  const person = getPersonById(personId)
                  if (!person) return null
                  return (
                    <div key={personId} className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                      <div className="flex items-center gap-2">
                        <EmmaPersonDisplay person={person} size="w-6 h-6" showAvatar={true} />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveStaffMember(event.id, personId, "alternate_staff", "committed_staff")}
                          className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                          title="Move to Committed"
                        >
                          ✓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeStaffMember(event.id, personId, "alternate_staff")}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Remove"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium text-gray-900">Participant Management</h4>
        <Button onClick={() => openParticipantModal(event.id)} size="sm" className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Participant
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Participant Cost</label>
          <Input
            type="number"
            value={formData.participant_cost ? formData.participant_cost / 100 : 0}
            onChange={(e) =>
              setEditFormData((prev) => ({
                ...prev,
                [event.id]: {
                  ...prev[event.id],
                  participant_cost: Math.round(Number.parseFloat(e.target.value || "0") * 100),
                },
              }))
            }
            placeholder="0.00"
            step="0.01"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Participant Capacity</label>
          <Input
            type="number"
            value={formData.participant_capacity || 0}
            onChange={(e) =>
              setEditFormData((prev) => ({
                ...prev,
                [event.id]: {
                  ...prev[event.id],
                  participant_capacity: Number.parseInt(e.target.value || "0"),
                },
              }))
            }
            placeholder="0"
            className="w-full"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-medium text-gray-700">Potential Participants</h5>
              <Badge variant="outline" className="text-xs">
                {(formData.potential_participants || event.potential_participants || []).length}
              </Badge>
            </div>
            <div className="space-y-2 min-h-[100px] bg-gray-50 rounded-lg p-3">
              {(formData.potential_participants || event.potential_participants || []).length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No potential participants</div>
              ) : (
                (formData.potential_participants || event.potential_participants || []).map((personId: string) => {
                  const person = getPersonById(personId)
                  if (!person) return null
                  return (
                    <div key={personId} className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                      <div className="flex items-center gap-2">
                        <EmmaPersonDisplay person={person} size="w-6 h-6" showAvatar={true} />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            moveParticipantMember(
                              event.id,
                              personId,
                              "potential_participants",
                              "committed_participants",
                            )
                          }
                          className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                          title="Move to Committed"
                        >
                          ✓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            moveParticipantMember(event.id, personId, "potential_participants", "waitlist_participants")
                          }
                          className="h-6 w-6 p-0 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                          title="Move to Waitlist"
                        >
                          <Hourglass className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeParticipantMember(event.id, personId, "potential_participants")}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Remove"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-medium text-gray-700">Committed Participants</h5>
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                {(formData.committed_participants || event.committed_participants || []).length}
                {(formData.participant_capacity || event.participant_capacity) > 0 &&
                  ` / ${formData.participant_capacity || event.participant_capacity}`}
              </Badge>
            </div>
            <div className="space-y-2 min-h-[100px] bg-green-50 rounded-lg p-3">
              {(formData.committed_participants || event.committed_participants || []).length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No committed participants</div>
              ) : (
                (formData.committed_participants || event.committed_participants || []).map((personId: string) => {
                  const person = getPersonById(personId)
                  if (!person) return null
                  return (
                    <div key={personId} className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                      <div className="flex items-center gap-2">
                        <EmmaPersonDisplay person={person} size="w-6 h-6" showAvatar={true} />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            moveParticipantMember(
                              event.id,
                              personId,
                              "committed_participants",
                              "potential_participants",
                            )
                          }
                          className="h-6 w-6 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                          title="Move to Potential"
                        >
                          ?
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            moveParticipantMember(event.id, personId, "committed_participants", "waitlist_participants")
                          }
                          className="h-6 w-6 p-0 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                          title="Move to Waitlist"
                        >
                          <Hourglass className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeParticipantMember(event.id, personId, "committed_participants")}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Remove"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-medium text-gray-700">Waitlist Participants</h5>
              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                {(formData.waitlist_participants || event.waitlist_participants || []).length}
              </Badge>
            </div>
            <div className="space-y-2 min-h-[100px] bg-yellow-50 rounded-lg p-3">
              {(formData.waitlist_participants || event.waitlist_participants || []).length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No waitlist participants</div>
              ) : (
                (formData.waitlist_participants || event.waitlist_participants || []).map((personId: string) => {
                  const person = getPersonById(personId)
                  if (!person) return null
                  return (
                    <div key={personId} className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                      <div className="flex items-center gap-2">
                        <EmmaPersonDisplay person={person} size="w-6 h-6" showAvatar={true} />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            moveParticipantMember(event.id, personId, "waitlist_participants", "committed_participants")
                          }
                          className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                          title="Move to Committed"
                        >
                          ✓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeParticipantMember(event.id, personId, "waitlist_participants")}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Remove"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {event.participant_schedule && (
        <div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-medium text-gray-900">Schedule Management</h4>
            </div>
          </div>

          <label className="block font-medium text-gray-700 mb-2">Scheduled Times</label>
          <EmmaCalendar
            eventLists={[
              {
                name: event.name,
                color: event.event_type?.color || "#ea580c",
                times: formData.participant_schedule || [],
              },
              ...(event.staff_published_time
                ? [
                    {
                      name: "Staff Applications Open",
                      color: "#a7f3d0", // lighter emerald for read-only indication
                      times: [event.staff_published_time],
                      description: "Time period when staff can apply to this event (read-only)",
                      showTooltip: true,
                      readOnly: true,
                    },
                  ]
                : []),
              ...(event.participant_published_time
                ? [
                    {
                      name: "Participant Applications Open",
                      color: "#93c5fd", // lighter blue for read-only indication
                      times: [event.participant_published_time],
                      description: "Time period when participants can apply to this event (read-only)",
                      showTooltip: true,
                      readOnly: true,
                    },
                  ]
                : []),
            ]}
            readOnly={false}
            showEventLegend={false}
            timezone={event.venue?.timezone || "America/Chicago"}
            initialDate={
              formData.participant_schedule && formData.participant_schedule.length > 0
                ? new Date(formData.participant_schedule[0].start)
                : undefined
            }
            onTimesChange={(eventListIndex, newTimes) => {
              console.log("[v0] Calendar times changed:", newTimes)
              if (eventListIndex === 0) {
                setEditFormData((prev) => ({
                  ...prev,
                  [event.id]: {
                    ...prev[event.id],
                    participant_schedule: newTimes,
                  },
                }))
              }
            }}
          />

          <label className="block font-medium text-gray-700 mb-2">Timeline View</label>
          <div className="mt-4">
            <EmmaTimeline
              events={(formData.participant_schedule || []).map((time, index) => ({
                date: new Date(time.start).toISOString().split("T")[0],
                label: `Session ${index + 1}`,
                description: `${new Date(time.start).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: event.venue?.timezone || "America/Chicago",
                })} - ${new Date(time.end).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: event.venue?.timezone || "America/Chicago",
                })}`,
              }))}
              selectedIndex={selectedTimelineEvents[event.id] || 0}
              onEventSelect={(index) => {
                setSelectedTimelineEvents((prev) => ({
                  ...prev,
                  [event.id]: index,
                }))
              }}
              getLabel={(event) => event.label || ""}
              getDescription={(event) => event.description || ""}
              indexClick={true}
              styles={{
                background: event.event_type?.color || "#ea580c",
                foreground: "#ffffff",
                outline: "#e5e7eb",
              }}
            />
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h4 className="text-lg font-medium text-gray-900">Event Transactions</h4>
        <EmmaTransactionTable
          transactions={event.transactions || []}
          onUpdate={(transaction) => handleTransactionUpdate(event.id, transaction)}
          onCreate={(newTransaction) => handleTransactionCreate(event, newTransaction)}
          onDelete={(transactionId) => handleTransactionDelete(event.id, transactionId)}
        />
      </div>
    </div>
  )
}
