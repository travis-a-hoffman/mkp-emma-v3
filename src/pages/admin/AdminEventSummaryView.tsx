"use client"

import { Banknote, Calendar, Edit, Eye, EyeOff, Mail, MapPin, Phone, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { EmmaAreaTag } from "@/src/components/emma/area-tag"
import { EmmaPersonDisplay } from "@/src/components/emma/person-display"
import { Button } from "@/components/ui/button"
import { EmmaEventPublishedTag } from "@/src/components/emma/event-published-tag"
import type { EventWithRelations } from "@/src/types/event"
import { formatCurrency, formatEventDateRange, formatVenueLocation } from "./AdminEventHelperMethods"
import type { Person } from "@/src/types/person"

interface AdminEventSummaryViewProps {
  event: EventWithRelations
  paymentStats: Record<string, any>
  toggleExpanded: (id: string) => null | string
  people: Person[]
  isExpanded: boolean
  startEditing: (event: EventWithRelations) => void
}

export default function AdminEventSummaryView({
  event,
  paymentStats,
  toggleExpanded,
  people,
  isExpanded,
  startEditing,
}: AdminEventSummaryViewProps) {
  return (
    <div className="flex items-start justify-between p-4">
      <div className="flex items-center space-x-4 flex-1">
        <div
          className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: event.event_type?.color ? `${event.event_type.color}20` : "#fed7aa", // orange-100 fallback
          }}
        >
          <Calendar
            className="w-6 h-6"
            style={{
              color: event.event_type?.color || "#ea580c", // orange-600 fallback
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-900 truncate">{event.name}</h3>
            {event.event_type && (
              <Badge
                variant="outline"
                className="text-xs"
                style={{
                  backgroundColor: event.event_type.color + "20",
                  borderColor: event.event_type.color,
                  color: event.event_type.color,
                }}
              >
                {event.event_type.code}
              </Badge>
            )}
            {event.area && <EmmaAreaTag area={event.area} />}
            <EmmaEventPublishedTag event={event} context="participants" />
            {!event.is_active && (
              <Badge variant="outline" className="text-xs bg-red-100 text-red-600 border-red-200">
                Archived
              </Badge>
            )}
          </div>
          <div className="text-sm text-gray-500 space-y-1">
            {event.venue && (
              <div className="flex items-center gap-2 flex-nowrap min-w-0 max-w-3xl overflow-hidden">
                <span className="font-medium flex-shrink-0">Where:</span>
                <div className="flex items-center gap-1 min-w-0 width">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{event.venue.name}</span>
                </div>
                {formatVenueLocation(event.venue) && (
                  <span className="text-gray-500 truncate min-w-0 flex-shrink">{formatVenueLocation(event.venue)}</span>
                )}
                {event.venue.phone && (
                  <div className="flex items-center gap-1 min-w-0 flex-shrink">
                    <Phone className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{event.venue.phone}</span>
                  </div>
                )}
                {event.venue.email && (
                  <div className="flex items-center gap-1 min-w-0 flex-shrink">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{event.venue.email}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="font-medium">When:</span>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatEventDateRange(event.participant_schedule)}</span>
              </div>
            </div>

            <div className="flex items-center gap-6 flex-nowrap min-w-0">
              {(event.participant_capacity > 0 || event.participant_cost > 0) && (
                <div className="flex items-center gap-3 text-sm text-gray-600 min-w-0">
                  <span className="font-medium text-gray-700">Participants:</span>
                  {event.participant_capacity > 0 && (
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>
                        {event.committed_participants.length}/{event.participant_capacity}
                      </span>
                    </div>
                  )}
                  {event.participant_cost > 0 && (
                    <div className="flex items-center gap-1">
                      <span>{formatCurrency(event.participant_cost)}</span>
                    </div>
                  )}
                </div>
              )}

              {(event.staff_capacity > 0 || event.staff_cost > 0) && (
                <div className="flex items-center gap-3 text-sm text-gray-600 min-w-0">
                  <span className="font-medium text-gray-700">Staff:</span>
                  {(event.staff_capacity > 0 || event.committed_staff.length > 0) && (
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>
                        {event.committed_staff.length}/{event.staff_capacity}
                      </span>
                    </div>
                  )}
                  {event.staff_cost > 0 && (
                    <div className="flex items-center gap-1">
                      <span>{formatCurrency(event.staff_cost)}</span>
                    </div>
                  )}
                </div>
              )}

              {(() => {
                const stats = paymentStats[event.id]
                if (stats) {
                  const { collectedPayments, totalExpectedPayments } = stats
                  if (collectedPayments > 0 || totalExpectedPayments > 0) {
                    return (
                      <div className="flex items-center gap-3 text-sm text-gray-600 min-w-0">
                        <span className="font-medium text-gray-700">Payments:</span>
                        <div className="flex items-center gap-1">
                          <Banknote className="w-3 h-3" />
                          <span className="text-sm text-muted-foreground">
                            {formatCurrency(collectedPayments)}/{formatCurrency(totalExpectedPayments)}
                          </span>
                        </div>
                      </div>
                    )
                  }
                }
                return null
              })()}
            </div>

            {event.primary_leader_id && (
              <div className="flex items-center gap-1">
                <span className="font-medium text-gray-700">Leader:</span>
                <EmmaPersonDisplay
                  personId={event.primary_leader_id}
                  showAvatar={true}
                  showContactInfo={true}
                  people={people}
                />
              </div>
            )}
            <div>Updated: {new Date(event.updated_at).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 ml-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleExpanded(event.id)}
          className="text-gray-500 hover:text-gray-700"
        >
          {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => startEditing(event)}
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        >
          <Edit className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
