"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Loader2 } from "lucide-react"
import { EmmaAreaTag } from "./area-tag"
import type { Area } from "../../types/area"

interface EmmaAreaModalProps {
  isOpen: boolean
  onClose: () => void
  onAreaSelect: (area: Area | null) => void
  selectedAreaId?: string | null
  title?: string
}

interface AreaApiResponse {
  success: boolean
  data: Area[]
  count: number
  error?: string
}

export function EmmaAreaModal({
  isOpen,
  onClose,
  onAreaSelect,
  selectedAreaId,
  title = "Select Area",
}: EmmaAreaModalProps) {
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  // Filter areas based on search term
  const filteredAreas = areas.filter(
    (area) =>
      area.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      area.code.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Fetch areas when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAreas()
    }
  }, [isOpen])

  const fetchAreas = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/areas?active=true")
      if (!response.ok) {
        throw new Error(`Failed to fetch areas: ${response.statusText}`)
      }

      const apiResponse: AreaApiResponse = await response.json()
      setAreas(apiResponse.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch areas")
      console.error("[v0] Error fetching areas:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleAreaSelect = (area: Area) => {
    onAreaSelect(area)
    onClose()
  }

  const handleClearSelection = () => {
    onAreaSelect(null)
    onClose()
  }

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("")
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search areas by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Areas List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading areas...</span>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-600 mb-4">{error}</p>
                <Button variant="outline" onClick={fetchAreas}>
                  Try Again
                </Button>
              </div>
            ) : filteredAreas.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">{searchTerm ? "No areas match your search." : "No areas available."}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAreas.map((area) => (
                  <div
                    key={area.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 ${
                      selectedAreaId === area.id ? "bg-blue-50 border-blue-200" : "border-gray-200"
                    }`}
                    onClick={() => handleAreaSelect(area)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <EmmaAreaTag area={area} />
                        <div>
                          <p className="font-medium text-gray-900">{area.name}</p>
                          {area.description && <p className="text-sm text-gray-600">{area.description}</p>}
                        </div>
                      </div>
                      {selectedAreaId === area.id && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={handleClearSelection}>
              Clear Selection
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
