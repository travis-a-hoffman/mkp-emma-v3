import type { EventTime, EventWithRelations } from "../../types/event"

export const formatVenueLocation = (venue?: EventWithRelations["venue"]) => {
  if (!venue?.physical_address) return ""
  return `${venue.physical_address.city}, ${venue.physical_address.state}`
}

export const formatEventDateRange = (participantSchedule?: EventTime[]) => {
  if (!participantSchedule || participantSchedule.length === 0) return "Not scheduled"

  const sortedTimes = [...participantSchedule].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  const startDate = new Date(sortedTimes[0].start).toLocaleDateString()
  const endDate = new Date(sortedTimes[sortedTimes.length - 1].end).toLocaleDateString()

  return startDate === endDate ? startDate : `${startDate} through ${endDate}`
}

export const formatCurrency = (cents: number) => {
  return `$${(cents / 100).toFixed(2)}`
}

export const formatEventTimes = (participantSchedule: EventTime[]) => {
  if (!participantSchedule || participantSchedule.length === 0) return "No times scheduled"
  return participantSchedule
    .map((time) => {
      const start = new Date(time.start).toLocaleString()
      const end = new Date(time.end).toLocaleString()
      return `${start} - ${end}`
    })
    .join(", ")
}
