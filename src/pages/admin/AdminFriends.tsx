"use client"

import { useAuth0 } from "../../lib/auth0-provider"
import { Navigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Heart, Search, Eye, EyeOff, UserCheck, UserPlus, Loader2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { EmmaTitleBar } from "../../components/emma/titlebar"
import { EmmaPersonDisplay } from "../../components/emma/person-display"
import type { Person } from "../../types/person"
import { useState, useEffect } from "react"

export default function AdminFriends() {
  const { isAuthenticated, isLoading } = useAuth0()
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const friends = people

  const filteredFriends = friends.filter((person) => {
    const matchesSearch =
      `${person.first_name} ${person.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      person.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      person.phone?.includes(searchTerm)

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && person.is_active) ||
      (statusFilter === "inactive" && !person.is_active)

    return matchesSearch && matchesStatus
  })

  const friendStats = {
    total: friends.length,
    active: friends.filter((p) => p.is_active).length,
    inactive: friends.filter((p) => !p.is_active).length,
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [isAuthenticated])

  const fetchData = async () => {
    try {
      setLoading(true)

      const response = await fetch("/api/people")
      if (!response.ok) {
        throw new Error("Failed to fetch people")
      }

      const data = await response.json()
      setPeople(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch friends")
      console.error("Error fetching friends:", err)
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
      <EmmaTitleBar title="Friends" backLink={{ href: "/admin", label: "Back to Admin" }} />

      <div className="p-6 pt-20">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <p className="text-gray-600">Manage personal connections and community friends</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Friends</p>
                    <p className="text-2xl font-bold text-gray-900">{friendStats.total}</p>
                  </div>
                  <Heart className="w-8 h-8 text-pink-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active</p>
                    <p className="text-2xl font-bold text-green-600">{friendStats.active}</p>
                  </div>
                  <UserCheck className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Inactive</p>
                    <p className="text-2xl font-bold text-gray-600">{friendStats.inactive}</p>
                  </div>
                  <UserPlus className="w-8 h-8 text-gray-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search by name, email, or phone..."
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
                    <SelectItem value="all">All Friends</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Friends List */}
          <Card>
            <CardHeader>
              <CardTitle>Friends ({filteredFriends.length})</CardTitle>
              <CardDescription>Personal connections and community friends</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-pink-600 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Loading friends...</p>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <Heart className="w-16 h-16 text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Friends</h3>
                  <p className="text-red-600 mb-4">{error}</p>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    Try Again
                  </Button>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Friends Found</h3>
                  <p className="text-gray-600 mb-4">
                    {searchTerm || statusFilter !== "all"
                      ? "No friends match your current filters."
                      : "No personal connections found in the system."}
                  </p>
                </div>
              ) : (
                <TooltipProvider>
                  <div className="space-y-4">
                    {filteredFriends.map((friend) => {
                      const isExpanded = expandedItems.has(friend.id)

                      return (
                        <div key={friend.id} className="border rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between p-4">
                            <div className="flex items-center space-x-4 flex-1">
                              <Heart className="w-5 h-5 text-pink-600" />
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <EmmaPersonDisplay person={friend} showAvatar={true} showContactInfo={false} />
                                  <Badge variant={friend.is_active ? "default" : "secondary"}>
                                    {friend.is_active ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-600">{friend.email}</span>
                                  {friend.phone && <span className="text-sm text-gray-600">• {friend.phone}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toggleExpanded(friend.id)}
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
                              <div className="pt-4">
                                <EmmaPersonDisplay
                                  person={friend} showAvatar={true} showContactInfo={true} />
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
