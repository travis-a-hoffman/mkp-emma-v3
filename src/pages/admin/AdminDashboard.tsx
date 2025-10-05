"use client"

import { useAuth0 } from "../../lib/auth0-provider"
import { Navigate, Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Earth,
  MapPin,
  Users,
  Map,
  Building2,
  Calendar,
  CalendarDays,
  Contact,
  Loader2,
  Tags,
  Shield,
  HeartHandshake,
  Handshake,
  CreditCard,
  PersonStanding,
  Settings,
  Sword,
  UserPlus,
  Zap,
  UserCog,
} from "lucide-react"
import { EmmaTitleBar } from "../../components/emma/titlebar"
import { useState, useEffect } from "react"

interface AdminStats {
  [key: string]: {
    active: number
    inactive: number
    total: number
  }
}

const adminSections = [
  {
    type: "breaker",
    title: "Manage real world resources",
    description: "",
    icon: Earth,
    path: "",
    color: "text-gray-600",
    statsEndpoint: "",
  },
  {
    type: "card",
    title: "Venues",
    description: "Manage event venues and locations",
    icon: MapPin,
    path: "/admin/venues",
    color: "text-blue-600",
    statsEndpoint: "/api/venues/stats",
  },
  {
    type: "card",
    title: "Areas",
    description: "Manage geographical areas",
    icon: Map,
    path: "/admin/areas",
    color: "text-purple-600",
    statsEndpoint: "/api/areas/stats",
  },
  {
    type: "card",
    title: "Communities",
    description: "Manage community groups",
    icon: Building2,
    path: "/admin/communities",
    color: "text-orange-600",
    statsEndpoint: "/api/communities/stats",
  },
  {
    type: "breaker",
    title: "Manage New Warrior Training Adventures",
    description: "",
    icon: PersonStanding,
    path: "",
    color: "text-gray-600",
    statsEndpoint: "",
  },
  {
    type: "card",
    title: "NWTA Events",
    description: "Manage New Warrior Training Adventure events",
    icon: Zap,
    path: "/admin/nwtas",
    color: "text-yellow-600",
    statsEndpoint: "/api/nwta-events/stats",
  },
  {
    type: "card",
    title: "NWTA Registrants",
    description: "Manage people who have signed up for, but have not yet completed initiation",
    icon: UserPlus,
    path: "/admin/registrants",
    color: "text-cyan-600",
    statsEndpoint: "/api/registrants/stats",
  },
  {
    type: "card",
    title: "NWTA Roles",
    description: "Manage roles and responsibilities for NWTA events",
    icon: UserCog,
    path: "/admin/nwta-roles",
    color: "text-teal-600",
    statsEndpoint: "/api/nwta-roles/stats",
  },
  {
    type: "breaker",
    title: "Manage other events",
    description: "",
    icon: CalendarDays,
    path: "",
    color: "text-gray-600",
    statsEndpoint: "",
  },
  {
    type: "card",
    title: "Events",
    description: "Manage events and activities",
    icon: Calendar,
    path: "/admin/events",
    color: "text-red-600",
    statsEndpoint: "/api/events/stats",
  },
  {
    type: "card",
    title: "Event Types",
    description: "Manage event categories and types",
    icon: Tags,
    path: "/admin/event-types",
    color: "text-indigo-600",
    statsEndpoint: "/api/event-types/stats",
  },
  {
    type: "breaker",
    title: "Manage people",
    description: "",
    icon: Handshake,
    path: "",
    color: "text-gray-600",
    statsEndpoint: "",
  },
  {
    type: "card",
    title: "Prospects",
    description: "Manage people who have shown some interest in ManKind Project",
    icon: Contact,
    path: "/admin/prospects",
    color: "text-blue-600",
    statsEndpoint: "/api/prospects/stats",
  },
  {
    type: "card",
    title: "Warriors",
    description: "Manage people who are initiated men",
    icon: Sword,
    path: "/admin/warriors",
    color: "text-amber-600",
    statsEndpoint: "/api/warriors/stats",
  },
  {
    type: "card",
    title: "Members",
    description: "Manage people, (ManKind Project warriors) who are also paying members",
    icon: CreditCard,
    path: "/admin/members",
    color: "text-emerald-600",
    statsEndpoint: "/api/members/stats",
  },
  {
    type: "card",
    title: "Affiliates",
    description: "Manage people (ManKind Project warriors) from other countries",
    icon: Shield,
    path: "/admin/affiliates",
    color: "text-violet-600",
    statsEndpoint: "/api/affiliates/stats",
  },
  {
    type: "card",
    title: "Friends",
    description: "Manage all other people who are connected to, or tracked by, ManKind Project",
    icon: HeartHandshake,
    path: "/admin/friends",
    color: "text-pink-600",
    statsEndpoint: "/api/friends/stats",
  },
  {
    type: "card",
    title: "People",
    description: "Manage users and contacts",
    icon: Users,
    path: "/admin/people",
    color: "text-green-600",
    statsEndpoint: "/api/people/stats",
  },
  {
    type: "breaker",
    title: "Manage groups",
    description: "",
    icon: Users,
    path: "",
    color: "text-violet-600",
    statsEndpoint: "",
  },
  {
    type: "card",
    title: "I-Groups",
    description: "Manage IGroups",
    icon: Users,
    path: "/admin/i-groups",
    color: "text-fuschia-600",
    statsEndpoint: "/api/i-groups/stats",
  },
  {
    type: "card",
    title: "Men's Circles",
    description: "Manage Men's Circles",
    icon: Users,
    path: "/admin/mens-circles",
    color: "text-fuschia-600",
    statsEndpoint: "/api/mens-circles/stats",
  },
  {
    type: "card",
    title: "Open Circles",
    description: "Manage Open Circles",
    icon: Users,
    path: "/admin/open-circles",
    color: "text-fuschia-600",
    statsEndpoint: "/api/open-circles/stats",
  },
  {
    type: "card",
    title: "Societies",
    description: "Manage Societies",
    icon: Users,
    path: "/admin/societies",
    color: "text-fuschia-600",
    statsEndpoint: "/api/societies/stats",
  },
  {
    type: "card",
    title: "Groups",
    description: "Manage Groups",
    icon: Users,
    path: "/admin/groups",
    color: "text-fuschia-600",
    statsEndpoint: "/api/groups/stats",
  },
  {
    type: "breaker",
    title: "Manage system",
    description: "",
    icon: Settings,
    path: "",
    color: "text-indigo-600",
    statsEndpoint: "",
  },
  {
    type: "card",
    title: "Emma Users",
    description: "Manage system users",
    icon: Users,
    path: "/admin/emma/users",
    color: "text-fuschia-600",
    statsEndpoint: "/api/emma/users/stats",
  },
  {
    type: "card",
    title: "Emma Groups",
    description: "Manage system groups",
    icon: Users,
    path: "/admin/emma/usergroups",
    color: "text-lime-600",
    statsEndpoint: "/api/emma/groups/stats",
  },
]

export default function AdminDashboard() {
  const { isAuthenticated, isLoading } = useAuth0()
  const [stats, setStats] = useState<AdminStats>({})
  const [statsLoading, setStatsLoading] = useState(true)

  const fetchStats = async () => {
    try {
      console.log("[v0] Starting to fetch stats for all card sections")

      const statsPromises = adminSections
        .filter((s) => s.type === "card")
        .map(async (section) => {
          console.log("[v0] Fetching stats for:", section.title, "from:", section.statsEndpoint)
          const response = await fetch(section.statsEndpoint)

          if (!response.ok) {
            console.log("[v0] Failed to fetch stats for:", section.title, "Status:", response.status)
            return { [section.title]: { active: 0, inactive: 0, total: 0 } }
          }

          const responseData = await response.json()
          console.log("[v0] Raw response for", section.title, ":", responseData)

          const statsData = responseData.success ? responseData.data : { active: 0, inactive: 0, total: 0 }
          console.log("[v0] Processed stats for", section.title, ":", statsData)

          return { [section.title]: statsData }
        })

      const results = await Promise.all(statsPromises)
      const combinedStats = results.reduce((acc, stat) => ({ ...acc, ...stat }), {})
      console.log("[v0] Final combined stats:", combinedStats)
      setStats(combinedStats)
    } catch (error) {
      console.error("[v0] Error fetching admin stats:", error)
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats()
    }
  }, [isAuthenticated])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <EmmaTitleBar title="Events Management" backLink={{ href: "/admin", label: "Back to Admin" }} />
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

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <EmmaTitleBar title="Events Management" backLink={{ href: "/admin", label: "Back to Admin" }} />
        <div className="p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mr-2" />
              <span className="text-lg">Loading dashboard statistics...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <EmmaTitleBar title="Admin Dashboard" backLink={{ href: "/", label: "Home" }} />

      <div className="p-6 pt-20">
        <div className="max-w-6xl mx-auto">
          {/* Admin Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminSections.map((section, index) => {
              const IconComponent = section.icon
              if (section.type === "card") {
                const sectionStats = stats[section.title] || { active: 0, inactive: 0, total: 0 }

                return (
                  <Link key={section.path} to={section.path}>
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                      <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-gray-100 ${section.color}`}>
                            <IconComponent className="w-6 h-6" />
                          </div>
                          <CardTitle className="text-xl">{section.title}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="text-base">{section.description}</CardDescription>
                        <div className="mb-3 text-sm text-gray-600">
                          {statsLoading ? (
                            <div className="text-gray-400">Loading stats...</div>
                          ) : (
                            <div className="flex gap-4">
                              <span>
                                Active: <span className="font-medium text-green-600">{sectionStats.active}</span>
                              </span>
                              <span>
                                Inactive: <span className="font-medium text-red-600">{sectionStats.inactive}</span>
                              </span>
                              <span>
                                Total: <span className="font-medium text-gray-800">{sectionStats.total}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              } else if (section.type === "breaker") {
                return (
                  <div key={`breaker-${index}`} className="col-span-full mb-8 mt-8 first:mt-0">
                    <div className="flex items-center gap-3 mb-2">
                      <IconComponent className="w-8 h-8 text-gray-600" />
                      <h2 className="text-2xl font-semibold text-gray-700">{section.title}</h2>
                    </div>
                    <div className="border-b border-gray-300 pb-2"></div>
                  </div>
                )
              }
              return null
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
