"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Plus, Edit, Save, X, Loader2 } from "lucide-react"
import type { Prospect } from "../../types/person"

interface EmmaProspectModalProps {
  isOpen: boolean
  onClose: () => void
  onProspectSelect: (prospect: Prospect | null) => void
  currentProspect?: Prospect | null
  title?: string
  eventId?: string
}

export function EmmaProspectModal({
  isOpen,
  onClose,
  onProspectSelect,
  currentProspect,
  title = "Manage Prospect",
  eventId,
}: EmmaProspectModalProps) {
  const [activeTab, setActiveTab] = useState("search")
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null)
  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    phone: "",
    notes: "",
    is_active: true,
  })

  useEffect(() => {
    if (isOpen) {
      if (currentProspect) {
        setActiveTab("edit")
        setEditingProspect(currentProspect)
        setFormData({
          first_name: currentProspect.first_name,
          middle_name: currentProspect.middle_name || "",
          last_name: currentProspect.last_name,
          email: currentProspect.email || "",
          phone: currentProspect.phone || "",
          notes: currentProspect.notes || "",
          is_active: currentProspect.is_active,
        })
      } else {
        setActiveTab("search")
        resetForm()
      }
      fetchProspects()
    }
  }, [isOpen, currentProspect])

  const resetForm = () => {
    setFormData({
      first_name: "",
      middle_name: "",
      last_name: "",
      email: "",
      phone: "",
      notes: "",
      is_active: true,
    })
    setEditingProspect(null)
  }

  const fetchProspects = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/prospects?active=true")
      if (response.ok) {
        const data = await response.json()
        setProspects(data.data || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching prospects:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const isEditing = editingProspect !== null
      const url = isEditing ? `/api/prospects/${editingProspect.id}` : "/api/prospects"
      const method = isEditing ? "PUT" : "POST"
      const body = isEditing ? { id: editingProspect.id, ...formData } : formData

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const data = await response.json()
        const savedProspect = data.data

        if (isEditing) {
          setProspects((prev) => prev.map((prospect) => (prospect.id === savedProspect.id ? savedProspect : prospect)))
        } else {
          setProspects((prev) => [savedProspect, ...prev])
        }

        onProspectSelect(savedProspect)

        // Close modal after a brief delay to allow state updates to complete
        setTimeout(() => {
          onClose()
        }, 100)
      }
    } catch (error) {
      console.error("[v0] Error saving prospect:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    resetForm()
    onClose()
  }

  const handleRemoveProspect = () => {
    onProspectSelect(null)
  }

  const filteredProspects = prospects.filter((prospect) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    const fullName = [prospect.first_name, prospect.middle_name, prospect.last_name].filter(Boolean).join(" ")
    return (
      fullName.toLowerCase().includes(searchLower) ||
      prospect.email?.toLowerCase().includes(searchLower) ||
      prospect.phone?.toLowerCase().includes(searchLower)
    )
  })

  const formatProspectName = (prospect: Prospect) => {
    return [prospect.first_name, prospect.middle_name, prospect.last_name].filter(Boolean).join(" ")
  }

  const getProspectInitials = (prospect: Prospect) => {
    const firstInitial = prospect.first_name?.charAt(0) || ""
    const lastInitial = prospect.last_name?.charAt(0) || ""
    return (firstInitial + lastInitial).toUpperCase()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Search for an existing prospect, create a new one, or edit the current prospect.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search">
              <Search className="w-4 h-4 mr-2" />
              Search
            </TabsTrigger>
            <TabsTrigger value="create">
              <Plus className="w-4 h-4 mr-2" />
              Create New
            </TabsTrigger>
            <TabsTrigger value="edit" disabled={!currentProspect}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Current
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Prospects</Label>
              <Input
                id="search"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredProspects.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {searchQuery ? "No prospects found matching your search." : "No prospects available."}
                  </div>
                ) : (
                  filteredProspects.map((prospect) => (
                    <div
                      key={prospect.id}
                      className="p-3 border rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => onProspectSelect(prospect)}
                    >
                      <div className="flex items-start space-x-3">
                        {prospect.photo_url ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                            <img
                              src={prospect.photo_url.split("?")[0] || "/placeholder.svg"}
                              alt={formatProspectName(prospect)}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600 flex-shrink-0">
                            {getProspectInitials(prospect)}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{formatProspectName(prospect)}</div>
                          {prospect.email && <div className="text-xs text-gray-500">{prospect.email}</div>}
                          {prospect.phone && <div className="text-xs text-gray-500">{prospect.phone}</div>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="middle_name">Middle Name</Label>
                <Input
                  id="middle_name"
                  value={formData.middle_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, middle_name: e.target.value }))}
                  placeholder="Michael"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="john.doe@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about this prospect..."
                  rows={3}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="edit" className="space-y-4">
            {currentProspect && (
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_first_name">First Name *</Label>
                    <Input
                      id="edit_first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_last_name">Last Name *</Label>
                    <Input
                      id="edit_last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_middle_name">Middle Name</Label>
                  <Input
                    id="edit_middle_name"
                    value={formData.middle_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, middle_name: e.target.value }))}
                    placeholder="Michael"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_email">Email</Label>
                    <Input
                      id="edit_email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="john.doe@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_phone">Phone</Label>
                    <Input
                      id="edit_phone"
                      value={formData.phone}
                      onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_notes">Notes</Label>
                  <Textarea
                    id="edit_notes"
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes about this prospect..."
                    rows={3}
                  />
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between">
          <div>
            {currentProspect && (
              <Button
                variant="outline"
                onClick={handleRemoveProspect}
                className="text-red-600 hover:text-red-700 bg-transparent"
              >
                Remove Prospect
              </Button>
            )}
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            {(activeTab === "create" || activeTab === "edit") && (
              <Button onClick={handleSave} disabled={saving || !formData.first_name || !formData.last_name}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Prospect
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
