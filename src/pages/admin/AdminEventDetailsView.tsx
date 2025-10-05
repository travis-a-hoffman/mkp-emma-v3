import { EmmaPersonDisplay } from "@/src/components/emma/person-display"
import { formatCurrency } from "@/src/pages/admin/AdminEventHelperMethods"
import { EmmaTransactionTable } from "@/src/components/emma/transaction-table"
import { EmmaCalendar } from "@/src/components/emma/calendar"
import { EmmaTimeline } from "@/src/components/emma/timeline"
import { Badge } from "@/components/ui/badge"
import type { EventWithRelations } from "@/src/types/event"
import type { Person } from "@/src/types/person"

interface AdminEventDetailsViewProps {
  event: EventWithRelations
  people: Person[]
}

export default function AdminEventDetailsView({ event, people }: AdminEventDetailsViewProps) {
  const getPersonById = (personId: string) => {
    return people.find((p) => p.id === personId)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Event Details</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Name:</span> {event.name}
              </div>
              {event.description && (
                <div>
                  <span className="font-medium">Description:</span> {event.description}
                </div>
              )}
              {event.event_type && (
                <div>
                  <span className="font-medium">Type:</span> {event.event_type.name} ({event.event_type.code})
                </div>
              )}
              {event.area && (
                <div>
                  <span className="font-medium">Area:</span> {event.area.name}
                </div>
              )}
              {event.community && (
                <div>
                  <span className="font-medium">Community:</span> {event.community.name}
                </div>
              )}
              {event.venue && (
                <div>
                  <span className="font-medium">Venue:</span> {event.venue.name}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Leadership</h4>
            <div className="space-y-2 text-sm">
              {event.primary_leader_id ? (
                <div>
                  <span className="font-medium">Primary Leader:</span>
                  <div className="mt-1">
                    <EmmaPersonDisplay
                      personId={event.primary_leader_id}
                      people={people}
                      showAvatar={true}
                      showContactInfo={true}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">No primary leader assigned</div>
              )}

              {event.leaders && event.leaders.length > 0 && (
                <div>
                  <span className="font-medium">Co-Leaders:</span>
                  <div className="mt-1 space-y-1">
                    {event.leaders.map((leaderId) => (
                      <EmmaPersonDisplay
                        key={leaderId}
                        personId={leaderId}
                        people={people}
                        showAvatar={true}
                        showContactInfo={true}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-lg font-medium text-gray-900">Publication Schedule</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h5 className="font-medium text-gray-700">Staff Open Application Dates</h5>
            <div className="bg-blue-50 rounded-lg p-4">
              {event.staff_published_time ? (
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Start:</span>{" "}
                    <span className="text-gray-900">
                      {new Date(event.staff_published_time.start).toLocaleString([], {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: event.venue?.timezone || "America/Chicago",
                      })}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">End:</span>{" "}
                    <span className="text-gray-900">
                      {new Date(event.staff_published_time.end).toLocaleString([], {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: event.venue?.timezone || "America/Chicago",
                      })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Staff publication date range not set</div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="font-medium text-gray-700">Participant Open Application Dates</h5>
            <div className="bg-green-50 rounded-lg p-4">
              {event.participant_published_time ? (
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Start:</span>{" "}
                    <span className="text-gray-900">
                      {new Date(event.participant_published_time.start).toLocaleString([], {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: event.venue?.timezone || "America/Chicago",
                      })}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">End:</span>{" "}
                    <span className="text-gray-900">
                      {new Date(event.participant_published_time.end).toLocaleString([], {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: event.venue?.timezone || "America/Chicago",
                      })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Participant publication date range not set</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-lg font-medium text-gray-900">Staff Details</h4>
        <div className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Staff Cost</label>
                    <div className="text-sm text-gray-900">{formatCurrency(event.staff_cost)}</div>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Staff Capacity</label>
                    <div className="text-sm text-gray-900">
                      {event.committed_staff.length}
                      {event.staff_capacity > 0 && <span className="text-gray-500"> / {event.staff_capacity}</span>}
                      {event.potential_staff.length > 0 && (
                        <span className="text-gray-500"> ({event.potential_staff.length} potential)</span>
                      )}
                      {event.alternate_staff.length > 0 && (
                        <span className="text-gray-500"> ({event.alternate_staff.length} alternates)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-gray-700">Primary Leader</h5>
                </div>
                {(() => {
                  const primary = getPersonById(event.primary_leader_id || "")
                  return !primary ? (
                    <div className="text-sm text-gray-500 text-center py-4">No primary leader selected</div>
                  ) : (
                    <div className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                      <div className="flex items-center gap-2">
                        <EmmaPersonDisplay person={primary} size="w-6 h-6" showAvatar={true} />
                      </div>
                    </div>
                  )
                })()}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-gray-700">Co-Leaders</h5>
                  <Badge variant="outline" className="text-xs">
                    {event.leaders.length}
                  </Badge>
                </div>
                <div className="space-y-2 min-h-[100px] bg-gray-50 rounded-lg p-3">
                  {event.leaders.length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-4">No event co-leaders chosen</div>
                  ) : (
                    event.leaders.map((personId) => {
                      const person = getPersonById(personId)
                      if (!person) return null
                      return (
                        <div
                          key={personId}
                          className="flex items-center justify-between bg-white rounded p-2 shadow-sm"
                        >
                          <div className="flex items-center gap-2">
                            <EmmaPersonDisplay person={person} size="w-6 h-6" showAvatar={true} />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h5 className="font-medium text-gray-700">Potential Staff</h5>
              <div className="space-y-2 min-h-[100px] bg-gray-50 rounded-lg p-3">
                {!event.potential_staff || event.potential_staff.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4">No potential staff</div>
                ) : (
                  event.potential_staff.map((personId) => {
                    const person = getPersonById(personId)
                    if (!person) return null
                    return (
                      <div key={personId} className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                        <div className="flex items-center gap-2">
                          <EmmaPersonDisplay person={person} size="w-6 h-6" showAvatar={true} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="font-medium text-gray-700">Committed Staff</h5>
              <div className="space-y-2 min-h-[100px] bg-green-50 rounded-lg p-3">
                {!event.committed_staff || event.committed_staff.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4">No committed staff</div>
                ) : (
                  event.committed_staff.map((personId) => {
                    const person = getPersonById(personId)
                    if (!person) return null
                    return (
                      <div key={personId} className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                        <div className="flex items-center gap-2">
                          <EmmaPersonDisplay person={person} size="w-6 h-6" showAvatar={true} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="font-medium text-gray-700">Alternate Staff</h5>
              <div className="space-y-2 min-h-[100px] bg-yellow-50 rounded-lg p-3">
                {!event.alternate_staff || event.alternate_staff.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4">No alternate staff</div>
                ) : (
                  event.alternate_staff.map((personId) => {
                    const person = getPersonById(personId)
                    if (!person) return null
                    return (
                      <div key={personId} className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                        <div className="flex items-center gap-2">
                          <EmmaPersonDisplay person={person} size="w-6 h-6" showAvatar={true} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-lg font-medium text-gray-900">Participant Details</h4>
        <div className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Participant Cost</label>
                    <div className="text-sm text-gray-900">{formatCurrency(event.participant_cost)}</div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Participant Capacity</label>
                    <div className="text-sm text-gray-900">
                      {event.committed_participants.length} / {event.participant_capacity}
                      {event.potential_participants.length > 0 && (
                        <span className="text-gray-500"> ({event.potential_participants.length} pending)</span>
                      )}
                      {event.waitlist_participants.length > 0 && (
                        <span className="text-gray-500"> ({event.waitlist_participants.length} waitlisted)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h5 className="font-medium text-gray-700">Potential Participants</h5>
              <div className="space-y-2 min-h-[100px] bg-gray-50 rounded-lg p-3">
                {event.potential_participants.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4">No potential participants</div>
                ) : (
                  event.potential_participants.map((personId) => {
                    const person = getPersonById(personId)
                    if (!person) return null
                    return (
                      <div key={personId} className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                        <div className="flex items-center gap-2">
                          <EmmaPersonDisplay person={person} size="w-6 h-6" showAvatar={true} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="font-medium text-gray-700">Committed Participants</h5>
              <div className="space-y-2 min-h-[100px] bg-green-50 rounded-lg p-3">
                {event.committed_participants.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4">No committed participants</div>
                ) : (
                  event.committed_participants.map((personId) => {
                    const person = getPersonById(personId)
                    if (!person) return null
                    return (
                      <div key={personId} className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                        <div className="flex items-center gap-2">
                          <EmmaPersonDisplay person={person} size="w-6 h-6" showAvatar={true} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="font-medium text-gray-700">Waitlist Participants</h5>
              <div className="space-y-2 min-h-[100px] bg-orange-50 rounded-lg p-3">
                {event.waitlist_participants.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4">No waitlist participants</div>
                ) : (
                  event.waitlist_participants.map((personId) => {
                    const person = getPersonById(personId)
                    if (!person) return null
                    return (
                      <div key={personId} className="flex items-center justify-between bg-white rounded p-2 shadow-sm">
                        <div className="flex items-center gap-2">
                          <EmmaPersonDisplay person={person} size="w-6 h-6" showAvatar={true} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {event.participant_schedule && event.participant_schedule.length > 0 && (
        <div>
          <h4 className="text-lg font-medium text-gray-900">Schedule Details</h4>
          <div className="space-y-4">
            <div>
              <label className="block font-medium text-gray-700 mb-2">Scheduled Times</label>
              <EmmaCalendar
                eventLists={[
                  {
                    name: event.name,
                    color: event.event_type?.color || "#ea580c",
                    times: event.participant_schedule,
                  },
                ]}
                readOnly={true}
                showEventLegend={false}
                timezone={event.venue?.timezone || "America/Chicago"}
                initialDate={
                  event.participant_schedule.length > 0 ? new Date(event.participant_schedule[0].start) : undefined
                }
              />
            </div>

            <div>
              <label className="block font-medium text-gray-700 mb-2">Timeline View</label>
              <EmmaTimeline
                events={event.participant_schedule.map((time, index) => ({
                  date: new Date(time.start).toISOString().split("T")[0],
                  label: `Session ${index + 1}`,
                  description: `${new Date(time.start).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: event.venue?.timezone || "America/Chicago",
                  })} - ${new Date(time.end).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: event.venue?.timezone || "America/Chicago",
                  })}`,
                }))}
                selectedIndex={0}
                onEventSelect={() => {}} // Read-only, no selection handling needed
                getLabel={(event) => event.label || ""}
                getDescription={(event) => event.description || ""}
                indexClick={false} // Disable clicking in read-only mode
                styles={{
                  background: event.event_type?.color || "#ea580c",
                  foreground: "#ffffff",
                  outline: "#e5e7eb",
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h4 className="text-lg font-medium text-gray-900">Event Transactions</h4>
        <EmmaTransactionTable transactions={event.transactions || []} readOnly={true} showActions={false} />
      </div>
    </div>
  )
}
