"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Banknote, Search, Calendar, Crown, MapPin, Users } from "lucide-react"
import { EmmaTitleBar } from "../components/emma/titlebar"
import { EmmaEventTypeTag } from "../components/emma/eventtype"
import { EmmaPersonDisplay } from "../components/emma/person-display"
import { EmmaAreaTag } from "../components/emma/area-tag"
import { EmmaCommunityTag } from "../components/emma/community-tag"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { EmmaEventPublishedTag } from "../components/emma/event-published-tag"
import type { EventWithRelations } from "../types/event"
import type { Person } from "../types/person"
import { formatCurrency } from "./admin/AdminEventHelperMethods"

export default function NwtaSearch() {
  const [searchTerm, setSearchTerm] = useState("")
  const [events, setEvents] = useState<EventWithRelations[]>([])
  const [leaders, setLeaders] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadAllUpcomingEvents()
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        searchEvents(searchTerm.trim())
      } else if (searchTerm.trim().length === 0) {
        loadAllUpcomingEvents()
        setHasSearched(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  useEffect(() => {
    if (events.length > 0) {
      fetchLeaders(events)
    }
  }, [events])

  const loadAllUpcomingEvents = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/nwta-events?published=true&active=true&upcoming=true")
      const result = await response.json()

      if (result.success) {
        setEvents(result.data || [])
      } else {
        console.error("Failed to load upcoming events:", result.error)
        setEvents([])
      }
    } catch (error) {
      console.error("Load upcoming events error:", error)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const searchEvents = async (term: string) => {
    setLoading(true)
    setHasSearched(true)
    try {
      const response = await fetch(`/api/nwta-events?search=${encodeURIComponent(term)}&published=true&active=true`)
      const result = await response.json()

      if (result.success) {
        setEvents(result.data || [])
      } else {
        console.error("Search failed:", result.error)
        setEvents([])
      }
    } catch (error) {
      console.error("Search error:", error)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const fetchLeaders = async (events: EventWithRelations[]) => {
    try {
      const leaderIds: string[] = []

      events.forEach((event) => {
        if (event.primary_leader_id) {
          leaderIds.push(event.primary_leader_id)
        }
        if (event.leaders && event.leaders.length > 0) {
          leaderIds.push(...event.leaders)
        }
      })

      const uniqueLeaderIds = [...new Set(leaderIds)]

      if (uniqueLeaderIds.length === 0) {
        setLeaders([])
        return
      }

      const response = await fetch("/api/people")

      if (!response.ok) {
        throw new Error("Failed to fetch people data")
      }

      const data = await response.json()
      if (data.success) {
        const leaderPeople = data.data.filter((person: Person) => uniqueLeaderIds.includes(person.id))
        setLeaders(leaderPeople)
      } else {
        throw new Error(data.error || "Failed to load people")
      }
    } catch (err) {
      console.error("Error fetching leaders:", err)
    }
  }

  const handleEventClick = (eventId: string) => {
    navigate(`/nwta/${eventId}`)
  }

  const formatEventDate = (participant_schedule: any[]) => {
    if (!participant_schedule || participant_schedule.length === 0) return "Date TBD"
    const startDate = new Date(participant_schedule[0].start)
    return startDate.toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-background">
      <EmmaTitleBar />
      <div className="pt-20 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-center text-3xl font-bold mb-6">NWTA Opportunities</h1>

          <div className="relative mb-8">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Search by event name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-lg py-6"
            />
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">
                {hasSearched ? "Searching events..." : "Loading upcoming events..."}
              </p>
            </div>
          )}

          {!loading && (events.length > 0 || hasSearched) && (
            <div className="space-y-4">
              {events.length > 0 ? (
                <>
                  <p className="text-muted-foreground mb-4">
                    {hasSearched ? `Found ${events.length}` : `Showing ${events.length} upcoming`} event
                    {events.length !== 1 ? "s" : ""}
                  </p>
                  {events.map((event) => (
                    <Card
                      key={event.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleEventClick(event.id)}
                    >
                      <CardContent className="p-2">
                        <div className="flex items-start space-x-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="text-lg font-semibold truncate">{event.name}</h3>
                              {event.area && <EmmaAreaTag area={event.area} />}
                              {event.community && <EmmaCommunityTag community={event.community} />}
                              <EmmaEventPublishedTag event={event} context="participants" />
                              {event.event_type && (
                                <EmmaEventTypeTag code={event.event_type.code} color={event.event_type.color} />
                              )}
                            </div>

                            {event.description && (
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{event.description}</p>
                            )}

                            {event.primary_leader_id && (
                              <div className="flex items-center space-x-1 mb-3">
                                <Crown className="h-4 w-4" />
                                <EmmaPersonDisplay
                                  personId={event.primary_leader_id}
                                  people={leaders}
                                  showAvatar={true}
                                  showContactInfo={false}
                                />
                              </div>
                            )}

                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              {event.venue && (
                                <div className="flex items-center space-x-1">
                                  <MapPin className="h-4 w-4" />
                                  <span className="truncate">
                                    {event.venue.name}
                                    {event.venue.physical_address && (
                                      <span>
                                        , {event.venue.physical_address.city}, {event.venue.physical_address.state}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center space-x-1">
                                <Calendar className="h-4 w-4" />
                                <span>{formatEventDate(event.participant_schedule)}</span>
                              </div>

                              <div className="flex items-center space-x-1">
                                <Banknote className="h-4 w-4" />
                                <span className="font-medium">{formatCurrency(event.participant_cost)}</span>
                              </div>

                              <div className="flex items-center space-x-1">
                                <Users className="h-4 w-4" />
                                <span>
                                  {event.participant_capacity} slots •{" "}
                                  {Math.max(
                                    0,
                                    event.participant_capacity - (event.committed_participants?.length || 0),
                                  )}{" "}
                                  open
                                </span>
                              </div>

                              {(event.committed_participants?.length || 0) >= event.participant_capacity && (
                                <div className="flex items-center space-x-1">
                                  <Users className="h-4 w-4" />
                                  <span>{event.waitlist_participants?.length || 0} on waitlist</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No NWTA events found matching "{searchTerm}"</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Try searching with different keywords or check back later for new events
                  </p>
                </div>
              )}
            </div>
          )}

          {!loading && events.length === 0 && !hasSearched && (
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Upcoming NWTA Events</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                There are currently no upcoming NWTA events available. Check back later for new opportunities or use the
                search to find specific events.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
