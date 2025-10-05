"use client"

import { useAuth0 } from "../lib/auth0-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, LogIn, User } from "lucide-react"
import { Link, Navigate } from "react-router-dom"
import { EmmaTitleBar } from "../components/emma/titlebar"

export default function Login() {
  const { user, error, isLoading, isAuthenticated, loginWithPopup } = useAuth0()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <EmmaTitleBar title="EMMA" backLink={{ href: "/", label: "Home" }} />
        <div className="p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mr-2" />
              <span className="text-lg">Authenticating user...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // TODO How to navigate back to the page the login request came from?
  if (isAuthenticated && user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <EmmaTitleBar />
      <main className="pt-20 container mx-auto px-4 py-12">
        {(isAuthenticated && user) ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Welcome back, {user.name}!</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  The next New Warrior Training Adventure ...
                </div>
                <div>
                  ...begins in 3 days, 4 hours, and 32 minutes.
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="pt-20 max-w-md mx-auto text-center space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Signup/Login for personalized features.</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  The next New Warrior Training Adventure ...
                </div>
                <p className="text-sm text-muted-foreground">
                  Please log in to access your personalized features.
                </p>
                <Button className="w-full" onClick={loginWithPopup}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Get Started
                </Button>
                <div>
                  ...begins in 3 days, 4 hours, and 32 minutes.
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
