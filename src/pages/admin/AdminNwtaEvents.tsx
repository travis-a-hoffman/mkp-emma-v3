"use client"

import { useAuth0 } from "../../lib/auth0-provider"
import { Navigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Plus, Loader2, Calendar } from "lucide-react"
import { EmmaTitleBar } from "../../components/emma/titlebar"
import type { NwtaEventWithRelations } from "../../types/nwta-event"
import type { Area } from "../../types/area"
import type { Community } from "../../types/community"
import type { Person as PersonType } from "../../types/person"
import { useState, useEffect } from "react"
import type { Transaction } from "../../types/transaction"
import { EmmaPersonModal } from "../../components/emma/person-modal"
import { EmmaProspectModal } from "../../components/emma/prospect-modal"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import AdminNwtaEventSummaryView from "./AdminNwtaEventSummaryView"
import AdminNwtaEventEditView from "./AdminNwtaEventEditView"
import AdminNwtaEventDetailsView from "./AdminNwtaEventDetailsView"

interface EventType {
  id: string
  name: string
  code: string
  color: string
  is_active: boolean
}

interface Venue {
  id: string
  name: string
  phone?: string
  email?: string
  website?: string
  timezone?: string
  is_active: boolean
}

export default function AdminNwtaEvents() {
  const { isAuthenticated, isLoading } = useAuth0()
  const [events, setEvents] = useState<NwtaEventWithRelations[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [people, setPeople] = useState<PersonType[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set())
  const [editFormData, setEditFormData] = useState<Record<string, Partial<NwtaEventWithRelations>>>({})
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set())
  const [showArchived, setShowArchived] = useState(false)
  const [archivingItems, setArchivingItems] = useState<Set<string>>(new Set())
  const [archiveConfirmation, setArchiveConfirmation] = useState<{
    isOpen: boolean
    event: NwtaEventWithRelations | null
  }>({
    isOpen: false,
    event: null,
  })
  const [staffModalOpen, setStaffModalOpen] = useState(false)
  const [staffModalEventId, setStaffModalEventId] = useState<string | null>(null)
  const [prospectModalOpen, setProspectModalOpen] = useState(false)
  const [prospectModalEventId, setProspectModalEventId] = useState<string | null>(null)
  const [currentPersonForModal, setCurrentPersonForModal] = useState<PersonType | null>(null)
  const [primaryLeaderModalOpen, setPrimaryLeaderModalOpen] = useState(false)
  const [primaryLeaderModalEventId, setPrimaryLeaderModalEventId] = useState<string | null>(null)
  const [selectedTimelineEvents, setSelectedTimelineEvents] = useState<Record<string, number>>({})
  const [loadedTransactions, setLoadedTransactions] = useState<Set<string>>(new Set())
  const [paymentStats, setPaymentStats] = useState<Record<string, any>>({})

  const filteredEvents = events.filter((event) => (showArchived ? !event.is_active : event.is_active))
  const activeEventCount = events.filter((e) => e.is_active).length

  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [isAuthenticated, showArchived])

  const fetchData = async () => {
    try {
      setLoadingData(true)
      setError(null)

      // Fetch NWTA events
      const eventsResponse = await fetch(`/api/nwta-events?active=${!showArchived}`)
      if (!eventsResponse.ok) throw new Error(`Failed to fetch NWTA events: ${eventsResponse.statusText}`)
      const eventsResult = await eventsResponse.json()
      const eventsData = Array.isArray(eventsResult.data) ? eventsResult.data : [eventsResult.data]
      setEvents(eventsData)
      fetchAllPaymentStats(eventsData)

      // Fetch related data
      const [eventTypesRes, venuesRes, areasRes, communitiesRes, peopleRes] = await Promise.all([
        fetch("/api/event-types"),
        fetch("/api/venues"),
        fetch("/api/areas"),
        fetch("/api/communities"),
        fetch("/api/people"),
      ])

      if (eventTypesRes.ok) {
        const result = await eventTypesRes.json()
        setEventTypes(Array.isArray(result.data) ? result.data : [result.data])
      }
      if (venuesRes.ok) {
        const result = await venuesRes.json()
        setVenues(Array.isArray(result.data) ? result.data : [result.data])
      }
      if (areasRes.ok) {
        const result = await areasRes.json()
        setAreas(Array.isArray(result.data) ? result.data : [result.data])
      }
      if (communitiesRes.ok) {
        const result = await communitiesRes.json()
        setCommunities(Array.isArray(result.data) ? result.data : [result.data])
      }
      if (peopleRes.ok) {
        const result = await peopleRes.json()
        setPeople(Array.isArray(result.data) ? result.data : [result.data])
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to fetch data")
    } finally {
      setLoadingData(false)
    }
  }

  const fetchAllPaymentStats = async (eventsData: any[]) => {
    const statsPromises = eventsData
      .filter((event) => event.transaction_log_id && !paymentStats[event.id])
      .map(async (event) => {
        try {
          const response = await fetch(`/api/transactions/stats?log=${event.transaction_log_id}`)
          const result = await response.json()

          if (result.success && result.data.payments) {
            return { eventId: event.id, stats: result.data.payments }
          }
        } catch (error) {
          console.error(`Error fetching payment stats for event ${event.id}:`, error)
        }
        return null
      })

    const results = await Promise.all(statsPromises)
    const newStats = results.reduce(
      (acc, result) => {
        if (result) {
          acc[result.eventId] = result.stats
        }
        return acc
      },
      {} as Record<string, any>,
    )

    if (Object.keys(newStats).length > 0) {
      setPaymentStats((prev) => ({ ...prev, ...newStats }))
    }
  }

  const fetchTransactions = async (event: any) => {
    if (!event.transaction_log_id || loadedTransactions.has(event.id)) return

    console.log("[v0] Fetching transactions for event:", event.id, "log_id:", event.transaction_log_id)

    try {
      const response = await fetch(`/api/transactions?log=${event.transaction_log_id}`)
      const result = await response.json()

      console.log("[v0] Transaction API response:", result)

      if (result.success) {
        const typedTransactions = result.data as Transaction[]
        const sortedTransactions = typedTransactions.sort((a, b) => (a.ordering || 0) - (b.ordering || 0))

        console.log("[v0] Sorted transactions:", sortedTransactions)

        setEvents((prevEvents) =>
          prevEvents.map((e) => (e.id === event.id ? { ...e, transactions: sortedTransactions } : e)),
        )
        setLoadedTransactions((prev) => new Set([...prev, event.id]))

        console.log("[v0] Updated event with transactions for event:", event.id)
      } else {
        console.error("[v0] Transaction API returned error:", result.error)
      }
    } catch (error) {
      console.error("[v0] Error fetching transactions:", error)
    }
  }

  const toggleExpanded = (id: string) => {
    const newExpandedId = id === expandedItem ? null : id
    setExpandedItem(newExpandedId)

    // Fetch transactions when expanding an event
    if (newExpandedId) {
      const event = events.find((e) => e.id === newExpandedId)
      if (event) {
        console.log("[v0] Expanding event, fetching transactions:", event.id)
        fetchTransactions(event)
      }
    }

    return newExpandedId
  }

  const startEditing = (event: NwtaEventWithRelations) => {
    if (editingItems.size > 0 && !editingItems.has(event.id)) {
      return
    }

    setExpandedItem(event.id)
    setEditingItems((prev) => new Set(prev).add(event.id))
    setEditFormData((prev) => ({
      ...prev,
      [event.id]: { ...event },
    }))

    // Fetch transactions when starting to edit
    fetchTransactions(event)
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
    setExpandedItem(null)
  }

  const createNewEvent = () => {
    const tempId = `temp-${Date.now()}`
    const newEvent: NwtaEventWithRelations = {
      id: tempId,
      event_type_id: null,
      name: "",
      description: null,
      area_id: null,
      community_id: null,
      venue_id: null,
      staff_cost: 0,
      staff_capacity: 0,
      potential_staff: [],
      committed_staff: [],
      alternate_staff: [],
      participant_cost: 0,
      participant_capacity: 0,
      potential_participants: [],
      committed_participants: [],
      waitlist_participants: [],
      primary_leader_id: null,
      leaders: [],
      participant_schedule: [],
      staff_schedule: [],
      participant_published_time: null,
      staff_published_time: null,
      start_at: null,
      end_at: null,
      is_published: false,
      is_active: true,
      transaction_log_id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      transactions: [],
      // NWTA specific fields
      roles: [],
      rookies: [],
      elders: [],
      mos: [],
    }
    setEvents((prev) => [newEvent, ...prev])
    startEditing(newEvent)
  }

  const saveChanges = async (id: string) => {
    const formData = editFormData[id]
    if (!formData) return

    if (!formData.name?.trim()) {
      setError("Event name is required")
      return
    }

    try {
      setSavingItems((prev) => new Set(prev).add(id))
      setError(null)

      const isNewEvent = id.startsWith("temp-")
      const url = isNewEvent ? "/api/nwta-events" : `/api/nwta-events/${id}`
      const method = isNewEvent ? "POST" : "PUT"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${isNewEvent ? "create" : "update"} NWTA event`)
      }

      const updatedEvent = await response.json()
      setEvents((prev) => prev.map((event) => (event.id === id ? updatedEvent.data : event)))

      // TODO Schedule this to run asynchronously?
      if (updatedEvent.data.transaction_log_id) {
        try {
          const statsResponse = await fetch(`/api/transactions/stats?log=${updatedEvent.data.transaction_log_id}`)
          const statsResult = await statsResponse.json()

          if (statsResult.success && statsResult.data.payments) {
            setPaymentStats((prev) => ({
              ...prev,
              [updatedEvent.data.id]: statsResult.data.payments,
            }))
          }
        } catch (error) {
          console.error(`Error refreshing payment stats for event ${updatedEvent.data.id}:`, error)
        }
      }

      cancelEditing(id)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to save NWTA event")
    } finally {
      setSavingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const formatEventTimes = (participantSchedule: any[]) => {
    if (!participantSchedule || participantSchedule.length === 0) return "No times scheduled"
    return participantSchedule
      .map((time) => {
        const start = new Date(time.start).toLocaleString()
        const end = new Date(time.end).toLocaleString()
        return `${start} - ${end}`
      })
      .join(", ")
  }

  const getPersonName = (personId: string | null | undefined) => {
    if (!personId) return "Not assigned"
    const person = people.find((p) => p.id === personId)
    if (!person) return "Unknown person"
    return `${person.first_name} ${person.last_name}`
  }

  const getPersonById = (personId: string) => {
    return people.find((p) => p.id === personId)
  }

  const formatPersonName = (person: PersonType) => {
    return `${person.first_name} ${person.last_name}`
  }

  const addStaffToLeaders = (eventId: string, personId: string) => {
    const event = events.find((e) => e.id === eventId)
    if (!event) return

    // Don't add if person is already primary leader
    if (event.primary_leader_id === personId) return

    const updatedEvent = { ...event }
    if (!updatedEvent.leaders.includes(personId)) {
      updatedEvent.leaders = [...updatedEvent.leaders, personId]
    }

    // Update local state
    setEvents((prev) => prev.map((e) => (e.id === eventId ? updatedEvent : e)))

    setEditFormData((prev) => {
      if (prev[eventId]) {
        const currentFormData = prev[eventId]
        const currentLeaders = currentFormData.leaders || []

        return {
          ...prev,
          [eventId]: {
            ...currentFormData,
            leaders: currentLeaders.includes(personId) ? currentLeaders : [...currentLeaders, personId],
          },
        }
      }
      return prev
    })
  }

  const removeStaffMember = (
    eventId: string,
    personId: string,
    fromList: "potential_staff" | "committed_staff" | "alternate_staff",
  ) => {
    const event = events.find((e) => e.id === eventId)
    if (!event) return

    const updatedEvent = { ...event }
    updatedEvent[fromList] = updatedEvent[fromList].filter((id) => id !== personId)

    // Also remove from leaders list if they're being removed from committed staff
    if (fromList === "committed_staff" && updatedEvent.leaders.includes(personId)) {
      updatedEvent.leaders = updatedEvent.leaders.filter((id) => id !== personId)
    }

    // Update local state only - save will happen when user clicks Save button
    setEvents((prev) => prev.map((e) => (e.id === eventId ? updatedEvent : e)))

    setEditFormData((prev) => {
      if (prev[eventId]) {
        const currentFormData = prev[eventId]
        const currentFromList = currentFormData[fromList] || []
        const currentLeaders = currentFormData.leaders || []

        return {
          ...prev,
          [eventId]: {
            ...currentFormData,
            [fromList]: currentFromList.filter((id) => id !== personId),
            // Remove from leaders if removing from committed staff
            leaders: fromList === "committed_staff" ? currentLeaders.filter((id) => id !== personId) : currentLeaders,
          },
        }
      }
      return prev
    })
  }

  const moveStaffMember = (
    eventId: string,
    personId: string,
    fromList: "potential_staff" | "committed_staff" | "alternate_staff",
    toList: "potential_staff" | "committed_staff" | "alternate_staff",
  ) => {
    const event = events.find((e) => e.id === eventId)
    if (!event) return

    const updatedEvent = { ...event }
    updatedEvent[fromList] = updatedEvent[fromList].filter((id) => id !== personId)
    if (!updatedEvent[toList].includes(personId)) {
      updatedEvent[toList] = [...updatedEvent[toList], personId]
    }

    // Also remove from leaders list if they're being removed from committed staff
    if (fromList === "committed_staff" && updatedEvent.leaders.includes(personId)) {
      updatedEvent.leaders = updatedEvent.leaders.filter((id) => id !== personId)
    }

    // Update local state only - save will happen when user clicks Save button
    setEvents((prev) => prev.map((e) => (e.id === eventId ? updatedEvent : e)))

    setEditFormData((prev) => {
      if (prev[eventId]) {
        const currentFormData = prev[eventId]
        const currentFromList = currentFormData[fromList] || []
        const currentToList = currentFormData[toList] || []

        return {
          ...prev,
          [eventId]: {
            ...currentFormData,
            [fromList]: currentFromList.filter((id) => id !== personId),
            [toList]: currentToList.includes(personId) ? currentToList : [...currentToList, personId],
          },
        }
      }
      return prev
    })
  }

  const openStaffModal = (eventId: string) => {
    setStaffModalEventId(eventId)
    setStaffModalOpen(true)
  }

  const handleStaffPersonSelect = (person: PersonType | null) => {
    if (person && staffModalEventId) {
      const event = events.find((e) => e.id === staffModalEventId)
      if (event) {
        // Add to potential staff list by default
        const updatedPotentialStaff = [...event.potential_staff]
        if (!updatedPotentialStaff.includes(person.id)) {
          updatedPotentialStaff.push(person.id)

          // Update local state only - save will happen when user clicks Save button
          const updatedEvent = {
            ...event,
            potential_staff: updatedPotentialStaff,
          }
          setEvents((prev) => prev.map((e) => (e.id === staffModalEventId ? updatedEvent : e)))

          setEditFormData((prev) => {
            if (prev[staffModalEventId]) {
              return {
                ...prev,
                [staffModalEventId]: {
                  ...prev[staffModalEventId],
                  potential_staff: updatedPotentialStaff,
                },
              }
            }
            return prev
          })
        }
      }
    }
    setStaffModalOpen(false)
    setStaffModalEventId(null)
  }

  const moveRegistrantMember = (
    eventId: string,
    personId: string,
    fromList: "potential_participants" | "committed_participants" | "waitlist_participants",
    toList: "potential_participants" | "committed_participants" | "waitlist_participants",
  ) => {
    const event = events.find((e) => e.id === eventId)
    if (!event) return

    const updatedEvent = { ...event }
    updatedEvent[fromList] = updatedEvent[fromList].filter((id) => id !== personId)
    if (!updatedEvent[toList].includes(personId)) {
      updatedEvent[toList] = [...updatedEvent[toList], personId]
    }

    // Update local state only - save will happen when user clicks Save button
    setEvents((prev) => prev.map((e) => (e.id === eventId ? updatedEvent : e)))

    setEditFormData((prev) => {
      if (prev[eventId]) {
        const currentFormData = prev[eventId]
        const currentFromList = currentFormData[fromList] || []
        const currentToList = currentFormData[toList] || []

        return {
          ...prev,
          [eventId]: {
            ...currentFormData,
            [fromList]: currentFromList.filter((id) => id !== personId),
            [toList]: currentToList.includes(personId) ? currentToList : [...currentToList, personId],
          },
        }
      }
      return prev
    })
  }

  const openRegistrantModal = (eventId: string) => {
    //setRegistrantModalEventId(eventId)
    //setRegistrantModalOpen(true)
  }

  const handleProspectPersonSelect = (prospect: any | null) => {
    if (prospect && prospectModalEventId) {
      const event = events.find((e) => e.id === prospectModalEventId)
      if (event) {
        // Add to potential registrants list by default
        const updatedPotentialProspects = [...event.potential_participants]
        if (!updatedPotentialProspects.includes(prospect.id)) {
          updatedPotentialProspects.push(prospect.id)

          // Update local state only - save will happen when user clicks Save button
          const updatedEvent = {
            ...event,
            potential_participants: updatedPotentialProspects,
          }
          setEvents((prev) => prev.map((e) => (e.id === prospectModalEventId ? updatedEvent : e)))

          setEditFormData((prev) => {
            if (prev[prospectModalEventId]) {
              return {
                ...prev,
                [prospectModalEventId]: {
                  ...prev[prospectModalEventId],
                  potential_participants: updatedPotentialProspects,
                },
              }
            }
            return prev
          })
        }
      }
    }
    setProspectModalOpen(false)
    setProspectModalEventId(null)
  }

  const handleRegistrantPersonSelect = (registrant: any | null) => {
    if (registrant && prospectModalEventId) {
      const event = events.find((e) => e.id === prospectModalEventId)
      if (event) {
        // Add to potential registrants list by default
        const updatedCommittedRegistrants = [...event.committed_participants]
        if (!updatedCommittedRegistrants.includes(registrant.id)) {
          updatedCommittedRegistrants.push(registrant.id)

          // Update local state only - save will happen when user clicks Save button
          const updatedEvent = {
            ...event,
            committed_participants: updatedCommittedRegistrants,
          }
          setEvents((prev) => prev.map((e) => (e.id === prospectModalEventId ? updatedEvent : e)))

          setEditFormData((prev) => {
            if (prev[prospectModalEventId]) {
              return {
                ...prev,
                [prospectModalEventId]: {
                  ...prev[prospectModalEventId],
                  committed_participants: updatedCommittedRegistrants,
                },
              }
            }
            return prev
          })
        }
      }
    }
    //setRegistrantModalOpen(false)
    //setRegistrantModalEventId(null)
  }

  const handleOpenLeaderPersonModal = (eventId: string, currentPersonId?: string) => {
    const currentPerson = currentPersonId ? people.find((p) => p.id === currentPersonId) || null : null
    setCurrentPersonForModal(currentPerson)
    setPrimaryLeaderModalEventId(eventId)
    setPrimaryLeaderModalOpen(true)
  }

  const handleLeaderPersonSelect = (person: PersonType | null) => {
    if (primaryLeaderModalEventId) {
      // Update editFormData for immediate UI update
      setEditFormData((prev) => ({
        ...prev,
        [primaryLeaderModalEventId]: {
          ...prev[primaryLeaderModalEventId],
          primary_leader_id: person?.id || undefined,
        },
      }))

      // Update events state to keep data in sync
      setEvents((prev) =>
        prev.map((event) =>
          event.id === primaryLeaderModalEventId ? { ...event, primary_leader_id: person?.id || null } : event,
        ),
      )

      // Add new person to people array if it doesn't exist
      if (person && !people.find((p) => p.id === person.id)) {
        setPeople((prev) => [person, ...prev])
      }
    }
    setPrimaryLeaderModalOpen(false)
    setCurrentPersonForModal(null)
    setPrimaryLeaderModalEventId(null)
  }

  const openArchiveConfirmation = (event: NwtaEventWithRelations) => {
    setArchiveConfirmation({ isOpen: true, event })
  }

  const closeArchiveConfirmation = () => {
    setArchiveConfirmation({ isOpen: false, event: null })
  }

  const archiveEvent = async () => {
    const event = archiveConfirmation.event
    if (!event) return

    setArchivingItems((prev) => new Set(prev).add(event.id))

    try {
      const response = await fetch(`/api/nwta-events/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      })

      if (!response.ok) {
        throw new Error("Failed to archive NWTA event")
      }

      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, is_active: false } : e)))
      closeArchiveConfirmation()
    } catch (err) {
      console.error("Error archiving NWTA event:", err)
      setError(err instanceof Error ? err.message : "Failed to archive NWTA event")
    } finally {
      setArchivingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(event.id)
        return newSet
      })
    }
  }

  const handleTransactionCreate = async (
    ev: any,
    newTransaction: Omit<Transaction, "id" | "created_at" | "updated_at">,
  ) => {
    try {
      newTransaction.log_id = ev.transaction_log_id
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTransaction),
      })

      console.log("[v0] handleTransactionCreate() POST body: ", JSON.stringify(newTransaction))

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create transaction")
      }

      const createdTransaction = await response.json()

      // Update local state to include the new transaction
      setEvents((prev) =>
        prev.map((event) =>
          event.id === ev.id
            ? { ...event, transactions: [...(event.transactions || []), createdTransaction.data] }
            : event,
        ),
      )

      console.log("[v0] Transaction created successfully:", createdTransaction.data)
    } catch (error) {
      console.error("[v0] Error creating transaction:", error)
      setError(error instanceof Error ? error.message : "Failed to create transaction")
    }
  }

  const handleTransactionUpdate = async (eventId: string, updatedTransaction: Transaction) => {
    try {
      const response = await fetch(`/api/transactions/${updatedTransaction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTransaction),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update transaction")
      }

      const updated = await response.json()

      // Update local state
      setEvents((prev) =>
        prev.map((event) =>
          event.id === eventId
            ? {
                ...event,
                transactions: (event.transactions || []).map((t) =>
                  t.id === updatedTransaction.id ? updated.data : t,
                ),
              }
            : event,
        ),
      )

      console.log("[v0] Transaction updated successfully:", updated.data)
    } catch (error) {
      console.error("[v0] Error updating transaction:", error)
      setError(error instanceof Error ? error.message : "Failed to update transaction")
    }
  }

  const handleTransactionDelete = async (eventId: string, transactionId: string) => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete transaction")
      }

      // Update local state to remove the transaction
      setEvents((prev) =>
        prev.map((event) =>
          event.id === eventId
            ? {
                ...event,
                transactions: (event.transactions || []).filter((t) => t.id !== transactionId),
              }
            : event,
        ),
      )

      console.log("[v0] Transaction deleted successfully:", transactionId)
    } catch (error) {
      console.error("[v0] Error deleting transaction:", error)
      setError(error instanceof Error ? error.message : "Failed to delete transaction")
    }
  }

  const removeRegistrantMember = (
    eventId: string,
    personId: string,
    fromList: "potential_participants" | "committed_participants" | "waitlist_participants",
  ) => {
    const event = events.find((e) => e.id === eventId)
    if (!event) return

    const updatedEvent = { ...event }
    updatedEvent[fromList] = updatedEvent[fromList].filter((id) => id !== personId)

    // Update local state only - save will happen when user clicks Save button
    setEvents((prev) => prev.map((e) => (e.id === eventId ? updatedEvent : e)))

    setEditFormData((prev) => {
      if (prev[eventId]) {
        const currentFormData = prev[eventId]
        const currentFromList = currentFormData[fromList] || []

        return {
          ...prev,
          [eventId]: {
            ...currentFormData,
            [fromList]: currentFromList.filter((id) => id !== personId),
          },
        }
      }
      return prev
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <EmmaTitleBar title="NWTA Events Management" backLink={{ href: "/admin", label: "Back to Admin" }} />
        <div className="p-6 pt-20">
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

  if (loadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <EmmaTitleBar title="NWTA Events Management" backLink={{ href: "/admin", label: "Back to Admin" }} />
        <div className="p-6 pt-20">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mr-2" />
              <span className="text-lg">Loading NWTA events details...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <EmmaTitleBar title="NWTA Events Management" backLink={{ href: "/admin", label: "Back to Admin" }} />

      <div className="p-6 pt-20">
        <div className="min-w-4xl max-w-6xl mx-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
              <Button variant="outline" size="sm" className="mt-2 bg-transparent" onClick={() => setError(null)}>
                Dismiss
              </Button>
            </div>
          )}

          <div className="mb-8 flex justify-between items-center">
            <p className="text-gray-600">Manage NWTA events, scheduling, and participant registration</p>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-400" />
                  NWTA Events ({activeEventCount})
                </CardTitle>
                <CardDescription>Manage NWTA events and their comprehensive details</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
                  <label htmlFor="show-archived" className="flex items-center gap-2 text-sm text-gray-600">
                    Show Archived
                  </label>
                </div>
                {!showArchived && (
                  <Button onClick={createNewEvent} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4" />
                    Add NWTA Event
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredEvents.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {showArchived ? "No archived NWTA events found" : "No active NWTA events found"}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {showArchived ? "No archived NWTA events found." : "Get started by creating your first NWTA event."}
                  </p>
                  {!showArchived && (
                    <div className="flex justify-center">
                      <Button onClick={createNewEvent} className="mt-4">
                        <Plus className="w-4 h-4 mr-2" />
                        Create First NWTA Event
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredEvents.map((event) => {
                    const isExpanded = expandedItem === event.id
                    const isEditing = editingItems.has(event.id)
                    const isSaving = savingItems.has(event.id)
                    const isArchiving = archivingItems.has(event.id)
                    const formData = editFormData[event.id] || event

                    return (
                      <Card key={event.id} className={!event.is_active ? "opacity-60" : ""}>
                        <div id={`event-${event.id}`}>
                          <CardContent className="p-0 min-w-3xl">
                            <AdminNwtaEventSummaryView
                              event={event}
                              paymentStats={paymentStats}
                              toggleExpanded={toggleExpanded}
                              people={people}
                              isExpanded={isExpanded}
                              startEditing={startEditing}
                            />

                            {isExpanded && (
                              <div className="border-t bg-card p-4">
                                {isEditing ? (
                                  <AdminNwtaEventEditView
                                    event={event}
                                    isSaving={isSaving}
                                    isArchiving={isArchiving}
                                    saveChanges={saveChanges}
                                    cancelEditing={cancelEditing}
                                    openArchiveConfirmation={openArchiveConfirmation}
                                    openStaffModal={openStaffModal}
                                    handleOpenLeaderPersonModal={handleOpenLeaderPersonModal}
                                    moveStaffMember={moveStaffMember}
                                    formData={formData}
                                    setEditFormData={setEditFormData}
                                    openParticipantModal={openRegistrantModal}
                                    removeStaffMember={removeStaffMember}
                                    eventTypes={eventTypes}
                                    areas={areas}
                                    communities={communities}
                                    venues={venues}
                                    people={people}
                                  />
                                ) : (
                                  <AdminNwtaEventDetailsView event={event} people={people} />
                                )}
                              </div>
                            )}
                          </CardContent>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <EmmaPersonModal
        isOpen={staffModalOpen}
        onClose={() => setStaffModalOpen(false)}
        onPersonSelect={handleStaffPersonSelect}
        title="Add Staff Member"
      />

      <EmmaProspectModal
        isOpen={prospectModalOpen}
        onClose={() => setProspectModalOpen(false)}
        onProspectSelect={handleProspectPersonSelect}
        title="Add Prospect"
      />

      <EmmaPersonModal
        isOpen={primaryLeaderModalOpen}
        onClose={() => setPrimaryLeaderModalOpen(false)}
        onPersonSelect={handleLeaderPersonSelect}
        title="Select Primary Leader"
        currentPerson={currentPersonForModal}
      />

      <Dialog open={archiveConfirmation.isOpen} onOpenChange={closeArchiveConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive NWTA Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "{archiveConfirmation.event?.name}"? This will hide it from the active
              NWTA events list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeArchiveConfirmation}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={archiveEvent}>
              Archive Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
