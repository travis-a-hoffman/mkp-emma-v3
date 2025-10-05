import { useAuth0 } from "../lib/auth0-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { User, Calendar, Loader2, Mail, Shield } from "lucide-react"
import { Link } from "react-router-dom"
import { EmmaTitleBar } from "../components/emma/titlebar"

export default function Dashboard() {
  const { user, isAuthenticated, isLoading } = useAuth0()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <EmmaTitleBar />
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please log in to access the dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/">Return to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <EmmaTitleBar title="Dashboard" backLink={{ href: "/", label: "Back to Home" }} />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Profile</CardTitle>
              <CardDescription>Your Auth0 profile information and account details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user?.picture || ""} alt={user?.name || ""} />
                  <AvatarFallback>
                    <User className="h-10 w-10" />
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold">{user?.name}</h3>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{user?.email}</span>
                  </div>
                  <Badge variant="secondary">{user?.email_verified ? "Verified" : "Unverified"}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="font-medium">Account Information</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>User ID:</span>
                      <span className="font-mono text-xs">{user?.sub}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Nickname:</span>
                      <span>{user?.nickname || "Not set"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Updated:</span>
                      <span>{user?.updated_at ? new Date(user.updated_at).toLocaleDateString() : "Unknown"}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Session Details</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Logged in: {new Date().toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span>Auth Provider: Auth0</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Security</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage your account security settings and two-factor authentication.
                </p>
                <Button variant="outline" size="sm" className="w-full bg-transparent">
                  Security Settings
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Customize your app experience and notification preferences.
                </p>
                <Button variant="outline" size="sm" className="w-full bg-transparent">
                  Edit Preferences
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">View your recent activity and login history.</p>
                <Button variant="outline" size="sm" className="w-full bg-transparent">
                  View Activity
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
