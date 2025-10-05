"use client"

import type { AreaWithColor } from "../../types/area"

interface EmmaAreaTagProps {
  area: AreaWithColor | null | undefined
  className?: string
}

// Function to calculate luminance and determine text color
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const color = hexColor.replace("#", "")

  // Convert to RGB
  const r = Number.parseInt(color.substr(0, 2), 16)
  const g = Number.parseInt(color.substr(2, 2), 16)
  const b = Number.parseInt(color.substr(4, 2), 16)

  // Calculate luminance using the relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Return black for light colors, white for dark colors
  return luminance > 0.5 ? "#000000" : "#ffffff"
}

export function EmmaAreaTag({ area, className = "" }: EmmaAreaTagProps) {
  if (!area) {
    return (<span/>)
    /*return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium border ${className}`}
      >
        UNK
      </span>
    )*/
  }

  const backgroundColor = area.color || "#6B7280"
  const textColor = getContrastColor(backgroundColor)

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium ${className}`}
      style={{
        borderColor: backgroundColor,
        backgroundColor: backgroundColor,
        color: textColor,
      }}
    >
      {area.code}
    </span>
  )
}
