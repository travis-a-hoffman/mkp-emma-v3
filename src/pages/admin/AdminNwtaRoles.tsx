"use client"

import { useAuth0 } from "../../lib/auth0-provider"
import { Navigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserCog, Plus, Edit, Archive, Loader2, Eye, EyeOff, Save, X, Users, Zap } from "lucide-react"
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
import { useState, useEffect } from "react"

interface NwtaRole {
  id: string
  name: string
  summary?: string
  nwta_event_id: string
  role_type_id?: string
  lead_warrior_id?: string
  warriors: string[]
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined data
  event_name: string
  role_type_name?: string
  experience_level?: number
  work_points?: number
  preparation_points?: number
  lead_warrior_first_name?: string
  lead_warrior_last_name?: string
}

interface NwtaRoleType {
  id: string
  name: string
  summary?: string
  experience_level: number
  work_points: number
  preparation_points: number
}

interface NwtaEvent {
  id: string
  name: string
}

export default function AdminNwtaRoles() {
  const { isAuthenticated, isLoading } = useAuth0()
  const [roles, setRoles] = useState<NwtaRole[]>([])
  const [roleTypes, setRoleTypes] = useState<NwtaRoleType[]>([])
  const [events, setEvents] = useState<NwtaEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set())
  const [editFormData, setEditFormData] = useState<Record<string, Partial<NwtaRole>>>({})
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set())
  const [archiveConfirmation, setArchiveConfirmation] = useState<{ isOpen: boolean; role: NwtaRole | null }>({
    isOpen: false,
    role: null,
  })
  const [archivingItems, setArchivingItems] = useState<Set<string>>(new Set())
  const [creatingRole, setCreatingRole] = useState<NwtaRole | null>(null)

  const filteredRoles = roles.filter((role) => (showArchived ? !role.is_active : role.is_active))
  const displayedRoles = creatingRole && !showArchived ? [creatingRole, ...filteredRoles] : filteredRoles

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [rolesResponse, roleTypesResponse, eventsResponse] = await Promise.all([
        fetch("/api/nwta-roles"),
        fetch("/api/nwta-role-types"),
        fetch("/api/nwta-events"),
      ])

      if (!rolesResponse.ok || !roleTypesResponse.ok || !eventsResponse.ok) {
        throw new Error("Failed to fetch data")
      }

      const [rolesData, roleTypesData, eventsData] = await Promise.all([
        rolesResponse.json(),
        roleTypesResponse.json(),
        eventsResponse.json(),
      ])

      setRoles(rolesData.data || [])
      setRoleTypes(roleTypesData.data || [])
      setEvents(eventsData.data || [])
    } catch (err) {
      console.error("Error fetching data:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [isAuthenticated])

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

  const startEditing = (role: NwtaRole) => {
    setEditingItems((prev) => new Set(prev).add(role.id))
    setEditFormData((prev) => ({
      ...prev,
      [role.id]: { ...role },
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

  const saveChanges = async (id: string) => {
    const formData = editFormData[id]
    if (!formData) return

    setSavingItems((prev) => new Set(prev).add(id))

    try {
      const response = await fetch(`/api/nwta-roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error("Failed to update NWTA role")
      }

      const updatedRole = await response.json()
      setRoles((prev) => prev.map((role) => (role.id === id ? updatedRole.data : role)))
      cancelEditing(id)
    } catch (err) {
      console.error("Error updating NWTA role:", err)
      setError(err instanceof Error ? err.message : "Failed to update NWTA role")
    } finally {
      setSavingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const createNewRole = () => {
    const newRole: NwtaRole = {
      id: "new",
      name: "",
      summary: "",
      nwta_event_id: "",
      warriors: [],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      event_name: "",
    }

    setCreatingRole(newRole)
    setEditingItems((prev) => new Set(prev).add("new"))
    setEditFormData((prev) => ({ ...prev, new: newRole }))
    setExpandedItems((prev) => new Set(prev).add("new"))
  }

  const saveNewRole = async () => {
    const formData = editFormData["new"]
    if (!formData || !formData.name?.trim() || !formData.nwta_event_id) {
      setError("Role name and NWTA event are required")
      return
    }

    setSavingItems((prev) => new Set(prev).add("new"))

    try {
      const response = await fetch("/api/nwta-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error("Failed to create NWTA role")
      }

      const newRole = await response.json()
      setRoles((prev) => [newRole.data, ...prev])
      setCreatingRole(null)
      cancelEditing("new")
    } catch (err) {
      console.error("Error creating NWTA role:", err)
      setError(err instanceof Error ? err.message : "Failed to create NWTA role")
    } finally {
      setSavingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete("new")
        return newSet
      })
    }
  }

  const openArchiveConfirmation = (role: NwtaRole) => {
    setArchiveConfirmation({ isOpen: true, role })
  }

  const closeArchiveConfirmation = () => {
    setArchiveConfirmation({ isOpen: false, role: null })
  }

  const archiveRole = async () => {
    const role = archiveConfirmation.role
    if (!role) return

    setArchivingItems((prev) => new Set(prev).add(role.id))

    try {
      const response = await fetch(`/api/nwta-roles/${role.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      })

      if (!response.ok) {
        throw new Error("Failed to archive NWTA role")
      }

      setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, is_active: false } : r)))
      closeArchiveConfirmation()
    } catch (err) {
      console.error("Error archiving NWTA role:", err)
      setError(err instanceof Error ? err.message : "Failed to archive NWTA role")
    } finally {
      setArchivingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(role.id)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <EmmaTitleBar title="NWTA Roles Management" backLink={{ href: "/admin", label: "Back to Admin" }} />
        <div className="p-6 pt-20">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mr-2" />
              <span className="text-lg">Loading NWTA roles...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <EmmaTitleBar title="NWTA Roles Management" backLink={{ href: "/admin", label: "Back to Admin" }} />

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
            <p className="text-gray-600">Manage roles and responsibilities for NWTA events</p>
            {!showArchived && (
              <Button onClick={createNewRole} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create New NWTA Role
              </Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserCog className="w-5 h-5 text-teal-600" />
                    NWTA Roles ({filteredRoles.length})
                  </CardTitle>
                  <CardDescription>Manage roles and responsibilities for NWTA events</CardDescription>
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
                        <p>{showArchived ? "Switch to active roles" : "Switch to archived roles"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {displayedRoles.length === 0 ? (
                <div className="text-center py-12">
                  <UserCog className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No {showArchived ? "archived" : "active"} NWTA roles
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {showArchived ? "No archived NWTA roles found." : "Get started by creating your first NWTA role."}
                  </p>
                  {!showArchived && (
                    <Button onClick={createNewRole} className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Create New NWTA Role
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {displayedRoles.map((role) => {
                    const isEditing = editingItems.has(role.id)
                    const isSaving = savingItems.has(role.id)
                    const isArchiving = archivingItems.has(role.id)
                    const isExpanded = expandedItems.has(role.id)
                    const formData = editFormData[role.id] || role

                    return (
                      <Card key={role.id} className={`${!role.is_active ? "opacity-60" : ""}`}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              {isEditing ? (
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                                    <Input
                                      value={formData.name || ""}
                                      onChange={(e) =>
                                        setEditFormData((prev) => ({
                                          ...prev,
                                          [role.id]: { ...prev[role.id], name: e.target.value },
                                        }))
                                      }
                                      placeholder="Enter role name"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
                                    <Textarea
                                      value={formData.summary || ""}
                                      onChange={(e) =>
                                        setEditFormData((prev) => ({
                                          ...prev,
                                          [role.id]: { ...prev[role.id], summary: e.target.value },
                                        }))
                                      }
                                      placeholder="Enter role summary"
                                      rows={3}
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">NWTA Event</label>
                                      <Select
                                        value={formData.nwta_event_id || "default"}
                                        onValueChange={(value) =>
                                          setEditFormData((prev) => ({
                                            ...prev,
                                            [role.id]: { ...prev[role.id], nwta_event_id: value },
                                          }))
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select NWTA event" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {events.map((event) => (
                                            <SelectItem key={event.id} value={event.id}>
                                              {event.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Role Type</label>
                                      <Select
                                        value={formData.role_type_id || "default"}
                                        onValueChange={(value) =>
                                          setEditFormData((prev) => ({
                                            ...prev,
                                            [role.id]: { ...prev[role.id], role_type_id: value || undefined },
                                          }))
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select role type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="default">No role type</SelectItem>
                                          {roleTypes.map((type) => (
                                            <SelectItem key={type.id} value={type.id}>
                                              {type.name} (Level {type.experience_level})
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-semibold">{role.name}</h3>
                                    <div className="flex gap-2">
                                      {!role.is_active && <Badge variant="destructive">Archived</Badge>}
                                      {role.role_type_name && (
                                        <Badge variant="outline">
                                          {role.role_type_name} (Level {role.experience_level})
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  {role.summary && <p className="text-gray-600 mb-3">{role.summary}</p>}
                                  <div className="flex items-center gap-6 text-sm text-gray-500">
                                    <div className="flex items-center gap-1">
                                      <Zap className="w-4 h-4" />
                                      <span>Event: {role.event_name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Users className="w-4 h-4" />
                                      <span>Warriors: {role.warriors?.length || 0}</span>
                                    </div>
                                    {role.lead_warrior_first_name && (
                                      <div className="flex items-center gap-1">
                                        <UserCog className="w-4 h-4" />
                                        <span>
                                          Lead: {role.lead_warrior_first_name} {role.lead_warrior_last_name}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 ml-4">
                              {isEditing ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => (role.id === "new" ? saveNewRole() : saveChanges(role.id))}
                                    disabled={isSaving}
                                  >
                                    {isSaving ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Save className="w-4 h-4" />
                                    )}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => cancelEditing(role.id)}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => toggleExpanded(role.id)}>
                                    {isExpanded ? "Hide Details" : "Show Details"}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => startEditing(role)}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  {role.is_active && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openArchiveConfirmation(role)}
                                      disabled={isArchiving}
                                    >
                                      {isArchiving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Archive className="w-4 h-4" />
                                      )}
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {isExpanded && !isEditing && (
                            <div className="mt-6 pt-6 border-t border-gray-200">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <h4 className="font-medium text-gray-900 mb-3">Role Requirements</h4>
                                  <div className="space-y-2">
                                    {role.experience_level !== undefined && (
                                      <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Experience Level:</span>
                                        <span className="text-sm font-medium">{role.experience_level}</span>
                                      </div>
                                    )}
                                    {role.work_points !== undefined && (
                                      <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Work Points:</span>
                                        <span className="text-sm font-medium">{role.work_points}</span>
                                      </div>
                                    )}
                                    {role.preparation_points !== undefined && (
                                      <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Preparation Points:</span>
                                        <span className="text-sm font-medium">{role.preparation_points}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <h4 className="font-medium text-gray-900 mb-3">Assigned Warriors</h4>
                                  <div className="space-y-2">
                                    <div className="flex justify-between">
                                      <span className="text-sm text-gray-600">Total Warriors:</span>
                                      <span className="text-sm font-medium">{role.warriors?.length || 0}</span>
                                    </div>
                                    {role.lead_warrior_first_name && (
                                      <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Lead Warrior:</span>
                                        <span className="text-sm font-medium">
                                          {role.lead_warrior_first_name} {role.lead_warrior_last_name}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
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
            <DialogTitle>Archive NWTA Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "{archiveConfirmation.role?.name}"? This will hide it from the active
              NWTA roles list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeArchiveConfirmation}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={archiveRole}>
              Archive Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
