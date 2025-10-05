"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Search, User } from "lucide-react"
import { EmmaTitleBar } from "../components/emma/titlebar"
import { EmmaAreaTag } from "../components/emma/area-tag"
import { EmmaCommunityTag } from "../components/emma/community-tag"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { Warrior } from "../types/person"
import type { EventWithRelations } from "../types/event"
import type { Area } from "../types/area"
import type { Community } from "../types/community"

interface WarriorWithRelations<E> extends Warrior<EventWithRelations> {
  area: Area
  community: Community
}

export default function WarriorSearch() {
  const [searchTerm, setSearchTerm] = useState("")
  const [warriors, setWarriors] = useState<WarriorWithRelations<EventWithRelations>[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadAllWarriors()
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        searchWarriors(searchTerm.trim())
      } else if (searchTerm.trim().length === 0) {
        loadAllWarriors()
        setHasSearched(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  const loadAllWarriors = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/warriors?active=true")
      const result = await response.json()

      if (result.success) {
        setWarriors(result.data || [])
      } else {
        console.error("Failed to load warriors:", result.error)
        setWarriors([])
      }
    } catch (error) {
      console.error("Load warriors error:", error)
      setWarriors([])
    } finally {
      setLoading(false)
    }
  }

  const searchWarriors = async (term: string) => {
    setLoading(true)
    setHasSearched(true)
    try {
      const response = await fetch(`/api/warriors?search=${encodeURIComponent(term)}&active=true`)
      const result = await response.json()

      if (result.success) {
        setWarriors(result.data || [])
      } else {
        console.error("Search failed:", result.error)
        setWarriors([])
      }
    } catch (error) {
      console.error("Search error:", error)
      setWarriors([])
    } finally {
      setLoading(false)
    }
  }

  const handleWarriorClick = (warriorId: string) => {
    navigate(`/warrior/${warriorId}`)
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "initiated":
        return "bg-green-100 text-green-800"
      case "active":
        return "bg-blue-100 text-blue-800"
      case "inactive":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <EmmaTitleBar />
      <div className="pt-20 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Find a Fellow Warrior</h1>

          <div className="relative mb-8">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Search by warrior name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-lg py-6"
            />
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">
                {hasSearched ? "Searching warriors..." : "Loading warriors..."}
              </p>
            </div>
          )}

          {!loading && (warriors.length > 0 || hasSearched) && (
            <div className="space-y-4">
              {warriors.length > 0 ? (
                <>
                  <p className="text-muted-foreground mb-4">
                    {hasSearched ? `Found ${warriors.length}` : `Showing ${warriors.length}`} warrior
                    {warriors.length !== 1 ? "s" : ""}
                  </p>
                  {warriors.map((warrior) => (
                    <Card
                      key={warrior.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleWarriorClick(warrior.id)}
                    >
                      <CardContent className="px-4">
                        <div className="flex items-center space-x-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={warrior.photo_url || undefined} />
                            <AvatarFallback>{getInitials(warrior.first_name, warrior.last_name)}</AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="text-lg font-semibold truncate">
                                {warrior.first_name} {warrior.last_name}
                              </h3>
                              <Badge className={getStatusColor(warrior.status)}>{warrior.status}</Badge>
                              <EmmaAreaTag area={warrior.area} />
                            </div>

                            {warrior.initiation_on && (
                              <p className="text-sm text-muted-foreground">
                                Initiated: {new Date(warrior.initiation_on).toLocaleDateString()}
                              </p>
                            )}

                            {/* TODO Change this to be warrior.initiation_event.venue.name */}
                            {warrior.initiation_event?.venue && (
                              <p className="text-sm text-muted-foreground truncate">
                                Initiated at: {warrior.initiation_event?.venue.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              ) : (
                <div className="text-center py-8">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No warriors found matching "{searchTerm}"</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Try searching with a different name or partial name
                  </p>
                </div>
              )}
            </div>
          )}

          {!loading && warriors.length === 0 && !hasSearched && (
            <div className="text-center py-12">
              <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Warriors Found</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                No active warriors are currently available. Try refreshing the page or contact support if this seems
                incorrect.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
