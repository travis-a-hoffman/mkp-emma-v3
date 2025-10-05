"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Loader2 } from "lucide-react"
import { EmmaCommunityTag } from "./community-tag"
import type { Community } from "../../types/community"

interface EmmaCommunityModalProps {
  isOpen: boolean
  onClose: () => void
  onCommunitySelect: (community: Community | null) => void
  selectedCommunityId?: string | null
  title?: string
}

interface CommunityApiResponse {
  success: boolean
  data: Community[]
  count: number
  error?: string
}

export function EmmaCommunityModal({
  isOpen,
  onClose,
  onCommunitySelect,
  selectedCommunityId,
  title = "Select Community",
}: EmmaCommunityModalProps) {
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  // Filter communities based on search term
  const filteredCommunities = communities.filter(
    (community) =>
      community.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      community.code.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Fetch communities when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCommunities()
    }
  }, [isOpen])

  const fetchCommunities = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/communities?active=true")
      if (!response.ok) {
        throw new Error(`Failed to fetch communities: ${response.statusText}`)
      }

      const apiResponse: CommunityApiResponse = await response.json()
      setCommunities(apiResponse.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch communities")
      console.error("[v0] Error fetching communities:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleCommunitySelect = (community: Community) => {
    onCommunitySelect(community)
    onClose()
  }

  const handleClearSelection = () => {
    onCommunitySelect(null)
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
              placeholder="Search communities by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Communities List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading communities...</span>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-600 mb-4">{error}</p>
                <Button variant="outline" onClick={fetchCommunities}>
                  Try Again
                </Button>
              </div>
            ) : filteredCommunities.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">
                  {searchTerm ? "No communities match your search." : "No communities available."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCommunities.map((community) => (
                  <div
                    key={community.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 ${
                      selectedCommunityId === community.id ? "bg-blue-50 border-blue-200" : "border-gray-200"
                    }`}
                    onClick={() => handleCommunitySelect(community)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <EmmaCommunityTag community={community} />
                        <div>
                          <p className="font-medium text-gray-900">{community.name}</p>
                          {community.description && <p className="text-sm text-gray-600">{community.description}</p>}
                        </div>
                      </div>
                      {selectedCommunityId === community.id && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
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
