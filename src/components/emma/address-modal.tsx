"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Plus, Edit, Save, X, MapPin, Loader2 } from "lucide-react"

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

interface EmmaAddressModalProps {
  isOpen: boolean
  onClose: () => void
  onAddressSelect: (address: Address | null) => void
  currentAddress?: Address | null
  title?: string
}

export function EmmaAddressModal({
  isOpen,
  onClose,
  onAddressSelect,
  currentAddress,
  title = "Manage Address",
}: EmmaAddressModalProps) {
  const [activeTab, setActiveTab] = useState("search")
  const [addresses, setAddresses] = useState<Address[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [formData, setFormData] = useState({
    address_1: "",
    address_2: "",
    city: "",
    state: "",
    country: "United States",
    postal_code: "", // Added postal_code to form data
  })

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (currentAddress) {
        setActiveTab("edit")
        setEditingAddress(currentAddress)
        setFormData({
          address_1: currentAddress.address_1,
          address_2: currentAddress.address_2 || "",
          city: currentAddress.city,
          state: currentAddress.state,
          country: currentAddress.country,
          postal_code: currentAddress.postal_code, // Include postal_code when editing
        })
      } else {
        setActiveTab("search")
        resetForm()
      }
      fetchAddresses()
    }
  }, [isOpen, currentAddress])

  const resetForm = () => {
    setFormData({
      address_1: "",
      address_2: "",
      city: "",
      state: "",
      country: "United States",
      postal_code: "", // Reset postal_code
    })
    setEditingAddress(null)
  }

  const fetchAddresses = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/addresses")
      if (response.ok) {
        const data = await response.json()
        setAddresses(data.data || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching addresses:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const isEditing = editingAddress !== null
      const url = isEditing ? `/api/addresses/${editingAddress.id}` : "/api/addresses"
      const method = isEditing ? "PUT" : "POST"
      const body = isEditing ? { id: editingAddress.id, ...formData } : formData

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const data = await response.json()
        const savedAddress = data.data

        // Update local addresses list
        if (isEditing) {
          setAddresses((prev) => prev.map((addr) => (addr.id === savedAddress.id ? savedAddress : addr)))
        } else {
          setAddresses((prev) => [savedAddress, ...prev])
        }

        onAddressSelect(savedAddress)
      }
    } catch (error) {
      console.error("[v0] Error saving address:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    resetForm()
    onClose()
  }

  const handleRemoveAddress = () => {
    onAddressSelect(null)
  }

  const filteredAddresses = addresses.filter((address) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      address.address_1.toLowerCase().includes(searchLower) ||
      address.city.toLowerCase().includes(searchLower) ||
      address.state.toLowerCase().includes(searchLower) ||
      address.country.toLowerCase().includes(searchLower) ||
      address.postal_code.toLowerCase().includes(searchLower) // Include postal_code in search
    )
  })

  const formatAddress = (address: Address) => {
    const parts = [
      address.address_1,
      address.address_2,
      `${address.city}, ${address.state} ${address.postal_code}`, // Include postal_code in formatted address
      address.country,
    ].filter(Boolean)
    return parts.join(", ")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Search for an existing address, create a new one, or edit the current address.
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
            <TabsTrigger value="edit" disabled={!currentAddress}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Current
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Addresses</Label>
              <Input
                id="search"
                placeholder="Search by address, city, state, postal code, or country..."
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
                {filteredAddresses.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {searchQuery ? "No addresses found matching your search." : "No addresses available."}
                  </div>
                ) : (
                  filteredAddresses.map((address) => (
                    <div
                      key={address.id}
                      className="p-3 border rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => onAddressSelect(address)}
                    >
                      <div className="flex items-start space-x-2">
                        <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{formatAddress(address)}</div>
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
              <div className="space-y-2">
                <Label htmlFor="address_1">Address Line 1 *</Label>
                <Input
                  id="address_1"
                  value={formData.address_1}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address_1: e.target.value }))}
                  placeholder="123 Main Street"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_2">Address Line 2</Label>
                <Input
                  id="address_2"
                  value={formData.address_2}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address_2: e.target.value }))}
                  placeholder="Apt 4B, Suite 100, etc."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="New York"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State/Province *</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                    placeholder="NY"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postal Code *</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, postal_code: e.target.value }))}
                    placeholder="10001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                    placeholder="United States"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="edit" className="space-y-4">
            {currentAddress && (
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_address_1">Address Line 1 *</Label>
                  <Input
                    id="edit_address_1"
                    value={formData.address_1}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address_1: e.target.value }))}
                    placeholder="123 Main Street"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_address_2">Address Line 2</Label>
                  <Input
                    id="edit_address_2"
                    value={formData.address_2}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address_2: e.target.value }))}
                    placeholder="Apt 4B, Suite 100, etc."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_city">City *</Label>
                    <Input
                      id="edit_city"
                      value={formData.city}
                      onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                      placeholder="New York"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_state">State/Province *</Label>
                    <Input
                      id="edit_state"
                      value={formData.state}
                      onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                      placeholder="NY"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_postal_code">Postal Code *</Label>
                    <Input
                      id="edit_postal_code"
                      value={formData.postal_code}
                      onChange={(e) => setFormData((prev) => ({ ...prev, postal_code: e.target.value }))}
                      placeholder="10001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_country">Country *</Label>
                    <Input
                      id="edit_country"
                      value={formData.country}
                      onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                      placeholder="United States"
                    />
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between">
          <div>
            {currentAddress && (
              <Button
                variant="outline"
                onClick={handleRemoveAddress}
                className="text-red-600 hover:text-red-700 bg-transparent"
              >
                Remove Address
              </Button>
            )}
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            {(activeTab === "create" || activeTab === "edit") && (
              <Button
                onClick={handleSave}
                disabled={
                  saving ||
                  !formData.address_1 ||
                  !formData.city ||
                  !formData.state ||
                  !formData.country ||
                  !formData.postal_code
                } // Added postal_code to validation
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Address
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
