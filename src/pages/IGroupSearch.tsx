"use client"

import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Search, MapPin, Calendar, Users, Loader2, X, Filter } from "lucide-react"
import { EmmaTitleBar } from "../components/emma/titlebar"
import { EmmaAreaTag } from "../components/emma/area-tag"
import { EmmaCommunityTag } from "../components/emma/community-tag"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { IGroupWithRelations } from "../types/group"

interface IGroupWithDistance extends IGroupWithRelations {
  distance?: number
  distance_units?: string
}

interface SearchParams {
  name: string
  city: string
  state: string
  zipcode: string
  days: string[]
  initiated: boolean
  uninitiated: boolean
}

const DAYS_OF_WEEK = [
  { value: 'Sun', label: 'Sunday' },
  { value: 'Mon', label: 'Monday' },
  { value: 'Tue', label: 'Tuesday' },
  { value: 'Wed', label: 'Wednesday' },
  { value: 'Thu', label: 'Thursday' },
  { value: 'Fri', label: 'Friday' },
  { value: 'Sat', label: 'Saturday' },
]

function formatActiveSince(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function formatDistance(meters: number | undefined): string {
  if (!meters) return ""
  const miles = meters / 1609.34
  return `${miles.toFixed(1)} mi away`
}

export default function IGroupSearch() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [params, setParams] = useState<SearchParams>({
    name: searchParams.get('name') || '',
    city: searchParams.get('city') || '',
    state: searchParams.get('state') || '',
    zipcode: searchParams.get('zipcode') || '',
    days: searchParams.get('days')?.split(' ').filter(Boolean) || [],
    initiated: searchParams.get('initiated') === 'true',
    uninitiated: searchParams.get('uninitiated') === 'true',
  })

  const [groups, setGroups] = useState<IGroupWithDistance[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (hasAnySearchParam()) {
        performSearch()
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [params])

  // Sync params to URL
  useEffect(() => {
    const newSearchParams = new URLSearchParams()
    if (params.name) newSearchParams.set('name', params.name)
    if (params.city) newSearchParams.set('city', params.city)
    if (params.state) newSearchParams.set('state', params.state)
    if (params.zipcode) newSearchParams.set('zipcode', params.zipcode)
    if (params.days.length > 0) newSearchParams.set('days', params.days.join(' '))
    if (params.initiated) newSearchParams.set('initiated', 'true')
    if (params.uninitiated) newSearchParams.set('uninitiated', 'true')

    setSearchParams(newSearchParams, { replace: true })
  }, [params, setSearchParams])

  const hasAnySearchParam = (): boolean => {
    return !!(
      params.name ||
      params.city ||
      params.state ||
      params.zipcode ||
      params.days.length > 0 ||
      params.initiated ||
      params.uninitiated
    )
  }

  const performSearch = async () => {
    if (!hasAnySearchParam()) {
      setGroups([])
      setHasSearched(false)
      return
    }

    setLoading(true)
    setHasSearched(true)

    try {
      const queryParams = new URLSearchParams()
      if (params.name) queryParams.set('name', params.name)
      if (params.city) queryParams.set('city', params.city)
      if (params.state) queryParams.set('state', params.state)
      if (params.zipcode) queryParams.set('zipcode', params.zipcode)
      if (params.days.length > 0) queryParams.set('days', params.days.join(' '))
      if (params.initiated) queryParams.set('initiated', 'true')
      if (params.uninitiated) queryParams.set('uninitiated', 'true')
      queryParams.set('active', 'true')

      const response = await fetch(`/api/i-groups?${queryParams.toString()}`)
      const result = await response.json()

      if (result.success) {
        setGroups(result.data || [])
      } else {
        console.error("Search failed:", result.error)
        setGroups([])
      }
    } catch (error) {
      console.error("Search error:", error)
      setGroups([])
    } finally {
      setLoading(false)
    }
  }

  const handleGroupClick = (groupId: string) => {
    navigate(`/i-group/${groupId}`, {
      state: { backLink: { href: "/i-group/search", label: "Back to Search" } }
    })
  }

  const clearAllFilters = () => {
    setParams({
      name: '',
      city: '',
      state: '',
      zipcode: '',
      days: [],
      initiated: false,
      uninitiated: false,
    })
    setGroups([])
    setHasSearched(false)
  }

  const toggleDay = (day: string) => {
    setParams(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }))
  }

  const activeFilterCount = () => {
    let count = 0
    if (params.name) count++
    if (params.city) count++
    if (params.state) count++
    if (params.zipcode) count++
    if (params.days.length > 0) count++
    if (params.initiated) count++
    if (params.uninitiated) count++
    return count
  }

  return (
    <div className="min-h-screen bg-background">
      <EmmaTitleBar />
      <div className="pt-20 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Search for I-Groups</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Hide' : 'Show'} Filters
              {activeFilterCount() > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilterCount()}
                </Badge>
              )}
            </Button>
          </div>

          {showFilters && (
            <Card className="mb-8">
              <CardContent className="pt-6 space-y-6">
                {/* Name Search */}
                <div>
                  <Label htmlFor="name">Group Name</Label>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Search by group name..."
                      value={params.name}
                      onChange={(e) => setParams({ ...params, name: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Location Search */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      type="text"
                      placeholder="Portland"
                      value={params.city}
                      onChange={(e) => setParams({ ...params, city: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      type="text"
                      placeholder="OR"
                      value={params.state}
                      onChange={(e) => setParams({ ...params, state: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="zipcode">Zipcode</Label>
                    <Input
                      id="zipcode"
                      type="text"
                      placeholder="97202"
                      value={params.zipcode}
                      onChange={(e) => setParams({ ...params, zipcode: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>

                {/* Days of Week */}
                <div>
                  <Label className="mb-3 block">Meeting Days</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`day-${day.value}`}
                          checked={params.days.includes(day.value)}
                          onCheckedChange={() => toggleDay(day.value)}
                        />
                        <Label
                          htmlFor={`day-${day.value}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {day.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Visitor Options */}
                <div>
                  <Label className="mb-3 block">Accepting Visitors</Label>
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="initiated"
                        checked={params.initiated}
                        onCheckedChange={(checked) =>
                          setParams({ ...params, initiated: checked as boolean })
                        }
                      />
                      <Label htmlFor="initiated" className="text-sm font-normal cursor-pointer">
                        Accepting Initiated Visitors
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="uninitiated"
                        checked={params.uninitiated}
                        onCheckedChange={(checked) =>
                          setParams({ ...params, uninitiated: checked as boolean })
                        }
                      />
                      <Label htmlFor="uninitiated" className="text-sm font-normal cursor-pointer">
                        Accepting Uninitiated Visitors
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Clear Filters */}
                {hasAnySearchParam() && (
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={clearAllFilters}>
                      <X className="h-4 w-4 mr-2" />
                      Clear All Filters
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Results Section */}
          {loading && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Searching I-Groups...</p>
            </div>
          )}

          {!loading && hasSearched && groups.length === 0 && (
            <div className="text-center py-12">
              <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No I-Groups Found</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                No I-Groups match your search criteria. Try adjusting your filters.
              </p>
            </div>
          )}

          {!loading && !hasSearched && !hasAnySearchParam() && (
            <div className="text-center py-12">
              <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Search for I-Groups</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Use the filters above to search for I-Groups by name, location, meeting days, or visitor acceptance.
              </p>
            </div>
          )}

          {!loading && groups.length > 0 && (
            <div className="space-y-4">
              <p className="text-muted-foreground mb-4">
                Found {groups.length} I-Group{groups.length !== 1 ? "s" : ""}
              </p>

              {groups.map((group) => (
                <Card
                  key={group.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleGroupClick(group.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col space-y-3">
                      {/* Header with name and visitor tags */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-semibold flex-1">{group.name}</h3>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {group.is_accepting_initiated_visitors && (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">
                              Initiated
                            </Badge>
                          )}
                          {group.is_accepting_uninitiated_visitors && (
                            <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 text-xs">
                              Uninitiated
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Area and Community tags */}
                      {(group.area || group.community) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {group.area && <EmmaAreaTag area={group.area} />}
                          {group.community && <EmmaCommunityTag community={group.community} />}
                        </div>
                      )}

                      {/* Description */}
                      {group.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{group.description}</p>
                      )}

                      {/* Active since */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>Active since {formatActiveSince(group.created_at)}</span>
                      </div>

                      {/* Schedule description */}
                      {group.schedule_description && (
                        <div className="p-2 bg-muted rounded-md">
                          <p className="text-sm text-muted-foreground">{group.schedule_description}</p>
                        </div>
                      )}

                      {/* Footer: Members and Distance */}
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 flex-shrink-0" />
                          <span>{group.members?.length || 0} member{group.members?.length !== 1 ? "s" : ""}</span>
                        </div>

                        {group.distance && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span>{formatDistance(group.distance)}</span>
                          </div>
                        )}

                        {group.venue && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">
                              {group.venue.name}
                              {group.venue.physical_address && (
                                <span>
                                  , {group.venue.physical_address.city}, {group.venue.physical_address.state}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
