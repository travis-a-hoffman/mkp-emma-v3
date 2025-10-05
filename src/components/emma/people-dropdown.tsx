"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronDown, X, User } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface Person {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  is_active: boolean
  photo_url: string | null
}

interface PersonApiResponse {
  data: Person | Person[]
  count: number
  message?: string
}

interface EmmaPeopleDropdownProps {
  value: string | null
  onValueChange: (value: string | null) => void
  placeholder?: string
  allowClear?: boolean
  className?: string
}

export function EmmaPeopleDropdown({
  value,
  onValueChange,
  placeholder = "Search for person...",
  allowClear = true,
  className = "",
}: EmmaPeopleDropdownProps) {
  const [people, setPeople] = useState<Person[]>([])
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Get selected person
  const selectedPerson = people.find((p) => p.id === value)

  // Format person name
  const formatPersonName = (person: Person) => {
    const parts = [person.first_name, person.middle_name, person.last_name].filter(Boolean)
    return parts.join(" ")
  }

  // Fetch people from API
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/people")
        if (!response.ok) {
          throw new Error(`Failed to fetch people: ${response.statusText}`)
        }
        const apiResponse: PersonApiResponse = await response.json()
        const peopleData = Array.isArray(apiResponse.data) ? apiResponse.data : [apiResponse.data]
        const activePeople = peopleData.filter((person) => person.is_active)
        setPeople(activePeople)
        setFilteredPeople(activePeople)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch people")
        console.error("[v0] Error fetching people:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchPeople()
  }, [])

  // Filter people based on search term
  useEffect(() => {
    if (searchTerm.length < 3) {
      setFilteredPeople([])
      return
    }

    const filtered = people.filter((person) => {
      const fullName = formatPersonName(person).toLowerCase()
      const search = searchTerm.toLowerCase()
      return fullName.includes(search)
    })

    setFilteredPeople(filtered)
  }, [searchTerm, people])

  const handleSelect = (person: Person) => {
    onValueChange(person.id)
    setSearchTerm("")
    setIsOpen(false)
  }

  const handleClear = () => {
    onValueChange(null)
    setSearchTerm("")
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    if (!isOpen && e.target.value.length >= 3) {
      setIsOpen(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false)
      setSearchTerm("")
    }
  }

  const getPersonInitials = (person: Person) => {
    const firstInitial = person.first_name?.charAt(0) || ""
    const lastInitial = person.last_name?.charAt(0) || ""
    return (firstInitial + lastInitial).toUpperCase()
  }

  const parsePhotoParams = (photoUrl: string | null) => {
    if (!photoUrl) return { x: 50, y: 50, zoom: 100 }

    try {
      const url = new URL(photoUrl)
      const x = Number.parseFloat(url.searchParams.get("x") || "50")
      const y = Number.parseFloat(url.searchParams.get("y") || "50")
      const zoom = Number.parseFloat(url.searchParams.get("zoom") || "100")
      return { x, y, zoom }
    } catch {
      return { x: 50, y: 50, zoom: 100 }
    }
  }

  const PersonAvatar = ({ person, size = "w-6 h-6" }: { person: Person; size?: string }) => {
    if (person.photo_url) {
      const baseUrl = person.photo_url.split("?")[0]
      const { x, y, zoom } = parsePhotoParams(person.photo_url)

      return (
        <div className={`${size} rounded-full overflow-hidden bg-gray-100 flex-shrink-0`}>
          <img
            src={baseUrl || "/placeholder.svg"}
            alt={formatPersonName(person)}
            className="w-full h-full object-cover"
            style={{
              objectPosition: `${x}% ${y}%`,
              transform: `scale(${zoom / 100})`,
              transformOrigin: "center",
            }}
          />
        </div>
      )
    }

    return (
      <div
        className={`${size} rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0`}
      >
        {getPersonInitials(person)}
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className="w-full justify-between text-left font-normal bg-transparent"
            onClick={() => {
              setIsOpen(!isOpen)
              if (!isOpen) {
                setTimeout(() => inputRef.current?.focus(), 100)
              }
            }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {selectedPerson ? (
                <PersonAvatar person={selectedPerson} />
              ) : (
                <User className="w-6 h-6 text-gray-400 flex-shrink-0" />
              )}
              <span className="truncate">{selectedPerson ? formatPersonName(selectedPerson) : placeholder}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {selectedPerson && allowClear && (
                <X
                  className="w-4 h-4 text-gray-400 hover:text-gray-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClear()
                  }}
                />
              )}
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <div className="p-2">
            <Input
              ref={inputRef}
              placeholder="Type at least 3 characters to search..."
              value={searchTerm}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="mb-2"
            />

            {error && <div className="p-2 text-sm text-red-600 bg-red-50 rounded">{error}</div>}

            {loading && <div className="p-2 text-sm text-gray-500 text-center">Loading people...</div>}

            {searchTerm.length > 0 && searchTerm.length < 3 && (
              <div className="p-2 text-sm text-gray-500 text-center">Type at least 3 characters to search</div>
            )}

            {searchTerm.length >= 3 && filteredPeople.length === 0 && !loading && (
              <div className="p-2 text-sm text-gray-500 text-center">No people found matching "{searchTerm}"</div>
            )}

            {filteredPeople.length > 0 && (
              <div className="max-h-60 overflow-y-auto">
                {allowClear && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left font-normal text-gray-500 hover:text-gray-700"
                    onClick={() => {
                      handleClear()
                      setIsOpen(false)
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Clear selection
                  </Button>
                )}
                {filteredPeople.map((person) => (
                  <Button
                    key={person.id}
                    variant="ghost"
                    className="w-full justify-start text-left font-normal"
                    onClick={() => handleSelect(person)}
                  >
                    <div className="mr-2">
                      <PersonAvatar person={person} />
                    </div>
                    {formatPersonName(person)}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
