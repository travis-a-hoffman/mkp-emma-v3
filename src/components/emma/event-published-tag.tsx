"use client"

import type { EventWithRelations } from "../../types/event"

interface EmmaEventPublishedTagProps {
  event: EventWithRelations
  context: "staff" | "participants"
  className?: string
}

type PublicationStatus = "Hidden" | "Preview" | "Open" | "Full" | "Closed"

function getPublicationStatus(
  event: EventWithRelations,
  context: "staff" | "participants",
  currentDate: Date,
): PublicationStatus {
  // If not published, always hidden
  if (!event.is_published) {
    return "Hidden"
  }

  // Get the appropriate published time range based on context
  const publishedTime = context === "staff" ? event.staff_published_time : event.participant_published_time

  // If no published time is set, treat as hidden
  if (!publishedTime) {
    return "Hidden"
  }

  const startDate = new Date(publishedTime.start)
  const endDate = new Date(publishedTime.end)

  // Before application start date
  if (currentDate < startDate) {
    return "Preview"
  }

  // After application end date
  if (currentDate > endDate) {
    return "Closed"
  }

  // Between start and end dates - check capacity
  const capacity = context === "staff" ? event.staff_capacity : event.participant_capacity
  const committed = context === "staff" ? event.committed_staff.length : event.committed_participants.length

  // If no capacity limit is set, always open
  if (capacity === 0) {
    return "Open"
  }

  // Check if there are still openings
  if (committed >= capacity) {
    return "Full"
  }

  return "Open"
}

function getStatusStyles(status: PublicationStatus): {
  backgroundColor: string
  textColor: string
  borderColor: string
} {
  switch (status) {
    case "Hidden":
      return {
        backgroundColor: "#f3f4f6", // gray-100
        textColor: "#6b7280", // gray-500
        borderColor: "#d1d5db", // gray-300
      }
    case "Preview":
      return {
        backgroundColor: "#fef3c7", // yellow-100
        textColor: "#d97706", // yellow-600
        borderColor: "#fbbf24", // yellow-400
      }
    case "Open":
      return {
        backgroundColor: "#dcfce7", // green-100
        textColor: "#16a34a", // green-600
        borderColor: "#4ade80", // green-400
      }
    case "Full":
      return {
        backgroundColor: "#fed7aa", // orange-100
        textColor: "#ea580c", // orange-600
        borderColor: "#fb923c", // orange-400
      }
    case "Closed":
      return {
        backgroundColor: "#fed7d7", // red-100
        textColor: "#dc2626", // red-600
        borderColor: "#f87171", // red-400
      }
    default:
      return {
        backgroundColor: "#f3f4f6",
        textColor: "#6b7280",
        borderColor: "#d1d5db",
      }
  }
}

export function EmmaEventPublishedTag({ event, context, className = "" }: EmmaEventPublishedTagProps) {
  const currentDate = new Date()
  const status = getPublicationStatus(event, context, currentDate)
  const styles = getStatusStyles(status)

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium border ${className}`}
      style={{
        backgroundColor: styles.backgroundColor,
        color: styles.textColor,
        borderColor: styles.borderColor,
      }}
    >
      {status}
    </span>
  )
}
