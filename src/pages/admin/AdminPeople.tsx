"use client"

import { useAuth0 } from "../../lib/auth0-provider"
import { Navigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Users, Plus, Edit, Archive, Loader2, Eye, EyeOff, Save, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { EmmaTitleBar } from "../../components/emma/titlebar"
import { EmmaAddress } from "../../components/emma/address"
import { EmmaPhotoUploadModal } from "../../components/emma/photo-upload-modal"
import { useState, useEffect } from "react"

interface Person {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  email: string | null
  phone: string | null
  billing_address_id: string | null
  mailing_address_id: string | null
  physical_address_id: string | null
  notes: string | null
  photo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Address {
  id: string
  address_1: string
  address_2?: string | null
  city: string
  state: string
  country: string
  postal_code: string
  created_at: string
  updated_at: string
}

interface PersonApiResponse {
  data: Person | Person[]
  count: number
  message?: string
}

export default function AdminPeople() {
  const { isAuthenticated, isLoading } = useAuth0()
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set())
  const [editFormData, setEditFormData] = useState<Record<string, Partial<Person>>>({})
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set())
  const [archiveConfirmation, setArchiveConfirmation] = useState<{ isOpen: boolean; person: Person | null }>({
    isOpen: false,
    person: null,
  })
  const [archivingItems, setArchivingItems] = useState<Set<string>>(new Set())
  const [creatingPerson, setCreatingPerson] = useState<Person | null>(null)
  const [photoUploadModal, setPhotoUploadModal] = useState<{
    isOpen: boolean
    personId: string | null
    cropMode: boolean
  }>({
    isOpen: false,
    personId: null,
    cropMode: false,
  })
  const [addressCache, setAddressCache] = useState<Record<string, Address>>({})

  const filteredPeople = people.filter((person) => (showArchived ? !person.is_active : person.is_active))
  const displayedPeople = creatingPerson && !showArchived ? [creatingPerson, ...filteredPeople] : filteredPeople

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

  const startEditing = (person: Person) => {
    setEditingItems((prev) => new Set(prev).add(person.id))
    setEditFormData((prev) => ({
      ...prev,
      [person.id]: {
        first_name: person.first_name,
        middle_name: person.middle_name,
        last_name: person.last_name,
        email: person.email,
        phone: person.phone,
        billing_address_id: person.billing_address_id,
        mailing_address_id: person.mailing_address_id,
        physical_address_id: person.physical_address_id,
        notes: person.notes,
        photo_url: person.photo_url,
        is_active: person.is_active,
      },
    }))
  }

  const createNewPerson = () => {
    const tempId = `temp-${Date.now()}`
    const newPerson: Person = {
      id: tempId,
      first_name: "",
      middle_name: null,
      last_name: "",
      email: null,
      phone: null,
      billing_address_id: null,
      mailing_address_id: null,
      physical_address_id: null,
      notes: null,
      photo_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setCreatingPerson(newPerson)
    setEditingItems((prev) => new Set(prev).add(tempId))
    setExpandedItems((prev) => new Set(prev).add(tempId))
    setEditFormData((prev) => ({
      ...prev,
      [tempId]: {
        first_name: "",
        middle_name: "",
        last_name: "",
        email: "",
        phone: "",
        billing_address_id: null,
        mailing_address_id: null,
        physical_address_id: null,
        notes: "",
        photo_url: null,
        is_active: true,
      },
    }))
  }

  const cancelEditing = (id: string) => {
    setEditingItems((prev) => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
    setEditFormData((prev) => {
      const newData = { ...prev }
      delete newData[id]
      return newData
    })

    if (creatingPerson && creatingPerson.id === id) {
      setCreatingPerson(null)
      setExpandedItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const updateFormData = (id: string, field: keyof Person, value: string | boolean | null) => {
    setEditFormData((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }))
  }

  const saveChanges = async (id: string) => {
    const formData = editFormData[id]
    if (!formData) return

    setSavingItems((prev) => new Set(prev).add(id))

    try {
      const isNewPerson = creatingPerson && creatingPerson.id === id
      const url = isNewPerson ? "/api/people" : `/api/people/${id}`
      const method = isNewPerson ? "POST" : "PUT"

      const cleanedData = {
        first_name: formData.first_name || "",
        middle_name: formData.middle_name || null,
        last_name: formData.last_name || "",
        email: formData.email || null,
        phone: formData.phone || null,
        billing_address_id: formData.billing_address_id || null,
        mailing_address_id: formData.mailing_address_id || null,
        physical_address_id: formData.physical_address_id || null,
        notes: formData.notes || null,
        photo_url: formData.photo_url || null,
        is_active: formData.is_active ?? true, // Ensure is_active is always a boolean
      }

      const body = isNewPerson ? cleanedData : { id, ...cleanedData }

      console.log("[v0] Submitting person data:", body)

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("[v0] API Error Response:", errorData)
        throw new Error(`Failed to ${isNewPerson ? "create" : "update"} person: ${response.statusText}`)
      }

      const personApiResponse: PersonApiResponse = await response.json()
      const savedPerson = personApiResponse.data as Person

      if (isNewPerson) {
        setPeople((prev) => [savedPerson, ...prev])
        setCreatingPerson(null)
        setExpandedItems((prev) => {
          const newSet = new Set(prev)
          newSet.delete(id)
          newSet.add(savedPerson.id)
          return newSet
        })
      } else {
        setPeople((prev) => prev.map((p) => (p.id === id ? savedPerson : p)))
      }

      cancelEditing(id)
    } catch (err) {
      console.error(`[v0] Error ${creatingPerson && creatingPerson.id === id ? "creating" : "updating"} person:`, err)
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${creatingPerson && creatingPerson.id === id ? "create" : "update"} person`,
      )
    } finally {
      setSavingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const openPhotoUpload = (personId: string, cropMode = false) => {
    if (personId.startsWith("temp-")) {
      setError("Please save the person first before uploading a photo.")
      return
    }
    setPhotoUploadModal({ isOpen: true, personId, cropMode })
  }

  const closePhotoUpload = () => {
    setPhotoUploadModal({ isOpen: false, personId: null, cropMode: false })
  }

  const handlePhotoUpload = async (file: File, positioning: { x: number; y: number; zoom: number }) => {
    const personId = photoUploadModal.personId
    if (!personId) return

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("positioning", JSON.stringify(positioning))

      const response = await fetch(`/api/people/${personId}/photo`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Failed to upload photo: ${response.statusText}`)
      }

      const result = await response.json()

      // Update the person's photo_url in state
      setPeople((prev) => prev.map((p) => (p.id === personId ? { ...p, photo_url: result.url } : p)))

      // Update form data if person is being edited
      if (editingItems.has(personId)) {
        setEditFormData((prev) => ({
          ...prev,
          [personId]: {
            ...prev[personId],
            photo_url: result.url,
          },
        }))
      }

      console.log("[v0] Photo uploaded successfully:", result)
    } catch (error) {
      console.error("[v0] Error uploading photo:", error)
      throw error
    }
  }

  const handlePhotoDelete = async (personId: string) => {
    try {
      const response = await fetch(`/api/people/${personId}/photo`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error(`Failed to delete photo: ${response.statusText}`)
      }

      // Update the person's photo_url in state
      setPeople((prev) => prev.map((p) => (p.id === personId ? { ...p, photo_url: null } : p)))

      // Update form data if person is being edited
      if (editingItems.has(personId)) {
        setEditFormData((prev) => ({
          ...prev,
          [personId]: {
            ...prev[personId],
            photo_url: null,
          },
        }))
      }

      console.log("[v0] Photo deleted successfully")
    } catch (error) {
      console.error("[v0] Error deleting photo:", error)
      alert("Failed to delete photo. Please try again.")
    }
  }

  const handlePhotoCrop = async (personId: string, positioning: { x: number; y: number; zoom: number }) => {
    try {
      const person = people.find((p) => p.id === personId)
      if (!person?.photo_url) return

      const cleanUrl = getCleanPhotoUrl(person.photo_url)
      if (!cleanUrl) return

      // Create new URL with updated positioning parameters
      const url = new URL(cleanUrl)
      url.searchParams.set("x", positioning.x.toString())
      url.searchParams.set("y", positioning.y.toString())
      url.searchParams.set("zoom", positioning.zoom.toString())
      const newPhotoUrl = url.toString()

      // Update the person's photo_url in the database
      const response = await fetch(`/api/people/${personId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...person,
          photo_url: newPhotoUrl,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to update photo positioning: ${response.statusText}`)
      }

      // Update the person's photo_url in state
      setPeople((prev) => prev.map((p) => (p.id === personId ? { ...p, photo_url: newPhotoUrl } : p)))

      // Update form data if person is being edited
      if (editingItems.has(personId)) {
        setEditFormData((prev) => ({
          ...prev,
          [personId]: {
            ...prev[personId],
            photo_url: newPhotoUrl,
          },
        }))
      }

      console.log("[v0] Photo positioning updated successfully")
    } catch (error) {
      console.error("[v0] Error updating photo positioning:", error)
      throw error
    }
  }

  const openArchiveConfirmation = (person: Person) => {
    setArchiveConfirmation({ isOpen: true, person })
  }

  const closeArchiveConfirmation = () => {
    setArchiveConfirmation({ isOpen: false, person: null })
  }

  const archivePerson = async () => {
    const person = archiveConfirmation.person
    if (!person) return

    setArchivingItems((prev) => new Set(prev).add(person.id))

    try {
      const response = await fetch(`/api/people/${person.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...person,
          is_active: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to archive person: ${response.statusText}`)
      }

      const personApiResponse: PersonApiResponse = await response.json()
      setPeople((prev) => prev.map((p) => (p.id === person.id ? (personApiResponse.data as Person) : p)))

      closeArchiveConfirmation()
    } catch (err) {
      console.error("[v0] Error archiving person:", err)
      setError(err instanceof Error ? err.message : "Failed to archive person")
    } finally {
      setArchivingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(person.id)
        return newSet
      })
    }
  }

  const unarchivePerson = async (person: Person) => {
    setArchivingItems((prev) => new Set(prev).add(person.id))

    try {
      const response = await fetch(`/api/people/${person.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...person,
          is_active: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to unarchive person: ${response.statusText}`)
      }

      const personApiResponse: PersonApiResponse = await response.json()
      setPeople((prev) => prev.map((p) => (p.id === person.id ? (personApiResponse.data as Person) : p)))
    } catch (err) {
      console.error("[v0] Error unarchiving person:", err)
      setError(err instanceof Error ? err.message : "Failed to unarchive person")
    } finally {
      setArchivingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(person.id)
        return newSet
      })
    }
  }

  const getFullName = (person: Person) => {
    const parts = [person.first_name, person.middle_name, person.last_name].filter(Boolean)
    return parts.join(" ")
  }

  useEffect(() => {
    const fetchPeople = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/people")
        if (!response.ok) {
          throw new Error(`Failed to fetch people: ${response.statusText}`)
        }
        const personApiResponse: PersonApiResponse = await response.json()
        setPeople(personApiResponse.data as Person[])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch people")
        console.error("[v0] Error fetching people:", err)
      } finally {
        setLoading(false)
      }
    }

    if (isAuthenticated) {
      fetchPeople()
    }
  }, [isAuthenticated])

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

  const fetchAddress = async (addressId: string): Promise<Address | null> => {
    if (addressCache[addressId]) {
      return addressCache[addressId]
    }

    try {
      const response = await fetch(`/api/addresses/${addressId}`)
      if (!response.ok) {
        return null
      }
      const addressResponse = await response.json()
      const address = addressResponse.data as Address

      setAddressCache((prev) => ({ ...prev, [addressId]: address }))
      return address
    } catch (err) {
      console.error(`[v0] Error fetching address ${addressId}:`, err)
      return null
    }
  }

  const formatAddressCompact = (address: Address): string => {
    const parts = [address.address_1, address.city, address.state, address.postal_code, address.country].filter(Boolean)
    return parts.join(", ")
  }

  const AddressDisplay = ({ addressId, label }: { addressId: string | null; label: string }) => {
    const [address, setAddress] = useState<Address | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
      if (addressId && !addressCache[addressId]) {
        setLoading(true)
        fetchAddress(addressId).then((addr) => {
          setAddress(addr)
          setLoading(false)
        })
      } else if (addressId && addressCache[addressId]) {
        setAddress(addressCache[addressId])
      }
    }, [addressId])

    if (!addressId) {
      return <p className="text-sm text-gray-500">Not set</p>
    }

    if (loading) {
      return <p className="text-sm text-gray-500">Loading...</p>
    }

    if (!address) {
      return <p className="text-sm text-gray-500">Address not found</p>
    }

    return <p className="text-sm text-gray-900">{formatAddressCompact(address)}</p>
  }

  const getCityState = async (addressId: string | null): Promise<string> => {
    if (!addressId) return ""

    try {
      const address = await fetchAddress(addressId)
      if (address) {
        return `${address.city}, ${address.state}`
      }
    } catch (err) {
      console.error(`[v0] Error fetching city/state for address ${addressId}:`, err)
    }
    return ""
  }

  const CityStateDisplay = ({ addressId }: { addressId: string | null }) => {
    const [cityState, setCityState] = useState<string>("")
    const [loading, setLoading] = useState(false)

    useEffect(() => {
      if (addressId) {
        setLoading(true)
        getCityState(addressId).then((result) => {
          setCityState(result)
          setLoading(false)
        })
      }
    }, [addressId])

    if (!addressId || (!loading && !cityState)) return null

    if (loading) {
      return <span className="text-gray-500">Loading...</span>
    }

    return <span>{cityState}</span>
  }

  // Helper function to parse positioning parameters from photo URL
  const getPhotoPositioning = (photoUrl: string | null) => {
    if (!photoUrl) return { x: 50, y: 50, zoom: 100 }

    try {
      const url = new URL(photoUrl)
      const x = Number.parseFloat(url.searchParams.get("x") || "50")
      const y = Number.parseFloat(url.searchParams.get("y") || "50")
      const zoom = Number.parseFloat(url.searchParams.get("zoom") || "100")
      return { x, y, zoom }
    } catch {
      return { x: 50, y: 50, zoom: 100 }
    }
  }

  // Helper function to get clean photo URL without positioning parameters
  const getCleanPhotoUrl = (photoUrl: string | null) => {
    if (!photoUrl) return null

    try {
      const url = new URL(photoUrl)
      url.searchParams.delete("x")
      url.searchParams.delete("y")
      url.searchParams.delete("zoom")
      return url.toString()
    } catch {
      return photoUrl
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <EmmaTitleBar title="People Management" backLink={{ href: "/admin", label: "Back to Admin" }} />

      <div className="p-6 pt-20">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex justify-between items-center">
            <p className="text-gray-600">Manage contacts and user information</p>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={createNewPerson}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Person
            </Button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>People ({displayedPeople.length})</CardTitle>
                  <CardDescription>Manage contacts, users, and their information</CardDescription>
                </div>
                <Button variant="outline" onClick={() => setShowArchived(!showArchived)} className="ml-4">
                  {showArchived ? "Show Active" : "Show Archived"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Loading people...</p>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading People</h3>
                  <p className="text-red-600 mb-4">{error}</p>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    Try Again
                  </Button>
                </div>
              ) : displayedPeople.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {showArchived ? "No Archived People" : "No People Found"}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {showArchived
                      ? "No people have been archived yet."
                      : "Get started by adding your first person to the system."}
                  </p>
                  {!showArchived && (
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={createNewPerson}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Person
                    </Button>
                  )}
                </div>
              ) : (
                <TooltipProvider>
                  <div className="space-y-4">
                    {displayedPeople.map((person) => {
                      const isExpanded = expandedItems.has(person.id)
                      const isEditing = editingItems.has(person.id)
                      const isSaving = savingItems.has(person.id)
                      const isArchiving = archivingItems.has(person.id)
                      const formData = editFormData[person.id] || person

                      return (
                        <div key={person.id} className="border rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between p-4">
                            <div className="flex items-start space-x-4 flex-1">
                              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
                                {person.photo_url ? (
                                  <img
                                    src={getCleanPhotoUrl(person.photo_url) || "/placeholder.svg"}
                                    alt={getFullName(person)}
                                    className="w-full h-full object-cover"
                                    style={{
                                      objectPosition: `${getPhotoPositioning(person.photo_url).x}% ${getPhotoPositioning(person.photo_url).y}%`,
                                      transform: `scale(${getPhotoPositioning(person.photo_url).zoom / 100})`,
                                      transformOrigin: "center",
                                    }}
                                  />
                                ) : (
                                  <span className="text-blue-600 font-medium text-lg">
                                    {person.first_name?.[0]?.toUpperCase()}
                                    {person.last_name?.[0]?.toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div className="flex-1">
                                {isEditing ? (
                                  <div className="space-y-4">
                                    <div className="flex gap-2">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div>
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openPhotoUpload(person.id)}
                                                disabled={person.id.startsWith("temp-")}
                                                className={
                                                  person.id.startsWith("temp-") ? "opacity-50 cursor-not-allowed" : ""
                                                }
                                              >
                                                <svg
                                                  className="w-4 h-4"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  viewBox="0 0 24 24"
                                                >
                                                  <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12m0 0l4-4m-4 4l-4-4"
                                                  />
                                                </svg>
                                              </Button>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>
                                              {person.id.startsWith("temp-")
                                                ? "Save the person first to upload a photo"
                                                : "Upload a photo"}
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>

                                      {person.photo_url && (
                                        <>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <div>
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openPhotoUpload(person.id, true)}
                                                    disabled={person.id.startsWith("temp-")}
                                                    className={
                                                      person.id.startsWith("temp-")
                                                        ? "opacity-50 cursor-not-allowed"
                                                        : ""
                                                    }
                                                  >
                                                    <svg
                                                      className="w-4 h-4"
                                                      fill="none"
                                                      stroke="currentColor"
                                                      viewBox="0 0 24 24"
                                                    >
                                                      <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                                                      />
                                                    </svg>
                                                  </Button>
                                                </div>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>
                                                  {person.id.startsWith("temp-")
                                                    ? "Save the person first to crop photo"
                                                    : "Edit the photo"}
                                                </p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>

                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <div>
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handlePhotoDelete(person.id)}
                                                    disabled={person.id.startsWith("temp-")}
                                                    className={
                                                      person.id.startsWith("temp-")
                                                        ? "opacity-50 cursor-not-allowed text-red-600"
                                                        : "text-red-600"
                                                    }
                                                  >
                                                    <svg
                                                      className="w-4 h-4"
                                                      fill="none"
                                                      stroke="currentColor"
                                                      viewBox="0 0 24 24"
                                                    >
                                                      <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                      />
                                                    </svg>
                                                  </Button>
                                                </div>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>
                                                  {person.id.startsWith("temp-")
                                                    ? "Save the person first to remove photo"
                                                    : "Remove the photo"}
                                                </p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </>
                                      )}
                                    </div>

                                    <div className="flex-1 space-y-2">
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <Input
                                          value={formData.first_name || ""}
                                          onChange={(e) => updateFormData(person.id, "first_name", e.target.value)}
                                          placeholder="First name"
                                          className="text-sm"
                                        />
                                        <Input
                                          value={formData.middle_name || ""}
                                          onChange={(e) => updateFormData(person.id, "middle_name", e.target.value)}
                                          placeholder="Middle name (optional)"
                                          className="text-sm"
                                        />
                                        <Input
                                          value={formData.last_name || ""}
                                          onChange={(e) => updateFormData(person.id, "last_name", e.target.value)}
                                          placeholder="Last name"
                                          className="text-sm"
                                        />
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <Input
                                          type="email"
                                          value={formData.email || ""}
                                          onChange={(e) => updateFormData(person.id, "email", e.target.value)}
                                          placeholder="Email address"
                                          className="text-sm"
                                        />
                                        <Input
                                          type="tel"
                                          value={formData.phone || ""}
                                          onChange={(e) => updateFormData(person.id, "phone", e.target.value)}
                                          placeholder="Phone number"
                                          className="text-sm"
                                        />
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                        <EmmaAddress
                                          label="Billing Address"
                                          addressId={formData.billing_address_id}
                                          onAddressChange={(addressId) =>
                                            updateFormData(person.id, "billing_address_id", addressId)
                                          }
                                        />
                                        <EmmaAddress
                                          label="Mailing Address"
                                          addressId={formData.mailing_address_id}
                                          onAddressChange={(addressId) =>
                                            updateFormData(person.id, "mailing_address_id", addressId)
                                          }
                                        />
                                        <EmmaAddress
                                          label="Physical Address"
                                          addressId={formData.physical_address_id}
                                          onAddressChange={(addressId) =>
                                            updateFormData(person.id, "physical_address_id", addressId)
                                          }
                                        />
                                      </div>
                                      <Textarea
                                        value={formData.notes || ""}
                                        onChange={(e) => updateFormData(person.id, "notes", e.target.value)}
                                        placeholder="Notes (optional)"
                                        className="text-sm"
                                        rows={2}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <h4 className="font-semibold text-gray-900">{getFullName(person)}</h4>
                                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                                      {person.email && <span>{person.email}</span>}
                                      {person.phone && <span>{person.phone}</span>}
                                      <CityStateDisplay addressId={person.physical_address_id} />
                                    </div>
                                    <div className="flex items-center space-x-2 mt-1">
                                      <Badge variant={person.is_active ? "default" : "secondary"}>
                                        {person.is_active ? "Active" : "Inactive"}
                                      </Badge>
                                      <span className="text-xs text-gray-500">
                                        Updated {new Date(person.updated_at).toLocaleString()}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {isEditing ? (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => saveChanges(person.id)}
                                        disabled={isSaving}
                                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                      >
                                        {isSaving ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Save className="w-4 h-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Save changes</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => cancelEditing(person.id)}
                                        disabled={isSaving}
                                        className="text-gray-600 hover:text-gray-700"
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Cancel editing</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </>
                              ) : (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => toggleExpanded(person.id)}
                                        className="text-gray-600 hover:text-gray-700"
                                      >
                                        {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{isExpanded ? "Hide details" : "Show details"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => startEditing(person)}
                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Edit person</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  {person.is_active ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => openArchiveConfirmation(person)}
                                          disabled={isArchiving}
                                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 bg-transparent"
                                        >
                                          {isArchiving ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <Archive className="w-4 h-4" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Archive person</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => unarchivePerson(person)}
                                          disabled={isArchiving}
                                          className="text-green-600 hover:text-green-700 hover:bg-green-50 bg-transparent"
                                        >
                                          {isArchiving ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <Archive className="w-4 h-4" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Unarchive person</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {isExpanded && !isEditing && (
                            <div className="px-4 pb-4 border-t bg-gray-50/50">
                              <div className="pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">ID</label>
                                      <p className="text-sm text-gray-600 font-mono">{person.id}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Full Name</label>
                                      <p className="text-sm text-gray-900">{getFullName(person)}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Email</label>
                                      <p className="text-sm text-gray-900">{person.email || "Not provided"}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Phone</label>
                                      <p className="text-sm text-gray-900">{person.phone || "Not provided"}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Notes</label>
                                      <p className="text-sm text-gray-900">{person.notes || "No notes"}</p>
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Billing Address</label>
                                      <AddressDisplay addressId={person.billing_address_id} label="Billing" />
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Mailing Address</label>
                                      <AddressDisplay addressId={person.mailing_address_id} label="Mailing" />
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Physical Address</label>
                                      <AddressDisplay addressId={person.physical_address_id} label="Physical" />
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Last Updated</label>
                                      <p className="text-sm text-gray-900">
                                        {new Date(person.updated_at).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                </div>
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

      <Dialog open={archiveConfirmation.isOpen} onOpenChange={closeArchiveConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Person</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "
              {archiveConfirmation.person ? getFullName(archiveConfirmation.person) : ""}"? This will mark them as
              inactive but preserve all data. You can reactivate them later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeArchiveConfirmation}>
              Cancel
            </Button>
            <Button
              onClick={archivePerson}
              disabled={archivingItems.has(archiveConfirmation.person?.id || "")}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {archivingItems.has(archiveConfirmation.person?.id || "") ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Archiving...
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Upload Modal */}
      <EmmaPhotoUploadModal
        isOpen={photoUploadModal.isOpen}
        onClose={closePhotoUpload}
        onUpload={handlePhotoUpload}
        onCrop={handlePhotoCrop}
        personId={photoUploadModal.personId}
        cropMode={photoUploadModal.cropMode}
        existingPhotoUrl={
          photoUploadModal.personId ? people.find((p) => p.id === photoUploadModal.personId)?.photo_url : null
        }
      />
    </div>
  )
}
