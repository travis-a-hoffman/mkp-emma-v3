/*
 * This provider is intended to be used inside of the Auth0Provider like so:
 * <Auth0Provider>
 *.  <EmmaUserProvider>
 *.    {children}
 *.  </EmmaUserProvider>
 * </Auth0Provider>
 */

"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useAuth0 } from "./auth0-provider"
import type { EmmaUserWithRelations } from "../../api/users"

interface EmmaContextType {
  emmaUser: EmmaUserWithRelations | null
  setEmmaUser: (user: EmmaUserWithRelations | null) => void
  isEmmaUserLoading: boolean
  loadEmmaUser: () => Promise<void>
  emmaUserError: string | null
}

const EmmaContext = createContext<EmmaContextType | undefined>(undefined)

export const useEmma = () => {
  const context = useContext(EmmaContext)
  if (!context) {
    throw new Error("useEmma must be used within an EmmaProvider")
  }
  return context
}

interface EmmaUserProviderProps {
  children: ReactNode
}

export const EmmaProvider = ({ children }: EmmaUserProviderProps) => {
  const { user: auth0User, isAuthenticated, isLoading: auth0Loading } = useAuth0()
  const [emmaUser, setEmmaUserState] = useState<EmmaUserWithRelations | null>(null)
  const [isEmmaUserLoading, setIsEmmaUserLoading] = useState(false)
  const [emmaUserError, setEmmaUserError] = useState<string | null>(null)

  const loadEmmaUser = async () => {
    if (!auth0User?.email) {
      console.log("[v0] No Auth0 user email available")
      return
    }

    setIsEmmaUserLoading(true)
    setEmmaUserError(null)

    try {
      console.log("[v0] Fetching EmmaUser for email:", auth0User.email)
      const response = await fetch(`/api/users?email=${encodeURIComponent(auth0User.email)}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch user: ${response.status}`)
      }

      const result = await response.json()
      console.log("[v0] EmmaUser API response:", result)

      if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
        // Take the first user if multiple found
        setEmmaUserState(result.data[0])
        console.log("[v0] EmmaUser loaded successfully:", result.data[0])
      } else if (result.success && result.data && !Array.isArray(result.data)) {
        // Single user object
        setEmmaUserState(result.data)
        console.log("[v0] EmmaUser loaded successfully:", result.data)
      } else {
        // No user found
        setEmmaUserState(null)
        console.log("[v0] No EmmaUser found for email:", auth0User.email)
      }
    } catch (error) {
      console.error("[v0] Error loading EmmaUser:", error)
      setEmmaUserError(error instanceof Error ? error.message : "Failed to load user")
      setEmmaUserState(null)
    } finally {
      setIsEmmaUserLoading(false)
    }
  }

  const setEmmaUser = (eu: EmmaUserWithRelations | null) => { 
    setEmmaUserState(eu)
    setEmmaUserError(null)
  }

  useEffect(() => {
    if (!auth0Loading && isAuthenticated && auth0User?.email) {
      console.log("[v0] Auth0 user available, loading EmmaUser...")
      loadEmmaUser()
    } else if (!isAuthenticated) {
      console.log("[v0] User not authenticated, clearing EmmaUser")
      setEmmaUser(null)
    }
  }, [auth0Loading, isAuthenticated, auth0User?.email])

  return (
    <EmmaContext.Provider
      value={{
        emmaUser,
        setEmmaUser,
        isEmmaUserLoading,
        loadEmmaUser,
        emmaUserError,
      }}
    >
      {children}
    </EmmaContext.Provider>
  )
}
