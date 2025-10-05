"use client"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth0 } from "../../lib/auth0-provider"
import { useEmma } from "../../lib/emma-provider"
import { useMkpConnect } from "../../lib/mkpconnect-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmmaTitleBar } from "../../components/emma/titlebar"
import { CheckCircle, UserCheck, Link2, Sparkles, Sword } from "lucide-react"

import type { Area } from "../../types/area"
import type { Community } from "../../types/community"
import type { EventWithRelations } from "../../types/event"
import type { Person, Warrior } from "../../types/person"
import type { EmmaUserWithRelations } from "../../../api/users"

interface WarriorWithRelations<E> extends Warrior<EventWithRelations> {
  area: Area
  community: Community
}

export default function Join() {
  const navigate = useNavigate()
  const { user, logout, loginWithPopup, isLoading, isAuthenticated } = useAuth0()
  const { emmaUser, isEmmaUserLoading, loadEmmaUser } = useEmma()
  const { mkpConnectWarrior, setMkpConnectWarrior } = useMkpConnect()

  const [loading, setLoading] = useState(false)
  // TODO Move tnis to the EmmaContext (EmmaProvider)
  const [emmaPersonOrWarrior, setEmmaPersonOrWarrior] = useState<
    Person | WarriorWithRelations<EventWithRelations> | null
  >(null)
  const [emmaActiveUser, setEmmaActiveUser] = useState<EmmaUserWithRelations | null>(null)

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchMkpConnectWarrior()
      fetchEmmaPersonOrWarrior()
      fetchEmmaActiveUser()
    }
  }, [isAuthenticated, user])

  const fetchMkpConnectWarrior = async () => {
    if (!user?.email) return

    setLoading(true)
    try {
      const response = await fetch(`/api/mkp-connect/warriors?email=${encodeURIComponent(user.email)}`)
      if (response.ok) {
        const data = await response.json()
        if (data.data && data.data.length > 0) {
          setMkpConnectWarrior(data.data[0])
        }
      }
    } catch (error) {
      console.error("[v0] Error fetching MkpConnect warrior:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmmaPersonOrWarrior = async () => {
    if (!user?.email) return

    try {
      const response = await fetch(`/api/users?email=${encodeURIComponent(user.email)}`)
      if (response.ok) {
        const data = await response.json()
        if (data && data.person_or_warrior) {
          setEmmaPersonOrWarrior(data.person_or_warrior)
        }
      }
    } catch (error) {
      console.error("[v0] Error fetching Emma person/warrior:", error)
    }
  }

  const fetchEmmaActiveUser = async () => {
    if (!user?.email) return

    try {
      const response = await fetch(`/api/users?email=${encodeURIComponent(user.email)}`)
      if (response.ok) {
        const data = await response.json()
        if (data && data.data && data.data.length > 0) {
          const userData = data.data[0]
          if (userData.approved_at) {
            setEmmaActiveUser(userData)
          }
        }
      }
    } catch (error) {
      console.error("[v0] Error fetching Emma active user:", error)
    }
  }

  const getAuth0Profile = () => {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-sm text-muted-foreground">✓ Successfully signed in with Auth0</div>
        <div className="font-medium">
          Welcome, {user?.name || ""} ({user?.email || ""})!
        </div>
      </div>
    )
  }

  const getMkpConnectProfile = () => {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-sm text-muted-foreground">✓ MkpConnect profile linked</div>
        <div className="font-medium">Your MkpConnect profile has been successfully linked.</div>
      </div>
    )
  }

  const getEmmaPersonOrWarriorProfile = () => {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-sm text-muted-foreground">✓ Emma profile created</div>
        <div className="font-medium">Your Emma profile is ready and configured.</div>
      </div>
    )
  }

  const getActiveUserProfile = () => {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-sm text-muted-foreground">✓ Setup complete</div>
        <div className="font-medium">You're all set to explore the community!</div>
      </div>
    )
  }

  const isStepComplete = (stepNumber: string) => {
    switch (stepNumber) {
      case "01":
        return !!user // Step 1: user is logged in
      case "02":
        return !!mkpConnectWarrior // Step 2: mkpConnectWarrior exists
      case "03":
        return !!emmaPersonOrWarrior // Step 3: emmaPersonOrWarrior exists
      case "04":
        return !!emmaActiveUser // Step 4: emmaActiveUser exists
      default:
        return false
    }
  }

  const steps = [
    {
      number: "01",
      action: "Sign up / Sign in",
      title: "Sign up / Sign in to Auth0",
      description: "Create your secure account or sign in with your existing credentials to get started with Emma.",
      icon: UserCheck,
      status: "upcoming",
      result: getAuth0Profile(),
      target: "handleLogin",
    },
    {
      number: "02",
      action: "Find Profile",
      title: "Import MkpConnect Profile",
      description:
        "Link your MkpConnect User to Emma to synch all your ManKind Project resources, events, and data.",
      icon: Link2,
      status: "upcoming",
      result: getMkpConnectProfile(),
      target: "/join/profile/import",
    },
    {
      number: "03",
      action: "Setup Profile",
      title: "Setup your Emma Profile",
      description: "Set up your personal profile with your information and preferences to connect with the community.",
      icon: Sparkles,
      status: "upcoming",
      result: getEmmaPersonOrWarriorProfile(),
      target: "/join/profile/setup",
    },
    {
      number: "04",
      action: "Confirm Profile",
      title: "Confirm and Save",
      description:
        "Confirm the details, save everything and start exploring events, connecting with warriors, and engaging with the community.",
      icon: Sword,
      status: "upcoming",
      result: getActiveUserProfile(),
      target: "/join/profile/complete",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <EmmaTitleBar />

      <main className="pt-20 container mx-auto px-4 pb-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-balance bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Join the ManKind Project Community
            </h1>
            <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
              Follow these simple steps to become part of the community and start your journey with EMMA.
            </p>
          </div>

          {/* Steps Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isComplete = isStepComplete(step.number)

              return (
                <Card
                  key={step.number}
                  className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                    isComplete
                      ? "bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20"
                      : "hover:border-primary/30"
                  }`}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            isComplete ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                          }`}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Step {step.number}</div>
                          <CardTitle className="text-lg leading-tight">{step.title}</CardTitle>
                        </div>
                      </div>
                      {isComplete && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="cursor-pointer">
                    {isComplete ? (
                      <div className="text-muted-foreground">{step.result}</div>
                    ) : (
                      <>
                        <p className="text-muted-foreground text-pretty leading-relaxed">{step.description}</p>
                        <Button
                          size="lg"
                          className="bg-primary hover:bg-primary/90"
                          onClick={() => {
                            if (step.target === "handleLogin") {
                              loginWithPopup()
                            } else {
                              navigate(step.target)
                            }
                          }}
                        >
                          {step.action}
                        </Button>
                      </>
                    )}
                  </CardContent>

                  {/* Decorative gradient overlay */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full -translate-y-16 translate-x-16" />
                </Card>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
