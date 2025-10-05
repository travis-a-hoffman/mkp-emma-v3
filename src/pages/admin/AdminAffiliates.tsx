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
  Building2,
  Search,
  Eye,
  EyeOff,
  Edit,
  Save,
  X,
  Plus,
  Mail,
  Phone,
  Globe,
  MapPin,
  Loader2,
  Handshake,
  DollarSign,
  Truck,
  Users,
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
import { useState, useEffect } from "react"

interface Affiliate {
  id: string
  name: string
  type: "sponsor" | "partner" | "vendor" | "venue" | "referral" | "other"
  description?: string | null
  website?: string | null
  email?: string | null
  phone?: string | null
  contact_person?: string | null
  contact_title?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  relationship_status: "active" | "inactive" | "pending" | "suspended"
  contract_start?: string | null
  contract_end?: string | null
  notes?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const affiliateTypes = [
  { value: "sponsor", label: "Sponsor", icon: DollarSign, color: "text-green-600" },
  { value: "partner", label: "Partner", icon: Handshake, color: "text-blue-600" },
  { value: "vendor", label: "Vendor", icon: Truck, color: "text-orange-600" },
  { value: "venue", label: "Venue", icon: Building2, color: "text-purple-600" },
  { value: "referral", label: "Referral Source", icon: Users, color: "text-indigo-600" },
  { value: "other", label: "Other", icon: Building2, color: "text-gray-600" },
]

const relationshipStatuses = [
  { value: "active", label: "Active", color: "bg-green-100 text-green-800 border-green-300" },
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { value: "inactive", label: "Inactive", color: "bg-gray-100 text-gray-800 border-gray-300" },
  { value: "suspended", label: "Suspended", color: "bg-red-100 text-red-800 border-red-300" },
]

const getTypeInfo = (type: string) => {
  return affiliateTypes.find((t) => t.value === type) || affiliateTypes[affiliateTypes.length - 1]
}

const getStatusBadge = (status: string) => {
  const statusInfo = relationshipStatuses.find((s) => s.value === status)
  if (!statusInfo) return <Badge variant="outline">{status}</Badge>

  return <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
}

export default function AdminAffiliates() {
  const { isAuthenticated, isLoading } = useAuth0()
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showInactive, setShowInactive] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set())
  const [editFormData, setEditFormData] = useState<Record<string, Partial<Affiliate>>>({})
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set())
  const [createDialog, setCreateDialog] = useState({ isOpen: false })
  const [createFormData, setCreateFormData] = useState({
    name: "",
    type: "partner" as Affiliate["type"],
    description: "",
    website: "",
    email: "",
    phone: "",
    contact_person: "",
    contact_title: "",
    contact_email: "",
    contact_phone: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "United States",
    relationship_status: "active" as Affiliate["relationship_status"],
    contract_start: "",
    contract_end: "",
    notes: "",
    is_active: true,
  })
  const [creating, setCreating] = useState(false)

  const filteredAffiliates = affiliates.filter((affiliate) => {
    const matchesSearch =
      affiliate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      affiliate.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      affiliate.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      affiliate.description?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = typeFilter === "all" || affiliate.type === typeFilter
    const matchesStatus = statusFilter === "all" || affiliate.relationship_status === statusFilter
    const matchesActive = showInactive || affiliate.is_active

    return matchesSearch && matchesType && matchesStatus && matchesActive
  })

  const affiliateStats = {
    total: affiliates.length,
    active: affiliates.filter((a) => a.relationship_status === "active").length,
    pending: affiliates.filter((a) => a.relationship_status === "pending").length,
    sponsors: affiliates.filter((a) => a.type === "sponsor").length,
    partners: affiliates.filter((a) => a.type === "partner").length,
    vendors: affiliates.filter((a) => a.type === "vendor").length,
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [isAuthenticated])

  const fetchData = async () => {
    try {
      setLoading(true)
      // Since there's no affiliates API yet, we'll simulate with empty data
      // In a real implementation, this would fetch from /api/affiliates
      setAffiliates([])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch affiliates")
      console.error("Error fetching affiliates:", err)
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

  const startEditing = (affiliate: Affiliate) => {
    if (editingItems.size > 0) return // Prevent editing multiple items

    setEditingItems((prev) => new Set(prev).add(affiliate.id))
    setEditFormData((prev) => ({
      ...prev,
      [affiliate.id]: { ...affiliate },
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

  const updateFormData = (id: string, field: keyof Affiliate, value: string | boolean | null) => {
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
      // Simulate API call - in real implementation, this would be:
      // const response = await fetch(`/api/affiliates/${id}`, { method: "PUT", ... })

      // For now, just update local state
      setAffiliates((prev) =>
        prev.map((affiliate) =>
          affiliate.id === id
            ? {
                ...affiliate,
                ...formData,
                updated_at: new Date().toISOString(),
              }
            : affiliate,
        ),
      )

      cancelEditing(id)
    } catch (err) {
      console.error("Error updating affiliate:", err)
      setError(err instanceof Error ? err.message : "Failed to update affiliate")
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
      name: "",
      type: "partner",
      description: "",
      website: "",
      email: "",
      phone: "",
      contact_person: "",
      contact_title: "",
      contact_email: "",
      contact_phone: "",
      address: "",
      city: "",
      state: "",
      postal_code: "",
      country: "United States",
      relationship_status: "active",
      contract_start: "",
      contract_end: "",
      notes: "",
      is_active: true,
    })
  }

  const closeCreateDialog = () => {
    setCreateDialog({ isOpen: false })
  }

  const updateCreateFormData = (field: string, value: string | boolean) => {
    setCreateFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const createAffiliate = async () => {
    if (!createFormData.name.trim()) {
      setError("Organization name is required")
      return
    }

    setCreating(true)

    try {
      // Simulate API call - in real implementation, this would be:
      // const response = await fetch("/api/affiliates", { method: "POST", ... })

      const newAffiliate: Affiliate = {
        id: `affiliate-${Date.now()}`, // Temporary ID
        ...createFormData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      setAffiliates((prev) => [newAffiliate, ...prev])
      closeCreateDialog()
    } catch (err) {
      console.error("Error creating affiliate:", err)
      setError(err instanceof Error ? err.message : "Failed to create affiliate")
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
      <EmmaTitleBar title="Affiliates" backLink={{ href: "/admin", label: "Back to Admin" }} />

      <div className="p-6 pt-20">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex justify-between items-center">
            <p className="text-gray-600">Manage partner organizations, sponsors, and business relationships</p>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Affiliate
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{affiliateStats.total}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">{affiliateStats.active}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{affiliateStats.pending}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Sponsors</p>
                  <p className="text-2xl font-bold text-green-600">{affiliateStats.sponsors}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Partners</p>
                  <p className="text-2xl font-bold text-blue-600">{affiliateStats.partners}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">Vendors</p>
                  <p className="text-2xl font-bold text-orange-600">{affiliateStats.vendors}</p>
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
                      placeholder="Search by name, contact, or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {affiliateTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {relationshipStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center space-x-2">
                  <Switch checked={showInactive} onCheckedChange={setShowInactive} />
                  <label className="text-sm font-medium">Show Inactive</label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Affiliates List */}
          <Card>
            <CardHeader>
              <CardTitle>Affiliates ({filteredAffiliates.length})</CardTitle>
              <CardDescription>Partner organizations and business relationships</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Loading affiliates...</p>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <Building2 className="w-16 h-16 text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Affiliates</h3>
                  <p className="text-red-600 mb-4">{error}</p>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    Try Again
                  </Button>
                </div>
              ) : filteredAffiliates.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Affiliates Found</h3>
                  <p className="text-gray-600 mb-4">
                    {searchTerm || typeFilter !== "all" || statusFilter !== "all"
                      ? "No affiliates match your current filters."
                      : "No affiliate organizations found in the system."}
                  </p>
                  {!searchTerm && typeFilter === "all" && statusFilter === "all" && (
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreateDialog}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Affiliate
                    </Button>
                  )}
                </div>
              ) : (
                <TooltipProvider>
                  <div className="space-y-4">
                    {filteredAffiliates.map((affiliate) => {
                      const isExpanded = expandedItems.has(affiliate.id)
                      const isEditing = editingItems.has(affiliate.id)
                      const isSaving = savingItems.has(affiliate.id)
                      const formData = editFormData[affiliate.id] || affiliate
                      const typeInfo = getTypeInfo(affiliate.type)
                      const TypeIcon = typeInfo.icon

                      return (
                        <div key={affiliate.id} className="border rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between p-4">
                            <div className="flex items-center space-x-4 flex-1">
                              <TypeIcon className={`w-5 h-5 ${typeInfo.color}`} />
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h4 className="font-semibold text-gray-900">{affiliate.name}</h4>
                                  <Badge variant="outline" className={typeInfo.color}>
                                    {typeInfo.label}
                                  </Badge>
                                  {getStatusBadge(affiliate.relationship_status)}
                                  {!affiliate.is_active && (
                                    <Badge variant="secondary" className="text-gray-600">
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  {affiliate.contact_person && (
                                    <span className="flex items-center gap-1">
                                      <Users className="w-4 h-4" />
                                      {affiliate.contact_person}
                                    </span>
                                  )}
                                  {affiliate.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="w-4 h-4" />
                                      {affiliate.email}
                                    </span>
                                  )}
                                  {affiliate.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="w-4 h-4" />
                                      {affiliate.phone}
                                    </span>
                                  )}
                                  {affiliate.website && (
                                    <span className="flex items-center gap-1">
                                      <Globe className="w-4 h-4" />
                                      Website
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
                                        onClick={() => saveChanges(affiliate.id)}
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
                                        onClick={() => cancelEditing(affiliate.id)}
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
                                        onClick={() => startEditing(affiliate)}
                                        disabled={editingItems.size > 0}
                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Edit affiliate</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => toggleExpanded(affiliate.id)}
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
                                        <label className="text-sm font-medium text-gray-700">Organization Name *</label>
                                        <Input
                                          value={formData.name || ""}
                                          onChange={(e) => updateFormData(affiliate.id, "name", e.target.value)}
                                          placeholder="Organization name"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Type</label>
                                        <Select
                                          value={formData.type || "partner"}
                                          onValueChange={(value) =>
                                            updateFormData(affiliate.id, "type", value as Affiliate["type"])
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {affiliateTypes.map((type) => (
                                              <SelectItem key={type.value} value={type.value}>
                                                {type.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Status</label>
                                        <Select
                                          value={formData.relationship_status || "active"}
                                          onValueChange={(value) =>
                                            updateFormData(
                                              affiliate.id,
                                              "relationship_status",
                                              value as Affiliate["relationship_status"],
                                            )
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {relationshipStatuses.map((status) => (
                                              <SelectItem key={status.value} value={status.value}>
                                                {status.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Switch
                                          checked={formData.is_active ?? true}
                                          onCheckedChange={(checked) =>
                                            updateFormData(affiliate.id, "is_active", checked)
                                          }
                                        />
                                        <label className="text-sm font-medium text-gray-700">Active</label>
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Website</label>
                                        <Input
                                          value={formData.website || ""}
                                          onChange={(e) => updateFormData(affiliate.id, "website", e.target.value)}
                                          placeholder="https://example.com"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Email</label>
                                        <Input
                                          type="email"
                                          value={formData.email || ""}
                                          onChange={(e) => updateFormData(affiliate.id, "email", e.target.value)}
                                          placeholder="contact@example.com"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Phone</label>
                                        <Input
                                          type="tel"
                                          value={formData.phone || ""}
                                          onChange={(e) => updateFormData(affiliate.id, "phone", e.target.value)}
                                          placeholder="Phone number"
                                        />
                                      </div>
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="text-sm font-medium text-gray-700">Description</label>
                                      <Textarea
                                        value={formData.description || ""}
                                        onChange={(e) => updateFormData(affiliate.id, "description", e.target.value)}
                                        placeholder="Organization description and relationship details"
                                        rows={3}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">
                                          Organization Details
                                        </label>
                                        <div className="space-y-1">
                                          <p className="text-sm text-gray-900 font-medium">{affiliate.name}</p>
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className={typeInfo.color}>
                                              {typeInfo.label}
                                            </Badge>
                                            {getStatusBadge(affiliate.relationship_status)}
                                          </div>
                                          {affiliate.description && (
                                            <p className="text-sm text-gray-600">{affiliate.description}</p>
                                          )}
                                        </div>
                                      </div>
                                      {affiliate.contact_person && (
                                        <div>
                                          <label className="text-sm font-medium text-gray-700">Primary Contact</label>
                                          <div className="space-y-1">
                                            <p className="text-sm text-gray-900">
                                              {affiliate.contact_person}
                                              {affiliate.contact_title && ` - ${affiliate.contact_title}`}
                                            </p>
                                            {affiliate.contact_email && (
                                              <p className="text-sm text-gray-600 flex items-center gap-1">
                                                <Mail className="w-3 h-3" />
                                                {affiliate.contact_email}
                                              </p>
                                            )}
                                            {affiliate.contact_phone && (
                                              <p className="text-sm text-gray-600 flex items-center gap-1">
                                                <Phone className="w-3 h-3" />
                                                {affiliate.contact_phone}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-sm font-medium text-gray-700">Contact Information</label>
                                        <div className="space-y-1">
                                          {affiliate.website && (
                                            <p className="text-sm text-gray-600 flex items-center gap-1">
                                              <Globe className="w-3 h-3" />
                                              <a
                                                href={affiliate.website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline"
                                              >
                                                {affiliate.website}
                                              </a>
                                            </p>
                                          )}
                                          {affiliate.email && (
                                            <p className="text-sm text-gray-600 flex items-center gap-1">
                                              <Mail className="w-3 h-3" />
                                              {affiliate.email}
                                            </p>
                                          )}
                                          {affiliate.phone && (
                                            <p className="text-sm text-gray-600 flex items-center gap-1">
                                              <Phone className="w-3 h-3" />
                                              {affiliate.phone}
                                            </p>
                                          )}
                                          {(affiliate.city || affiliate.state) && (
                                            <p className="text-sm text-gray-600 flex items-center gap-1">
                                              <MapPin className="w-3 h-3" />
                                              {[affiliate.city, affiliate.state].filter(Boolean).join(", ")}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {affiliate.notes && (
                                      <div className="md:col-span-2">
                                        <label className="text-sm font-medium text-gray-700">Notes</label>
                                        <p className="text-sm text-gray-900 mt-1 p-3 bg-white rounded border">
                                          {affiliate.notes}
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

      {/* Create Affiliate Dialog */}
      <Dialog open={createDialog.isOpen} onOpenChange={closeCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Affiliate</DialogTitle>
            <DialogDescription>Create a new affiliate organization. Organization name is required.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Organization Name *</label>
                <Input
                  value={createFormData.name}
                  onChange={(e) => updateCreateFormData("name", e.target.value)}
                  placeholder="Organization name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Type</label>
                <Select value={createFormData.type} onValueChange={(value) => updateCreateFormData("type", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {affiliateTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Website</label>
                <Input
                  value={createFormData.website}
                  onChange={(e) => updateCreateFormData("website", e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Email</label>
                <Input
                  type="email"
                  value={createFormData.email}
                  onChange={(e) => updateCreateFormData("email", e.target.value)}
                  placeholder="contact@example.com"
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
              <label className="text-sm font-medium text-gray-700">Description</label>
              <Textarea
                value={createFormData.description}
                onChange={(e) => updateCreateFormData("description", e.target.value)}
                placeholder="Organization description and relationship details"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Relationship Status</label>
                <Select
                  value={createFormData.relationship_status}
                  onValueChange={(value) => updateCreateFormData("relationship_status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {relationshipStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  checked={createFormData.is_active}
                  onCheckedChange={(checked) => updateCreateFormData("is_active", checked)}
                />
                <label className="text-sm font-medium text-gray-700">Active</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCreateDialog}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={createAffiliate}
              disabled={creating || !createFormData.name.trim()}
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
                  Add Affiliate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
