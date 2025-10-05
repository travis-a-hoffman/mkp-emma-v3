import { put, del } from "@vercel/blob"
import { supabase, isSupabaseConfigured } from "../../_lib/supabase.js"
import type { VercelRequest, VercelResponse } from "@vercel/node"

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
    return res.status(400).json({ error: "Area ID is required" })
  }

  try {
    if (req.method === "POST" || req.method === "PUT") {
      // Handle image upload
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

            // Validate file size (10MB limit for area images)
            if (fileBuffer.length > 10 * 1024 * 1024) {
              return res.status(400).json({ error: "File size must be less than 10MB" })
            }

            const { data: area, error: fetchError } = await supabase
              .from("areas")
              .select("image_url")
              .eq("id", id)
              .single()

            if (fetchError) {
              console.error("[v0] Error fetching area:", fetchError)
              return res.status(404).json({ error: "Area not found" })
            }

            // Delete old image if it exists
            if (area.image_url) {
              try {
                await del(area.image_url)
              } catch (deleteError) {
                console.error("[v0] Error deleting old image:", deleteError)
                // Continue with upload even if delete fails
              }
            }

            const fileExtension = filename.split(".").pop() || "jpg"
            const uniqueFilename = `areas/${id}/image-${Date.now()}.${fileExtension}`

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

            const { error: updateError } = await supabase
              .from("areas")
              .update({
                image_url: finalUrl,
                updated_at: new Date().toISOString(),
              })
              .eq("id", id)

            if (updateError) {
              console.error("[v0] Error updating area image URL:", updateError)
              // Try to clean up uploaded file
              try {
                await del(blob.url)
              } catch (cleanupError) {
                console.error("[v0] Error cleaning up uploaded file:", cleanupError)
              }
              return res.status(500).json({ error: "Failed to update area record" })
            }

            return res.status(200).json({
              url: finalUrl,
              filename: uniqueFilename,
              size: fileBuffer.length,
              type: fileType,
              positioning,
            })
          } catch (error) {
            console.error("[v0] Image upload error:", error)
            return res.status(500).json({ error: "Upload failed" })
          }
        })
      })
    } else if (req.method === "DELETE") {
      const { data: area, error: fetchError } = await supabase.from("areas").select("image_url").eq("id", id).single()

      if (fetchError) {
        console.error("[v0] Error fetching area:", fetchError)
        return res.status(404).json({ error: "Area not found" })
      }

      if (!area.image_url) {
        return res.status(404).json({ error: "No image to delete" })
      }

      // Delete from Vercel Blob
      await del(area.image_url)

      const { error: updateError } = await supabase
        .from("areas")
        .update({
          image_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      if (updateError) {
        console.error("[v0] Error updating area record:", updateError)
        return res.status(500).json({ error: "Failed to update area record" })
      }

      return res.status(200).json({ success: true })
    } else {
      return res.status(405).json({ error: "Method not allowed" })
    }
  } catch (error) {
    console.error("[v0] Image API error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}
