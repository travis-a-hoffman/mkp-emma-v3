"use client"

import { useAuth0 } from "../../lib/auth0-provider"
import { Navigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  ChefHat,
  Crown,
  Shield,
  Search,
  Eye,
  EyeOff,
  Award,
  Users,
  Calendar,
  Loader2,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { EmmaTitleBar } from "../../components/emma/titlebar"
import { EmmaPersonDisplay } from "../../components/emma/person-display"
import { EmmaPersonModal } from "../../components/emma/person-modal"
import { EmmaAreaTag } from "../../components/emma/area-tag"
import { EmmaCommunityTag } from "../../components/emma/community-tag"
import { EmmaAreaModal } from "../../components/emma/area-modal"
import { EmmaCommunityModal } from "../../components/emma/community-modal"
import type { Person, Warrior } from "../../types/person"
import type { EventWithRelations } from "../../types/event"
import type { Area } from "../../types/area"
import type { Community } from "../../types/community"
import { useState, useEffect } from "react"

interface WarriorStats {
  total: number
  active: number
  inactive: number
  by_status: Record<string, number>
}

interface WarriorWithRelations<E> extends Warrior<EventWithRelations> {
  area: Area | null
  community: Community | null
}

const getStatusBadge = (status: string) => {
  switch (status.toLowerCase()) {
    case "full_leader":
      return (
        <Badge className="bg-purple-100 text-purple-800 border-purple-300">
          <Crown className="w-3 h-3 mr-1" />
          Full Leader
        </Badge>
      )
    case "leader_track":
      return (
        <Badge className="bg-red-100 text-red-800 border-red-300">
          <Award className="w-3 h-3 mr-1" />
          Leader Track
        </Badge>
      )
    case "staff":
      return (
        <Badge className="bg-orange-100 text-orange-800 border-orange-300">
          <Users className="w-3 h-3 mr-1" />
          Staff
        </Badge>
      )
    case "rookie":
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-300">
          <Users className="w-3 h-3 mr-1" />
          Rookie
        </Badge>
      )
    case "initiated":
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300">
          <Shield className="w-3 h-3 mr-1" />
          Initiated
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}


export default function AdminWarriors() {
  const { isAuthenticated, isLoading } = useAuth0()
  const [warriors, setWarriors] = useState<WarriorWithRelations<EventWithRelations>[]>([])
  const [stats, setStats] = useState<WarriorStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false)
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false)
  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false)
  const [selectedWarrior, setSelectedWarrior] = useState<WarriorWithRelations<EventWithRelations> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [selectedArea, setSelectedArea] = useState<Area | null>(null)
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null)

  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    phone: "",
    billing_address_id: "",
    mailing_address_id: "",
    physical_address_id: "",
    notes: "",
    photo_url: "",
    log_id: "",
    initiation_id: "",
    initiation_on: "",
    status: "Initiated",
    training_events: [] as string[],
    staffed_events: [] as string[],
    lead_events: [] as string[],
    mos_events: [] as string[],
    is_active: true,
    area_id: null as string | null,
    community_id: null as string | null,
  })

  const filteredWarriors = warriors.filter((warrior) => {
    if (!warrior) {
      return false
    }

    const matchesSearch =
      `${warrior.first_name || ""} ${warrior.last_name || ""}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      warrior.email?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || warrior.status === statusFilter
    const matchesActive =
      activeFilter === "all" ||
      (activeFilter === "active" && warrior.is_active) ||
      (activeFilter === "inactive" && !warrior.is_active)

    return matchesSearch && matchesStatus && matchesActive
  })

  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [isAuthenticated])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [warriorsResponse, statsResponse] = await Promise.all([
        fetch("/api/warriors"),
        fetch("/api/warriors/stats"),
      ])

      if (!warriorsResponse.ok || !statsResponse.ok) {
        throw new Error("Failed to fetch warriors data")
      }

      const warriorsData = await warriorsResponse.json()
      const statsData = await statsResponse.json()

      console.log("[v0] Warriors API response:", warriorsData)
      console.log("[v0] Warriors data structure:", typeof warriorsData, Array.isArray(warriorsData))
      console.log("[v0] Warriors data.data:", warriorsData.data)
      console.log("[v0] Stats API response:", statsData)

      setWarriors(warriorsData.data || [])
      setStats(statsData.data || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch warriors")
      console.error("Error fetching warriors:", err)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      first_name: "",
      middle_name: "",
      last_name: "",
      email: "",
      phone: "",
      billing_address_id: "",
      mailing_address_id: "",
      physical_address_id: "",
      notes: "",
      photo_url: "",
      log_id: "",
      initiation_id: "",
      initiation_on: "",
      status: "Initiated",
      training_events: [],
      staffed_events: [],
      lead_events: [],
      mos_events: [],
      is_active: true,
      area_id: null,
      community_id: null,
    })
    setSelectedPerson(null)
    setSelectedArea(null)
    setSelectedCommunity(null)
  }

  const handleCreate = () => {
    resetForm()
    setSelectedWarrior(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (warrior: WarriorWithRelations<EventWithRelations>) => {
    setFormData({
      first_name: warrior.first_name,
      middle_name: warrior.middle_name || "",
      last_name: warrior.last_name,
      email: warrior.email || "",
      phone: warrior.phone || "",
      billing_address_id: warrior.billing_address_id || "",
      mailing_address_id: warrior.mailing_address_id || "",
      physical_address_id: warrior.physical_address_id || "",
      notes: warrior.notes || "",
      photo_url: warrior.photo_url || "",
      log_id: warrior.log_id || "",
      initiation_id: warrior.initiation_id || "",
      initiation_on: warrior.initiation_on || "",
      status: warrior.status,
      training_events: warrior.training_events,
      staffed_events: warrior.staffed_events,
      lead_events: warrior.lead_events,
      mos_events: warrior.mos_events,
      is_active: warrior.is_active,
      area_id: warrior.area_id || null,
      community_id: warrior.community_id || null,
    })
    setSelectedPerson(warrior)
    setSelectedArea(warrior.area || warrior.initiation_event?.area || null)
    setSelectedCommunity(warrior.community || warrior.initiation_event?.community || null)
    setSelectedWarrior(warrior)
    setIsEditModalOpen(true)
  }

  const handleDelete = (warrior: WarriorWithRelations<EventWithRelations>) => {
    setSelectedWarrior(warrior)
    setIsDeleteModalOpen(true)
  }

  const handlePersonSelect = (person: Person | null) => {
    if (person) {
      setFormData((prev) => ({
        ...prev,
        first_name: person.first_name,
        middle_name: person.middle_name || "",
        last_name: person.last_name,
        email: person.email || "",
        phone: person.phone || "",
        billing_address_id: person.billing_address_id || "",
        mailing_address_id: person.mailing_address_id || "",
        physical_address_id: person.physical_address_id || "",
        notes: person.notes || "",
        photo_url: person.photo_url || "",
      }))
      setSelectedPerson(person)
    }
    setIsPersonModalOpen(false)
  }

  const handleAreaSelect = (area: Area | null) => {
    setSelectedArea(area)
    setFormData((prev) => ({
      ...prev,
      area_id: area?.id || null,
    }))
    setIsAreaModalOpen(false)
  }

  const handleCommunitySelect = (community: Community | null) => {
    setSelectedCommunity(community)
    setFormData((prev) => ({
      ...prev,
      community_id: community?.id || null,
    }))
    setIsCommunityModalOpen(false)
  }

  const saveWarrior = async () => {
    try {
      setSaving(true)

      const payload = {
        ...formData,
        middle_name: formData.middle_name || null,
        notes: formData.notes || null,
        billing_address_id: formData.billing_address_id || null,
        mailing_address_id: formData.mailing_address_id || null,
        physical_address_id: formData.physical_address_id || null,
        log_id: formData.log_id || null,
        initiation_id: formData.initiation_id || null,
        initiation_on: formData.initiation_on || null,
        area_id: formData.area_id || null,
        community_id: formData.community_id || null,
      }

      console.log("[v0] Saving warrior with payload:", payload)

      const url = selectedWarrior ? `/api/warriors/${selectedWarrior.id}` : "/api/warriors"
      const method = selectedWarrior ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save warrior")
      }

      console.log("[v0] Warrior saved successfully")
      await fetchData()
      setIsCreateModalOpen(false)
      setIsEditModalOpen(false)
      resetForm()
    } catch (err) {
      console.error("[v0] Error saving warrior:", err)
      setError(err instanceof Error ? err.message : "Failed to save warrior")
    } finally {
      setSaving(false)
    }
  }

  const deleteWarrior = async () => {
    if (!selectedWarrior) return

    try {
      setDeleting(true)

      const response = await fetch(`/api/warriors/${selectedWarrior.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete warrior")
      }

      await fetchData()
      setIsDeleteModalOpen(false)
      setSelectedWarrior(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete warrior")
    } finally {
      setDeleting(false)
    }
  }

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
      <EmmaTitleBar title="Warriors" backLink={{ href: "/admin", label: "Back to Admin" }} />

      <div className="p-6 pt-20">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex justify-between items-center">
            <p className="text-gray-600">Manage warrior brotherhood members and track their progression</p>
            <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Warrior
            </Button>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Total</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Active</p>
                    <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Inactive</p>
                    <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Leaders</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {(stats.by_status.leader_track || 0) + (stats.by_status.full_leader || 0)}{" "}
                      {/* Updated leader count calculation for new status names */}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="initiated">Initiated</SelectItem>
                    <SelectItem value="rookie">Rookie</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="leader_track">Leader Track</SelectItem>
                    <SelectItem value="full_leader">Full Leader</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={activeFilter} onValueChange={setActiveFilter}>
                  <SelectTrigger className="w-full md:w-32">
                    <SelectValue placeholder="Active" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Warriors List */}
          <Card>
            <CardHeader>
              <CardTitle>Warriors ({filteredWarriors.length})</CardTitle>
              <CardDescription>Brotherhood members and their progression</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Loading warriors...</p>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Warriors</h3>
                  <p className="text-red-600 mb-4">{error}</p>
                  <Button
                    onClick={fetchData}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50 bg-transparent"
                  >
                    Try Again
                  </Button>
                </div>
              ) : filteredWarriors.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Warriors Found</h3>
                  <p className="text-gray-600 mb-4">
                    {searchTerm || statusFilter !== "all" || activeFilter !== "all"
                      ? "No warriors match your current filters."
                      : "No warriors found in the system."}
                  </p>
                  <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Warrior
                  </Button>
                </div>
              ) : (
                <TooltipProvider>
                  <div className="space-y-4">
                    {filteredWarriors.map((warrior) => {
                      if (!warrior) {
                        return null
                      }

                      const isExpanded = expandedItems.has(warrior.id)

                      return (
                        <div key={warrior.id} className="border rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between p-4">
                            <div className="flex items-center space-x-4 flex-1">
                              <Shield className={`w-5 h-5 ${warrior.is_active ? "text-blue-600" : "text-gray-400"}`} />
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <EmmaPersonDisplay personId={warrior.id} people={[warrior]} showAvatar={true} />
                                  {getStatusBadge(warrior.status)}
                                  {warrior.area && <EmmaAreaTag area={warrior.area} />}
                                  {warrior.community && <EmmaCommunityTag community={warrior.community} />}
                                  {!warrior.is_active && (
                                    <Badge variant="outline" className="text-gray-500">
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {warrior.training_events.length} trainings
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="w-4 h-4" />
                                    {warrior.staffed_events.length} staffings
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Award className="w-4 h-4" />
                                    {warrior.lead_events.length} leads
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <ChefHat className="w-4 h-4" />
                                    {warrior.mos_events.length} MOS
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toggleExpanded(warrior.id)}
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
                                    onClick={() => handleEdit(warrior)}
                                    className="text-gray-600 hover:text-gray-700"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit warrior</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDelete(warrior)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete warrior</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-4 pb-4 border-t bg-gray-50/50">
                              <div className="pt-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Warrior Details</label>
                                      <EmmaPersonDisplay personId={warrior.id} people={[warrior]} showAvatar={true} />
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Status</label>
                                      <div className="mt-1">{getStatusBadge(warrior.status)}</div>
                                    </div>
                                    {warrior.initiation_on && (
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Initiation Date</label>
                                        <p className="text-sm text-gray-600 mt-1">
                                          {new Date(warrior.initiation_on).toLocaleDateString()}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Event Statistics</label>
                                      <div className="mt-1 space-y-1 text-sm text-gray-600">
                                        <p>Training Events: {warrior.training_events.length}</p>
                                        <p>Staff Events: {warrior.staffed_events.length}</p>
                                        <p>Leadership Events: {warrior.lead_events.length}</p>
                                        <p>MOS Events: {warrior.mos_events.length}</p>
                                      </div>
                                    </div>
                                    {warrior.log_id && (
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Transaction Log ID</label>
                                        <p className="text-xs font-mono text-gray-600 mt-1">{warrior.log_id}</p>
                                      </div>
                                    )}
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

      {/* Create/Edit Modal */}
      <Dialog
        open={isCreateModalOpen || isEditModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateModalOpen(false)
            setIsEditModalOpen(false)
            resetForm()
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedWarrior ? "Edit Warrior" : "Create New Warrior"}</DialogTitle>
            <DialogDescription>
              {selectedWarrior
                ? "Update warrior information and progression."
                : "Add a new warrior to the brotherhood."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="person">Person Information</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Email address"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="Phone number"
                  />
                </div>
              </div>
              <div className="mt-2">
                <Button type="button" variant="outline" onClick={() => setIsPersonModalOpen(true)}>
                  Select Existing Person
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="initiated">Initiated</SelectItem>
                    <SelectItem value="rookie">Rookie</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="leader_track">Leader Track</SelectItem>
                    <SelectItem value="full_leader">Full Leader</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="initiation_on">Initiation Date</Label>
                <Input
                  id="initiation_on"
                  type="date"
                  value={formData.initiation_on}
                  onChange={(e) => setFormData((prev) => ({ ...prev, initiation_on: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="area">Area</Label>
              <div className="flex items-center gap-2 mt-2">
                {selectedArea ? (
                  <div className="flex items-center gap-2">
                    <EmmaAreaTag area={selectedArea} />
                    <span className="text-sm text-gray-600">{selectedArea.name}</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">No area selected</span>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAreaModalOpen(true)}>
                  {selectedArea ? "Change Area" : "Select Area"}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="community">Community</Label>
              <div className="flex items-center gap-2 mt-2">
                {selectedCommunity ? (
                  <div className="flex items-center gap-2">
                    <EmmaCommunityTag community={selectedCommunity} />
                    <span className="text-sm text-gray-600">{selectedCommunity.name}</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">No community selected</span>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCommunityModalOpen(true)}>
                  {selectedCommunity ? "Change Community" : "Select Community"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="log_id">Transaction Log ID</Label>
                <Input
                  id="log_id"
                  value={formData.log_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, log_id: e.target.value }))}
                  placeholder="Optional UUID"
                />
              </div>

              <div>
                <Label htmlFor="initiation_id">Initiation Event ID</Label>
                <Input
                  id="initiation_id"
                  value={formData.initiation_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, initiation_id: e.target.value }))}
                  placeholder="Optional UUID"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Active Warrior</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false)
                setIsEditModalOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveWarrior} disabled={saving || !formData.first_name || !formData.last_name}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {selectedWarrior ? "Update Warrior" : "Create Warrior"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Person Selection Modal */}
      <EmmaPersonModal
        isOpen={isPersonModalOpen}
        onClose={() => setIsPersonModalOpen(false)}
        onPersonSelect={handlePersonSelect}
        title="Select Person for Warrior"
      />

      {/* Area Selection Modal */}
      <EmmaAreaModal
        isOpen={isAreaModalOpen}
        onClose={() => setIsAreaModalOpen(false)}
        onAreaSelect={handleAreaSelect}
        selectedAreaId={selectedArea?.id}
        title="Select Warrior Area"
      />

      {/* Community Selection Modal */}
      <EmmaCommunityModal
        isOpen={isCommunityModalOpen}
        onClose={() => setIsCommunityModalOpen(false)}
        onCommunitySelect={handleCommunitySelect}
        selectedCommunityId={selectedCommunity?.id}
        title="Select Warrior Community"
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete Warrior
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this warrior? This action cannot be undone.
              {selectedWarrior && (
                <div className="mt-2 p-3 bg-gray-50 rounded">
                  <EmmaPersonDisplay personId={selectedWarrior.id} people={[selectedWarrior]} showAvatar={true} />
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteWarrior} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Warrior
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
