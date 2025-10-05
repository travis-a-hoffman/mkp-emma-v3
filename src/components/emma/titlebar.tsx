"use client"

import { useState } from "react"
import { useAuth0 } from "../../lib/auth0-provider"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowLeft, User, Menu, LogIn } from "lucide-react"
import { Link } from "react-router-dom"

interface EmmaTitleBarProps {
  title?: string
  backLink?: {
    href: string
    label: string
  }
}

export function EmmaTitleBar({ title = "EMMA", backLink }: EmmaTitleBarProps) {
  const { user, logout, loginWithPopup } = useAuth0()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
  }

  const handleLogin = () => {
    loginWithPopup()
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4 grid grid-cols-3 items-center">
        <div className="flex items-center justify-start gap-2">
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Menu className="h-9 w-9 text-primary" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 text-xl">
              <DropdownMenuItem asChild className="py-3 px-4 text-lg sm:py-2 sm:px-3 sm:text-base">
                <Link to="/" onClick={() => setIsMenuOpen(false)}>
                  Home
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="py-3 px-4 text-lg sm:py-2 sm:px-3 sm:text-base">
                <Link to="/nwta" onClick={() => setIsMenuOpen(false)}>
                  NWTA
                </Link>
              </DropdownMenuItem>
              {user && (
                <>
                  <DropdownMenuItem asChild className="py-3 px-4 text-lg sm:py-2 sm:px-3 sm:text-base">
                    <Link to="/staffing" onClick={() => setIsMenuOpen(false)}>
                      Staffing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="py-3 px-4 text-lg sm:py-2 sm:px-3 sm:text-base">
                    <Link to="/training" onClick={() => setIsMenuOpen(false)}>
                      Training
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="py-3 px-4 text-lg sm:py-2 sm:px-3 sm:text-base">
                    <Link to="/warrior" onClick={() => setIsMenuOpen(false)}>
                      Warriors
                    </Link>
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem className="py-3 px-4 text-lg sm:py-2 sm:px-3 sm:text-base">About...</DropdownMenuItem>
              <DropdownMenuItem asChild className="py-3 px-4 text-lg sm:py-2 sm:px-3 sm:text-base">
                <Link to="/about/emma" onClick={() => setIsMenuOpen(false)}>
                  &nbsp;•&nbsp;Emma
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="py-3 px-4 text-lg sm:py-2 sm:px-3 sm:text-base">
                <Link to="/about/new-warrior-training-adventure" onClick={() => setIsMenuOpen(false)}>
                  &nbsp;•&nbsp;The Weekend
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="py-3 px-4 text-lg sm:py-2 sm:px-3 sm:text-base">
                <Link to="/about/my-community" onClick={() => setIsMenuOpen(false)}>
                  &nbsp;•&nbsp;Your Community
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="py-3 px-4 text-lg sm:py-2 sm:px-3 sm:text-base">
                <Link to="/about/my-area" onClick={() => setIsMenuOpen(false)}>
                  &nbsp;•&nbsp;Your Area
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="py-3 px-4 text-lg sm:py-2 sm:px-3 sm:text-base">
                <Link to="/about/mankind-project" onClick={() => setIsMenuOpen(false)}>
                  &nbsp;•&nbsp;ManKind Project
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="py-3 px-4 text-lg sm:py-2 sm:px-3 sm:text-base">
                <Link to="/about/mankind-project-usa" onClick={() => setIsMenuOpen(false)}>
                  &nbsp;•&nbsp;ManKind Project USA
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {backLink && (
            <Button variant="ghost" size="sm" asChild>
              <Link to={backLink.href}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {backLink.label}
              </Link>
            </Button>
          )}
        </div>

        <div className="flex items-center justify-center">
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>

        <div className="flex items-center justify-end">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8" onClick={handleLogout}>
                  <AvatarImage src={user.picture || ""} alt={user.name || ""} />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden sm:inline">{user.name}</span>
              </div>
            </div>
          ) : (
            <Button variant="ghost" size="lg" onClick={handleLogin}>
              <LogIn className="h-4 w-4 mr-2" />
              Login
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
