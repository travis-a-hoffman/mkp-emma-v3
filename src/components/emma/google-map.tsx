"use client"

import { useEffect, useRef, useState } from "react"

interface GoogleMapProps {
  geoPolygon: any
  className?: string
}

declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

export function GoogleMap({ geoPolygon, className = "w-full aspect-video" }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      setError("Google Maps API key not configured. Please set VITE_GOOGLE_MAPS_API_KEY environment variable.")
      return
    }

    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      setIsLoaded(true)
      return
    }

    // Load Google Maps script
    const script = document.createElement("script")
    script.async = true
    script.defer = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`

    script.onload = () => {
      setIsLoaded(true)
    }

    script.onerror = () => {
      setError("Failed to load Google Maps")
    }

    document.head.appendChild(script)

    return () => {
      // Cleanup script if component unmounts
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !geoPolygon) return

    try {
      // Initialize map
      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 10,
        center: { lat: 39.8283, lng: -98.5795 }, // Center of US as default
        mapTypeId: "roadmap",
      })

      const bounds = new window.google.maps.LatLngBounds()

      // Parse GeoJSON and add to map
      if (geoPolygon.type === "Polygon" && geoPolygon.coordinates) {
        const coordinates = geoPolygon.coordinates[0] // First ring of polygon
        const polygonCoords = coordinates.map((coord: [number, number]) => ({
          lat: coord[1], // GeoJSON uses [lng, lat], Google Maps uses {lat, lng}
          lng: coord[0],
        }))

        // Create polygon
        const polygon = new window.google.maps.Polygon({
          paths: polygonCoords,
          strokeColor: "#FF0000",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#FF0000",
          fillOpacity: 0.35,
        })

        polygon.setMap(map)

        polygonCoords.forEach((coord: { lat: number; lng: number }) => {
          bounds.extend(coord)
        })
      } else if (geoPolygon.type === "FeatureCollection") {
        // Handle FeatureCollection
        geoPolygon.features.forEach((feature: any) => {
          if (feature.geometry.type === "Polygon") {
            const coordinates = feature.geometry.coordinates[0]
            const polygonCoords = coordinates.map((coord: [number, number]) => ({
              lat: coord[1],
              lng: coord[0],
            }))

            const polygon = new window.google.maps.Polygon({
              paths: polygonCoords,
              strokeColor: "#FF0000",
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: "#FF0000",
              fillOpacity: 0.35,
            })

            polygon.setMap(map)

            polygonCoords.forEach((coord: { lat: number; lng: number }) => {
              bounds.extend(coord)
            })
          }
        })
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds)
      }
    } catch (err) {
      console.error("[v0] Error rendering map:", err)
      setError("Failed to render geographic data on map")
    }
  }, [isLoaded, geoPolygon])

  if (error) {
    return (
      <div className={`${className} bg-gray-100 border border-gray-300 rounded flex items-center justify-center`}>
        <div className="text-center text-gray-600">
          <p className="text-sm">{error}</p>
          <p className="text-xs mt-1">Showing raw data instead:</p>
          <pre className="text-xs mt-2 bg-white p-2 rounded max-h-32 overflow-auto">
            {JSON.stringify(geoPolygon, null, 2)}
          </pre>
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
}
