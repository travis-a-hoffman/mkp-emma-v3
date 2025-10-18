"use client"

import { useAuth0 } from "../lib/auth0-provider"
import { useEmma } from "../lib/emma-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, LogIn, Info } from "lucide-react"
import { EmmaTitleBar } from "../components/emma/titlebar"
import { EmmaCountdownTimer } from "../components/emma/countdown-timer"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useGroupStats } from "../hooks/useGroupStats"
import { formatGroupsMessage } from "../lib/formatGroupsMessage"

export default function Home() {
  const { user, error, isLoading, isAuthenticated, loginWithPopup } = useAuth0()
  const { location } = useEmma()
  const navigate = useNavigate()
  const [nextEvent, setNextEvent] = useState<any>(null)
  const [eventLoading, setEventLoading] = useState(true)

  // Fetch group stats with geolocation
  const { stats: groupStats, isLoading: groupStatsLoading } = useGroupStats(
    location?.latitude,
    location?.longitude,
    isAuthenticated,
    25,
  )

  useEffect(() => {
    const fetchNextEvent = async () => {
      try {
        const response = await fetch("/api/nwta-events?published=true")
        if (response.ok) {
          const result = await response.json()
          if (result.success && result.data && result.data.length > 0) {
            const sortedEvents = result.data.sort((a: any, b: any) => {
              const aStart = a.participant_schedule?.[0]?.start
                ? new Date(a.participant_schedule[0].start).getTime()
                : 0
              const bStart = b.participant_schedule?.[0]?.start
                ? new Date(b.participant_schedule[0].start).getTime()
                : 0
              return aStart - bStart
            })
            const upcomingEvents = sortedEvents.filter((event: any) => {
              const eventStart = event.participant_schedule?.[0]?.start
              return eventStart && new Date(eventStart) > new Date()
            })
            if (upcomingEvents.length > 0) {
              setNextEvent(upcomingEvents[0])
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch next NWTA event:", error)
      } finally {
        setEventLoading(false)
      }
    }

    fetchNextEvent()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <EmmaTitleBar />
        <div className="p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mr-2" />
              <span className="text-lg">Authenticating user...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <EmmaTitleBar />

      <main className="pt-20 container mx-auto px-4">
        {isAuthenticated && user ? (
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 className="text-xl font-semibold mb-4">New Warrior Training Adventure</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  {eventLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />
                      <span>Loading event details...</span>
                    </div>
                  ) : nextEvent ? (
                    <>
                      <div className="text-sm mb-4">
                        {nextEvent.venue
                          ? `At ${nextEvent.venue.name} near ${
                              nextEvent.venue.physical_address?.city && nextEvent.venue.physical_address?.state
                                ? `${nextEvent.venue.physical_address.city}, ${nextEvent.venue.physical_address.state}`
                                : `an Unknown Location`
                            }`
                          : `At a venue To Be Determined.`}
                      </div>
                      <EmmaCountdownTimer targetDate={new Date(nextEvent.participant_schedule?.[0]?.start)} />
                    </>
                  ) : (
                    <div className="text-muted-foreground">No upcoming events scheduled at this time.</div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 className="text-xl font-semibold mb-4">Training</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6" onClick={() => navigate("/training")}>
                <div className="text-center">
                  In the next month, there are 12 training opportunities near you; 2 in your Community (Portland), 3 in
                  your Area (Northwest), and 7 Nationally (United States).
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 className="text-xl font-semibold mb-4">Staffing</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6" onClick={() => navigate("/staffing")}>
                <div className="text-center">
                  In the next month, there are 7 staffing opportunities near you; 1 in your Community (Portland), 2 in
                  your Area (Northwest), and 4 Nationally (United States).
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 className="text-xl font-semibold mb-4">Groups</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 cursor-pointer" onClick={() => navigate("/i-groups")}>
                <div className="text-center">
                  {groupStatsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />
                      <span>Loading group statistics...</span>
                    </div>
                  ) : (
                    formatGroupsMessage(groupStats, isAuthenticated)
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="max-w-md mx-auto text-center space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 className="text-xl font-semibold mb-4">New Warrior Training Adventure</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  {eventLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      <span className="text-sm">Loading...</span>
                    </div>
                  ) : nextEvent ? (
                    <EmmaCountdownTimer targetDate={new Date(nextEvent.participant_schedule?.[0]?.start)} />
                  ) : (
                    <div className="text-muted-foreground text-sm">No upcoming events scheduled.</div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate("/about/mankind-project")}
            >
              <CardHeader>
                <CardTitle>ManKind Project</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-left mb-6">
                  ManKind Project (MKP) is a global, non-religious brotherhood welcoming men of all backgrounds,
                  beliefs, orientations, persuasions, and origins. In a world filled with toxic masculinity, we are good
                  men devoted to helping men like you become better men for the good of all mankind.
                </p>
                <Button className="sm:w-1/2" onClick={() => navigate("/about/mankind-project")}>
                  <Info className="h-4 w-4 mr-2" />
                  Learn More
                </Button>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate("/groups")}
            >
              <CardHeader>
                <CardTitle>
                  <h2 className="text-xl font-semibold mb-4">Groups</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-left">
                  {groupStatsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      <span className="text-sm">Loading...</span>
                    </div>
                  ) : (
                    formatGroupsMessage(groupStats, isAuthenticated)
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 className="text-xl font-semibold mb-4">Get Connected</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Button className="sm:w-1/2" onClick={() => navigate("/join")}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Start Your Journey
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
