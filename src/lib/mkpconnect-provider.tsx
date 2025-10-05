/*
 * This provider is intended to be used inside of the EmmaUserProvider like so:
 * <EmmaUserProvider>
 *.  <MkpConnectProvider>
 *     {children}
 *   </MkpConnectProvider>
 *.</EmmaUserProvider>
 */

"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import type { WarriorWithRelations } from "../../api/mkp-connect/warriors"

interface WarriorProfile {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  email: string
  phone?: string | null
  address?: {
    street?: string
    city?: string
    state?: string
    zip?: string
  }
  initiation_on: string | null
  community?: string
  area?: string
  civicrm_id?: string
  drupal_id?: string
}

interface MkpConnectContextType {
  mkpConnectWarrior: WarriorWithRelations | null
  setMkpConnectWarrior: (warrior: WarriorWithRelations) => void
  isMkpConnectWarriorLoading: boolean
  loadMkpConnectWarriorByEmail: (email: string) => Promise<WarriorProfile[]>
  loadMkpConnectWarriorByUserId: (userId: string) => Promise<WarriorProfile[]>
  loadMkpConnectWarriorByName: (
    firstname: string,
    middlename: string | null,
    lastname: string,
  ) => Promise<WarriorProfile[]>
  mkpConnectWarriorError: string | null
}

const MkpConnectContext = createContext<MkpConnectContextType | undefined>(undefined)

export const useMkpConnect = () => {
  const context = useContext(MkpConnectContext)
  if (!context) {
    throw new Error("useMkpConnect must be used within an MkpConnectProvider")
  }
  return context
}

interface MkpConnectProviderProps {
  children: ReactNode
}

export const MkpConnectProvider = ({ children }: MkpConnectProviderProps) => {
  const [mkpConnectWarrior, setMkpConnectWarriorState] = useState<WarriorWithRelations | null>(null)
  const [isMkpConnectWarriorLoading, setIsMkpConnectWarriorLoading] = useState(false)
  const [mkpConnectWarriorError, setMkpConnectWarriorError] = useState<string | null>(null)

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const loadMkpConnectWarriorByEmail = async (email: string): Promise<WarriorProfile[]> => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setMkpConnectWarriorError("Please enter a valid email address")
      return []
    }

    setIsMkpConnectWarriorLoading(true)
    setMkpConnectWarriorError(null)

    try {
      const response = await fetch(`/api/mkp-connect/warriors?email=${encodeURIComponent(trimmedEmail)}`)
      if (response.ok) {
        const responseObj = await response.json()
        const responseData: WarriorWithRelations[] = responseObj.data || []

        const warriorProfiles: WarriorProfile[] = []
        responseData.forEach((w) => {
          const wp: WarriorProfile = {
            id: w.id,
            first_name: w.first_name,
            middle_name: w.middle_name || null,
            last_name: w.last_name,
            initiation_on: w.initiation_event ? w.initiation_event.end_at : w.initiation_on,
            email: w.email || "Unknown",
            phone: w.phone,
            address: {
              street: w.physical_address?.address_1,
              city: w.physical_address?.city,
              state: w.physical_address?.state,
              zip: w.physical_address?.postal_code,
            },
            area: w.area?.name || "Unknown",
            community: w.community?.name || "Unknown",
            civicrm_id: w.civicrm_id,
            drupal_id: w.drupal_id,
          }
          warriorProfiles.push(wp)
        })
        // TODO Should I set the results (in warriorProfiles) in a context value?
        //setSearchResults(warriorProfiles)
        if (warriorProfiles.length === 0) {
          setMkpConnectWarriorError("No warrior profiles found for this email address")
        }
        return warriorProfiles
      } else {
        setMkpConnectWarriorError(`Search failed: ${response.status} ${response.statusText}`)
        return []
      }
    } catch (error) {
      setMkpConnectWarriorError(`Search failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      return []
    } finally {
      setIsMkpConnectWarriorLoading(false)
    }
  }

  const loadMkpConnectWarriorByUserId = async (userId: string): Promise<WarriorProfile[]> => {
    const trimmedUserId = userId.trim()
    if (!trimmedUserId) {
      setMkpConnectWarriorError("Please enter a valid MkpConnect UserId")
      return []
    }

    setIsMkpConnectWarriorLoading(true)
    setMkpConnectWarriorError(null)

    try {
      const response = await fetch(`/api/mkp-connect/warriors?userid=${encodeURIComponent(trimmedUserId)}`)
      if (response.ok) {
        const responseObj = await response.json()
        const responseData: WarriorWithRelations[] = responseObj.data || []

        const warriorProfiles: WarriorProfile[] = []
        responseData.forEach((w) => {
          const wp: WarriorProfile = {
            id: w.id,
            first_name: w.first_name,
            middle_name: w.middle_name || null,
            last_name: w.last_name,
            initiation_on: w.initiation_event ? w.initiation_event.end_at : w.initiation_on,
            email: w.email || "Unknown",
            phone: w.phone,
            address: {
              street: w.physical_address?.address_1,
              city: w.physical_address?.city,
              state: w.physical_address?.state,
              zip: w.physical_address?.postal_code,
            },
            area: w.area?.name || "Unknown",
            community: w.community?.name || "Unknown",
            civicrm_id: w.civicrm_id,
            drupal_id: w.drupal_id,
          }
          warriorProfiles.push(wp)
        })
        // TODO Should I set the results (in warriorProfiles) in a context value?
        //setSearchResults(warriorProfiles)
        if (warriorProfiles.length === 0) {
          setMkpConnectWarriorError("No warrior profiles found for this email address")
        }
        return warriorProfiles
      } else {
        setMkpConnectWarriorError(`Search failed: ${response.status} ${response.statusText}`)
        return []
      }
    } catch (error) {
      setMkpConnectWarriorError(`Search failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      return []
    } finally {
      setIsMkpConnectWarriorLoading(false)
    }
  }

  const loadMkpConnectWarriorByName = async (
    firstname: string,
    middlename: string | null,
    lastname: string,
  ): Promise<WarriorProfile[]> => {
    const trimmedFirstName = firstname.trim()
    const trimmedMiddleName = middlename?.trim() || ""
    const trimmedLastName = lastname.trim()

    if (!trimmedFirstName && !trimmedLastName) {
      setMkpConnectWarriorError("Please enter first and last name to search by")
      return []
    }

    setIsMkpConnectWarriorLoading(true)
    setMkpConnectWarriorError(null)

    try {
      const nameParams =
        "firstname=" +
        encodeURIComponent(trimmedFirstName) +
        (trimmedMiddleName ? "&middlename=" + encodeURIComponent(trimmedMiddleName) : "") +
        "&lastname=" +
        encodeURIComponent(trimmedLastName)
      const response = await fetch(`/api/mkp-connect/warriors?${nameParams}`)
      if (response.ok) {
        const responseObj = await response.json()
        const responseData: WarriorWithRelations[] = responseObj.data || []

        const warriorProfiles: WarriorProfile[] = []
        responseData.forEach((w) => {
          const wp: WarriorProfile = {
            id: w.id,
            first_name: w.first_name,
            middle_name: w.middle_name || null,
            last_name: w.last_name,
            initiation_on: w.initiation_event ? w.initiation_event.end_at : w.initiation_on,
            email: w.email || "Unknown",
            phone: w.phone,
            address: {
              street: w.physical_address?.address_1,
              city: w.physical_address?.city,
              state: w.physical_address?.state,
              zip: w.physical_address?.postal_code,
            },
            area: w.area?.name || "Unknown",
            community: w.community?.name || "Unknown",
            civicrm_id: w.civicrm_id,
            drupal_id: w.drupal_id,
          }
          warriorProfiles.push(wp)
        })

        // TODO Should I set the results (in warriorProfiles) in a context value?
        //setSearchResults(warriorProfiles)
        if (warriorProfiles.length === 0) {
          setMkpConnectWarriorError("No warrior profiles found for this name")
        }
        return warriorProfiles
      } else {
        setMkpConnectWarriorError(`Search failed: ${response.status} ${response.statusText}`)
        return []
      }
    } catch (error) {
      setMkpConnectWarriorError(`Search failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      return []
    } finally {
      setIsMkpConnectWarriorLoading(false)
    }
  }

  const setMkpConnectWarrior = (wwr: WarriorWithRelations | null) => {
    setMkpConnectWarriorState(wwr)
    setMkpConnectWarriorError(null)
  }

  return (
    <MkpConnectContext.Provider
      value={{
        mkpConnectWarrior,
        isMkpConnectWarriorLoading,
        setMkpConnectWarrior,
        loadMkpConnectWarriorByEmail,
        loadMkpConnectWarriorByUserId,
        loadMkpConnectWarriorByName,
        mkpConnectWarriorError,
      }}
    >
      {children}
    </MkpConnectContext.Provider>
  )
}
