/**
 * Geolocation API Endpoint
 *
 * This endpoint provides IP-based geolocation data using Vercel's automatic
 * geolocation headers. When a request is received by Vercel Functions, Vercel
 * automatically enriches the request with geolocation headers based on the
 * client's IP address.
 *
 * Available Vercel Geolocation Headers:
 * - x-vercel-ip-latitude: Latitude coordinate (e.g., "37.7749")
 * - x-vercel-ip-longitude: Longitude coordinate (e.g., "-122.4194")
 * - x-vercel-ip-city: City name (e.g., "San Francisco")
 * - x-vercel-ip-country-region: State/province code (e.g., "CA", "NY")
 * - x-vercel-ip-country: 2-letter country code (e.g., "US")
 * - x-vercel-ip-postal-code: Postal/ZIP code (e.g., "94102")
 * - x-vercel-ip-timezone: Timezone (e.g., "America/Los_Angeles")
 *
 * Why read headers directly instead of using @vercel/functions?
 * - @vercel/functions geolocation() expects Request type, but Vercel serverless
 *   functions use VercelRequest type from @vercel/node
 * - Type conversion is complex and adds unnecessary overhead
 * - Reading headers directly is simple, maintainable, and matches our existing API pattern
 * - The @vercel/functions geolocation helper is just a wrapper around these headers
 *
 * Important Notes:
 * - Geolocation headers are ONLY available in production (after deployment)
 * - Local development will not have these headers set
 * - This feature is available on all Vercel plans (Hobby, Pro, Enterprise)
 * - Accuracy is city-level (~5-50km radius), not precise GPS location
 *
 * References:
 * - https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package
 * - https://vercel.com/guides/geo-ip-headers-geolocation-vercel-functions
 * - https://vercel.com/changelog/enhanced-geolocation-information-available-for-vercel-functions
 */

import type { VercelRequest, VercelResponse } from "@vercel/node"

interface LocationData {
  latitude: string | null
  longitude: string | null
  city: string | null
  state: string | null
  accuracy: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    })
  }

  try {
    // Extract geolocation data from Vercel's automatic headers
    // These headers are automatically added by Vercel's infrastructure
    const latitude = req.headers["x-vercel-ip-latitude"] as string | undefined
    const longitude = req.headers["x-vercel-ip-longitude"] as string | undefined
    const city = req.headers["x-vercel-ip-city"] as string | undefined
    const state = req.headers["x-vercel-ip-country-region"] as string | undefined

    // Create location data object
    const locationData: LocationData = {
      latitude: latitude || null,
      longitude: longitude || null,
      city: city || null,
      state: state || null, // State/province code (e.g., "CA", "NY")
      accuracy: "ip", // IP-based geolocation (city-level accuracy)
    }

    // Set cookie with location data (24 hours expiration)
    const cookieValue = JSON.stringify(locationData)
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString()

    res.setHeader(
      "Set-Cookie",
      `emma_location=${encodeURIComponent(cookieValue)}; Path=/; Expires=${expires}; SameSite=Lax`,
    )

    // Return location data in response
    return res.status(200).json({
      success: true,
      data: locationData,
    })
  } catch (error) {
    console.error("[v0] Geolocation error:", error)
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve geolocation",
    })
  }
}
