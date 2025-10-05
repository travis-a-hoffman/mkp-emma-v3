"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth0 } from "../../lib/auth0-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { EmmaTitleBar } from "../../components/emma/titlebar"
import { Loader2, Save, ArrowLeft, User, Sword } from "lucide-react"
import type { Person, Warrior } from "../../types/person"
import type { EventWithRelations } from "../../types/event"
import type { Area } from "../../types/area"
import type { Community } from "../../types/community"

interface WarriorWithRelations extends Warrior<EventWithRelations> {
  area: Area
  community: Community
}

export default function JoinProfileSetup() {
  const navigate = useNavigate()
  const { user, isLoading, isAuthenticated } = useAuth0()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mkpConnectWarrior, setMkpConnectWarrior] = useState<WarriorWithRelations | null>(null)
  const [emmaPersonOrWarrior, setEmmaPersonOrWarrior] = useState<Person | WarriorWithRelations | null>(null)

  // Form data for Person fields
  const [personFormData, setPersonFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    phone: "",
    notes: "",
    is_active: true,
  })

  // Form data for Warrior fields (only shown if mkpConnectWarrior exists)
  const [warriorFormData, setWarriorFormData] = useState({
    inner_essence_name: "",
    status: "active",
  })

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchMkpConnectWarrior()
      fetchEmmaPersonOrWarrior()
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
          // Pre-populate form with MkpConnect data
          setPersonFormData((prev) => ({
            ...prev,
            first_name: data.data[0].first_name || "",
            last_name: data.data[0].last_name || "",
            email: data.data[0].email || user.email || "",
            phone: data.data[0].phone || "",
          }))
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
          // Pre-populate form with existing Emma data
          const existing = data.person_or_warrior
          setPersonFormData((prev) => ({
            ...prev,
            first_name: existing.first_name || prev.first_name,
            middle_name: existing.middle_name || "",
            last_name: existing.last_name || prev.last_name,
            email: existing.email || prev.email,
            phone: existing.phone || prev.phone,
            notes: existing.notes || "",
            is_active: existing.is_active ?? true,
          }))

          // If it's a warrior, populate warrior fields
          if ("inner_essence_name" in existing) {
            setWarriorFormData((prev) => ({
              ...prev,
              inner_essence_name: existing.inner_essence_name || "",
              status: existing.status || "active",
            }))
          }
        }
      }
    } catch (error) {
      console.error("[v0] Error fetching Emma person/warrior:", error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const isWarrior = !!mkpConnectWarrior
      const isEditing = !!emmaPersonOrWarrior

      // Prepare the data based on whether this is a Person or Warrior
      let saveData: any = {
        ...personFormData,
        email: personFormData.email || user?.email,
      }

      if (isWarrior) {
        // If they have an mkpConnectWarrior, save as Warrior
        saveData = {
          ...saveData,
          ...warriorFormData,
          log_id: mkpConnectWarrior.log_id,
          initiation_id: mkpConnectWarrior.initiation_id,
          initiation_on: mkpConnectWarrior.initiation_on,
          training_events: mkpConnectWarrior.training_events || [],
          staffed_events: mkpConnectWarrior.staffed_events || [],
          lead_events: mkpConnectWarrior.lead_events || [],
          mos_events: mkpConnectWarrior.mos_events || [],
          area_id: mkpConnectWarrior.area_id,
          community_id: mkpConnectWarrior.community_id,
        }
      }

      const endpoint = isWarrior ? "/api/warriors" : "/api/people"
      const method = isEditing ? "PUT" : "POST"
      const url = isEditing ? `${endpoint}/${emmaPersonOrWarrior.id}` : endpoint

      if (isEditing) {
        saveData.id = emmaPersonOrWarrior.id
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saveData),
      })

      if (response.ok) {
        const data = await response.json()
        setEmmaPersonOrWarrior(data.data)

        // Navigate back to Join page to show completion
        navigate("/join")
      } else {
        console.error("[v0] Error saving profile:", await response.text())
      }
    } catch (error) {
      console.error("[v0] Error saving profile:", error)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <EmmaTitleBar />
        <div className="pt-20 container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mr-2" />
              <span className="text-lg">Loading profile setup...</span>
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
        <div className="pt-20 container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">Please log in to access this page.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isWarrior = !!mkpConnectWarrior
  const firstName = user.given_name || user.name?.split(" ")[0] || "Brother"

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <EmmaTitleBar />

      <main className="pt-20 container mx-auto px-4 pb-12">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/join")} className="flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Setup Your Emma Profile</h1>
              <p className="text-muted-foreground">
                {isWarrior ? "Complete your warrior profile information" : "Enter your basic profile information"}
              </p>
            </div>
          </div>

          {/* Profile Type Indicator */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center space-x-3">
                {isWarrior ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sword className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">Warrior Profile</div>
                      <div className="text-sm text-muted-foreground">
                        You have an MkpConnect profile - setting up as Warrior
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <User className="w-5 h-5 text-secondary-foreground" />
                    </div>
                    <div>
                      <div className="font-medium">Person Profile</div>
                      <div className="text-sm text-muted-foreground">
                        No MkpConnect profile found - setting up as Person
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Person Information Form */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={personFormData.first_name}
                    onChange={(e) => setPersonFormData((prev) => ({ ...prev, first_name: e.target.value }))}
                    placeholder="John"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={personFormData.last_name}
                    onChange={(e) => setPersonFormData((prev) => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="middle_name">Middle Name</Label>
                <Input
                  id="middle_name"
                  value={personFormData.middle_name}
                  onChange={(e) => setPersonFormData((prev) => ({ ...prev, middle_name: e.target.value }))}
                  placeholder="Michael"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={personFormData.email}
                    onChange={(e) => setPersonFormData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="john.doe@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={personFormData.phone}
                    onChange={(e) => setPersonFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={personFormData.notes}
                  onChange={(e) => setPersonFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about yourself..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Warrior-specific fields */}
          {isWarrior && (
            <Card>
              <CardHeader>
                <CardTitle>Warrior Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inner_essence_name">Inner Essence Name</Label>
                  <Input
                    id="inner_essence_name"
                    value={warriorFormData.inner_essence_name}
                    onChange={(e) => setWarriorFormData((prev) => ({ ...prev, inner_essence_name: e.target.value }))}
                    placeholder="Your inner essence name..."
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save Button */}
          <div className="flex justify-end space-x-4">
            <Button variant="outline" onClick={() => navigate("/join")} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !personFormData.first_name || !personFormData.last_name || !personFormData.email}
              size="lg"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving Profile...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
