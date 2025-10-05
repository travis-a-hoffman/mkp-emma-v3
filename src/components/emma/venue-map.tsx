"use client"

import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useMemo, useCallback } from "react"
import type { AreaWithColor } from "../../types/area"

interface Venue {
  id: string
  name: string
  latitude?: number | null
  longitude?: number | null
  area_id?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
}

interface VenueMapProps {
  venues: Venue[]
  areas: AreaWithColor[]
  className?: string
}

export interface VenueMapRef {
  centerOnVenue: (venueId: string) => void
  fitAllMarkers: () => void
}

declare global {
  interface Window {
    google: any
  }
}

export const VenueMap = forwardRef<VenueMapRef, VenueMapProps>(
  ({ venues, areas, className = "w-full aspect-video" }, ref) => {
    const mapRef = useRef<HTMLDivElement>(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const mapInstanceRef = useRef<any>(null)
    const markersRef = useRef<Map<string, any>>(new Map())
    const infoWindowRef = useRef<any>(null)
    const previousVenuesRef = useRef<Venue[]>([])
    const currentlyOpenVenueRef = useRef<string | null>(null)

    const stableVenues = useMemo(() => venues, [venues])
    const stableAreas = useMemo(() => areas, [areas])

    const createInfoContent = useCallback(
      (venue: Venue) => {
        const area = stableAreas.find((a) => a.id === venue.area_id)
        return `
        <div style="max-width: 250px; padding: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: bold;">${venue.name}</h3>
            ${area ? `<span style="border-color: ${area.color || "#6B7280"}; background-color: ${area.color || "#6B7280"}; color: ${(area.color && getContrastColor(area.color)) || "white"}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 500;">${area.code}</span>` : ""}
          </div>
          ${venue.phone ? `<p style="margin: 0 0 4px 0; font-size: 12px;"><strong>Phone:</strong> ${venue.phone}</p>` : ""}
          ${venue.email ? `<p style="margin: 0 0 4px 0; font-size: 12px;"><strong>Email:</strong> ${venue.email}</p>` : ""}
          ${venue.website ? `<p style="margin: 0; font-size: 12px;"><strong>Website:</strong> <a href="${venue.website}" target="_blank" style="color: #2563eb;">${venue.website}</a></p>` : ""}
        </div>
      `
      },
      [stableAreas],
    )

    const updateMarker = useCallback(
      async (venue: Venue) => {
        if (!mapInstanceRef.current) return

        const { AdvancedMarkerElement, PinElement } = await window.google.maps.importLibrary("marker")
        const existingMarker = markersRef.current.get(venue.id)
        const area = stableAreas.find((a) => a.id === venue.area_id)
        const pinColor = area?.color || "#6B7280"

        if (existingMarker) {
          existingMarker.map = null
          markersRef.current.delete(venue.id)
        }

        if (venue.latitude != null && venue.longitude != null) {
          const pinElement = new PinElement({
            background: pinColor,
            borderColor: "#ffffff",
            glyphColor: getContrastColor(pinColor),
            scale: 1.2,
          })

          const marker = new AdvancedMarkerElement({
            position: { lat: venue.latitude, lng: venue.longitude },
            map: mapInstanceRef.current,
            title: venue.name,
            content: pinElement.element,
          })

          markersRef.current.set(venue.id, marker)

          marker.addListener("click", () => {
            const infoContent = createInfoContent(venue)
            infoWindowRef.current.setContent(infoContent)
            infoWindowRef.current.open(mapInstanceRef.current, marker)
            currentlyOpenVenueRef.current = venue.id
          })

          if (currentlyOpenVenueRef.current === venue.id && infoWindowRef.current) {
            const infoContent = createInfoContent(venue)
            infoWindowRef.current.setContent(infoContent)
          }
        }
      },
      [stableAreas, createInfoContent],
    )

    const centerOnVenue = useCallback(
      (venueId: string) => {
        const venue = stableVenues.find((v) => v.id === venueId)
        const marker = markersRef.current.get(venueId)

        if (venue && marker && mapInstanceRef.current && venue.latitude && venue.longitude) {
          mapInstanceRef.current.setCenter({ lat: venue.latitude, lng: venue.longitude })

          const infoContent = createInfoContent(venue)

          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(infoContent)
            infoWindowRef.current.open(mapInstanceRef.current, marker)
            currentlyOpenVenueRef.current = venueId
          }
        }
      },
      [stableVenues, createInfoContent],
    )

    const fitAllMarkers = useCallback(() => {
      if (!mapInstanceRef.current) return

      if (infoWindowRef.current) {
        infoWindowRef.current.close()
        currentlyOpenVenueRef.current = null
      }

      const venuesWithCoords = stableVenues.filter((venue) => venue.latitude != null && venue.longitude != null)

      if (venuesWithCoords.length === 0) return

      const bounds = new window.google.maps.LatLngBounds()
      venuesWithCoords.forEach((venue) => {
        bounds.extend({ lat: venue.latitude!, lng: venue.longitude! })
      })

      if (venuesWithCoords.length === 1) {
        mapInstanceRef.current.setCenter({
          lat: venuesWithCoords[0].latitude!,
          lng: venuesWithCoords[0].longitude!,
        })
        mapInstanceRef.current.setZoom(12)
      } else {
        mapInstanceRef.current.fitBounds(bounds)
      }
    }, [stableVenues])

    useImperativeHandle(
      ref,
      () => ({
        centerOnVenue,
        fitAllMarkers,
      }),
      [centerOnVenue, fitAllMarkers],
    )

    useEffect(() => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        setError("Google Maps API key not configured. Please set VITE_GOOGLE_MAPS_API_KEY environment variable.")
        return
      }

      if (window.google && window.google.maps) {
        setIsLoaded(true)
        return
      }

      const script = document.createElement("script")
      script.async = true
      script.defer = true
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,marker`

      script.onload = () => {
        setIsLoaded(true)
      }

      script.onerror = () => {
        setError("Failed to load Google Maps")
      }

      document.head.appendChild(script)

      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script)
        }
      }
    }, [])

    useEffect(() => {
      if (!isLoaded || !mapRef.current) return

      const initializeMap = async () => {
        try {
          if (!mapInstanceRef.current) {
            const { AdvancedMarkerElement, PinElement } = await window.google.maps.importLibrary("marker")

            const map = new window.google.maps.Map(mapRef.current, {
              zoom: 4,
              center: { lat: 39.8283, lng: -98.5795 }, // Center of US as default
              mapTypeId: "roadmap",
              mapId: "VENUE_MAP_ID", // Required for advanced markers
            })

            mapInstanceRef.current = map

            const infoWindow = new window.google.maps.InfoWindow()
            infoWindowRef.current = infoWindow

            infoWindow.addListener("closeclick", () => {
              currentlyOpenVenueRef.current = null
            })
          }

          const previousVenues = previousVenuesRef.current
          const currentVenues = stableVenues

          const changedVenues = currentVenues.filter((venue) => {
            const previousVenue = previousVenues.find((p) => p.id === venue.id)
            return !previousVenue || JSON.stringify(previousVenue) !== JSON.stringify(venue)
          })

          const removedVenueIds = previousVenues
            .filter((prev) => !currentVenues.find((curr) => curr.id === prev.id))
            .map((venue) => venue.id)

          removedVenueIds.forEach((venueId) => {
            const marker = markersRef.current.get(venueId)
            if (marker) {
              marker.map = null
              markersRef.current.delete(venueId)
            }
            if (currentlyOpenVenueRef.current === venueId) {
              currentlyOpenVenueRef.current = null
            }
          })

          for (const venue of changedVenues) {
            await updateMarker(venue)
          }

          previousVenuesRef.current = [...currentVenues]

          if (previousVenues.length === 0 && currentVenues.length > 0) {
            const venuesWithCoords = currentVenues.filter((venue) => venue.latitude != null && venue.longitude != null)

            if (venuesWithCoords.length > 0) {
              const bounds = new window.google.maps.LatLngBounds()
              venuesWithCoords.forEach((venue) => {
                bounds.extend({ lat: venue.latitude!, lng: venue.longitude! })
              })

              if (venuesWithCoords.length === 1) {
                mapInstanceRef.current.setCenter({
                  lat: venuesWithCoords[0].latitude!,
                  lng: venuesWithCoords[0].longitude!,
                })
                mapInstanceRef.current.setZoom(12)
              } else {
                mapInstanceRef.current.fitBounds(bounds)
              }
            }
          }
        } catch (err) {
          console.error("Error rendering venue map:", err)
          setError("Failed to render venues on map")
        }
      }

      initializeMap()
    }, [isLoaded, stableVenues, stableAreas, updateMarker])

    if (error) {
      return (
        <div className={`${className} bg-gray-100 border border-gray-300 rounded flex items-center justify-center`}>
          <div className="text-center text-gray-600">
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )
    }

    if (!isLoaded) {
      return (
        <div className={`${className} bg-gray-100 border border-gray-300 rounded flex items-center justify-center`}>
          <div className="text-center text-gray-600">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
            <p className="text-sm">Loading map...</p>
          </div>
        </div>
      )
    }

    return <div ref={mapRef} className={className} />
  },
)

function getContrastColor(hexColor: string): string {
  const color = hexColor.replace("#", "")
  const r = Number.parseInt(color.substr(0, 2), 16)
  const g = Number.parseInt(color.substr(2, 2), 16)
  const b = Number.parseInt(color.substr(4, 2), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#000000" : "#ffffff"
}

VenueMap.displayName = "VenueMap"
