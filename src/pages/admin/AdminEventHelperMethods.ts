import type { EventTime, EventWithRelations } from "@/src/types/event"

export const formatCurrency = (cents: number) => {
  return `$${(cents / 100).toFixed(2)}`
}

export const formatEventTimes = (participant_schedule: EventTime[]) => {
  if (!participant_schedule || participant_schedule.length === 0) return "No times scheduled"
  return participant_schedule
    .map((time) => {
      const start = new Date(time.start).toLocaleString()
      const end = new Date(time.end).toLocaleString()
      return `${start} - ${end}`
    })
    .join(", ")
}

export const formatVenueLocation = (venue?: EventWithRelations["venue"]) => {
  if (!venue?.physical_address) return ""
  return `${venue.physical_address.city}, ${venue.physical_address.state}`
}

export const formatEventDateRange = (participant_schedule?: EventTime[]) => {
  if (!participant_schedule || participant_schedule.length === 0) return "Not scheduled"

  const sortedTimes = [...participant_schedule].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  )
  const startDate = new Date(sortedTimes[0].start).toLocaleDateString()
  const endDate = new Date(sortedTimes[sortedTimes.length - 1].end).toLocaleDateString()

  return startDate === endDate ? startDate : `${startDate} through ${endDate}`
}

export const calculateEventStartEnd = (participant_schedule: EventTime[]) => {
  if (!participant_schedule || participant_schedule.length === 0) {
    return { start: null, end: null }
  }

  const starts = participant_schedule.map((p) => new Date(p.start).getTime())
  const ends = participant_schedule.map((p) => new Date(p.end).getTime())

  return {
    start: new Date(Math.min(...starts)).toISOString(),
    end: new Date(Math.max(...ends)).toISOString(),
  }
}

export const syncEventBasicFields = (eventData: any, participant_schedule: EventTime[]) => {
  const { start, end } = calculateEventStartEnd(participant_schedule)
  return {
    ...eventData,
    start: start || eventData.start_at || null,
    end: end || eventData.end_at || null,
    participant_schedule,
  }
}

export const validateScheduleSync = (
  start_at: string | null,
  end_at: string | null,
  participant_schedule: EventTime[],
) => {
  if (!participant_schedule || participant_schedule.length === 0) {
    return { isValid: true, message: "" }
  }

  const calculatedSync = calculateEventStartEnd(participant_schedule)
  if (!calculatedSync.start || !calculatedSync.end) {
    return { isValid: false, message: "Unable to calculate schedule bounds" }
  }

  if (!start_at || !end_at) {
    return {
      isValid: false,
      message: "Event start_at/end_at times are null but participant schedule exists",
    }
  }

  const eventStart = new Date(start_at).getTime()
  const eventEnd = new Date(end_at).getTime()
  const scheduleStart = new Date(calculatedSync.start).getTime()
  const scheduleEnd = new Date(calculatedSync.end).getTime()

  if (eventStart !== scheduleStart || eventEnd !== scheduleEnd) {
    return {
      isValid: false,
      message: "Event start_at/end_at times don't match participant schedule bounds",
    }
  }

  return { isValid: true, message: "" }
}

export const formatEventStartEnd = (start_at: string | null, end_at: string | null, timezone?: string) => {
  if (!start_at || !end_at) return "Times not set"

  const startDate = new Date(start_at)
  const endDate = new Date(end_at)

  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }

  const startFormatted = startDate.toLocaleDateString([], formatOptions)
  const endFormatted = endDate.toLocaleDateString([], formatOptions)

  // If same day, show date once
  const startDateOnly = startDate.toLocaleDateString([], { timeZone: timezone })
  const endDateOnly = endDate.toLocaleDateString([], { timeZone: timezone })

  if (startDateOnly === endDateOnly) {
    const timeOptions: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    }
    const startTime = startDate.toLocaleTimeString([], timeOptions)
    const endTime = endDate.toLocaleTimeString([], timeOptions)
    return `${startDateOnly} from ${startTime} to ${endTime}`
  }

  return `${startFormatted} to ${endFormatted}`
}

export const hasValidEventTimes = (start_at: string | null, end_at: string | null): boolean => {
  return !!(start_at && end_at)
}
