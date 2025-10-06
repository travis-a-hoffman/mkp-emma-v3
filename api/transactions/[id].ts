import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"

const UpdateTransactionSchema = z.object({
  log_id: z.string().uuid().optional(),
  payor_person_id: z.string().uuid().nullable().optional(),
  payor_name: z.string().optional(),
  payee_person_id: z.string().uuid().nullable().optional(),
  payee_name: z.string().optional(),
  type: z.enum(["Payment", "Refund", "Expense", "Reimbursement"]).optional(),
  name: z.string().min(1).optional(),
  details: z.string().optional(),
  data: z.any().optional(),
  amount: z.number().int().positive().optional(),
  method: z.enum(["Cash", "Check", "Credit", "Debit", "Transfer", "Other"]).optional(),
  ordering: z.number().int().positive().optional(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (!isSupabaseConfigured) {
    return res.status(500).json({
      success: false,
      error: "Database configuration missing",
    })
  }

  const { id } = req.query

  if (!id || typeof id !== "string") {
    return res.status(400).json({
      success: false,
      error: "Transaction ID is required",
    })
  }

  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("transaction_logs")
        .select(`
          id,
          log_id,
          payor_person_id,
          payor_name,
          payee_person_id,
          payee_name,
          type,
          name,
          details,
          data,
          amount,
          method,
          ordering,
          created_at,
          updated_at,
          payor:people!payor_person_id(id, first_name, middle_name, last_name, photo_url),
          payee:people!payee_person_id(id, first_name, middle_name, last_name, photo_url)
        `)
        .eq("id", id)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({
            success: false,
            error: "Transaction not found",
          })
        }
        console.error("[v0] Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to fetch transaction",
          details: error,
        })
      }

      return res.status(200).json({
        success: true,
        data: data,
      })
    }

    if (req.method === "PUT") {
      const validation = UpdateTransactionSchema.safeParse(req.body)
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid transaction data",
          details: validation.error.errors,
        })
      }

      const { data, error } = await supabase
        .from("transaction_logs")
        .update({
          ...validation.data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select(`
          id,
          log_id,
          payor_person_id,
          payor_name,
          payee_person_id,
          payee_name,
          type,
          name,
          details,
          data,
          amount,
          method,
          ordering,
          created_at,
          updated_at
        `)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({
            success: false,
            error: "Transaction not found",
          })
        }
        console.error("[v0] Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to update transaction",
          details: error,
        })
      }

      return res.status(200).json({
        success: true,
        data: data,
        message: "Transaction updated successfully",
      })
    }

    if (req.method === "DELETE") {
      const { data, error } = await supabase.from("transaction_logs").delete().eq("id", id).select("id").single()

      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({
            success: false,
            error: "Transaction not found",
          })
        }
        console.error("[v0] Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to delete transaction",
          details: error,
        })
      }

      return res.status(200).json({
        success: true,
        data: { id: data.id },
        message: "Transaction deleted successfully",
      })
    }

    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    })
  } catch (error) {
    console.error("[v0] API error:", error)
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    })
  }
}
