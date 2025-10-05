"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { EmmaTitleBar } from "../components/emma/titlebar"
import { EmmaEventTypeTag } from "../components/emma/eventtype"
import { EmmaAreaTag } from "../components/emma/area-tag"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Calendar, Users, Clock } from "lucide-react"
import { EmmaCalendar } from "../components/emma/calendar"
import { EmmaPersonDisplay } from "../components/emma/person-display"
import { formatCurrency } from "./admin/AdminEventHelperMethods"
import { EmmaEventPublishedTag } from "../components/emma/event-published-tag"
import type { EventWithRelations } from "../types/event"
import type { Person } from "../types/person"

function getSignupWindowMessage(event: EventWithRelations): string | null {
  const currentDate = new Date()

  // If not published, show the application window dates
  if (!event.is_published) {
    if (event.participant_published_time) {
      const startDate = new Date(event.participant_published_time.start).toLocaleDateString()
      const endDate = new Date(event.participant_published_time.end).toLocaleDateString()
      return `Applications accepted from ${startDate} to ${endDate}`
    }
    return null
  }

  // Get the participant published time range
  const publishedTime = event.participant_published_time

  // If no published time is set, return null
  if (!publishedTime) {
    return null
  }

  const startDate = new Date(publishedTime.start)
  const endDate = new Date(publishedTime.end)

  // Before application start date - Preview
  if (currentDate < startDate) {
    return `Not accepting applications until ${startDate.toLocaleDateString()}`
  }

  // After application end date - Closed
  if (currentDate > endDate) {
    return "No longer accepting applications"
  }

  // Between start and end dates - check capacity
  const capacity = event.participant_capacity
  const committed = event.committed_participants.length

  // Check if there are still openings
  if (capacity > 0 && committed >= capacity) {
    // Full - accepting waitlist
    return `Accepting waitlist applications until ${endDate.toLocaleDateString()}`
  }

  // Open - accepting applications
  return `Accepting applications until ${endDate.toLocaleDateString()}`
}

export default function Training() {
  const { uuid } = useParams<{ uuid: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<EventWithRelations | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handlePersonClick = (personId: string) => {
    navigate(`/warrior/${personId}`, {
      state: { backLink: { href: `/training/${uuid}`, label: "Training" } },
    })
  }

  useEffect(() => {
    if (!uuid) {
      setError("Training ID is required")
      setLoading(false)
      return
    }

    fetchEvent()
  }, [uuid])

  useEffect(() => {
    if (event) {
      fetchPeople(event)
    }
  }, [event])

  const fetchEvent = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/events/${uuid}`)

      if (!response.ok) {
        throw new Error("Failed to fetch training details")
      }

      const data = await response.json()
      if (data.success) {
        setEvent(data.data)
      } else {
        throw new Error(data.error || "Failed to load training")
      }
    } catch (err) {
      console.error("Error fetching training:", err)
      setError(err instanceof Error ? err.message : "Failed to load training")
    } finally {
      setLoading(false)
    }
  }

  const fetchPeople = async (event: EventWithRelations) => {
    try {
      const personIds: string[] = []

      // Add leaders
      if (event.primary_leader_id) {
        personIds.push(event.primary_leader_id)
      }
      if (event.leaders && event.leaders.length > 0) {
        personIds.push(...event.leaders)
      }

      // Add staff
      if (event.committed_staff && event.committed_staff.length > 0) {
        personIds.push(...event.committed_staff)
      }

      // Add participants
      if (event.committed_participants && event.committed_participants.length > 0) {
        personIds.push(...event.committed_participants)
      }
      if (event.waitlist_participants && event.waitlist_participants.length > 0) {
        personIds.push(...event.waitlist_participants)
      }

      const uniquePersonIds = [...new Set(personIds)]

      if (uniquePersonIds.length === 0) {
        setPeople([])
        return
      }

      // TODO This is very unbounded; need to rewrite this to request just the list of people we want.
      const response = await fetch("/api/people")

      if (!response.ok) {
        throw new Error("Failed to fetch people data")
      }

      const data = await response.json()
      if (data.success) {
        const relevantPeople = data.data.filter((person: Person) => uniquePersonIds.includes(person.id))
        setPeople(relevantPeople)
      } else {
        throw new Error(data.error || "Failed to load people")
      }
    } catch (err) {
      console.error("Error fetching people:", err)
      setError(err instanceof Error ? err.message : "Failed to load people")
    }
  }

  if (!uuid) {
    return (
      <div className="min-h-screen bg-background">
        <EmmaTitleBar />
        <div className="pt-20 container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-destructive">The Training ID is required</p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <EmmaTitleBar />
        <div className="pt-20 container mx-auto px-4 py-8">
          <div className="text-center">
            <p>Loading training details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-background">
        <EmmaTitleBar />
        <div className="pt-20 container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-destructive">{error || "Training not found"}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <EmmaTitleBar backLink={{ href: "/training", label: "Search" }} />
      <div className="pt-20 container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <h1 className="text-center text-3xl font-bold mb-6">Training Opportunity</h1>

          {/* Event Essentials */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {event.area && <EmmaAreaTag area={event.area} />}
                    {event.community && <EmmaAreaTag area={event.community} />}
                    <EmmaEventPublishedTag event={event} context="participants" />
                    {event.event_type && (
                      <EmmaEventTypeTag code={event.event_type.code} color={event.event_type.color} />
                    )}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-balance">{event.name}</h1>
                  {event.description && <p className="text-muted-foreground">{event.description}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {event.venue && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">{event.venue.name}</p>
                      {event.venue.physical_address && (
                        <p className="text-sm text-muted-foreground">
                          {event.venue.physical_address.city}, {event.venue.physical_address.state}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {event.participant_schedule.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="font-medium">
                        {new Date(event.participant_schedule[0].start).toLocaleDateString()}
                        {" – "}
                        {new Date(
                          event.participant_schedule[event.participant_schedule.length - 1].end,
                        ).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {event.participant_schedule.length} session{event.participant_schedule.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {(() => {
                const signupMessage = getSignupWindowMessage(event)
                if (signupMessage) {
                  return (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm font-medium text-blue-800">{signupMessage}</p>
                    </div>
                  )
                }
                return null
              })()}
            </CardContent>
          </Card>

          {/* Event Leadership */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Leadership
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {event.primary_leader_id ? (
                <div>
                  <h5 className="font-medium text-sm mb-2">Primary Leader</h5>
                  <EmmaPersonDisplay
                    personId={event.primary_leader_id}
                    people={people}
                    showAvatar={true}
                    showContactInfo={true}
                    onClick={() => handlePersonClick(event.primary_leader_id!)}
                  />
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Primary leader not assigned yet</div>
              )}

              {event.leaders && event.leaders.length > 0 && (
                <div>
                  <h5 className="font-medium text-sm mb-2">Co-Leaders</h5>
                  <div className="space-y-2">
                    {event.leaders.map((leaderId) => (
                      <EmmaPersonDisplay
                        key={leaderId}
                        personId={leaderId}
                        people={people}
                        showAvatar={true}
                        showContactInfo={true}
                        onClick={() => handlePersonClick(leaderId)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Event Staff */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Event Staff
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                {(() => {
                  const leaderIds = [
                    ...(event.primary_leader_id ? [event.primary_leader_id] : []),
                    ...(event.leaders || []),
                  ]
                  const staffOnly = event.committed_staff.filter((staffId) => !leaderIds.includes(staffId))

                  return (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <h4 className="font-medium">Staff ({staffOnly.length})</h4>
                      </div>
                      <div className="space-y-2">
                        {staffOnly.length > 0 ? (
                          staffOnly.map((staffId) => (
                            <EmmaPersonDisplay
                              showAvatar={true}
                              key={staffId}
                              personId={staffId}
                              people={people}
                              onClick={() => handlePersonClick(staffId)}
                            />
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No staff yet</p>
                        )}
                      </div>
                    </>
                  )
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Event Participants */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Capacity:</span>
                  <span className="font-medium">{event.participant_capacity}</span>
                </div>
                <div className="flex justify-between">
                  <span>Committed:</span>
                  <span className="font-medium">{event.committed_participants.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cost:</span>
                  <span className="font-medium">{formatCurrency(event.participant_cost)}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <h4 className="font-medium">Participants ({event.committed_participants.length})</h4>
                  </div>
                  <div className="space-y-2">
                    {event.committed_participants.length > 0 ? (
                      event.committed_participants.map((participantId) => (
                        <EmmaPersonDisplay
                          showAvatar={true}
                          key={participantId}
                          personId={participantId}
                          people={people}
                          onClick={() => handlePersonClick(participantId)}
                        />
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No committed participants yet</p>
                    )}
                  </div>
                </div>

                {event.waitlist_participants && event.waitlist_participants.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <h4 className="font-medium">Waitlist ({event.waitlist_participants.length})</h4>
                    </div>
                    <div className="space-y-2">
                      {event.waitlist_participants.map((participantId) => (
                        <EmmaPersonDisplay
                          showAvatar={true}
                          key={participantId}
                          personId={participantId}
                          people={people}
                          onClick={() => handlePersonClick(participantId)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {event.participant_schedule.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <EmmaCalendar
                  eventLists={[
                    {
                      name: event.name,
                      color: event.event_type?.color || "#ea580c",
                      times: event.participant_schedule,
                    },
                  ]}
                  readOnly={true}
                  showEventLegend={false}
                  timezone={event.venue?.timezone || "America/Chicago"}
                  initialDate={
                    event.participant_schedule.length > 0 ? new Date(event.participant_schedule[0].start) : undefined
                  }
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
