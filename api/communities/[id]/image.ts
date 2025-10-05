import type { VercelRequest, VercelResponse } from "@vercel/node"
import { put, del } from "@vercel/blob"
import { supabase, isSupabaseConfigured } from "../../_lib/supabase.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (!isSupabaseConfigured) {
    return res.status(500).json({
      success: false,
      error: "Database not configured",
    })
  }

  const { method, query } = req
  const communityId = query.id as string

  if (!communityId) {
    return res.status(400).json({
      success: false,
      error: "Community ID is required",
    })
  }

  try {
    switch (method) {
      case "POST":
        console.log(`[v0] POST /api/communities/${communityId}/image - Uploading community image`)

        // Get community to verify it exists
        const { data: community, error: fetchError } = await supabase
          .from("communities")
          .select("id, image_url")
          .eq("id", communityId)
          .single()

        if (fetchError) {
          console.error("[v0] Error fetching community:", fetchError)
          return res.status(404).json({
            success: false,
            error: "Community not found",
          })
        }

        const { imageData, x = 0, y = 0, zoom = 1 } = req.body

        if (!imageData) {
          return res.status(400).json({
            success: false,
            error: "Image data is required",
          })
        }

        // Convert base64 to buffer
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "")
        const buffer = Buffer.from(base64Data, "base64")

        // Upload to Vercel Blob
        const filename = `community-${communityId}-${Date.now()}.jpg`
        const blob = await put(filename, buffer, {
          access: "public",
          contentType: "image/jpeg",
        })

        // Delete old image if it exists
        if (community.image_url) {
          try {
            await del(community.image_url)
          } catch (deleteError) {
            console.warn("[v0] Failed to delete old image:", deleteError)
          }
        }

        // Create image URL with positioning parameters
        const imageUrl = `${blob.url}?x=${x}&y=${y}&zoom=${zoom}`

        // Update community with new image URL
        const { error: updateError } = await supabase
          .from("communities")
          .update({
            image_url: imageUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", communityId)

        if (updateError) {
          console.error("[v0] Error updating community:", updateError)
          return res.status(500).json({
            success: false,
            error: "Failed to update community image",
          })
        }

        return res.json({
          success: true,
          data: { image_url: imageUrl },
          message: "Community image uploaded successfully",
        })

      case "DELETE":
        console.log(`[v0] DELETE /api/communities/${communityId}/image - Deleting community image`)

        // Get community to verify it exists and get current image URL
        const { data: communityToDelete, error: fetchDeleteError } = await supabase
          .from("communities")
          .select("id, image_url")
          .eq("id", communityId)
          .single()

        if (fetchDeleteError) {
          console.error("[v0] Error fetching community:", fetchDeleteError)
          return res.status(404).json({
            success: false,
            error: "Community not found",
          })
        }

        if (communityToDelete.image_url) {
          try {
            // Extract the base URL without positioning parameters
            const baseUrl = communityToDelete.image_url.split("?")[0]
            await del(baseUrl)
          } catch (deleteError) {
            console.warn("[v0] Failed to delete image from blob storage:", deleteError)
          }
        }

        // Update community to remove image URL
        const { error: removeError } = await supabase
          .from("communities")
          .update({
            image_url: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", communityId)

        if (removeError) {
          console.error("[v0] Error removing community image:", removeError)
          return res.status(500).json({
            success: false,
            error: "Failed to remove community image",
          })
        }

        return res.json({
          success: true,
          message: "Community image deleted successfully",
        })

      default:
        res.setHeader("Allow", ["POST", "DELETE"])
        return res.status(405).json({
          success: false,
          error: `Method ${method} not allowed`,
        })
    }
  } catch (error) {
    console.error("[v0] Server error:", error)
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    })
  }
}
