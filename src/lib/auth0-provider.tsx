"use client"

import { createAuth0Client, type Auth0Client, type User } from "@auth0/auth0-spa-js"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

interface Auth0ContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  loginWithPopup: () => Promise<void>
  logout: () => void
  error: string | null
}

const Auth0Context = createContext<Auth0ContextType | undefined>(undefined)

export const useAuth0 = () => {
  const context = useContext(Auth0Context)
  if (!context) {
    throw new Error("useAuth0 must be used within an Auth0Provider")
  }
  return context
}

interface Auth0ProviderProps {
  children: ReactNode
}

export const Auth0Provider = ({ children }: Auth0ProviderProps) => {
  const [auth0Client, setAuth0Client] = useState<Auth0Client | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initAuth0 = async () => {
      try {
        const domain = import.meta.env.VITE_AUTH0_DOMAIN
        const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID

        if (!domain || !clientId) {
          throw new Error("Auth0 domain and client ID must be provided")
        }

        console.log("[v0] Auth0 Domain:", domain)
        console.log("[v0] Auth0 Client ID:", clientId)

        const client = await createAuth0Client({
          domain,
          clientId,
          authorizationParams: {
            redirect_uri: window.location.origin,
          },
        })

        console.log("[v0] Auth0 client created successfully")
        setAuth0Client(client)

        // Check if user is authenticated
        const isAuthenticated = await client.isAuthenticated()
        console.log("[v0] User authenticated:", isAuthenticated)
        setIsAuthenticated(isAuthenticated)

        if (isAuthenticated) {
          const user = await client.getUser()
          console.log("[v0] User data:", user)
          setUser(user || null)
        }
      } catch (err) {
        console.error("[v0] Auth0 initialization error:", err)
        setError(err instanceof Error ? err.message : "Authentication error")
      } finally {
        setIsLoading(false)
      }
    }

    initAuth0()
  }, [])

  const loginWithPopup = async () => {
    try {
      if (auth0Client) {
        console.log("[v0] Starting popup login...")
        await auth0Client.loginWithPopup()
        const user = await auth0Client.getUser()
        console.log("[v0] Login successful, user:", user)
        setUser(user || null)
        setIsAuthenticated(true)
      } else {
        console.error("[v0] Auth0 client not initialized")
      }
    } catch (err) {
      console.error("[v0] Login error:", err)
      setError(err instanceof Error ? err.message : "Login error")
    }
  }

  const logout = () => {
    if (auth0Client) {
      auth0Client.logout({
        logoutParams: {
          returnTo: window.location.origin,
        },
      })
      setUser(null)
      setIsAuthenticated(false)
    }
  }

  return (
    <Auth0Context.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        loginWithPopup,
        logout,
        error,
      }}
    >
      {children}
    </Auth0Context.Provider>
  )
}
