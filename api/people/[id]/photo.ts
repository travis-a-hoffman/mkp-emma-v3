import { put, del } from "@vercel/blob"
import { supabase, isSupabaseConfigured } from "../../_lib/supabase.js"
import type { VercelRequest, VercelResponse } from "@vercel/node"

interface Person {
  id: string
  first_name: string
  middle_name?: string | null
  last_name: string
  email?: string | null
  phone?: string | null
  billing_address_id?: string | null
  mailing_address_id?: string | null
  physical_address_id?: string | null
  notes?: string | null
  photo_url?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, PUT, DELETE, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (!isSupabaseConfigured) {
    return res.status(500).json({
      success: false,
      error: "Database not configured",
    })
  }

  const { id } = req.query

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Person ID is required" })
  }

  try {
    if (req.method === "POST" || req.method === "PUT") {
      // Handle photo upload
      const contentType = req.headers["content-type"] || ""

      if (!contentType.includes("multipart/form-data")) {
        return res.status(400).json({ error: "Content-Type must be multipart/form-data" })
      }

      // Parse form data manually for Vercel functions
      const chunks: Buffer[] = []
      req.on("data", (chunk) => chunks.push(chunk))

      return new Promise((resolve) => {
        req.on("end", async () => {
          try {
            const buffer = Buffer.concat(chunks)

            // Simple form data parsing for single file
            const boundary = contentType.split("boundary=")[1]
            if (!boundary) {
              return res.status(400).json({ error: "Invalid form data" })
            }

            const parts = buffer.toString("binary").split(`--${boundary}`)
            let fileBuffer: Buffer | null = null
            let filename = ""
            let fileType = ""
            let positioning = { x: 50, y: 50, zoom: 100 } // Default: centered at 100% zoom

            for (const part of parts) {
              if (part.includes('Content-Disposition: form-data; name="file"')) {
                const headerEnd = part.indexOf("\r\n\r\n")
                if (headerEnd !== -1) {
                  const headers = part.substring(0, headerEnd)
                  const filenameMatch = headers.match(/filename="([^"]*)"/)
                  const contentTypeMatch = headers.match(/Content-Type: ([^\r\n]*)/)

                  if (filenameMatch) filename = filenameMatch[1]
                  if (contentTypeMatch) fileType = contentTypeMatch[1]

                  const fileData = part.substring(headerEnd + 4, part.length - 2)
                  fileBuffer = Buffer.from(fileData, "binary")
                }
              } else if (part.includes('Content-Disposition: form-data; name="positioning"')) {
                const headerEnd = part.indexOf("\r\n\r\n")
                if (headerEnd !== -1) {
                  const positioningData = part.substring(headerEnd + 4, part.length - 2)
                  try {
                    positioning = JSON.parse(positioningData)
                  } catch (e) {
                    console.error("[v0] Error parsing positioning data:", e)
                  }
                }
              }
            }

            if (!fileBuffer || !filename) {
              return res.status(400).json({ error: "No file provided" })
            }

            // Validate file type
            if (!fileType.startsWith("image/")) {
              return res.status(400).json({ error: "File must be an image" })
            }

            // Validate file size (5MB limit)
            if (fileBuffer.length > 5 * 1024 * 1024) {
              return res.status(400).json({ error: "File size must be less than 5MB" })
            }

            // Check if person exists and get current photo URL
            const { data: person, error: fetchError } = await supabase
              .from("people")
              .select("photo_url")
              .eq("id", id)
              .single()

            if (fetchError) {
              console.error("[v0] Error fetching person:", fetchError)
              return res.status(404).json({ error: "Person not found" })
            }

            // Delete old photo if it exists
            if (person.photo_url) {
              try {
                await del(person.photo_url)
              } catch (deleteError) {
                console.error("[v0] Error deleting old photo:", deleteError)
                // Continue with upload even if delete fails
              }
            }

            // Generate unique filename
            const fileExtension = filename.split(".").pop() || "jpg"
            const uniqueFilename = `people/${id}/photo-${Date.now()}.${fileExtension}`

            // Upload to Vercel Blob
            const blob = await put(uniqueFilename, fileBuffer, {
              access: "public",
              contentType: fileType,
            })

            const urlWithPositioning = new URL(blob.url)
            urlWithPositioning.searchParams.set("x", positioning.x.toString()) // x as percentage (0-100)
            urlWithPositioning.searchParams.set("y", positioning.y.toString()) // y as percentage (0-100)
            urlWithPositioning.searchParams.set("zoom", positioning.zoom.toString()) // zoom as percentage (50-200)
            const finalUrl = urlWithPositioning.toString()

            // Update person record with new photo URL including positioning
            const { error: updateError } = await supabase
              .from("people")
              .update({
                photo_url: finalUrl,
                updated_at: new Date().toISOString(),
              })
              .eq("id", id)

            if (updateError) {
              console.error("[v0] Error updating person photo URL:", updateError)
              // Try to clean up uploaded file
              try {
                await del(blob.url)
              } catch (cleanupError) {
                console.error("[v0] Error cleaning up uploaded file:", cleanupError)
              }
              return res.status(500).json({ error: "Failed to update person record" })
            }

            return res.status(200).json({
              url: finalUrl,
              filename: uniqueFilename,
              size: fileBuffer.length,
              type: fileType,
              positioning,
            })
          } catch (error) {
            console.error("[v0] Photo upload error:", error)
            return res.status(500).json({ error: "Upload failed" })
          }
        })
      })
    } else if (req.method === "DELETE") {
      // Handle photo deletion
      const { data: person, error: fetchError } = await supabase
        .from("people")
        .select("photo_url")
        .eq("id", id)
        .single()

      if (fetchError) {
        console.error("[v0] Error fetching person:", fetchError)
        return res.status(404).json({ error: "Person not found" })
      }

      if (!person.photo_url) {
        return res.status(404).json({ error: "No photo to delete" })
      }

      // Delete from Vercel Blob
      await del(person.photo_url)

      // Update person record to remove photo URL
      const { error: updateError } = await supabase
        .from("people")
        .update({
          photo_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      if (updateError) {
        console.error("[v0] Error updating person record:", updateError)
        return res.status(500).json({ error: "Failed to update person record" })
      }

      return res.status(200).json({ success: true })
    } else {
      return res.status(405).json({ error: "Method not allowed" })
    }
  } catch (error) {
    console.error("[v0] Photo API error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}
