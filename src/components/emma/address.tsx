"use client"

import React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { MapPin, Plus } from "lucide-react"
import { EmmaAddressModal } from "./address-modal"

interface Address {
  id: string
  address_1: string
  address_2?: string | null
  city: string
  state: string
  postal_code: string
  country: string
  created_at: string
  updated_at: string
}

interface EmmaAddressProps {
  label: string
  addressId?: string | null
  onAddressChange: (addressId: string | null) => void
  className?: string
}

export function EmmaAddress({ label, addressId, onAddressChange, className = "" }: EmmaAddressProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [address, setAddress] = useState<Address | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch address details when addressId changes
  const fetchAddress = async (id: string) => {
    if (!id) return

    setLoading(true)
    try {
      const response = await fetch(`/api/addresses/${id}`)
      if (response.ok) {
        const data = await response.json()
        setAddress(data.data)
      }
    } catch (error) {
      console.error("[v0] Error fetching address:", error)
    } finally {
      setLoading(false)
    }
  }

  // Load address when component mounts or addressId changes
  React.useEffect(() => {
    if (addressId) {
      fetchAddress(addressId)
    } else {
      setAddress(null)
    }
  }, [addressId])

  const formatAddress = (addr: Address) => {
    const parts = [
      addr.address_1,
      addr.address_2,
      `${addr.city}, ${addr.state} ${addr.postal_code}`,
      addr.country,
    ].filter(Boolean)
    return parts.join(", ")
  }

  const handleAddressSelect = (selectedAddress: Address | null) => {
    setAddress(selectedAddress)
    onAddressChange(selectedAddress?.id || null)
    setIsModalOpen(false)
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium text-gray-700">{label}</label>

      {loading ? (
        <div className="p-3 border rounded-md bg-gray-50">
          <div className="text-sm text-gray-500">Loading address...</div>
        </div>
      ) : address ? (
        <div
          className="p-3 border rounded-md bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
          onClick={() => setIsModalOpen(true)}
        >
          <div className="flex items-start space-x-2">
            <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-900 truncate">{formatAddress(address)}</div>
            </div>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => setIsModalOpen(true)}
          className="w-full justify-start text-gray-500 border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add {label}
        </Button>
      )}

      <EmmaAddressModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddressSelect={handleAddressSelect}
        currentAddress={address}
        title={`Manage ${label}`}
      />
    </div>
  )
}
