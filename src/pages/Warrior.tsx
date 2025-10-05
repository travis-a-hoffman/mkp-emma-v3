"use client"

import { useState, useEffect } from "react"
import { useParams, useLocation } from "react-router-dom"
import { EmmaTitleBar } from "../components/emma/titlebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CalendarDays, Mail, Phone, Award, Users, Crown, Sword } from "lucide-react"
import type { Warrior } from "../types/person"
import type { EventWithRelations } from "../types/event"
import { EmmaAreaTag } from "../components/emma/area-tag"
import { EmmaCommunityTag } from "../components/emma/community-tag"
import type { Area } from "../types/area"
import type { Community } from "../types/community"

interface WarriorWithRelations<E> extends Warrior<EventWithRelations> {
  area: Area
  community: Community
}

interface WarriorApiResponse {
  success: boolean
  data: WarriorWithRelations<EventWithRelations>
  error?: string
}


export default function WarriorPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const location = useLocation()
  const [warriorData, setWarriorData] = useState<WarriorWithRelations<EventWithRelations> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const backLink = location.state?.backLink || { href: "/warrior", label: "Search" }

  useEffect(() => {
    const fetchWarrior = async () => {
      if (!uuid) {
        setError("Warrior ID is required")
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/warriors/${uuid}`)
        const result: WarriorApiResponse = await response.json()

        if (!result.success) {
          setError(result.error || "Failed to fetch warrior")
          return
        }

        setWarriorData(result.data)
      } catch (err) {
        console.error("Error fetching warrior:", err)
        setError("Failed to load warrior information")
      } finally {
        setLoading(false)
      }
    }

    fetchWarrior()
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

  if (error || !warriorData) {
    return (
      <div className="min-h-screen bg-background">
        <EmmaTitleBar backLink={backLink} />
        <div className="pt-20 container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">{error || "Warrior not found"}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  const getFullName = () => {
    const parts = [warriorData.first_name, warriorData.middle_name, warriorData.last_name].filter(Boolean)
    return parts.join(" ")
  }

  const formatInitiationDate = (dateString: string | null) => {
    if (!dateString) return "Not specified"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <EmmaTitleBar backLink={backLink} />
      <div className="pt-20 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <Avatar className="h-24 w-24 sm:h-32 sm:w-32">
                  <AvatarImage src={warriorData.photo_url || undefined} alt={getFullName()} />
                  <AvatarFallback className="text-2xl">
                    {warriorData.first_name[0]}
                    {warriorData.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-center sm:text-left space-y-2">
                  <h1 className="text-3xl font-bold">{getFullName()}</h1>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Award className="h-3 w-3" />
                      {warriorData.status}
                    </Badge>
                    <EmmaAreaTag area={warriorData.area} />
                    <EmmaCommunityTag community={warriorData.community} />
                    {!warriorData.is_active && <Badge variant="outline">Inactive</Badge>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {warriorData.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${warriorData.email}`} className="text-blue-600 hover:underline">
                    {warriorData.email}
                  </a>
                </div>
              )}
              {warriorData.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${warriorData.phone}`} className="text-blue-600 hover:underline">
                    {warriorData.phone}
                  </a>
                </div>
              )}
              {!warriorData.email && !warriorData.phone && (
                <p className="text-muted-foreground">No contact information available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Initiation Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Initiation Date</h4>
                  <p>{formatInitiationDate(warriorData.initiation_on)}</p>
                </div>
                {warriorData.initiation_event && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-1">Initiation Event</h4>
                    <p>{warriorData.initiation_event.name}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Event Participation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Training</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{warriorData.training_events.length}</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Staffed</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{warriorData.staffed_events.length}</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Crown className="h-4 w-4 text-purple-600" />
                    <span className="font-medium">Led</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-600">{warriorData.lead_events.length}</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Sword className="h-4 w-4 text-red-600" />
                    <span className="font-medium">MOS</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{warriorData.mos_events.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {warriorData.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{warriorData.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
