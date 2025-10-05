"use client"

import { useAuth0 } from "../../lib/auth0-provider"
import { Navigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Search, Eye, EyeOff, UserCheck, Clock, UserX, Loader2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { EmmaTitleBar } from "../../components/emma/titlebar"
import { EmmaPersonDisplay } from "../../components/emma/person-display"
import { EmmaAreaTag } from "../../components/emma/area-tag"
import type { EventWithRelations } from "../../types/event"
import type { Registrant } from "../../types/person"
import { useState, useEffect } from "react"

interface RegistrantWithDetails extends Registrant<EventWithRelations> {
  position?: number // for ordered lists (potential and waitlist)
}

export default function AdminRegistrants() {
  const { isAuthenticated, isLoading } = useAuth0()
  const [events, setEvents] = useState<EventWithRelations[]>([])
  const [registrants, setRegistrants] = useState<RegistrantWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [eventFilter, setEventFilter] = useState<string>("all")
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const filteredRegistrants = registrants.filter((registrant) => {
    const matchesSearch =
      `${registrant.first_name} ${registrant.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      registrant?.event?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      registrant.email?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || registrant.status === statusFilter
    const matchesEvent = eventFilter === "all" || registrant?.event?.id === eventFilter

    return matchesSearch && matchesStatus && matchesEvent
  })

  const registrantStats = {
    total: registrants.length,
    potential: registrants.filter((r) => r.status === "potential").length,
    committed: registrants.filter((r) => r.status === "committed").length,
    waitlist: registrants.filter((r) => r.status === "waitlist").length,
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [isAuthenticated])

  const fetchData = async () => {
    try {
      setLoading(true)

      const [eventsResponse, registrantsResponse] = await Promise.all([
        fetch("/api/events?active=true"),
        fetch("/api/registrants?active=true"),
      ])

      if (!eventsResponse.ok || !registrantsResponse.ok) {
        throw new Error("Failed to fetch data")
      }

      const eventsData = await eventsResponse.json()
      const registrantsData = await registrantsResponse.json()

      const eventsArray = eventsData.data || []
      const registrantsArray = registrantsData.data || []

      setEvents(eventsArray)

      const transformedRegistrants: RegistrantWithDetails[] = registrantsArray.map((reg: any) => {
        const event = eventsArray.find((e: EventWithRelations) => e.id === reg.event_id)

        let status: "potential" | "committed" | "waitlist" = "potential"
        let position: number | undefined = undefined

        if (event) {
          if (event.committed_participants?.includes(reg.id)) {
            status = "committed"
          } else if (event.waitlist_participants?.includes(reg.id)) {
            status = "waitlist"
            position = event.waitlist_participants.indexOf(reg.id) + 1
          } else if (event.potential_participants?.includes(reg.id)) {
            status = "potential"
            position = event.potential_participants.indexOf(reg.id) + 1
          }
        }

        return {
          ...reg,
          event: event || { id: reg.event_id, name: "Unknown Event" },
          status,
          position,
        }
      })

      setRegistrants(transformedRegistrants)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch registrants")
      console.error("Error fetching registrants:", err)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "potential":
        return (
          <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50">
            Potential
          </Badge>
        )
      case "committed":
        return (
          <Badge variant="default" className="text-green-700 border-green-300 bg-green-50">
            Committed
          </Badge>
        )
      case "waitlist":
        return (
          <Badge variant="secondary" className="text-orange-700 border-orange-300 bg-orange-50">
            Waitlist
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "potential":
        return <Clock className="w-4 h-4 text-yellow-600" />
      case "committed":
        return <UserCheck className="w-4 h-4 text-green-600" />
      case "waitlist":
        return <UserX className="w-4 h-4 text-orange-600" />
      default:
        return <Users className="w-4 h-4" />
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <EmmaTitleBar title="NWTA Registrants" backLink={{ href: "/admin", label: "Back to Admin" }} />

      <div className="p-6 pt-20">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <p className="text-gray-600">Manage event registrations and participant status</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Registrants</p>
                    <p className="text-2xl font-bold text-gray-900">{registrantStats.total}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Potential</p>
                    <p className="text-2xl font-bold text-yellow-600">{registrantStats.potential}</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Committed</p>
                    <p className="text-2xl font-bold text-green-600">{registrantStats.committed}</p>
                  </div>
                  <UserCheck className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Waitlist</p>
                    <p className="text-2xl font-bold text-orange-600">{registrantStats.waitlist}</p>
                  </div>
                  <UserX className="w-8 h-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search by name, email, or event..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="potential">Potential</SelectItem>
                    <SelectItem value="committed">Committed</SelectItem>
                    <SelectItem value="waitlist">Waitlist</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={eventFilter} onValueChange={setEventFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registrants ({filteredRegistrants.length})</CardTitle>
              <CardDescription>Manage participant registrations and status transitions</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Loading registrants...</p>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Registrants</h3>
                  <p className="text-red-600 mb-4">{error}</p>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    Try Again
                  </Button>
                </div>
              ) : filteredRegistrants.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Registrants Found</h3>
                  <p className="text-gray-600 mb-4">
                    {searchTerm || statusFilter !== "all" || eventFilter !== "all"
                      ? "No registrants match your current filters."
                      : "No event registrations found in the system."}
                  </p>
                </div>
              ) : (
                <TooltipProvider>
                  <div className="space-y-4">
                    {filteredRegistrants.map((registrant) => {
                      const registrantKey = `${registrant.id}-${registrant?.event?.id}`
                      const isExpanded = expandedItems.has(registrantKey)

                      return (
                        <div key={registrantKey} className="border rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between p-4">
                            <div className="flex items-center space-x-4 flex-1">
                              {getStatusIcon(registrant.status)}
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <EmmaPersonDisplay person={registrant} showAvatar={true} showContactInfo={false} />
                                  {getStatusBadge(registrant.status)}
                                  {registrant.position && (
                                    <Badge variant="outline" className="text-xs">
                                      #{registrant.position}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900">
                                    {registrant?.event?.name || "Unknown Event"}
                                  </span>
                                  {registrant?.event?.area && <EmmaAreaTag area={registrant.event.area} />}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toggleExpanded(registrantKey)}
                                    className="text-gray-600 hover:text-gray-700"
                                  >
                                    {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{isExpanded ? "Hide details" : "Show details"}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-4 pb-4 border-t bg-gray-50/50">
                              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">Person Details</label>
                                    <EmmaPersonDisplay person={registrant} showAvatar={true} showContactInfo={false} />
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">Registration Status</label>
                                    <div className="flex items-center gap-2 mt-1">
                                      {getStatusBadge(registrant.status)}
                                      {registrant.position && (
                                        <span className="text-sm text-gray-600">Position #{registrant.position}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">Transaction Log ID</label>
                                    <p className="text-sm font-mono text-gray-900 mt-1">
                                      {registrant.transaction_log || (
                                        <span className="text-gray-500 font-sans">Not assigned</span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">Event</label>
                                    <p className="text-sm text-gray-900">
                                      {registrant?.event?.name || "Unknown Event"}
                                    </p>
                                    {registrant?.event?.description && (
                                      <p className="text-sm text-gray-600">{registrant.event.description}</p>
                                    )}
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">Event Capacity</label>
                                    <p className="text-sm text-gray-900">
                                      {registrant?.event?.committed_participants?.length || 0} /{" "}
                                      {registrant?.event?.participant_capacity || "N/A"} committed
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {registrant?.event?.waitlist_participants?.length || 0} on waitlist
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </TooltipProvider>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
