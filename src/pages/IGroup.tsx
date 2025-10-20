"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { EmmaTitleBar } from "../components/emma/titlebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  MapPin,
  Calendar,
  Users,
  Mail,
  Phone,
  Globe,
  Clock,
  AlertCircle,
  ExternalLink,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { EmmaAreaTag } from "../components/emma/area-tag"
import { EmmaCommunityTag } from "../components/emma/community-tag"
import type { IGroupWithRelations } from "../types/group"
import type { Person } from "../types/person"
import type { EventTime } from "../types/event"

interface IGroupApiResponse {
  success: boolean
  data: IGroupWithRelations
  error?: string
}

function getFullName(person: Person): string {
  return [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ")
}

function formatActiveSince(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Not specified"
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatScheduleEvent(event: EventTime, timezone?: string): string {
  const start = new Date(event.start)
  const end = new Date(event.end)
  const dayOfWeek = start.toLocaleDateString("en-US", { weekday: "long" })
  const timeRange = `${start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`
  return timezone ? `${dayOfWeek}, ${timeRange} (${timezone})` : `${dayOfWeek}, ${timeRange}`
}

function formatAddress(address: any): string[] {
  const parts = [
    address.address_1,
    address.address_2,
    `${address.city}, ${address.state} ${address.postal_code}`,
    address.country !== "United States" ? address.country : null,
  ].filter(Boolean)
  return parts as string[]
}

export default function IGroup() {
  const { uuid } = useParams<{ uuid: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [iGroupData, setIGroupData] = useState<IGroupWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const backLink = location.state?.backLink || { href: "/i-group/search", label: "Search I-Groups" }

  useEffect(() => {
    const fetchIGroup = async () => {
      if (!uuid) {
        setError("I-Group ID is required")
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/i-groups/${uuid}`)
        const result: IGroupApiResponse = await response.json()

        if (!result.success) {
          setError(result.error || "Failed to fetch I-Group")
          return
        }

        setIGroupData(result.data)
      } catch (err) {
        console.error("Error fetching I-Group:", err)
        setError("Failed to load I-Group information")
      } finally {
        setLoading(false)
      }
    }

    fetchIGroup()
  }, [uuid])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <EmmaTitleBar backLink={backLink} />
        <div className="pt-20 container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/3"></div>
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-24 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !iGroupData) {
    return (
      <div className="min-h-screen bg-background">
        <EmmaTitleBar backLink={backLink} />
        <div className="pt-20 container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">{error || "I-Group not found"}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  const googleMapsUrl =
    iGroupData.latitude && iGroupData.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${iGroupData.latitude},${iGroupData.longitude}`
      : null

  return (
    <div className="min-h-screen bg-background">
      <EmmaTitleBar backLink={backLink} />
      <div className="pt-20 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <h1 className="text-3xl font-bold">{iGroupData.name}</h1>
                <div className="flex flex-wrap gap-2">
                  {iGroupData.is_active ? (
                    <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="h-3 w-3 mr-1" />
                      Inactive
                    </Badge>
                  )}
                  {iGroupData.is_accepting_initiated_visitors && (
                    <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                      Accepting Initiated Visitors
                    </Badge>
                  )}
                  {iGroupData.is_accepting_uninitiated_visitors && (
                    <Badge variant="default" className="bg-purple-600 hover:bg-purple-700">
                      Accepting Uninitiated Visitors
                    </Badge>
                  )}
                  {iGroupData.is_requiring_contact_before_visiting && (
                    <Badge variant="outline">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Contact Required
                    </Badge>
                  )}
                  {iGroupData.area && <EmmaAreaTag area={iGroupData.area} />}
                  {iGroupData.community && <EmmaCommunityTag community={iGroupData.community} />}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Group Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Group Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {iGroupData.description && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Description</h4>
                  <p className="whitespace-pre-wrap">{iGroupData.description}</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {iGroupData.genders && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-1">Type</h4>
                    <p>{iGroupData.genders}</p>
                  </div>
                )}
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Accepting New Members</h4>
                  <p>{iGroupData.is_accepting_new_members ? "Yes" : "No"}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Active Since</h4>
                  <p>{formatActiveSince(iGroupData.created_at)}</p>
                </div>
                {iGroupData.established_on && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-1">Established On</h4>
                    <p>{formatDate(iGroupData.established_on)}</p>
                  </div>
                )}
              </div>
              {iGroupData.membership_criteria && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Membership Criteria</h4>
                  <p className="text-sm">{iGroupData.membership_criteria}</p>
                </div>
              )}
              {iGroupData.url && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Website</h4>
                  <a
                    href={iGroupData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {iGroupData.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Venue Information Card */}
          {iGroupData.venue && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Venue Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Venue Name</h4>
                  {iGroupData.venue.website ? (
                    <a
                      href={iGroupData.venue.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {iGroupData.venue.name}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p>{iGroupData.venue.name}</p>
                  )}
                </div>
                {iGroupData.venue.physical_address && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-1">Address</h4>
                    <div className="space-y-1">
                      {formatAddress(iGroupData.venue.physical_address).map((line, idx) => (
                        <p key={idx}>{line}</p>
                      ))}
                    </div>
                    {googleMapsUrl && (
                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1 mt-2 text-sm"
                      >
                        <MapPin className="h-3 w-3" />
                        View on Google Maps
                      </a>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {iGroupData.venue.phone && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Phone</h4>
                      <a href={`tel:${iGroupData.venue.phone}`} className="text-blue-600 hover:underline">
                        {iGroupData.venue.phone}
                      </a>
                    </div>
                  )}
                  {iGroupData.venue.email && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Email</h4>
                      <a href={`mailto:${iGroupData.venue.email}`} className="text-blue-600 hover:underline">
                        {iGroupData.venue.email}
                      </a>
                    </div>
                  )}
                  {iGroupData.venue.timezone && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Timezone</h4>
                      <p>{iGroupData.venue.timezone}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Schedule Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Schedule Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {iGroupData.schedule_description && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Description</h4>
                  <p className="whitespace-pre-wrap">{iGroupData.schedule_description}</p>
                </div>
              )}
              {iGroupData.schedule_events && iGroupData.schedule_events.length > 0 ? (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Meeting Times</h4>
                  <div className="space-y-2">
                    {iGroupData.schedule_events.map((event, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{formatScheduleEvent(event, iGroupData.venue?.timezone)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No scheduled meetings</p>
              )}
            </CardContent>
          </Card>

          {/* Contact Information Card */}
          {(iGroupData.primary_contact || iGroupData.public_contact) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {iGroupData.primary_contact && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Primary Contact</h4>
                    <div className="space-y-2">
                      <p className="font-medium">{getFullName(iGroupData.primary_contact)}</p>
                      {iGroupData.primary_contact.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a
                            href={`mailto:${iGroupData.primary_contact.email}`}
                            className="text-blue-600 hover:underline"
                          >
                            {iGroupData.primary_contact.email}
                          </a>
                        </div>
                      )}
                      {iGroupData.primary_contact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a
                            href={`tel:${iGroupData.primary_contact.phone}`}
                            className="text-blue-600 hover:underline"
                          >
                            {iGroupData.primary_contact.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {iGroupData.public_contact && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Public Contact</h4>
                    <div className="space-y-2">
                      <p className="font-medium">{getFullName(iGroupData.public_contact)}</p>
                      {iGroupData.public_contact.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a
                            href={`mailto:${iGroupData.public_contact.email}`}
                            className="text-blue-600 hover:underline"
                          >
                            {iGroupData.public_contact.email}
                          </a>
                        </div>
                      )}
                      {iGroupData.public_contact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a
                            href={`tel:${iGroupData.public_contact.phone}`}
                            className="text-blue-600 hover:underline"
                          >
                            {iGroupData.public_contact.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Members Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Members ({iGroupData.members?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {iGroupData.members && iGroupData.members.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {iGroupData.members.map((member: any) => (
                    <Card
                      key={member.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/warrior/${member.id}`)}
                    >
                      <CardContent className="p-4 flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={member.photo_url || undefined} />
                          <AvatarFallback>
                            {member.first_name[0]}
                            {member.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{getFullName(member)}</p>
                          {member.warriors?.[0]?.status && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              {member.warriors[0].status}
                            </Badge>
                          )}
                          {!member.is_active && (
                            <Badge variant="outline" className="text-xs mt-1 ml-1">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No members in this I-Group</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
