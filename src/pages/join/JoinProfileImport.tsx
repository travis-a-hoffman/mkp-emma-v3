"use client"

import { useState } from "react"
import { useAuth0 } from "../../lib/auth0-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  Check,
  Plus,
  Minus,
  User,
  Mail,
  Phone,
  PersonStanding,
  MapPin,
  Hash,
  Users,
} from "lucide-react"
import { EmmaTitleBar } from "../../components/emma/titlebar"
import type { WarriorWithRelations } from "../../../api/mkp-connect/warriors"
import { useNavigate } from "react-router-dom"

interface WarriorProfile {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  email: string
  phone?: string | null
  address?: {
    street?: string
    city?: string
    state?: string
    zip?: string
  }
  initiation_on: string | null
  community?: string
  area?: string
  civicrm_id?: string
  drupal_id?: string
}

interface ProfileSelection {
  profileId: string
  type: "primary" | "match" | "not-match"
}

export default function JoinProfileImport() {
  const { user, isLoading, isAuthenticated } = useAuth0()
  const navigate = useNavigate()

  const [activeSearchTab, setActiveSearchTab] = useState("email")
  const [searchEmail, setSearchEmail] = useState("")
  const [searchUserId, setSearchUserId] = useState("")
  const [searchFirstName, setSearchFirstName] = useState("")
  const [searchMiddleName, setSearchMiddleName] = useState("")
  const [searchLastName, setSearchLastName] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<WarriorProfile[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [selections, setSelections] = useState<ProfileSelection[]>([])
  const [isLinking, setIsLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSearchByUserId = async () => {
    if (!searchUserId.trim()) {
      setSearchError("Please enter a valid connect User Id")
      return
    }

    setIsSearching(true)
    setSearchError(null)
    setSearchResults([])
    setSelections([])

    try {
      const response = await fetch(`/api/mkp-connect/warriors?userid=${encodeURIComponent(searchUserId)}`)
      if (response.ok) {
        const responseObj = await response.json()
        const responseData: WarriorWithRelations[] = responseObj.data || []

        const warriorProfiles: WarriorProfile[] = []
        responseData.forEach((w) => {
          const wp: WarriorProfile = {
            id: w.id,
            first_name: w.first_name,
            middle_name: w.middle_name || null,
            last_name: w.last_name,
            initiation_on: w.initiation_event ? w.initiation_event.end_at : w.initiation_on,
            email: w.email || "Unknown",
            phone: w.phone,
            address: {
              street: w.physical_address?.address_1,
              city: w.physical_address?.city,
              state: w.physical_address?.state,
              zip: w.physical_address?.postal_code,
            },
            area: w.area?.name || "Unknown",
            community: w.community?.name || "Unknown",
            civicrm_id: w.civicrm_id,
            drupal_id: w.drupal_id,
          }
          warriorProfiles.push(wp)
        })
        setSearchResults(warriorProfiles)
        if (warriorProfiles.length === 0) {
          setSearchError("No warrior profiles found for this Connect ID")
        }
      } else {
        setSearchError(`Search failed: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      setSearchError(`Search failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearchByName = async () => {
    if (!searchFirstName.trim() && !searchLastName.trim()) {
      setSearchError("Please enter first and last name to search by")
      return
    }

    setIsSearching(true)
    setSearchError(null)
    setSearchResults([])
    setSelections([])

    try {
      const nameParams =
        "firstname=" +
        encodeURIComponent(searchFirstName.trim()) +
        (searchMiddleName.trim() ? "&middlename=" + encodeURIComponent(searchMiddleName.trim()) : "") +
        "&lastname=" +
        encodeURIComponent(searchLastName.trim())
      const response = await fetch(`/api/mkp-connect/warriors?${nameParams}`)
      if (response.ok) {
        const responseObj = await response.json()
        const responseData: WarriorWithRelations[] = responseObj.data || []

        const warriorProfiles: WarriorProfile[] = []
        responseData.forEach((w) => {
          const wp: WarriorProfile = {
            id: w.id,
            first_name: w.first_name,
            middle_name: w.middle_name || null,
            last_name: w.last_name,
            initiation_on: w.initiation_event ? w.initiation_event.end_at : w.initiation_on,
            email: w.email || "Unknown",
            phone: w.phone,
            address: {
              street: w.physical_address?.address_1,
              city: w.physical_address?.city,
              state: w.physical_address?.state,
              zip: w.physical_address?.postal_code,
            },
            area: w.area?.name || "Unknown",
            community: w.community?.name || "Unknown",
            civicrm_id: w.civicrm_id,
            drupal_id: w.drupal_id,
          }
          warriorProfiles.push(wp)
        })
        setSearchResults(warriorProfiles)
        if (warriorProfiles.length === 0) {
          setSearchError("No warrior profiles found for this name")
        }
      } else {
        setSearchError(`Search failed: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      setSearchError(`Search failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearchByEmail = async () => {
    if (!searchEmail.trim() || !isValidEmail(searchEmail)) {
      setSearchError("Please enter a valid email address")
      return
    }

    setIsSearching(true)
    setSearchError(null)
    setSearchResults([])
    setSelections([])

    try {
      const response = await fetch(`/api/mkp-connect/warriors?email=${encodeURIComponent(searchEmail)}`)
      if (response.ok) {
        const responseObj = await response.json()
        const responseData: WarriorWithRelations[] = responseObj.data || []

        const warriorProfiles: WarriorProfile[] = []
        responseData.forEach((w) => {
          const wp: WarriorProfile = {
            id: w.id,
            first_name: w.first_name,
            middle_name: w.middle_name || null,
            last_name: w.last_name,
            initiation_on: w.initiation_event ? w.initiation_event.end_at : w.initiation_on,
            email: w.email || "Unknown",
            phone: w.phone,
            address: {
              street: w.physical_address?.address_1,
              city: w.physical_address?.city,
              state: w.physical_address?.state,
              zip: w.physical_address?.postal_code,
            },
            area: w.area?.name || "Unknown",
            community: w.community?.name || "Unknown",
            civicrm_id: w.civicrm_id,
            drupal_id: w.drupal_id,
          }
          warriorProfiles.push(wp)
        })
        setSearchResults(warriorProfiles)
        if (warriorProfiles.length === 0) {
          setSearchError("No warrior profiles found for this email address")
        }
      } else {
        setSearchError(`Search failed: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      setSearchError(`Search failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsSearching(false)
    }
  }

  const toggleCardExpansion = (profileId: string) => {
    const newExpanded = new Set(expandedCards)
    if (newExpanded.has(profileId)) {
      newExpanded.delete(profileId)
    } else {
      newExpanded.add(profileId)
    }
    setExpandedCards(newExpanded)
  }

  const handleSelectionChange = (profileId: string, type: "primary" | "match" | "not-match") => {
    const newSelections = selections.filter((s) => s.profileId !== profileId)

    if (type === "primary") {
      const filteredSelections = newSelections.filter((s) => s.type !== "primary")
      setSelections([...filteredSelections, { profileId, type }])
    } else {
      setSelections([...newSelections, { profileId, type }])
    }
  }

  const getSelectionForProfile = (profileId: string): ProfileSelection | undefined => {
    return selections.find((s) => s.profileId === profileId)
  }

  const getSelectionIcon = (profileId: string) => {
    const selection = getSelectionForProfile(profileId)
    if (!selection) return null

    switch (selection.type) {
      case "primary":
        return <Check className="w-4 h-4 text-green-600" />
      case "match":
        return <Plus className="w-4 h-4 text-blue-600" />
      case "not-match":
        return <Minus className="w-4 h-4 text-red-600" />
      default:
        return null
    }
  }

  const handleSaveProfile = async () => {
    const primaryProfile = searchResults.find((profile) =>
      selections.some((s) => s.profileId === profile.id && s.type === "primary"),
    )

    if (!primaryProfile) {
      setLinkError("Please select a primary profile before saving")
      return
    }

    setIsLinking(true)
    setLinkError(null)

    try {
      // This follows the same pattern as JoinProfileSetup.tsx

      // First, check if user already exists in Emma
      const userResponse = await fetch(`/api/users?email=${encodeURIComponent(user?.email || "")}`)
      let userData = null

      if (userResponse.ok) {
        const userResult = await userResponse.json()
        if (userResult.data && userResult.data.length > 0) {
          userData = userResult.data[0]
        }
      }

      // Create or update user with mkpConnectWarrior link
      const mkpConnectWarriorData = {
        id: primaryProfile.id,
        first_name: primaryProfile.first_name,
        middle_name: primaryProfile.middle_name,
        last_name: primaryProfile.last_name,
        email: primaryProfile.email,
        phone: primaryProfile.phone,
        initiation_on: primaryProfile.initiation_on,
        area: primaryProfile.area,
        community: primaryProfile.community,
        civicrm_id: primaryProfile.civicrm_id,
        drupal_id: primaryProfile.drupal_id,
        address: primaryProfile.address,
      }

      const userPayload = {
        auth0_user: {
          email: user?.email,
          given_name: user?.given_name,
          family_name: user?.family_name,
          name: user?.name,
          picture: user?.picture,
          sub: user?.sub,
        },
        civicrm_user: mkpConnectWarriorData,
        mkp_connect_warrior: mkpConnectWarriorData, // Store the warrior data
      }

      let saveResponse
      if (userData) {
        // Update existing user
        saveResponse = await fetch(`/api/users?id=${userData.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userPayload),
        })
      } else {
        // Create new user
        saveResponse = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userPayload),
        })
      }

      if (saveResponse.ok) {
        console.log("[v0] Successfully saved mkpConnectWarrior profile")
        // Navigate back to Join page - it will refetch data and show step completion
        navigate("/join")
      } else {
        setLinkError("Failed to save profile. Please try again.")
      }
    } catch (error) {
      setLinkError(`Failed to save profile: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLinking(false)
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

  const primarySelection = selections.find((s) => s.type === "primary")
  const matchSelections = selections.filter((s) => s.type === "match")

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <EmmaTitleBar />

      <main className="pt-20 container mx-auto px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <Card>
            <CardHeader>
              <CardTitle className="text-center text-balance">Link Your MkpConnect Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-left text-muted-foreground text-pretty">
                Search for your existing MkpConnect profile using your email address, Connect ID, or name.
              </div>
              <div className="text-center text-balance mt-6">Why Do This Step?</div>
              <div className="text-left text-muted-foreground text-pretty mt-6">
                Your user authenticates you with the system securely, but it is your MkpConnect profile that lets us
                know what specific parts of the system you should have access to. This step keeps everyone's data safe
                while still letting EMMA share data with just the right people.
              </div>
            </CardContent>
          </Card>

          {isAuthenticated && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Search for Your Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeSearchTab} onValueChange={setActiveSearchTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email
                    </TabsTrigger>
                    <TabsTrigger value="connectid" className="flex items-center gap-2">
                      <Hash className="w-4 h-4" />
                      Connect ID
                    </TabsTrigger>
                    <TabsTrigger value="name" className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Name
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="email" className="space-y-4 mt-6">
                    <div className="space-y-2">
                      <Label htmlFor="search-email">Email Address</Label>
                      <div className="flex gap-2">
                        <Input
                          id="search-email"
                          type="email"
                          placeholder="Enter your email address"
                          value={searchEmail}
                          onChange={(e) => setSearchEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearchByEmail()}
                          disabled={isSearching}
                        />
                        <Button
                          onClick={handleSearchByEmail}
                          disabled={isSearching || !searchEmail.trim() || !isValidEmail(searchEmail)}
                        >
                          {isSearching ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Search className="w-4 h-4 mr-2" />
                          )}
                          Search
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="connectid" className="space-y-4 mt-6">
                    <div className="space-y-2">
                      <Label htmlFor="search-userid">Connect ID</Label>
                      <div className="flex gap-2">
                        <Input
                          id="search-userid"
                          type="text"
                          placeholder="Enter your Connect ID"
                          value={searchUserId}
                          onChange={(e) => setSearchUserId(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearchByUserId()}
                          disabled={isSearching}
                        />
                        <Button onClick={handleSearchByUserId} disabled={isSearching || !searchUserId.trim()}>
                          {isSearching ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Search className="w-4 h-4 mr-2" />
                          )}
                          Search
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="name" className="space-y-4 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="search-firstname">First Name</Label>
                        <Input
                          id="search-firstname"
                          type="text"
                          placeholder="First name"
                          value={searchFirstName}
                          onChange={(e) => setSearchFirstName(e.target.value)}
                          disabled={isSearching}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="search-middlename">Middle Name</Label>
                        <Input
                          id="search-middlename"
                          type="text"
                          placeholder="Middle name (optional)"
                          value={searchMiddleName}
                          onChange={(e) => setSearchMiddleName(e.target.value)}
                          disabled={isSearching}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="search-lastname">Last Name</Label>
                        <Input
                          id="search-lastname"
                          type="text"
                          placeholder="Last name"
                          value={searchLastName}
                          onChange={(e) => setSearchLastName(e.target.value)}
                          disabled={isSearching}
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleSearchByName}
                      disabled={isSearching || (!searchFirstName.trim() && !searchLastName.trim())}
                      className="w-full"
                    >
                      {isSearching ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Search className="w-4 h-4 mr-2" />
                      )}
                      Search by Name
                    </Button>
                  </TabsContent>
                </Tabs>

                {searchError && <div className="text-sm text-destructive mt-4">{searchError}</div>}
              </CardContent>
            </Card>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Search Results</h2>
              <div className="text-sm text-muted-foreground">
                Select one profile as your <strong>primary</strong> profile, and mark others as <strong>matches</strong>{" "}
                or <strong>not matches</strong>.
              </div>

              {searchResults.map((profile) => (
                <Card key={profile.id} className="relative">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center">
                        <User className="w-5 h-5 mr-2" />
                        {profile.first_name} {profile.middle_name && `${profile.middle_name} `}
                        {profile.last_name}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {getSelectionIcon(profile.id)}
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => toggleCardExpansion(profile.id)}>
                              {expandedCards.has(profile.id) ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </Collapsible>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Initiation Date */}
                    {profile.initiation_on && (
                      <div className="flex items-center">
                        <PersonStanding className="w-4 h-4 mr-2 text-muted-foreground" />
                        <span className="text-sm font-medium">Initiated: </span>
                        <span className="text-sm">
                          {new Date(profile.initiation_on).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    )}

                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-2 text-muted-foreground" />
                        <span className="text-sm">{profile.email}</span>
                      </div>
                      {profile.phone && (
                        <div className="flex items-center">
                          <Phone className="w-4 h-4 mr-2 text-muted-foreground" />
                          <span className="text-sm">{profile.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Expandable Details */}
                    <Collapsible open={expandedCards.has(profile.id)}>
                      <CollapsibleContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {profile.address && (
                            <div className="flex items-start">
                              <MapPin className="w-4 h-4 mr-2 mt-0.5 text-muted-foreground" />
                              <div className="text-sm">
                                <div className="font-medium">Address:</div>
                                {profile.address.street && <div>{profile.address.street}</div>}
                                <div>
                                  {[profile.address.city, profile.address.state, profile.address.zip]
                                    .filter(Boolean)
                                    .join(", ")}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {profile.civicrm_id && (
                            <div className="flex items-center">
                              <div className="w-4 h-4 mr-2 text-muted-foreground flex items-center justify-center">
                                <span className="text-xs font-bold">C</span>
                              </div>
                              <span className="text-sm">CiviCRM ID: {profile.civicrm_id}</span>
                            </div>
                          )}
                          {profile.drupal_id && (
                            <div className="flex items-center">
                              <div className="w-4 h-4 mr-2 text-muted-foreground flex items-center justify-center">
                                <span className="text-xs font-bold">D</span>
                              </div>
                              <span className="text-sm">Drupal ID: {profile.drupal_id}</span>
                            </div>
                          )}
                        </div>

                        {(profile.community || profile.area) && (
                          <div className="pt-2 border-t">
                            <div className="text-sm text-muted-foreground">
                              {profile.community && <div>Community: {profile.community}</div>}
                              {profile.area && <div>Area: {profile.area}</div>}
                            </div>
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Selection Controls */}
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant={getSelectionForProfile(profile.id)?.type === "primary" ? "default" : "outline"}
                        onClick={() => handleSelectionChange(profile.id, "primary")}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Primary
                      </Button>
                      <Button
                        size="sm"
                        variant={getSelectionForProfile(profile.id)?.type === "match" ? "default" : "outline"}
                        onClick={() => handleSelectionChange(profile.id, "match")}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Match
                      </Button>
                      <Button
                        size="sm"
                        variant={getSelectionForProfile(profile.id)?.type === "not-match" ? "destructive" : "outline"}
                        onClick={() => handleSelectionChange(profile.id, "not-match")}
                      >
                        <Minus className="w-4 h-4 mr-1" />
                        Not Match
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {selections.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Save Profile Selection</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {primarySelection && (
                        <div className="flex items-center gap-2">
                          <Badge variant="default">Primary</Badge>
                          <span className="text-sm">
                            {searchResults.find((p) => p.id === primarySelection.profileId)?.first_name}{" "}
                            {searchResults.find((p) => p.id === primarySelection.profileId)?.last_name}
                          </span>
                        </div>
                      )}
                      {matchSelections.map((selection) => (
                        <div key={selection.profileId} className="flex items-center gap-2">
                          <Badge variant="secondary">Match</Badge>
                          <span className="text-sm">
                            {searchResults.find((p) => p.id === selection.profileId)?.first_name}{" "}
                            {searchResults.find((p) => p.id === selection.profileId)?.last_name}
                          </span>
                        </div>
                      ))}
                    </div>

                    {linkError && <div className="text-sm text-destructive">{linkError}</div>}

                    <Button onClick={handleSaveProfile} disabled={!primarySelection || isLinking} className="w-full">
                      {isLinking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Save Profile & Continue
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
