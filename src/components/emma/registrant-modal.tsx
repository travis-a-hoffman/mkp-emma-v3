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
import type { EventBasic } from "../../types/event"
import type { Registrant } from "../../types/person"

interface EmmaRegistrantModalProps {
  isOpen: boolean
  onClose: () => void
  onRegistrantSelect: (registrant: Registrant<EventBasic> | null) => void
  currentRegistrant?: Registrant<EventBasic> | null
  title?: string
  eventId?: string
}

export function EmmaRegistrantModal({
  isOpen,
  onClose,
  onRegistrantSelect,
  currentRegistrant,
  title = "Manage Registrant",
  eventId,
}: EmmaRegistrantModalProps) {
  const [activeTab, setActiveTab] = useState("search")
  const [registrants, setRegistrants] = useState<Registrant<EventBasic>[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingRegistrant, setEditingRegistrant] = useState<Registrant<EventBasic> | null>(null)
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
      if (currentRegistrant) {
        setActiveTab("edit")
        setEditingRegistrant(currentRegistrant)
        setFormData({
          first_name: currentRegistrant.first_name,
          middle_name: currentRegistrant.middle_name || "",
          last_name: currentRegistrant.last_name,
          email: currentRegistrant.email || "",
          phone: currentRegistrant.phone || "",
          notes: currentRegistrant.notes || "",
          is_active: currentRegistrant.is_active,
        })
      } else {
        setActiveTab("search")
        resetForm()
      }
      fetchRegistrants()
    }
  }, [isOpen, currentRegistrant])

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
    setEditingRegistrant(null)
  }

  const fetchRegistrants = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/registrants?active=true")
      if (response.ok) {
        const data = await response.json()
        setRegistrants(data.data || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching registrants:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const isEditing = editingRegistrant !== null
      const url = isEditing ? `/api/registrants/${editingRegistrant.id}` : "/api/registrants"
      const method = isEditing ? "PUT" : "POST"
      const body = isEditing ? { id: editingRegistrant.id, ...formData } : formData

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const data = await response.json()
        const savedRegistrant = data.data

        if (isEditing) {
          setRegistrants((prev) => prev.map((registrant) => (registrant.id === savedRegistrant.id ? savedRegistrant : registrant)))
        } else {
          setRegistrants((prev) => [savedRegistrant, ...prev])
        }

        onRegistrantSelect(savedRegistrant)

        // Close modal after a brief delay to allow state updates to complete
        setTimeout(() => {
          onClose()
        }, 100)
      }
    } catch (error) {
      console.error("[v0] Error saving registrant:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    resetForm()
    onClose()
  }

  const handleRemoveRegistrant = () => {
    onRegistrantSelect(null)
  }

  const filteredRegistrants = registrants.filter((registrant) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    const fullName = [registrant.first_name, registrant.middle_name, registrant.last_name].filter(Boolean).join(" ")
    return (
      fullName.toLowerCase().includes(searchLower) ||
      registrant.email?.toLowerCase().includes(searchLower) ||
      registrant.phone?.toLowerCase().includes(searchLower)
    )
  })

  const formatRegistrantName = (registrant: Registrant<EventBasic>) => {
    return [registrant.first_name, registrant.middle_name, registrant.last_name].filter(Boolean).join(" ")
  }

  const getRegistrantInitials = (registrant: Registrant<EventBasic>) => {
    const firstInitial = registrant.first_name?.charAt(0) || ""
    const lastInitial = registrant.last_name?.charAt(0) || ""
    return (firstInitial + lastInitial).toUpperCase()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Search for an existing registrant, create a new one, or edit the current registrant.
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
            <TabsTrigger value="edit" disabled={!currentRegistrant}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Current
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Registrants</Label>
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
                {filteredRegistrants.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {searchQuery ? "No registrants found matching your search." : "No registrants available."}
                  </div>
                ) : (
                  filteredRegistrants.map((registrant) => (
                    <div
                      key={registrant.id}
                      className="p-3 border rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => onRegistrantSelect(registrant)}
                    >
                      <div className="flex items-start space-x-3">
                        {registrant.photo_url ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                            <img
                              src={registrant.photo_url.split("?")[0] || "/placeholder.svg"}
                              alt={formatRegistrantName(registrant)}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600 flex-shrink-0">
                            {getRegistrantInitials(registrant)}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{formatRegistrantName(registrant)}</div>
                          {registrant.email && <div className="text-xs text-gray-500">{registrant.email}</div>}
                          {registrant.phone && <div className="text-xs text-gray-500">{registrant.phone}</div>}
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
                  placeholder="Additional notes about this registrant..."
                  rows={3}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="edit" className="space-y-4">
            {currentRegistrant && (
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
                    placeholder="Additional notes about this registrant..."
                    rows={3}
                  />
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between">
          <div>
            {currentRegistrant && (
              <Button
                variant="outline"
                onClick={handleRemoveRegistrant}
                className="text-red-600 hover:text-red-700 bg-transparent"
              >
                Remove Registrant
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
                    Save Registrant
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
