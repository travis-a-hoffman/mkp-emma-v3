"use client"

import { useState, useCallback, useMemo } from "react"
import { ChevronLeft, ChevronRight, X, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export interface EventTime {
  start: string
  end: string
}

export interface EventList {
  name: string
  color: string
  times: EventTime[]
  description?: string
  showTooltip?: boolean
  readOnly?: boolean
}

interface EmmaCalendarProps {
  eventLists: EventList[]
  readOnly?: boolean
  onTimesChange?: (eventListIndex: number, newTimes: EventTime[]) => void
  initialDate?: Date
  showEventLegend?: boolean
  timezone?: string
}

// Helper function to calculate text color based on background luminance
const getContrastColor = (hexColor: string): string => {
  const r = Number.parseInt(hexColor.slice(1, 3), 16)
  const g = Number.parseInt(hexColor.slice(3, 5), 16)
  const b = Number.parseInt(hexColor.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#000000" : "#ffffff"
}

const formatTime = (dateString: string, timezone?: string): string => {
  const date = new Date(dateString)
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  })
}

const formatDateForDisplay = (dateString: string, timezone?: string): string => {
  const date = new Date(dateString + "T00:00:00")
  return date.toLocaleDateString([], { timeZone: timezone })
}

// Helper function to create timezone-aware date
const createTimezoneAwareDate = (dateString: string, timeString: string, timezone?: string): Date => {
  if (timezone) {
    // Create date in the specified timezone
    const [year, month, day] = dateString.split("-").map(Number)
    const [hour, minute] = timeString.split(":").map(Number)

    // Create a date string in ISO format with timezone offset
    const tempDate = new Date()
    tempDate.setFullYear(year, month - 1, day)
    tempDate.setHours(hour, minute, 0, 0)

    // Get timezone offset for the specified timezone
    const formatter = new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      timeZoneName: "longOffset",
    })

    // This is a simplified approach - for production, consider using a library like date-fns-tz
    return tempDate
  } else {
    // Fallback to local timezone
    const date = new Date(dateString)
    const [hour, minute] = timeString.split(":").map(Number)
    date.setHours(hour, minute, 0, 0)
    return date
  }
}

// Helper function to check if two dates are the same day
const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

const isDateInRange = (date: Date, startDate: Date | null, endDate: Date | null): boolean => {
  if (!startDate || !endDate) return false
  const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const normalizedStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const normalizedEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
  return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd
}

// Helper function to format date without timezone conversion
const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const getTimezoneDisplayName = (timezone: string): string => {
  const timezoneMap: Record<string, string> = {
    "America/New_York": "Eastern (ET)",
    "America/Chicago": "Central (CT)",
    "America/Denver": "Mountain (MT)",
    "America/Los_Angeles": "Pacific (PT)",
    "America/Phoenix": "Mountain (MST)",
    "America/Anchorage": "Alaska (AKT)",
    "Pacific/Honolulu": "Hawaii (HST)",
    "America/Puerto_Rico": "Atlantic (AST)",
    "America/Detroit": "Eastern (ET)",
    "America/Indianapolis": "Eastern (ET)",
    "America/Louisville": "Eastern (ET)",
    "America/Menominee": "Central (CT)",
    "America/North_Dakota/Center": "Central (CT)",
    "America/North_Dakota/New_Salem": "Central (CT)",
    "America/Boise": "Mountain (MT)",
    "America/Juneau": "Alaska (AKT)",
    "America/Metlakatla": "Alaska (AKT)",
    "America/Nome": "Alaska (AKT)",
    "America/Sitka": "Alaska (AKT)",
    "America/Yakutat": "Alaska (AKT)",
  }

  return timezoneMap[timezone] || timezone
}

export function EmmaCalendar({
  eventLists,
  readOnly = false,
  onTimesChange,
  initialDate,
  showEventLegend = true,
  timezone = "America/New_York", // Default timezone with configurable support
}: EmmaCalendarProps) {
  const [currentDate, setCurrentDate] = useState(initialDate || new Date())
  const [dragStart, setDragStart] = useState<Date | null>(null)
  const [dragEnd, setDragEnd] = useState<Date | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showTimeForm, setShowTimeForm] = useState(false)
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("17:00")
  const [firstDate, setFirstDate] = useState("")
  const [lastDate, setLastDate] = useState("")
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null)
  const [editingListIndex, setEditingListIndex] = useState<number | null>(null)

  // Calculate calendar grid
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const days = []
    const current = new Date(startDate)

    for (let i = 0; i < 42; i++) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    return days
  }, [currentDate])

  const getEventsForDate = useCallback(
    (date: Date) => {
      const events: Array<{ event: EventTime; listIndex: number; list: EventList }> = []

      eventLists.forEach((list, listIndex) => {
        list.times.forEach((time) => {
          if (!time.start || !time.end) return

          // Convert UTC times to timezone-aware dates for comparison
          const startDate = new Date(time.start)
          const endDate = new Date(time.end)

          if (isSameDay(date, startDate) || isSameDay(date, endDate) || (date >= startDate && date <= endDate)) {
            events.push({ event: time, listIndex, list })
          }
        })
      })

      return events
    },
    [eventLists],
  )

  // Navigate months
  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1))
      return newDate
    })
  }

  const handleMouseDown = (date: Date) => {
    if (readOnly) return
    setIsDragging(true)
    setDragStart(date)
    setDragEnd(date)
  }

  const handleMouseEnter = (date: Date) => {
    if (readOnly || !isDragging || !dragStart) return
    setDragEnd(date)
  }

  const handleMouseUp = () => {
    if (readOnly || !isDragging || !dragStart || !dragEnd) return

    setIsDragging(false)

    // Determine the actual start and end dates (in case user dragged backwards)
    const actualStart = dragStart <= dragEnd ? dragStart : dragEnd
    const actualEnd = dragStart <= dragEnd ? dragEnd : dragStart

    setIsEditMode(false)
    setEditingTimeIndex(null)
    setEditingListIndex(null)

    setFirstDate(formatDateForInput(actualStart))
    setLastDate(formatDateForInput(actualEnd))
    setShowTimeForm(true)
  }

  const handleEventClick = (eventData: { event: EventTime; listIndex: number; list: EventList }) => {
    if (eventData.list.readOnly) return

    const timeIndex = eventData.list.times.findIndex(
      (t) => t.start === eventData.event.start && t.end === eventData.event.end,
    )

    // Set edit mode
    setIsEditMode(true)
    setEditingTimeIndex(timeIndex)
    setEditingListIndex(eventData.listIndex)

    if (!eventData.event.start || !eventData.event.end) return

    const startDate = new Date(eventData.event.start)
    const endDate = new Date(eventData.event.end)

    setFirstDate(formatDateForInput(startDate))
    setLastDate(formatDateForInput(endDate))

    // Format times in the specified timezone
    const startTimeFormatted = startDate.toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    })
    const endTimeFormatted = endDate.toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    })

    setStartTime(startTimeFormatted)
    setEndTime(endTimeFormatted)

    setShowTimeForm(true)
  }

  const handleSaveTime = () => {
    if (!onTimesChange || eventLists.length === 0 || !firstDate || !lastDate) return

    // Create timezone-aware dates and convert to UTC for storage
    const startDate = createTimezoneAwareDate(firstDate, startTime, timezone)
    const endDate = createTimezoneAwareDate(lastDate, endTime, timezone)

    const newTime: EventTime = {
      start: startDate.toISOString(), // Store as UTC
      end: endDate.toISOString(), // Store as UTC
    }

    if (isEditMode && editingTimeIndex !== null && editingListIndex !== null) {
      // Edit existing time
      const newTimes = [...eventLists[editingListIndex].times]
      newTimes[editingTimeIndex] = newTime
      onTimesChange(editingListIndex, newTimes)
    } else {
      // Add new time
      const newTimes = [...eventLists[0].times, newTime]
      onTimesChange(0, newTimes)
    }

    handleCancel()
  }

  const handleCancel = () => {
    setShowTimeForm(false)
    setDragStart(null)
    setDragEnd(null)
    setFirstDate("")
    setLastDate("")
    setIsEditMode(false)
    setEditingTimeIndex(null)
    setEditingListIndex(null)
  }

  const handleDeleteCurrentTime = () => {
    if (!onTimesChange || !isEditMode || editingTimeIndex === null || editingListIndex === null) return

    const newTimes = eventLists[editingListIndex].times.filter((_, index) => index !== editingTimeIndex)
    onTimesChange(editingListIndex, newTimes)
    handleCancel()
  }

  // Remove time range
  const handleRemoveTime = (listIndex: number, timeIndex: number) => {
    if (readOnly || !onTimesChange) return

    if (eventLists[listIndex]?.readOnly) return

    const newTimes = eventLists[listIndex].times.filter((_, index) => index !== timeIndex)
    onTimesChange(listIndex, newTimes)
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardContent className="p-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigateMonth("prev")} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <h2 className="text-lg font-semibold text-foreground">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>

            <Button variant="ghost" size="sm" onClick={() => navigateMonth("next")} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div key={day} className="h-8 flex items-center justify-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1" onMouseLeave={() => setIsDragging(false)}>
            {calendarDays.map((date, index) => {
              const isCurrentMonth = date.getMonth() === currentDate.getMonth()
              const isToday = isSameDay(date, new Date())
              const events = getEventsForDate(date)
              const isInDragRange = isDateInRange(date, dragStart, dragEnd)

              return (
                <div
                  key={index}
                  className={`
                    h-20 border border-border rounded-md p-1 cursor-pointer transition-colors select-none
                    ${isCurrentMonth ? "bg-card hover:bg-muted" : "bg-muted/50 text-muted-foreground"}
                    ${isToday ? "ring-2 ring-accent" : ""}
                    ${!readOnly ? "hover:bg-accent/10" : ""}
                    ${isInDragRange ? "bg-accent/20 ring-1 ring-accent" : ""}
                  `}
                  onMouseDown={() => handleMouseDown(date)}
                  onMouseEnter={() => handleMouseEnter(date)}
                  onMouseUp={handleMouseUp}
                >
                  <div className="text-sm font-medium mb-1">{date.getDate()}</div>

                  {/* Event indicators */}
                  <div className="space-y-1">
                    {events.slice(0, 2).map((eventData, eventIndex) => {
                      if (!eventData.event.start || !eventData.event.end) return null

                      const eventStartDate = new Date(eventData.event.start)
                      const eventEndDate = new Date(eventData.event.end)
                      const isFirstDay = isSameDay(date, eventStartDate)
                      const isLastDay = isSameDay(date, eventEndDate)
                      const isMultiDay = !isSameDay(eventStartDate, eventEndDate)

                      // Determine what time to display based on position in multi-day event
                      let displayTime = ""
                      if (isMultiDay) {
                        if (isFirstDay) {
                          displayTime = formatTime(eventData.event.start, timezone)
                        } else if (isLastDay) {
                          displayTime = formatTime(eventData.event.end, timezone)
                        } else {
                          // Middle days show no time, just the event name or indicator
                          displayTime = "•"
                        }
                      } else {
                        // Single day event shows start time
                        displayTime = formatTime(eventData.event.start, timezone)
                      }

                      const eventElement = (
                        <div
                          key={eventIndex}
                          className="text-xs px-1 py-0.5 rounded truncate flex items-center justify-between group cursor-pointer"
                          style={{
                            backgroundColor: eventData.list.color,
                            color: getContrastColor(eventData.list.color),
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEventClick(eventData)
                          }}
                        >
                          <span className="truncate">{displayTime}</span>
                          {!readOnly && !eventData.list.readOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-3 w-3 p-0 opacity-0 group-hover:opacity-100 hover:bg-black/20"
                              onClick={(e) => {
                                e.stopPropagation()
                                const timeIndex = eventData.list.times.findIndex(
                                  (t) => t.start === eventData.event.start && t.end === eventData.event.end,
                                )
                                handleRemoveTime(eventData.listIndex, timeIndex)
                              }}
                            >
                              <X className="h-2 w-2" />
                            </Button>
                          )}
                        </div>
                      )

                      if (eventData.list.showTooltip && eventData.list.description) {
                        return (
                          <Tooltip key={eventIndex}>
                            <TooltipTrigger asChild>{eventElement}</TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{eventData.list.name}</p>
                              <p className="text-sm text-gray-200">{eventData.list.description}</p>
                              <div className="text-xs text-gray-300 mt-1 space-y-1">
                                <div>
                                  <span className="font-medium">Start:</span>{" "}
                                  {eventData.event.start ? (
                                    <>
                                      {new Date(eventData.event.start).toLocaleDateString([], {
                                        timeZone: timezone,
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })}{" "}
                                      at {formatTime(eventData.event.start, timezone)}
                                    </>
                                  ) : (
                                    "Not set"
                                  )}
                                </div>
                                <div>
                                  <span className="font-medium">End:</span>{" "}
                                  {eventData.event.end ? (
                                    <>
                                      {new Date(eventData.event.end).toLocaleDateString([], {
                                        timeZone: timezone,
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })}{" "}
                                      at {formatTime(eventData.event.end, timezone)}
                                    </>
                                  ) : (
                                    "Not set"
                                  )}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )
                      }

                      return eventElement
                    })}

                    {events.length > 2 && (
                      <div className="text-xs text-muted-foreground px-1">+{events.length - 2} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <Dialog open={showTimeForm && !readOnly} onOpenChange={handleCancel}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{isEditMode ? "Edit Event Segment" : "Refine Event Segment"}</DialogTitle>
                <DialogDescription>
                  {firstDate && lastDate && firstDate === lastDate
                    ? `Set the time for ${formatDateForDisplay(firstDate, timezone)}. All times are in the venue's local time, ${getTimezoneDisplayName(timezone)}.`
                    : `Set the time range from ${formatDateForDisplay(firstDate, timezone)} to ${formatDateForDisplay(lastDate, timezone)}. All times are in the venue's local time: ${getTimezoneDisplayName(timezone)}.`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-date">First Date *</Label>
                    <Input
                      id="first-date"
                      type="date"
                      value={firstDate}
                      onChange={(e) => setFirstDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-date">Last Date *</Label>
                    <Input id="last-date" type="date" value={lastDate} onChange={(e) => setLastDate(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-time">Start Time *</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-time">End Time *</Label>
                    <Input id="end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                </div>
              </div>

              <DialogFooter className="flex justify-between">
                <div>
                  {isEditMode && (
                    <Button
                      variant="outline"
                      className="text-red-600 hover:text-red-700 bg-transparent"
                      onClick={handleDeleteCurrentTime}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete This Segment
                    </Button>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={handleCancel}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSaveTime} disabled={!firstDate || !lastDate || !startTime || !endTime}>
                    <Save className="w-4 h-4 mr-2" />
                    {isEditMode ? "Save Changes" : "Add Event Segment"}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Event Legend */}
          {showEventLegend && eventLists.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex flex-wrap gap-2">
                {eventLists.map((list, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded border border-border" style={{ backgroundColor: list.color }} />
                    <span className="text-sm text-foreground">{list.name}</span>
                    {list.description && <span className="text-xs text-muted-foreground">({list.description})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
