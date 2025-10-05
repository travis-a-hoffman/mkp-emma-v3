"use client"

import React, { useState, useEffect } from "react"

interface EmmaCountdownTimerProps {
  targetDate: Date
}

interface TimeUnit {
  value: number
  label: string
}

export function EmmaCountdownTimer({ targetDate }: EmmaCountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeUnit[]>([])

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const target = targetDate.getTime()
      const difference = target - now

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24))
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))

        setTimeLeft([
          { value: days, label: "Days" },
          { value: hours, label: "Hours" },
          { value: minutes, label: "Minutes" },
        ])
      } else {
        setTimeLeft([])
      }
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 60000) // Update every minute

    return () => clearInterval(timer)
  }, [targetDate])

  if (timeLeft.length === 0) {
    return <div className="text-center text-lg font-semibold text-muted-foreground">Event has started!</div>
  }

  return (
    <div className="flex justify-center items-center space-x-2 sm:space-x-4">
      {timeLeft.map((unit, index) => (
        <React.Fragment key={unit.label}>
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg shadow-lg border border-gray-600 overflow-hidden">
                <div className="bg-gradient-to-b from-gray-700 to-gray-800 px-3 py-2 sm:px-4 sm:py-3">
                  <div className="text-white font-mono text-4xl sm:text-6xl font-bold leading-none">
                    {unit.value.toString().padStart(2, "0")}
                  </div>
                </div>
                <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-600"></div>
              </div>
            </div>
            <div className="text-xs sm:text-sm font-medium text-muted-foreground mt-1 uppercase tracking-wide">
              {unit.label}
            </div>
          </div>
          {index < timeLeft.length - 1 && <div className="text-2xl sm:text-3xl font-bold text-muted-foreground">:</div>}
        </React.Fragment>
      ))}
    </div>
  )
}
