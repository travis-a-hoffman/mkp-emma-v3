import type { Person } from "@/src/types/person"

export interface Transaction extends TransactionBasic {
  log_id: string
  payor_person_id: string | null
  payee_person_id: string | null
  data: any
}

export interface TransactionBasic {
  id: string
  payor_name: string
  payee_name: string
  type: "Payment" | "Refund" | "Expense" | "Reimbursement"
  name: string
  details: string
  amount: number
  ordering: number
  method: "Cash" | "Check" | "Credit" | "Transfer" | "Debit" | "Other"
  created_at: string
  happened_at: string
  updated_at: string
}

export interface TransactionWithRelations extends Transaction {
  payor: Person
  payee: Person
}
