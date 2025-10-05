import type { VercelRequest, VercelResponse } from "@vercel/node"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
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

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`,
    })
  }

  try {
    const { log } = req.query

    // Get total transaction count
    let totalQuery = supabase.from("transaction_logs").select("*", { count: "exact", head: true })
    if (log) {
      totalQuery = totalQuery.eq("log_id", log)
    }
    const { count: totalTransactions, error: totalError } = await totalQuery

    if (totalError) throw totalError

    // Get payment count
    let paymentQuery = supabase
      .from("transaction_logs")
      .select("*", { count: "exact", head: true })
      .eq("type", "Payment")
    if (log) {
      paymentQuery = paymentQuery.eq("log_id", log)
    }
    const { count: paymentCount, error: paymentError } = await paymentQuery

    if (paymentError) throw paymentError

    // Get refund count
    let refundQuery = supabase.from("transaction_logs").select("*", { count: "exact", head: true }).eq("type", "Refund")
    if (log) {
      refundQuery = refundQuery.eq("log_id", log)
    }
    const { count: refundCount, error: refundError } = await refundQuery

    if (refundError) throw refundError

    // Get expense count
    let expenseQuery = supabase
      .from("transaction_logs")
      .select("*", { count: "exact", head: true })
      .eq("type", "Expense")
    if (log) {
      expenseQuery = expenseQuery.eq("log_id", log)
    }
    const { count: expenseCount, error: expenseError } = await expenseQuery

    if (expenseError) throw expenseError

    // Get reimbursement count
    let reimbursementQuery = supabase
      .from("transaction_logs")
      .select("*", { count: "exact", head: true })
      .eq("type", "Reimbursement")
    if (log) {
      reimbursementQuery = reimbursementQuery.eq("log_id", log)
    }
    const { count: reimbursementCount, error: reimbursementError } = await reimbursementQuery

    if (reimbursementError) throw reimbursementError

    // Get transaction data for financial calculations
    let dataQuery = supabase.from("transaction_logs").select("amount, type, method, payor_name, payor_person_id")
    if (log) {
      dataQuery = dataQuery.eq("log_id", log)
    }
    const { data: transactionData, error: dataError } = await dataQuery

    if (dataError) throw dataError

    let eventData = null
    if (log) {
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select(
          "staff_capacity, staff_cost, participant_capacity, participant_cost, committed_staff, committed_participants",
        )
        .eq("transaction_log_id", log)
        .single()

      if (eventError) {
        console.error("Error fetching event data:", eventError)
      } else {
        eventData = event
      }
    }

    // Calculate financial statistics
    const totalAmount =
      transactionData?.reduce((sum: number, t: any) => {
        return sum + (t.type === "Payment" || t.type === "Reimbursement" ? t.amount : -t.amount)
      }, 0) || 0

    const totalInflows =
      transactionData
        ?.filter((t: any) => t.type === "Payment" || t.type === "Reimbursement")
        .reduce((sum: number, t: any) => sum + t.amount, 0) || 0
    const totalOutflows =
      transactionData
        ?.filter((t: any) => t.type === "Refund" || t.type === "Expense")
        .reduce((sum: number, t: any) => sum + t.amount, 0) || 0

    const averageTransactionSize = totalTransactions ? Math.round(totalAmount / totalTransactions) : 0

    // Calculate per-payor statistics
    const payorStats =
      transactionData?.reduce((acc: Record<string, { count: number; total: number }>, transaction: any) => {
        if (transaction.type === "Payment" || transaction.type === "Reimbursement") {
          const payorKey = transaction.payor_person_id || transaction.payor_name || "Unknown"
          if (!acc[payorKey]) {
            acc[payorKey] = { count: 0, total: 0 }
          }
          acc[payorKey].count += 1
          acc[payorKey].total += transaction.amount
        }
        return acc
      }, {}) || {}

    // Calculate method breakdown
    const methodBreakdown =
      transactionData?.reduce((acc: Record<string, number>, transaction: any) => {
        acc[transaction.method] = (acc[transaction.method] || 0) + 1
        return acc
      }, {}) || {}

    let paymentCalculations = {}
    if (log && eventData) {
      const collectedPayments =
        transactionData
          ?.filter((t: any) => t.type === "Payment")
          .reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0

      const expectedStaffPayments =
        (eventData.staff_capacity || eventData.committed_staff?.length || 0) * (eventData.staff_cost || 0)

      const expectedParticipantPayments =
        (eventData.participant_capacity || eventData.committed_participants?.length || 0) *
        (eventData.participant_cost || 0)

      const totalExpectedPayments = expectedStaffPayments + expectedParticipantPayments
      const remainingPayments = Math.max(0, totalExpectedPayments - collectedPayments)

      paymentCalculations = {
        expectedStaffPayments,
        expectedParticipantPayments,
        totalExpectedPayments,
        collectedPayments,
        remainingPayments,
      }
    }

    const responseData = {
      // Standard stats format for consistency
      active: paymentCount || 0,
      inactive: refundCount || 0,
      total: totalTransactions || 0,

      // Financial summary
      financial: {
        total_amount: totalAmount,
        total_inflows: totalInflows,
        total_outflows: totalOutflows,
        average_transaction_size: averageTransactionSize,
        net_amount: totalInflows - totalOutflows,
      },

      // Transaction type breakdown
      by_type: {
        Payment: paymentCount || 0,
        Refund: refundCount || 0,
        Expense: expenseCount || 0,
        Reimbursement: reimbursementCount || 0,
      },

      // Payment method breakdown
      by_method: methodBreakdown,

      // Per-payor statistics
      by_payor: payorStats,

      ...(log && eventData ? { payments: paymentCalculations } : {}),
    }

    return res.status(200).json({
      success: true,
      data: responseData,
    })
  } catch (error) {
    console.error("Error fetching transaction stats:", error)
    return res.status(500).json({
      success: false,
      error: "Failed to fetch transaction stats",
    })
  }
}
