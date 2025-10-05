"use client"

import { useAuth0 } from "../../lib/auth0-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, User, Calendar, MapPin, Phone, Mail } from "lucide-react"
import { EmmaTitleBar } from "../../components/emma/titlebar"
import type { EmmaUserWithRelations } from "../../../api/users"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

interface WarriorData {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zip?: string
  }
  initiation_date?: string
  community?: string
  area?: string
}

export default function JoinWelcome() {
  const { user, isLoading, isAuthenticated } = useAuth0()
  const [isFirstLogin, setIsFirstLogin] = useState<boolean>(false)
  const navigate = useNavigate()
  const [warriorData, setWarriorData] = useState<WarriorData[]>([])
  const [apiLoading, setApiLoading] = useState<boolean>(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [emmaUserData, setEmmaUserData] = useState<EmmaUserWithRelations | null>(null)

  useEffect(() => {
    if (isAuthenticated && user) {
      const firstLoginCookie = document.cookie.split("; ").find((row) => row.startsWith("JoinWelcomeFirstLoginAt="))

      if (!firstLoginCookie) {
        const now = new Date().toISOString()
        document.cookie = `JoinWelcomeFirstLoginAt=${now}; path=/join/welcome; max-age=${60 * 60 * 24 * 365}` // 1 year
        setIsFirstLogin(true)
      } else {
        setIsFirstLogin(false)
      }

      fetchWarriorData()
    }
  }, [isAuthenticated, user])

  const fetchWarriorData = async () => {
    if (!user?.email) return

    setApiLoading(true)
    setApiError(null)

    try {
      const response = await fetch(`/api/mkp-connect/warriors?email=${encodeURIComponent(user.email)}`)
      if (response.ok) {
        const data = await response.json()
        setWarriorData(data.data)
      } else {
        setApiError(`API returned ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      setApiError(`Failed to fetch warrior data: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setApiLoading(false)
    }
  }

  const fetchEmmaUserData = async () => {
    if (!user || !user.email) return

    setApiLoading(true)
    setApiError(null)

    try {
      const response = await fetch(`/api/users/?email=${encodeURIComponent(user.email)}`)
      if (response.ok) {
        const data = await response.json()
        setEmmaUserData(data)
      } else {
        setApiError(`API returned ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      setApiError(`Failed to fetch warrior data: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setApiLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <EmmaTitleBar />
        <div className="p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mr-2" />
              <span className="text-lg">Authenticating User...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <EmmaTitleBar />
        <div className="p-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">Please log in to access this page.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const firstName = user.given_name || user.name?.split(" ")[0] || "Brother"
  console.log("warriorData: ", warriorData);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <EmmaTitleBar />

      <main className="pt-20 container mx-auto px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                {isFirstLogin ? `Welcome to your login to EMMA, ${firstName}!` : `Welcome back to EMMA ${firstName}!`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground">
                {isFirstLogin
                  ? "We're excited for you to join the ManKind Project. Below you'll find next steps."
                  : "Great to see you again! Your warrior profile is always available here."}
              </div>
            </CardContent>
          </Card>

          <>
            {apiLoading && (
              <Card>
                <CardContent className="py-8">
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span>Searching for your profile...</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {apiError && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive">Error Loading Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{apiError}</p>
                  <Button onClick={fetchWarriorData} className="mt-4" disabled={apiLoading}>
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            )}



            {!apiLoading && !apiError && 
              (warriorData.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <div className="text-muted-foreground">
                      We couldn't find a profile using the email address "{user.email}".<br/>
                    </div>

                    <div className="text-muted-foreground">
                      Create a new profile...
                      <Button className="w-1/2" onClick={() => navigate("/join/new")}>
                        Create a new Profile
                      </Button>
                    </div>

                    <div className="text-muted-foreground">
                      I used a different email address...
                      <Button className="w-1/2" variant="outline" onClick={() => navigate("/join/search")}>
                        Search for my Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : ( 
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold">Your Warrior Profile</h2>
                  {warriorData.map((warrior, index) => (
                    <Card key={warrior.id || index}>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <User className="w-5 h-5 mr-2" />
                          {warrior.first_name} {warrior.last_name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center">
                            <Mail className="w-4 h-4 mr-2 text-muted-foreground" />
                            <span className="text-sm">{warrior.email}</span>
                          </div>
                          {warrior.phone && (
                            <div className="flex items-center">
                              <Phone className="w-4 h-4 mr-2 text-muted-foreground" />
                              <span className="text-sm">{warrior.phone}</span>
                            </div>
                          )}
                          {warrior.initiation_date && (
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                              <span className="text-sm">
                                Initiated: {new Date(warrior.initiation_date).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {warrior.address && (
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                              <span className="text-sm">
                                {[warrior.address.city, warrior.address.state].filter(Boolean).join(", ")}
                              </span>
                            </div>
                          )}
                        </div>
                        {(warrior.community || warrior.area) && (
                          <div className="pt-2 border-t">
                            <div className="text-sm text-muted-foreground">
                              {warrior.community && <div>Community: {warrior.community}</div>}
                              {warrior.area && <div>Area: {warrior.area}</div>}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            )}
          </>
        </div>
      </main>
    </div>
  )
}
