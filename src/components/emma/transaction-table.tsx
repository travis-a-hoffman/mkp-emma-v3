"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ChevronUp,
  ChevronDown,
  Pencil,
  Check,
  X,
  Plus,
  Trash,
  User,
  BanknoteIcon,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import type { Transaction } from "@/src/types/transaction"
import { EmmaPersonModal } from "./person-modal"
import { EmmaPersonDisplay } from "./person-display"
import type { Person } from "@/src/types/person"

interface EmmaTransactionTableProps {
  transactions: Transaction[]
  onUpdate?: (transaction: Transaction) => void
  onDelete?: (transactionId: string) => void
  onCreate?: (transaction: Omit<Transaction, "id" | "created_at" | "updated_at">) => void
  readOnly?: boolean
  showActions?: boolean
  title?: string
}

type SortField = keyof Transaction
type SortDirection = "asc" | "desc"

export function EmmaTransactionTable({
  transactions,
  onUpdate,
  onDelete,
  onCreate,
  readOnly = false,
  showActions = true,
  title = "Transactions",
}: EmmaTransactionTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<Partial<Transaction>>({})
  const [sortField, setSortField] = useState<SortField>("happened_at")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [searchTerm, setSearchTerm] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    type: "Payment",
    method: "Cash",
    amount: 0,
    ordering: 1,
  })
  const [people, setPeople] = useState<Person[]>([])
  const [payorModalOpen, setPayorModalOpen] = useState(false)
  const [payeeModalOpen, setPayeeModalOpen] = useState(false)
  const [editingPayorModalOpen, setEditingPayorModalOpen] = useState(false)
  const [editingPayeeModalOpen, setEditingPayeeModalOpen] = useState(false)

  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const response = await fetch("/api/people?active=true")
        if (response.ok) {
          const data = await response.json()
          setPeople(data.data || [])
        }
      } catch (error) {
        console.error("[v0] Error fetching people:", error)
      }
    }
    fetchPeople()
  }, [])

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const sortedAndFilteredTransactions = useMemo(() => {
    const filtered = transactions.filter(
      (transaction) =>
        transaction.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.payor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.payee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.details?.toLowerCase().includes(searchTerm.toLowerCase()),
    )

    return filtered.sort((a, b) => {
      let aValue = a[sortField]
      let bValue = b[sortField]

      if (sortField === "created_at" || sortField === "updated_at" || sortField === "happened_at") {
        aValue = new Date(aValue as string).getTime()
        bValue = new Date(bValue as string).getTime()
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })
  }, [transactions, searchTerm, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingId(transaction.id)
    setEditingData({ ...transaction })
  }

  const handleSave = () => {
    if (editingId && editingData && onUpdate) {
      onUpdate(editingData as Transaction)
    }
    setEditingId(null)
    setEditingData({})
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditingData({})
  }

  const handleCreate = () => {
    if (
      onCreate &&
      newTransaction.name &&
      (newTransaction.payor_name || newTransaction.payor_person_id) &&
      (newTransaction.payee_name || newTransaction.payee_person_id)
    ) {
      onCreate(newTransaction as Omit<Transaction, "id" | "created_at" | "updated_at">)
      setNewTransaction({
        type: "Payment",
        method: "Cash",
        amount: 0,
        ordering: 1,
      })
      setShowCreateForm(false)
    }
  }

  const handlePayorSelect = (person: Person | null) => {
    setNewTransaction({
      ...newTransaction,
      payor_person_id: person?.id || null,
      payor_name: person ? `${person.first_name} ${person.last_name}` : "",
    })
    setPayorModalOpen(false)
  }

  const handlePayeeSelect = (person: Person | null) => {
    setNewTransaction({
      ...newTransaction,
      payee_person_id: person?.id || null,
      payee_name: person ? `${person.first_name} ${person.last_name}` : "",
    })
    setPayeeModalOpen(false)
  }

  const handleEditingPayorSelect = (person: Person | null) => {
    setEditingData({
      ...editingData,
      payor_person_id: person?.id || null,
      payor_name: person ? `${person.first_name} ${person.last_name}` : "",
    })
    setEditingPayorModalOpen(false)
  }

  const handleEditingPayeeSelect = (person: Person | null) => {
    setEditingData({
      ...editingData,
      payee_person_id: person?.id || null,
      payee_name: person ? `${person.first_name} ${person.last_name}` : "",
    })
    setEditingPayeeModalOpen(false)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
  }

  const TransactionTypeIcon = ({ type }: { type: "Payment" | "Refund" | "Expense" | "Reimbursement" }) => {
    if (type === "Payment" || type === "Reimbursement") {
      return (
        <div className="flex items-center justify-center" title={type}>
          <div className="relative">
            <BanknoteIcon className="w-5 h-5 text-green-600" />
            <ArrowDown className="w-3 h-3 text-green-600 absolute -top-1 -right-1" />
          </div>
        </div>
      )
    } else {
      return (
        <div className="flex items-center justify-center" title={type}>
          <div className="relative">
            <BanknoteIcon className="w-5 h-5 text-red-600" />
            <ArrowUp className="w-3 h-3 text-red-600 absolute -top-1 -right-1" />
          </div>
        </div>
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
            {!readOnly && onCreate && (
              <Button onClick={() => setShowCreateForm(true)} size="sm" className="flex items-center gap-1">
                <Plus className="w-4 h-4" />
                Add Transaction
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showCreateForm && !readOnly && (
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <h4 className="font-medium mb-3">Create New Transaction</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Transaction Type</label>
                <Select
                  value={newTransaction.type}
                  onValueChange={(value) =>
                    setNewTransaction({ ...newTransaction, type: value as Transaction["type"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Payment">Payment</SelectItem>
                    <SelectItem value="Refund">Refund</SelectItem>
                    <SelectItem value="Expense">Expense</SelectItem>
                    <SelectItem value="Reimbursement">Reimbursement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Method</label>
                <Select
                  value={newTransaction.method}
                  onValueChange={(value) =>
                    setNewTransaction({ ...newTransaction, method: value as Transaction["method"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Check">Check</SelectItem>
                    <SelectItem value="Credit">Credit</SelectItem>
                    <SelectItem value="Debit">Debit</SelectItem>
                    <SelectItem value="Transfer">Transfer</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  value={newTransaction.name || ""}
                  onChange={(e) => setNewTransaction({ ...newTransaction, name: e.target.value })}
                  placeholder="Transaction name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={newTransaction.amount ? (newTransaction.amount / 100).toFixed(2) : ""}
                  onChange={(e) =>
                    setNewTransaction({
                      ...newTransaction,
                      amount: Math.round(Number.parseFloat(e.target.value || "0") * 100),
                    })
                  }
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payor</label>
                <div className="flex gap-2">
                  <Input
                    value={newTransaction.payor_name || ""}
                    onChange={(e) =>
                      setNewTransaction({ ...newTransaction, payor_name: e.target.value, payor_person_id: null })
                    }
                    placeholder="Payor name or select person"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPayorModalOpen(true)}
                    className="px-3"
                  >
                    <User className="w-4 h-4" />
                  </Button>
                </div>
                {newTransaction.payor_person_id && (
                  <div className="mt-1">
                    <EmmaPersonDisplay
                      personId={newTransaction.payor_person_id}
                      people={people}
                      showAvatar={true}
                      size="w-6 h-6"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payee</label>
                <div className="flex gap-2">
                  <Input
                    value={newTransaction.payee_name || ""}
                    onChange={(e) =>
                      setNewTransaction({ ...newTransaction, payee_name: e.target.value, payee_person_id: null })
                    }
                    placeholder="Payee name or select person"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPayeeModalOpen(true)}
                    className="px-3"
                  >
                    <User className="w-4 h-4" />
                  </Button>
                </div>
                {newTransaction.payee_person_id && (
                  <div className="mt-1">
                    <EmmaPersonDisplay
                      personId={newTransaction.payee_person_id}
                      people={people}
                      showAvatar={true}
                      size="w-6 h-6"
                    />
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Details</label>
                <Textarea
                  value={newTransaction.details || ""}
                  onChange={(e) => setNewTransaction({ ...newTransaction, details: e.target.value })}
                  placeholder="Additional details..."
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Transaction Date</label>
                <Input
                  type="datetime-local"
                  value={
                    newTransaction.happened_at ? new Date(newTransaction.happened_at).toISOString().slice(0, 16) : ""
                  }
                  onChange={(e) =>
                    setNewTransaction({
                      ...newTransaction,
                      happened_at: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    })
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create Transaction</Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none w-16" onClick={() => handleSort("type")}>
                  <div className="flex items-center gap-1">
                    Type
                    <SortIcon field="type" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-1">
                    Name
                    <SortIcon field="name" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("payor_name")}>
                  <div className="flex items-center gap-1">
                    Payor
                    <SortIcon field="payor_name" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("payee_name")}>
                  <div className="flex items-center gap-1">
                    Payee
                    <SortIcon field="payee_name" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("amount")}>
                  <div className="flex items-center gap-1">
                    Amount
                    <SortIcon field="amount" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("method")}>
                  <div className="flex items-center gap-1">
                    Method
                    <SortIcon field="method" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("happened_at")}>
                  <div className="flex items-center gap-1">
                    Date
                    <SortIcon field="happened_at" />
                  </div>
                </TableHead>
                {showActions && !readOnly && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAndFilteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    <TransactionTypeIcon type={transaction.type} />
                  </TableCell>
                  <TableCell>
                    {editingId === transaction.id ? (
                      <Input
                        value={editingData.name || ""}
                        onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                        className="w-full"
                      />
                    ) : (
                      <div>
                        <div className="font-medium">{transaction.name}</div>
                        {transaction.details && <div className="text-sm text-gray-500">{transaction.details}</div>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === transaction.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editingData.payor_name || ""}
                          onChange={(e) =>
                            setEditingData({ ...editingData, payor_name: e.target.value, payor_person_id: null })
                          }
                          className="flex-1"
                          placeholder="Payor name"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingPayorModalOpen(true)}
                          className="px-2"
                        >
                          <User className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        {transaction.payor_person_id ? (
                          <EmmaPersonDisplay
                            personId={transaction.payor_person_id}
                            people={people}
                            showAvatar={true}
                            size="w-6 h-6"
                          />
                        ) : (
                          <span>{transaction.payor_name}</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === transaction.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editingData.payee_name || ""}
                          onChange={(e) =>
                            setEditingData({ ...editingData, payee_name: e.target.value, payee_person_id: null })
                          }
                          className="flex-1"
                          placeholder="Payee name"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingPayeeModalOpen(true)}
                          className="px-2"
                        >
                          <User className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        {transaction.payee_person_id ? (
                          <EmmaPersonDisplay
                            personId={transaction.payee_person_id}
                            people={people}
                            showAvatar={true}
                            size="w-6 h-6"
                          />
                        ) : (
                          <span>{transaction.payee_name}</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === transaction.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editingData.amount ? (editingData.amount / 100).toFixed(2) : ""}
                        onChange={(e) =>
                          setEditingData({
                            ...editingData,
                            amount: Math.round(Number.parseFloat(e.target.value || "0") * 100),
                          })
                        }
                        className="w-24"
                      />
                    ) : (
                      <span className="font-mono">{formatCurrency(transaction.amount)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === transaction.id ? (
                      <Select
                        value={editingData.method}
                        onValueChange={(value) =>
                          setEditingData({ ...editingData, method: value as Transaction["method"] })
                        }
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Check">Check</SelectItem>
                          <SelectItem value="Credit">Credit</SelectItem>
                          <SelectItem value="Debit">Debit</SelectItem>
                          <SelectItem value="Transfer">Transfer</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{transaction.method}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === transaction.id ? (
                      <Input
                        type="datetime-local"
                        value={
                          editingData.happened_at ? new Date(editingData.happened_at).toISOString().slice(0, 16) : ""
                        }
                        onChange={(e) =>
                          setEditingData({
                            ...editingData,
                            happened_at: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                          })
                        }
                        className="w-40"
                      />
                    ) : (
                      <span className="text-sm text-gray-500">
                        {transaction.happened_at ? formatDate(transaction.happened_at) : "Not set"}
                      </span>
                    )}
                  </TableCell>
                  {showActions && !readOnly && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {editingId === transaction.id ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={handleSave} className="h-8 w-8 p-0">
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancel} className="h-8 w-8 p-0">
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(transaction)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {onDelete && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onDelete(transaction.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              >
                                <Trash className="w-4 h-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {sortedAndFilteredTransactions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? "No transactions match your search." : "No transactions found."}
          </div>
        )}

        <EmmaPersonModal
          isOpen={payorModalOpen}
          onClose={() => setPayorModalOpen(false)}
          onPersonSelect={handlePayorSelect}
          title="Select Payor"
        />

        <EmmaPersonModal
          isOpen={payeeModalOpen}
          onClose={() => setPayeeModalOpen(false)}
          onPersonSelect={handlePayeeSelect}
          title="Select Payee"
        />

        <EmmaPersonModal
          isOpen={editingPayorModalOpen}
          onClose={() => setEditingPayorModalOpen(false)}
          onPersonSelect={handleEditingPayorSelect}
          title="Select Payor"
        />

        <EmmaPersonModal
          isOpen={editingPayeeModalOpen}
          onClose={() => setEditingPayeeModalOpen(false)}
          onPersonSelect={handleEditingPayeeSelect}
          title="Select Payee"
        />
      </CardContent>
    </Card>
  )
}
