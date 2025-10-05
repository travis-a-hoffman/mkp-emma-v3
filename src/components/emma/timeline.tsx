"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export interface TimelineEvent {
  date: string // Format: YYYY-MM-DD
  label?: string
  description?: string
  data?: any
}

export interface MonthMarker {
  date: string
  position: number
  label: string
}

export interface TimelineStyles {
  background?: string
  foreground?: string
  outline?: string
}

export interface TimelineMotion {
  stiffness?: number
  damping?: number
}

export interface EmmaTimelineProps {
  events: TimelineEvent[]
  selectedIndex: number
  onEventSelect: (index: number) => void
  getLabel?: (event: TimelineEvent) => string
  getDescription?: (event: TimelineEvent) => string
  indexClick?: boolean
  minEventPadding?: number
  maxEventPadding?: number
  linePadding?: number
  labelWidth?: number
  fillingMotion?: TimelineMotion
  slidingMotion?: TimelineMotion
  styles?: TimelineStyles
  isTouchEnabled?: boolean
  isKeyboardEnabled?: boolean
  className?: string
}

export const EmmaTimeline: React.FC<EmmaTimelineProps> = ({
  events,
  selectedIndex,
  onEventSelect,
  getLabel = (event: TimelineEvent) => event.label || new Date(event.date).toDateString().substring(4),
  getDescription = (event: TimelineEvent) => event.description || "",
  indexClick = true,
  minEventPadding = 20,
  maxEventPadding = 120,
  linePadding = 100,
  labelWidth = 85,
  fillingMotion = { stiffness: 150, damping: 25 },
  slidingMotion = { stiffness: 150, damping: 25 },
  styles = {},
  isTouchEnabled = true,
  isKeyboardEnabled = true,
  className,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [timelineWidth, setTimelineWidth] = useState(0)
  const [eventPositions, setEventPositions] = useState<number[]>([])
  const [monthMarkers, setMonthMarkers] = useState<MonthMarker[]>([])
  const [visibleWidth, setVisibleWidth] = useState(0)
  const [translateX, setTranslateX] = useState(0)

  const calculateMonthMarkers = useCallback(() => {
    if (events.length === 0 || eventPositions.length === 0) return []

    if (events.length === 1) {
      // For single event, show previous month, current month, and next month
      const eventDate = new Date(events[0].date)
      const markers: MonthMarker[] = []

      // Previous month
      const prevMonth = new Date(eventDate.getFullYear(), eventDate.getMonth() - 1, 1)
      const prevLabel =
        prevMonth.getMonth() === 0
          ? prevMonth.getFullYear().toString()
          : prevMonth.toLocaleDateString("en-US", { month: "short" })

      // Current month
      const currentMonth = new Date(eventDate.getFullYear(), eventDate.getMonth(), 1)
      const currentLabel =
        currentMonth.getMonth() === 0
          ? currentMonth.getFullYear().toString()
          : currentMonth.toLocaleDateString("en-US", { month: "short" })

      // Next month
      const nextMonth = new Date(eventDate.getFullYear(), eventDate.getMonth() + 1, 1)
      const nextLabel =
        nextMonth.getMonth() === 0
          ? nextMonth.getFullYear().toString()
          : nextMonth.toLocaleDateString("en-US", { month: "short" })

      const centerPosition = eventPositions[0]
      const spacing = 120 // Fixed spacing for single event context

      markers.push(
        {
          date: prevMonth.toISOString().split("T")[0],
          position: centerPosition - spacing,
          label: prevLabel,
        },
        {
          date: currentMonth.toISOString().split("T")[0],
          position: centerPosition,
          label: currentLabel,
        },
        {
          date: nextMonth.toISOString().split("T")[0],
          position: centerPosition + spacing,
          label: nextLabel,
        },
      )

      return markers
    }

    // Get date range from events
    const eventDates = events.map((event) => new Date(event.date))
    const minDate = new Date(Math.min(...eventDates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...eventDates.map((d) => d.getTime())))

    // Generate first of each month between min and max dates
    const markers: MonthMarker[] = []
    const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1)

    while (current <= maxDate) {
      const markerDate = new Date(current)

      // Calculate position based on date relative to event dates
      const totalTimeSpan = maxDate.getTime() - minDate.getTime()
      const markerTimeOffset = markerDate.getTime() - minDate.getTime()
      const relativePosition = totalTimeSpan > 0 ? markerTimeOffset / totalTimeSpan : 0

      // Map to timeline position
      const startPos = eventPositions[0] || linePadding
      const endPos = eventPositions[eventPositions.length - 1] || linePadding
      const position = startPos + (endPos - startPos) * relativePosition

      const isJanuary = markerDate.getMonth() === 0
      const label = isJanuary
        ? markerDate.getFullYear().toString()
        : markerDate.toLocaleDateString("en-US", { month: "short" })

      markers.push({
        date: markerDate.toISOString().split("T")[0],
        position,
        label,
      })

      // Move to next month
      current.setMonth(current.getMonth() + 1)
    }

    return markers
  }, [events, eventPositions, linePadding])

  const calculateEventPositions = useCallback(() => {
    if (events.length === 0) return []

    const positions: number[] = []
    const totalEvents = events.length

    if (totalEvents === 1) {
      const centerPosition = Math.max(400, visibleWidth / 2)
      positions.push(centerPosition)
      return positions
    }

    // Calculate spacing between events for multiple events
    const availableWidth = Math.max(800, visibleWidth - linePadding * 2)
    const spacing = Math.min(maxEventPadding, Math.max(minEventPadding, availableWidth / (totalEvents - 1 || 1)))

    // Position events
    for (let i = 0; i < totalEvents; i++) {
      positions.push(linePadding + i * spacing)
    }

    return positions
  }, [events, linePadding, minEventPadding, maxEventPadding, visibleWidth])

  const calculateTodayPosition = useCallback(() => {
    if (events.length === 0 || eventPositions.length === 0) return 0

    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset to start of day for comparison

    if (events.length === 1) {
      const eventDate = new Date(events[0].date)
      eventDate.setHours(0, 0, 0, 0)

      const centerPosition = eventPositions[0]

      // If today is before the event, show partial progress
      if (today < eventDate) {
        return Math.max(0, centerPosition * 0.3) // Show some progress but not full
      }

      // If today is on or after the event, show full progress to the event
      return centerPosition
    }

    // Get date range from events
    const eventDates = events.map((event) => new Date(event.date))
    const minDate = new Date(Math.min(...eventDates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...eventDates.map((d) => d.getTime())))

    // If today is before the first event, return 0 (no progress)
    if (today < minDate) return 0

    // If today is after the last event, return full timeline width
    if (today > maxDate) return eventPositions[eventPositions.length - 1] || 0

    // Calculate today's relative position between min and max dates
    const totalTimeSpan = maxDate.getTime() - minDate.getTime()
    const todayTimeOffset = today.getTime() - minDate.getTime()
    const relativePosition = totalTimeSpan > 0 ? todayTimeOffset / totalTimeSpan : 0

    // Map to timeline position
    const startPos = eventPositions[0] || linePadding
    const endPos = eventPositions[eventPositions.length - 1] || linePadding
    const todayPosition = startPos + (endPos - startPos) * relativePosition

    return todayPosition
  }, [events, eventPositions, linePadding])

  useEffect(() => {
    const positions = calculateEventPositions()
    setEventPositions(positions)

    if (positions.length > 0) {
      const totalWidth =
        events.length === 1
          ? Math.max(800, visibleWidth) // Ensure minimum width for single event context
          : positions[positions.length - 1] + linePadding
      setTimelineWidth(totalWidth)
    }
  }, [calculateEventPositions, linePadding, events.length, visibleWidth])

  useEffect(() => {
    const markers = calculateMonthMarkers()
    setMonthMarkers(markers)
  }, [calculateMonthMarkers])

  useEffect(() => {
    const handleResize = () => {
      if (timelineRef.current) {
        setVisibleWidth(timelineRef.current.offsetWidth)
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    if (eventPositions.length > 0 && selectedIndex >= 0 && selectedIndex < eventPositions.length) {
      const selectedPosition = eventPositions[selectedIndex]
      const centerOffset = visibleWidth / 2
      const newTranslateX = Math.max(Math.min(0, centerOffset - selectedPosition), visibleWidth - timelineWidth)
      setTranslateX(newTranslateX)
    }
  }, [selectedIndex, eventPositions, visibleWidth, timelineWidth])

  useEffect(() => {
    if (!isKeyboardEnabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault()
          if (selectedIndex > 0) {
            onEventSelect(selectedIndex - 1)
          }
          break
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault()
          if (selectedIndex < events.length - 1) {
            onEventSelect(selectedIndex + 1)
          }
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedIndex, events.length, onEventSelect, isKeyboardEnabled])

  const handleEventClick = (index: number) => {
    if (indexClick) {
      onEventSelect(index)
    }
  }

  const handlePrevious = () => {
    if (selectedIndex > 0) {
      onEventSelect(selectedIndex - 1)
    }
  }

  const handleNext = () => {
    if (selectedIndex < events.length - 1) {
      onEventSelect(selectedIndex + 1)
    }
  }

  const fillWidth = calculateTodayPosition()

  const timelineStyles = {
    backgroundColor: styles.background || "hsl(var(--primary))",
    color: styles.foreground || "hsl(var(--primary-foreground))",
    borderColor: styles.outline || "hsl(var(--border))",
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevious}
            disabled={selectedIndex <= 0}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 mx-4">
            {selectedIndex >= 0 && selectedIndex < events.length && (
              <div className="text-center">
                <div className="text-sm text-muted-foreground">
                  {(() => {
                    const event = events[selectedIndex]

                    if (event.data && event.data.start_at && event.data.end_at) {
                      const startDate = new Date(event.data.start_at)
                      const endDate = new Date(event.data.end_at)

                      // Check if start and end are on the same date
                      const isSameDate = startDate.toDateString() === endDate.toDateString()

                      if (isSameDate) {
                        // Single day event - show date and time range
                        const dateStr = startDate.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                        const startTime = startDate.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })
                        const endTime = endDate.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })
                        return `${dateStr} • ${startTime} - ${endTime}`
                      } else {
                        // Multi-day event - show date range with times
                        const startDateStr = startDate.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                        const endDateStr = endDate.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                        const startTime = startDate.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })
                        const endTime = endDate.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })
                        return `${startDateStr} ${startTime} - ${endDateStr} ${endTime}`
                      }
                    }

                    // Fallback to event date if no start_at/end_at data
                    const eventDate = new Date(event.date)
                    return eventDate.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  })()}
                </div>
                {getDescription(events[selectedIndex]) && (
                  <div className="text-xs text-muted-foreground mt-1">{getDescription(events[selectedIndex])}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {selectedIndex + 1} of {events.length}
                </div>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleNext}
            disabled={selectedIndex >= events.length - 1}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Timeline Container */}
        <div ref={timelineRef} className="relative overflow-hidden bg-muted rounded-lg p-4" style={{ height: "120px" }}>
          {/* Timeline Line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border transform -translate-y-1/2">
            {/* Progress Fill */}
            <div
              className="absolute top-0 left-0 h-full transition-all duration-300 ease-out"
              style={{
                backgroundColor: timelineStyles.backgroundColor,
                width: `${fillWidth}px`,
                transform: `translateX(${translateX}px)`,
              }}
            />
          </div>

          {/* Timeline Events */}
          <div
            className="absolute top-1/2 transform -translate-y-1/2 transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${translateX}px) translateY(-50%)` }}
          >
            {monthMarkers.map((marker, index) => (
              <div
                key={`month-${index}`}
                className="absolute top-1/2 transform -translate-y-1/2"
                style={{ left: `${marker.position}px`, transform: "translateX(-50%) translateY(-50%)" }}
              >
                {/* Month Marker Dot */}
                <div
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60"
                  style={{ transform: "translateY(+50%)" }}
                />

                {/* Month Label */}
                <div
                  className="absolute -top-6 text-xs text-muted-foreground/80 text-center whitespace-nowrap font-medium"
                  style={{
                    width: "40px",
                    left: "-20px",
                  }}
                >
                  {marker.label}
                </div>
              </div>
            ))}

            {events.map((event, index) => {
              const isSelected = index === selectedIndex
              const position = eventPositions[index] || 0

              return (
                <div
                  key={index}
                  className={cn("absolute group", indexClick ? "cursor-pointer" : "cursor-default")}
                  style={{ left: `${position}px`, transform: "translateX(-50%)" }}
                  onClick={() => handleEventClick(index)}
                >
                  {/* Event Point */}
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2 transition-all duration-200",
                      isSelected ? "scale-125" : indexClick ? "group-hover:scale-110" : "",
                    )}
                    style={{
                      backgroundColor: isSelected ? timelineStyles.backgroundColor : "hsl(var(--background))",
                      borderColor: isSelected
                        ? timelineStyles.backgroundColor
                        : indexClick
                          ? "hsl(var(--border))"
                          : timelineStyles.borderColor,
                      transform: "translateY(-50%)", // Center the circle vertically on the timeline line
                    }}
                  />

                  {/* Event Label */}
                  <div
                    className={cn(
                      "absolute top-6 text-xs text-center transition-colors duration-200",
                      "whitespace-nowrap",
                      isSelected ? "text-foreground font-medium" : "text-muted-foreground",
                    )}
                    style={{
                      width: `${labelWidth}px`,
                      left: `${-labelWidth / 2}px`,
                    }}
                  >
                    {getLabel(event)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default EmmaTimeline
