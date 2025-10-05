import type { NextApiRequest, NextApiResponse } from "next"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"

// Validation schemas
const TransactionSchema = z.object({
  log_id: z.string().uuid(),
  payor_person_id: z.string().uuid().nullable().optional(),
  payor_name: z.string().optional(),
  payee_person_id: z.string().uuid().nullable().optional(),
  payee_name: z.string().optional(),
  type: z.enum(["Payment", "Refund", "Expense", "Reimbursement"]),
  name: z.string().min(1),
  details: z.string().optional(),
  data: z.any().optional(),
  amount: z.number().int().positive(),
  method: z.enum(["Cash", "Check", "Credit", "Debit", "Transfer", "Other"]),
  ordering: z.number().int().positive(),
  happened_at: z.string().datetime().optional(),
})

const BulkTransactionSchema = z.array(TransactionSchema)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
      error: "Database not configured",
    })
  }

  const { log } = req.query

  try {
    if (req.method === "GET") {
      let query = supabase.from("transaction_logs").select(`
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
        happened_at,
        payor:people!payor_person_id(id, first_name, middle_name, last_name, photo_url),
        payee:people!payee_person_id(id, first_name, middle_name, last_name, photo_url)
      `)

      // Filter by log_id if provided
      if (log) {
        query = query.eq("log_id", log).order("ordering", { ascending: true })
      } else {
        query = query.order("created_at", { ascending: false })
      }

      const { data, error, count } = await query

      if (error) {
        console.error("[v0] Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to fetch transactions",
          details: error,
        })
      }

      return res.status(200).json({
        success: true,
        data: data || [],
        count: count || data?.length || 0,
      })
    }

    if (req.method === "POST") {
      console.log("[v0] POST /api/transactions received body:", JSON.stringify(req.body, null, 2))

      // Handle bulk operations with log parameter
      if (log) {
        const validation = BulkTransactionSchema.safeParse(req.body)
        if (!validation.success) {
          console.log("[v0] Bulk validation failed:", validation.error.errors)
          return res.status(400).json({
            success: false,
            error: "Invalid transaction data",
            details: validation.error.errors,
          })
        }

        const transactions = validation.data.map((transaction) => ({
          ...transaction,
          log_id: log as string,
        }))

        const { data, error } = await supabase
          .from("transaction_logs")
          .insert(transactions)
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
            happened_at
          `)

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(500).json({
            success: false,
            error: "Failed to create transactions",
            details: error,
          })
        }

        return res.status(201).json({
          success: true,
          data: data,
          message: `Created ${data?.length || 0} transactions`,
        })
      } else {
        // Single transaction creation
        const validation = TransactionSchema.safeParse(req.body)
        if (!validation.success) {
          console.log("[v0] Single transaction validation failed:", validation.error.errors)
          console.log("[v0] Received data:", JSON.stringify(req.body, null, 2))
          return res.status(400).json({
            success: false,
            error: "Invalid transaction data",
            details: validation.error.errors,
          })
        }

        const { data, error } = await supabase
          .from("transaction_logs")
          .insert([validation.data])
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
            happened_at
          `)
          .single()

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(500).json({
            success: false,
            error: "Failed to create transaction",
            details: error,
          })
        }

        return res.status(201).json({
          success: true,
          data: data,
          message: "Transaction created successfully",
        })
      }
    }

    if (req.method === "PUT") {
      // Handle bulk updates with log parameter
      if (log) {
        const validation = BulkTransactionSchema.safeParse(req.body)
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Invalid transaction data",
            details: validation.error.errors,
          })
        }

        // Delete existing transactions for this log
        await supabase.from("transaction_logs").delete().eq("log_id", log)

        // Insert new transactions
        const transactions = validation.data.map((transaction) => ({
          ...transaction,
          log_id: log as string,
        }))

        const { data, error } = await supabase
          .from("transaction_logs")
          .insert(transactions)
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
            happened_at
          `)

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(500).json({
            success: false,
            error: "Failed to update transactions",
            details: error,
          })
        }

        return res.status(200).json({
          success: true,
          data: data,
          message: `Updated ${data?.length || 0} transactions`,
        })
      } else {
        return res.status(400).json({
          success: false,
          error: "Bulk update requires log parameter",
        })
      }
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
