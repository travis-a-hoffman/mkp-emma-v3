"use client"

import { Phone, Mail } from "lucide-react"
import type { Person as PersonType } from "../../types/person"

interface PersonDisplayProps {
  personId?: string | null | undefined
  person?: PersonType | null | undefined
  showAvatar?: boolean
  showContactInfo?: boolean
  people?: PersonType[]
  size?: string | null | undefined
  onClick?: () => void
}

export function EmmaPersonDisplay({
  personId,
  person = null,
  showAvatar = false,
  showContactInfo = false,
  people = [],
  size = "w-8 h-8",
  onClick,
}: PersonDisplayProps) {
  if (person) {
    // We can skip the following checks...
  } else if (!personId) {
    return <span className="text-gray-500">Not assigned</span>
  } else {
    person = people.find((p) => p.id === personId) || null
    if (!person) {
      return <span className="text-gray-500">Unknown person</span>
    }
  }

  const fullName = `${person.first_name} ${person.last_name}`

  const content = (
    <div className="flex items-center gap-2">
      {showAvatar && (
        <div className={size + " rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0"}>
          {person.photo_url ? (
            <img
              src={person.photo_url || "/placeholder.svg"}
              alt={getPersonInitials(person)}
              className={size + " rounded-full object-cover"}
            />
          ) : (
            <div
              className={`${size} rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0`}
            >
              {getPersonInitials(person)}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col min-w-0">
        <span className="font-medium text-gray-900 truncate">{fullName}</span>

        {showContactInfo && (
          <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
            {person.phone && (
              <div className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                <span>{person.phone}</span>
              </div>
            )}
            {person.email && (
              <div className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                <span className="truncate">{person.email}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  if (onClick) {
    return (
      <div onClick={onClick} className="cursor-pointer hover:bg-gray-50 rounded-md p-1 -m-1 transition-colors">
        {content}
      </div>
    )
  }

  return content
}

const getPersonInitials = (person: PersonType) => {
  const firstInitial = person.first_name?.charAt(0) || ""
  const lastInitial = person.last_name?.charAt(0) || ""
  return (firstInitial + lastInitial).toUpperCase()
}
/*
            <User className={size+" text-gray-500"} />

  const PersonAvatar = ({ person, size = "w-8 h-8" }: { person: PersonType; size?: string }) => {
    if (person.photo_url) {
      const baseUrl = person.photo_url.split("?")[0]
      return (
        <div className={`${size} rounded-full overflow-hidden bg-gray-100 flex-shrink-0`}>
          <img
            src={baseUrl || "/placeholder.svg"}
            alt={formatPersonName(person)}
            className="w-full h-full object-cover"
          />
        </div>
      )
    }

    return (
      <div
        className={`${size} rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0`}
      >
        {getPersonInitials(person)}
      </div>
    )
  }
  */
