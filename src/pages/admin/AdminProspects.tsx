"use client"

import { useAuth0 } from "../../lib/auth0-provider"
import { Navigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Edit, Archive, Loader2, Eye, EyeOff, Save, X, UserPlus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { EmmaPersonModal } from "../../components/emma/person-modal"
import { EmmaTitleBar } from "../../components/emma/titlebar"
import type { Prospect, Person } from "../../types/person"
import { useState, useEffect } from "react"

interface ProspectApiResponse {
  data: Prospect | Prospect[]
  count: number
  message?: string
}

interface PersonApiResponse {
  data: Person | Person[]
  count: number
  message?: string
}

export default function AdminProspects() {
  const { isAuthenticated, isLoading } = useAuth0()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set())
  const [editFormData, setEditFormData] = useState<Record<string, Partial<Prospect>>>({})
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set())
  const [archiveConfirmation, setArchiveConfirmation] = useState<{ isOpen: boolean; prospect: Prospect | null }>({
    isOpen: false,
    prospect: null,
  })
  const [archivingItems, setArchivingItems] = useState<Set<string>>(new Set())
  const [creatingProspect, setCreatingProspect] = useState<Prospect | null>(null)
  const [personModalOpen, setPersonModalOpen] = useState(false)
  const [currentPersonForModal, setCurrentPersonForModal] = useState<Person | null>(null)
  const [editingProspectForPerson, setEditingProspectForPerson] = useState<string | null>(null)

  const filteredProspects = prospects.filter((prospect) => (showArchived ? !prospect.is_active : prospect.is_active))
  const displayedProspects =
    creatingProspect && !showArchived ? [creatingProspect, ...filteredProspects] : filteredProspects

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

  const startEditing = (prospect: Prospect) => {
    setEditingItems((prev) => new Set(prev).add(prospect.id))
    setEditFormData((prev) => ({
      ...prev,
      [prospect.id]: {
        log_id: prospect.log_id,
        balked_events: prospect.balked_events,
        is_active: prospect.is_active,
      },
    }))
  }

  const createNewProspect = () => {
    const tempId = `temp-${Date.now()}`
    const newProspect: Prospect = {
      id: tempId,
      log_id: undefined,
      balked_events: [],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      first_name: "",
      middle_name: undefined,
      last_name: "",
      email: undefined,
      phone: undefined,
      billing_address_id: undefined,
      mailing_address_id: undefined,
      physical_address_id: undefined,
      notes: undefined,
      photo_url: undefined,
    }

    setCreatingProspect(newProspect)
    setEditingItems((prev) => new Set(prev).add(tempId))
    setExpandedItems((prev) => new Set(prev).add(tempId))
    setEditFormData((prev) => ({
      ...prev,
      [tempId]: {
        log_id: undefined,
        balked_events: [],
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

    if (creatingProspect && creatingProspect.id === id) {
      setCreatingProspect(null)
      setExpandedItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const updateFormData = (id: string, field: keyof Prospect, value: string | boolean | string[] | null) => {
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
      const isNewProspect = creatingProspect && creatingProspect.id === id
      const url = isNewProspect ? "/api/prospects" : `/api/prospects/${id}`
      const method = isNewProspect ? "POST" : "PUT"

      const cleanedData = {
        log_id: formData.log_id || null,
        balked_events: formData.balked_events || [],
        is_active: formData.is_active ?? true,
      }

      const body = isNewProspect ? cleanedData : { id, ...cleanedData }

      console.log("[v0] Submitting prospect data:", body)

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
        throw new Error(`Failed to ${isNewProspect ? "create" : "update"} prospect: ${response.statusText}`)
      }

      const prospectApiResponse: ProspectApiResponse = await response.json()
      const savedProspect = prospectApiResponse.data as Prospect

      if (isNewProspect) {
        setProspects((prev) => [savedProspect, ...prev])
        setCreatingProspect(null)
        setExpandedItems((prev) => {
          const newSet = new Set(prev)
          newSet.delete(id)
          newSet.add(savedProspect.id)
          return newSet
        })
      } else {
        setProspects((prev) => prev.map((p) => (p.id === id ? savedProspect : p)))
      }

      cancelEditing(id)
    } catch (err) {
      console.error(
        `[v0] Error ${creatingProspect && creatingProspect.id === id ? "creating" : "updating"} prospect:`,
        err,
      )
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${creatingProspect && creatingProspect.id === id ? "create" : "update"} prospect`,
      )
    } finally {
      setSavingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const openArchiveConfirmation = (prospect: Prospect) => {
    setArchiveConfirmation({ isOpen: true, prospect })
  }

  const closeArchiveConfirmation = () => {
    setArchiveConfirmation({ isOpen: false, prospect: null })
  }

  const archiveProspect = async () => {
    const prospect = archiveConfirmation.prospect
    if (!prospect) return

    setArchivingItems((prev) => new Set(prev).add(prospect.id))

    try {
      const response = await fetch(`/api/prospects/${prospect.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...prospect,
          is_active: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to archive prospect: ${response.statusText}`)
      }

      const prospectApiResponse: ProspectApiResponse = await response.json()
      setProspects((prev) => prev.map((p) => (p.id === prospect.id ? (prospectApiResponse.data as Prospect) : p)))

      closeArchiveConfirmation()
    } catch (err) {
      console.error("[v0] Error archiving prospect:", err)
      setError(err instanceof Error ? err.message : "Failed to archive prospect")
    } finally {
      setArchivingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(prospect.id)
        return newSet
      })
    }
  }

  const unarchiveProspect = async (prospect: Prospect) => {
    setArchivingItems((prev) => new Set(prev).add(prospect.id))

    try {
      const response = await fetch(`/api/prospects/${prospect.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...prospect,
          is_active: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to unarchive prospect: ${response.statusText}`)
      }

      const prospectApiResponse: ProspectApiResponse = await response.json()
      setProspects((prev) => prev.map((p) => (p.id === prospect.id ? (prospectApiResponse.data as Prospect) : p)))
    } catch (err) {
      console.error("[v0] Error unarchiving prospect:", err)
      setError(err instanceof Error ? err.message : "Failed to unarchive prospect")
    } finally {
      setArchivingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(prospect.id)
        return newSet
      })
    }
  }

  const getFullName = (prospect: Prospect) => {
    const parts = [prospect.first_name, prospect.middle_name, prospect.last_name].filter(Boolean)
    return parts.join(" ")
  }

  const getPersonName = (personId: string) => {
    const person = people.find((p) => p.id === personId)
    if (!person) return "Unknown Person"
    const parts = [person.first_name, person.middle_name, person.last_name].filter(Boolean)
    return parts.join(" ")
  }

  const handlePersonSelect = (person: Person | null) => {
    if (editingProspectForPerson && person) {
      if (creatingProspect && creatingProspect.id === editingProspectForPerson) {
        setCreatingProspect((prev) =>
          prev
            ? {
                ...prev,
                id: person.id,
                first_name: person.first_name,
                middle_name: person.middle_name,
                last_name: person.last_name,
                email: person.email,
                phone: person.phone,
                billing_address_id: person.billing_address_id,
                mailing_address_id: person.mailing_address_id,
                physical_address_id: person.physical_address_id,
                notes: person.notes,
                photo_url: person.photo_url,
              }
            : null,
        )
      }
    }

    setPersonModalOpen(false)
    setCurrentPersonForModal(null)
    setEditingProspectForPerson(null)
  }

  const openPersonModal = (prospectId: string) => {
    const prospect = prospects.find((p) => p.id === prospectId) || creatingProspect
    setCurrentPersonForModal(prospect || null)
    setEditingProspectForPerson(prospectId)
    setPersonModalOpen(true)
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        const prospectsResponse = await fetch("/api/prospects")
        if (!prospectsResponse.ok) {
          throw new Error(`Failed to fetch prospects: ${prospectsResponse.statusText}`)
        }
        const prospectApiResponse: ProspectApiResponse = await prospectsResponse.json()
        setProspects(prospectApiResponse.data as Prospect[])

        const peopleResponse = await fetch("/api/people?active=true")
        if (!peopleResponse.ok) {
          throw new Error(`Failed to fetch people: ${peopleResponse.statusText}`)
        }
        const personApiResponse: PersonApiResponse = await peopleResponse.json()
        setPeople(personApiResponse.data as Person[])
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <EmmaTitleBar title="Prospects Management" backLink={{ href: "/admin", label: "Back to Admin" }} />

      <div className="p-6 pt-20">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex justify-between items-center">
            <p className="text-gray-600">Manage people who have shown interest in signing up for initiation</p>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={createNewProspect}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Prospect
            </Button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Prospects ({displayedProspects.length})</CardTitle>
                  <CardDescription>Manage people interested in initiation</CardDescription>
                </div>
                <Button variant="outline" onClick={() => setShowArchived(!showArchived)} className="ml-4">
                  {showArchived ? "Show Active" : "Show Archived"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Loading prospects...</p>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <UserPlus className="w-16 h-16 text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Prospects</h3>
                  <p className="text-red-600 mb-4">{error}</p>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    Try Again
                  </Button>
                </div>
              ) : displayedProspects.length === 0 ? (
                <div className="text-center py-12">
                  <UserPlus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {showArchived ? "No Archived Prospects" : "No Prospects Found"}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {showArchived
                      ? "No prospects have been archived yet."
                      : "Get started by adding your first prospect to the system."}
                  </p>
                  {!showArchived && (
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={createNewProspect}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Prospect
                    </Button>
                  )}
                </div>
              ) : (
                <TooltipProvider>
                  <div className="space-y-4">
                    {displayedProspects.map((prospect) => {
                      const isExpanded = expandedItems.has(prospect.id)
                      const isEditing = editingItems.has(prospect.id)
                      const isSaving = savingItems.has(prospect.id)
                      const isArchiving = archivingItems.has(prospect.id)
                      const formData = editFormData[prospect.id] || prospect

                      return (
                        <div key={prospect.id} className="border rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between p-4">
                            <div className="flex items-start space-x-4 flex-1">
                              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <UserPlus className="w-6 h-6 text-green-600" />
                              </div>
                              <div className="flex-1">
                                {isEditing ? (
                                  <div className="space-y-4">
                                    <div>
                                      <label className="text-sm font-medium text-gray-700 mb-1 block">Person</label>
                                      <div className="flex items-center space-x-2">
                                        <Button
                                          variant="outline"
                                          onClick={() => openPersonModal(prospect.id)}
                                          className="flex-1 justify-start text-left"
                                        >
                                          <span>{getFullName(prospect) || "Select a person..."}</span>
                                        </Button>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                                        Balked Events (comma-separated UUIDs)
                                      </label>
                                      <Input
                                        value={formData.balked_events?.join(", ") || ""}
                                        onChange={(e) => {
                                          const events = e.target.value
                                            .split(",")
                                            .map((s) => s.trim())
                                            .filter(Boolean)
                                          updateFormData(prospect.id, "balked_events", events)
                                        }}
                                        placeholder="Event UUIDs that prospect has balked at"
                                        className="text-sm"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <h4 className="font-semibold text-gray-900">{getFullName(prospect)}</h4>
                                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                                      {prospect.email && <span>{prospect.email}</span>}
                                      {prospect.phone && <span>{prospect.phone}</span>}
                                      {prospect.balked_events.length > 0 && (
                                        <span className="text-orange-600">
                                          {prospect.balked_events.length} balked event
                                          {prospect.balked_events.length !== 1 ? "s" : ""}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center space-x-2 mt-1">
                                      <Badge variant={prospect.is_active ? "default" : "secondary"}>
                                        {prospect.is_active ? "Active" : "Inactive"}
                                      </Badge>
                                      <span className="text-xs text-gray-500">
                                        Updated {new Date(prospect.updated_at).toLocaleString()}
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
                                        onClick={() => saveChanges(prospect.id)}
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
                                        onClick={() => cancelEditing(prospect.id)}
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
                                        onClick={() => toggleExpanded(prospect.id)}
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
                                        onClick={() => startEditing(prospect)}
                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Edit prospect</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  {prospect.is_active ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => openArchiveConfirmation(prospect)}
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
                                        <p>Archive prospect</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => unarchiveProspect(prospect)}
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
                                        <p>Unarchive prospect</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {isExpanded && !isEditing && (
                            <div className="px-4 pb-4 border-t bg-gray-50/50">
                              <div className="pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Prospect ID</label>
                                      <p className="text-sm text-gray-600 font-mono">{prospect.id}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Person</label>
                                      <p className="text-sm text-gray-900">{getFullName(prospect)}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Full Name</label>
                                      <p className="text-sm text-gray-900">{getFullName(prospect)}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Email</label>
                                      <p className="text-sm text-gray-900">{prospect.email || "Not provided"}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Phone</label>
                                      <p className="text-sm text-gray-900">{prospect.phone || "Not provided"}</p>
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Log ID</label>
                                      <p className="text-sm text-gray-600 font-mono">{prospect.log_id || "Not set"}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Balked Events</label>
                                      <p className="text-sm text-gray-900">
                                        {prospect.balked_events.length > 0
                                          ? `${prospect.balked_events.length} event${prospect.balked_events.length !== 1 ? "s" : ""}`
                                          : "None"}
                                      </p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Created</label>
                                      <p className="text-sm text-gray-900">
                                        {new Date(prospect.created_at).toLocaleString()}
                                      </p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Last Updated</label>
                                      <p className="text-sm text-gray-900">
                                        {new Date(prospect.updated_at).toLocaleString()}
                                      </p>
                                    </div>
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

      <Dialog open={archiveConfirmation.isOpen} onOpenChange={closeArchiveConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Prospect</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "
              {archiveConfirmation.prospect ? getFullName(archiveConfirmation.prospect) : ""}"? This will mark them as
              inactive but preserve all data. You can reactivate them later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeArchiveConfirmation}>
              Cancel
            </Button>
            <Button
              onClick={archiveProspect}
              disabled={archivingItems.has(archiveConfirmation.prospect?.id || "")}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {archivingItems.has(archiveConfirmation.prospect?.id || "") ? (
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

      <EmmaPersonModal
        isOpen={personModalOpen}
        onClose={() => {
          setPersonModalOpen(false)
          setCurrentPersonForModal(null)
          setEditingProspectForPerson(null)
        }}
        onPersonSelect={handlePersonSelect}
        currentPerson={currentPersonForModal}
        title="Manage Prospect Person"
      />
    </div>
  )
}
