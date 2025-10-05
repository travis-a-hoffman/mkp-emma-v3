"use client"

import { useAuth0 } from "../../lib/auth0-provider"
import { Navigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Users,
  Search,
  Eye,
  EyeOff,
  Edit,
  Save,
  X,
  Plus,
  Mail,
  Phone,
  MapPin,
  Loader2,
  UserCheck,
  UserX,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmmaTitleBar } from "../../components/emma/titlebar"
import { EmmaPersonDisplay } from "../../components/emma/person-display"
import { EmmaAddress } from "../../components/emma/address"
import type { Person } from "../../types/person"
import { useState, useEffect } from "react"

interface Address {
  id: string
  address_1: string
  address_2?: string | null
  city: string
  state: string
  country: string
  postal_code: string
  created_at: string
  updated_at: string
}

interface MemberWithAddresses extends Person {
  physical_address?: Address
  mailing_address?: Address
  billing_address?: Address
}

const getMembershipStatus = (person: Person) => {
  // Simple logic - can be enhanced based on business rules
  if (!person.is_active) return "Inactive"
  if (person.email && person.phone) return "Active"
  if (person.email || person.phone) return "Partial"
  return "Incomplete"
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Active":
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300">
          <UserCheck className="w-3 h-3 mr-1" />
          Active
        </Badge>
      )
    case "Partial":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
          <UserCheck className="w-3 h-3 mr-1" />
          Partial
        </Badge>
      )
    case "Incomplete":
      return (
        <Badge className="bg-orange-100 text-orange-800 border-orange-300">
          <UserX className="w-3 h-3 mr-1" />
          Incomplete
        </Badge>
      )
    case "Inactive":
      return (
        <Badge className="bg-gray-100 text-gray-800 border-gray-300">
          <UserX className="w-3 h-3 mr-1" />
          Inactive
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default function AdminMembers() {
  const { isAuthenticated, isLoading } = useAuth0()
  const [members, setMembers] = useState<MemberWithAddresses[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showInactive, setShowInactive] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set())
  const [editFormData, setEditFormData] = useState<Record<string, Partial<Person>>>({})
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set())
  const [createDialog, setCreateDialog] = useState({ isOpen: false })
  const [createFormData, setCreateFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    phone: "",
    notes: "",
    is_active: true,
  })
  const [creating, setCreating] = useState(false)

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.phone?.includes(searchTerm)

    const memberStatus = getMembershipStatus(member)
    const matchesStatus = statusFilter === "all" || memberStatus === statusFilter
    const matchesActive = showInactive || member.is_active

    return matchesSearch && matchesStatus && matchesActive
  })

  const memberStats = {
    total: members.length,
    active: members.filter((m) => getMembershipStatus(m) === "Active").length,
    partial: members.filter((m) => getMembershipStatus(m) === "Partial").length,
    incomplete: members.filter((m) => getMembershipStatus(m) === "Incomplete").length,
    inactive: members.filter((m) => !m.is_active).length,
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [isAuthenticated])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch people and addresses in parallel
      const [peopleResponse, addressesResponse] = await Promise.all([fetch("/api/people"), fetch("/api/addresses")])

      if (!peopleResponse.ok || !addressesResponse.ok) {
        throw new Error("Failed to fetch data")
      }

      const peopleData = await peopleResponse.json()
      const addressesData = await addressesResponse.json()

      const peopleArray = peopleData.data || []
      const addressesArray = addressesData.data || []

      setAddresses(addressesArray)

      // Enhance people with address information
      const membersWithAddresses: MemberWithAddresses[] = peopleArray.map((person: Person) => {
        const physical_address = person.physical_address_id
          ? addressesArray.find((addr: Address) => addr.id === person.physical_address_id)
          : undefined
        const mailing_address = person.mailing_address_id
          ? addressesArray.find((addr: Address) => addr.id === person.mailing_address_id)
          : undefined
        const billing_address = person.billing_address_id
          ? addressesArray.find((addr: Address) => addr.id === person.billing_address_id)
          : undefined

        return {
          ...person,
          physical_address,
          mailing_address,
          billing_address,
        }
      })

      setMembers(membersWithAddresses)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch members")
      console.error("Error fetching members:", err)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
        // Also stop editing if collapsing
        setEditingItems((editPrev) => {
          const editNewSet = new Set(editPrev)
          editNewSet.delete(id)
          return editNewSet
        })
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const startEditing = (member: MemberWithAddresses) => {
    if (editingItems.size > 0) return // Prevent editing multiple items

    setEditingItems((prev) => new Set(prev).add(member.id))
    setEditFormData((prev) => ({
      ...prev,
      [member.id]: {
        first_name: member.first_name,
        middle_name: member.middle_name,
        last_name: member.last_name,
        email: member.email,
        phone: member.phone,
        notes: member.notes,
        is_active: member.is_active,
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
    // Collapse the item when canceling
    setExpandedItems((prev) => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }

  const updateFormData = (id: string, field: keyof Person, value: string | boolean | null) => {
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
      const response = await fetch(`/api/people/${id}`, {
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
        throw new Error(`Failed to update member: ${response.statusText}`)
      }

      const updatedMember = await response.json()

      setMembers((prev) =>
        prev.map((member) =>
          member.id === id
            ? {
                ...member,
                ...updatedMember.data,
              }
            : member,
        ),
      )

      cancelEditing(id)
    } catch (err) {
      console.error("Error updating member:", err)
      setError(err instanceof Error ? err.message : "Failed to update member")
    } finally {
      setSavingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const openCreateDialog = () => {
    setCreateDialog({ isOpen: true })
    setCreateFormData({
      first_name: "",
      middle_name: "",
      last_name: "",
      email: "",
      phone: "",
      notes: "",
      is_active: true,
    })
  }

  const closeCreateDialog = () => {
    setCreateDialog({ isOpen: false })
    setCreateFormData({
      first_name: "",
      middle_name: "",
      last_name: "",
      email: "",
      phone: "",
      notes: "",
      is_active: true,
    })
  }

  const updateCreateFormData = (field: string, value: string | boolean) => {
    setCreateFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const createMember = async () => {
    if (!createFormData.first_name.trim() || !createFormData.last_name.trim()) {
      setError("First name and last name are required")
      return
    }

    setCreating(true)

    try {
      const response = await fetch("/api/people", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createFormData),
      })

      if (!response.ok) {
        throw new Error(`Failed to create member: ${response.statusText}`)
      }

      const newMember = await response.json()
      setMembers((prev) => [newMember.data, ...prev])
      closeCreateDialog()
    } catch (err) {
      console.error("Error creating member:", err)
      setError(err instanceof Error ? err.message : "Failed to create member")
    } finally {
      setCreating(false)
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
      <EmmaTitleBar title="Members" backLink={{ href: "/admin", label: "Back to Admin" }} />

      <div className="p-6 pt-20">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex justify-between items-center">
            <p className="text-gray-600">Manage organization membership and contact information</p>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Member
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{memberStats.total}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">{memberStats.active}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Partial</p>
                  <p className="text-2xl font-bold text-yellow-600">{memberStats.partial}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Incomplete</p>
                  <p className="text-2xl font-bold text-orange-600">{memberStats.incomplete}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Inactive</p>
                  <p className="text-2xl font-bold text-gray-600">{memberStats.inactive}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search by name, email, or phone..."
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
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Incomplete">Incomplete</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center space-x-2">
                  <Switch checked={showInactive} onCheckedChange={setShowInactive} />
                  <label className="text-sm font-medium">Show Inactive</label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Members List */}
          <Card>
            <CardHeader>
              <CardTitle>Members ({filteredMembers.length})</CardTitle>
              <CardDescription>Organization membership directory and contact management</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Loading members...</p>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Members</h3>
                  <p className="text-red-600 mb-4">{error}</p>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    Try Again
                  </Button>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Members Found</h3>
                  <p className="text-gray-600 mb-4">
                    {searchTerm || statusFilter !== "all"
                      ? "No members match your current filters."
                      : "No members found in the system."}
                  </p>
                  {!searchTerm && statusFilter === "all" && (
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreateDialog}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Member
                    </Button>
                  )}
                </div>
              ) : (
                <TooltipProvider>
                  <div className="space-y-4">
                    {filteredMembers.map((member) => {
                      const isExpanded = expandedItems.has(member.id)
                      const isEditing = editingItems.has(member.id)
                      const isSaving = savingItems.has(member.id)
                      const formData = editFormData[member.id] || member
                      const memberStatus = getMembershipStatus(member)

                      return (
                        <div key={member.id} className="border rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between p-4">
                            <div className="flex items-center space-x-4 flex-1">
                              <Users className="w-5 h-5 text-blue-600" />
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <EmmaPersonDisplay person={member} showAvatar={true} showContactInfo={false} />
                                  {getStatusBadge(memberStatus)}
                                  {!member.is_active && (
                                    <Badge variant="secondary" className="text-gray-600">
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  {member.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="w-4 h-4" />
                                      {member.email}
                                    </span>
                                  )}
                                  {member.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="w-4 h-4" />
                                      {member.phone}
                                    </span>
                                  )}
                                  {member.physical_address && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-4 h-4" />
                                      {member.physical_address.city}, {member.physical_address.state}
                                    </span>
                                  )}
                                </div>
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
                                        onClick={() => saveChanges(member.id)}
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
                                        onClick={() => cancelEditing(member.id)}
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
                                        onClick={() => startEditing(member)}
                                        disabled={editingItems.size > 0}
                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Edit member</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => toggleExpanded(member.id)}
                                        className="text-gray-600 hover:text-gray-700"
                                      >
                                        {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{isExpanded ? "Hide details" : "Show details"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </>
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-4 pb-4 border-t bg-gray-50/50">
                              <div className="pt-4 space-y-4">
                                {isEditing ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">First Name *</label>
                                        <Input
                                          value={formData.first_name || ""}
                                          onChange={(e) => updateFormData(member.id, "first_name", e.target.value)}
                                          placeholder="First name"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Middle Name</label>
                                        <Input
                                          value={formData.middle_name || ""}
                                          onChange={(e) => updateFormData(member.id, "middle_name", e.target.value)}
                                          placeholder="Middle name (optional)"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Last Name *</label>
                                        <Input
                                          value={formData.last_name || ""}
                                          onChange={(e) => updateFormData(member.id, "last_name", e.target.value)}
                                          placeholder="Last name"
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Email</label>
                                        <Input
                                          type="email"
                                          value={formData.email || ""}
                                          onChange={(e) => updateFormData(member.id, "email", e.target.value)}
                                          placeholder="Email address"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Phone</label>
                                        <Input
                                          type="tel"
                                          value={formData.phone || ""}
                                          onChange={(e) => updateFormData(member.id, "phone", e.target.value)}
                                          placeholder="Phone number"
                                        />
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Switch
                                          checked={formData.is_active ?? true}
                                          onCheckedChange={(checked) => updateFormData(member.id, "is_active", checked)}
                                        />
                                        <label className="text-sm font-medium text-gray-700">Active Member</label>
                                      </div>
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="text-sm font-medium text-gray-700">Notes</label>
                                      <Textarea
                                        value={formData.notes || ""}
                                        onChange={(e) => updateFormData(member.id, "notes", e.target.value)}
                                        placeholder="Member notes and comments"
                                        rows={3}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Contact Information</label>
                                        <EmmaPersonDisplay person={member} showAvatar={true} showContactInfo={false} />
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Membership Status</label>
                                        <div className="mt-1">{getStatusBadge(memberStatus)}</div>
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Addresses</label>
                                        <div className="space-y-2">
                                          {member.physical_address_id && (
                                            <div>
                                              <p className="text-xs font-medium text-gray-500">Physical</p>
                                              <EmmaAddress
                                                label="Physical Address"
                                                addressId={member.physical_address_id}
                                                onAddressChange={() => {}}
                                              />
                                            </div>
                                          )}
                                          {member.mailing_address_id && (
                                            <div>
                                              <p className="text-xs font-medium text-gray-500">Mailing</p>
                                              <EmmaAddress
                                                label="Mailing Address"
                                                addressId={member.mailing_address_id}
                                                onAddressChange={() => {}}
                                              />
                                            </div>
                                          )}
                                          {member.billing_address_id && (
                                            <div>
                                              <p className="text-xs font-medium text-gray-500">Billing</p>
                                              <EmmaAddress
                                                label="Billing Address"
                                                addressId={member.billing_address_id}
                                                onAddressChange={() => {}}
                                              />
                                            </div>
                                          )}
                                          {!member.physical_address_id &&
                                            !member.mailing_address_id &&
                                            !member.billing_address_id && (
                                              <p className="text-sm text-gray-500">No addresses on file</p>
                                            )}
                                        </div>
                                      </div>
                                    </div>
                                    {member.notes && (
                                      <div className="md:col-span-2">
                                        <label className="text-sm font-medium text-gray-700">Notes</label>
                                        <p className="text-sm text-gray-900 mt-1 p-3 bg-white rounded border">
                                          {member.notes}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
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

      {/* Create Member Dialog */}
      <Dialog open={createDialog.isOpen} onOpenChange={closeCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Member</DialogTitle>
            <DialogDescription>Create a new member profile. First name and last name are required.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">First Name *</label>
                <Input
                  value={createFormData.first_name}
                  onChange={(e) => updateCreateFormData("first_name", e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Middle Name</label>
                <Input
                  value={createFormData.middle_name}
                  onChange={(e) => updateCreateFormData("middle_name", e.target.value)}
                  placeholder="Middle name (optional)"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Last Name *</label>
                <Input
                  value={createFormData.last_name}
                  onChange={(e) => updateCreateFormData("last_name", e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Email</label>
                <Input
                  type="email"
                  value={createFormData.email}
                  onChange={(e) => updateCreateFormData("email", e.target.value)}
                  placeholder="Email address"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Phone</label>
                <Input
                  type="tel"
                  value={createFormData.phone}
                  onChange={(e) => updateCreateFormData("phone", e.target.value)}
                  placeholder="Phone number"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <Textarea
                value={createFormData.notes}
                onChange={(e) => updateCreateFormData("notes", e.target.value)}
                placeholder="Member notes and comments"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={createFormData.is_active}
                onCheckedChange={(checked) => updateCreateFormData("is_active", checked)}
              />
              <label className="text-sm font-medium text-gray-700">Active Member</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCreateDialog}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={createMember}
              disabled={creating || !createFormData.first_name.trim() || !createFormData.last_name.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Member
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
