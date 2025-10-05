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
import type { Person } from "../../types/person"

interface EmmaPersonModalProps {
  isOpen: boolean
  onClose: () => void
  onPersonSelect: (person: Person | null) => void
  currentPerson?: Person | null
  title?: string
  eventId?: string
  createRegistrant?: boolean
}

export function EmmaPersonModal({
  isOpen,
  onClose,
  onPersonSelect,
  currentPerson,
  title = "Manage Person",
  eventId,
  createRegistrant = false,
}: EmmaPersonModalProps) {
  const [activeTab, setActiveTab] = useState("search")
  const [people, setPeople] = useState<Person[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
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
      if (currentPerson) {
        setActiveTab("edit")
        setEditingPerson(currentPerson)
        setFormData({
          first_name: currentPerson.first_name,
          middle_name: currentPerson.middle_name || "",
          last_name: currentPerson.last_name,
          email: currentPerson.email || "",
          phone: currentPerson.phone || "",
          notes: currentPerson.notes || "",
          is_active: currentPerson.is_active,
        })
      } else {
        setActiveTab("search")
        resetForm()
      }
      fetchPeople()
    }
  }, [isOpen, currentPerson])

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
    setEditingPerson(null)
  }

  const fetchPeople = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/people?active=true")
      if (response.ok) {
        const data = await response.json()
        setPeople(data.data || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching people:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const isEditing = editingPerson !== null
      const url = isEditing ? `/api/people/${editingPerson.id}` : "/api/people"
      const method = isEditing ? "PUT" : "POST"
      const body = isEditing ? { id: editingPerson.id, ...formData } : formData

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const data = await response.json()
        const savedPerson = data.data

        if (isEditing) {
          setPeople((prev) => prev.map((person) => (person.id === savedPerson.id ? savedPerson : person)))
        } else {
          setPeople((prev) => [savedPerson, ...prev])
        }

        if (createRegistrant && eventId && !isEditing) {
          try {
            console.log("[v0] Creating registrant record for person:", savedPerson.id, "event:", eventId)
            const registrantResponse = await fetch("/api/registrants", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                person_id: savedPerson.id,
                event_id: eventId,
                is_active: true,
              }),
            })

            if (registrantResponse.ok) {
              console.log("[v0] Successfully created registrant record")
            } else {
              console.error("[v0] Failed to create registrant record:", await registrantResponse.text())
            }
          } catch (registrantError) {
            console.error("[v0] Error creating registrant record:", registrantError)
          }
        }

        onPersonSelect(savedPerson)

        // Close modal after a brief delay to allow state updates to complete
        setTimeout(() => {
          onClose()
        }, 100)
      }
    } catch (error) {
      console.error("[v0] Error saving person:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    resetForm()
    onClose()
  }

  const handleRemovePerson = () => {
    onPersonSelect(null)
  }

  const filteredPeople = people.filter((person) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    const fullName = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ")
    return (
      fullName.toLowerCase().includes(searchLower) ||
      person.email?.toLowerCase().includes(searchLower) ||
      person.phone?.toLowerCase().includes(searchLower)
    )
  })

  const formatPersonName = (person: Person) => {
    return [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ")
  }

  const getPersonInitials = (person: Person) => {
    const firstInitial = person.first_name?.charAt(0) || ""
    const lastInitial = person.last_name?.charAt(0) || ""
    return (firstInitial + lastInitial).toUpperCase()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Search for an existing person, create a new one, or edit the current person.
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
            <TabsTrigger value="edit" disabled={!currentPerson}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Current
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search People</Label>
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
                {filteredPeople.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {searchQuery ? "No people found matching your search." : "No people available."}
                  </div>
                ) : (
                  filteredPeople.map((person) => (
                    <div
                      key={person.id}
                      className="p-3 border rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => onPersonSelect(person)}
                    >
                      <div className="flex items-start space-x-3">
                        {person.photo_url ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                            <img
                              src={person.photo_url.split("?")[0] || "/placeholder.svg"}
                              alt={formatPersonName(person)}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600 flex-shrink-0">
                            {getPersonInitials(person)}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{formatPersonName(person)}</div>
                          {person.email && <div className="text-xs text-gray-500">{person.email}</div>}
                          {person.phone && <div className="text-xs text-gray-500">{person.phone}</div>}
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
                  placeholder="Additional notes about this person..."
                  rows={3}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="edit" className="space-y-4">
            {currentPerson && (
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
                    placeholder="Additional notes about this person..."
                    rows={3}
                  />
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between">
          <div>
            {currentPerson && (
              <Button
                variant="outline"
                onClick={handleRemovePerson}
                className="text-red-600 hover:text-red-700 bg-transparent"
              >
                Remove Person
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
                    Save Person
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
