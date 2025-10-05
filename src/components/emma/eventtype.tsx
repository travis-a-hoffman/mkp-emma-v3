import type React from "react"

interface EmmaEventTypeTagProps {
  code: string
  color: string
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

export const EmmaEventTypeTag: React.FC<EmmaEventTypeTagProps> = ({ code, color, className = "" }) => {
  const bgColor = color || "#6B7280"
  const textColor = getContrastColor(bgColor)

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium border ${className}`}
      style={{
        borderColor: bgColor,
        backgroundColor: bgColor,
        color: textColor,
      }}
    >
      {code}
    </span>
  )
}
