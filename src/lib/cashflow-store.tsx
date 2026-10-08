import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import { useAuth } from "./auth-provider"
import { supabase } from "./supabase"
import { toast } from "sonner" // In case they use it, or fallback to console

export interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  date: string; // ISO date string or YYYY-MM-DD
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  category: string;
  startDate: string; 
  lastProcessed: string; 
}

interface CashflowStore {
  transactions: Transaction[];
  subscriptions: Subscription[];
  currency: string | null;
  isLoading: boolean;
  addTransaction: (tx: Omit<Transaction, "id">) => Promise<void>;
  updateTransaction: (id: string, tx: Omit<Transaction, "id">) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  addSubscription: (sub: Omit<Subscription, "id" | "lastProcessed">) => Promise<void>;
  removeSubscription: (id: string) => Promise<void>;
  setCurrency: (currency: string) => Promise<void>;
  isCurrencySet: boolean;
}

const STORAGE_PREFIX = "aces-cashflow"

function getStorageKey(userId: string | undefined, suffix: string) {
  return userId ? `${STORAGE_PREFIX}-${suffix}-${userId}` : `${STORAGE_PREFIX}-${suffix}`
}

function parseJson(value: string | null): any {
  if (!value) return null
  try { return JSON.parse(value) } catch { return null }
}

const CashflowContext = createContext<CashflowStore | null>(null)

export function CashflowProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [currency, setCurrencyState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
  
  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }

  // Load from local storage initially
  useEffect(() => {
    if (!user) {
      setTransactions([])
      setSubscriptions([])
      setCurrencyState(null)
      return
    }
    const cachedTx = parseJson(localStorage.getItem(getStorageKey(user.id, 'transactions'))) || []
    const cachedSub = parseJson(localStorage.getItem(getStorageKey(user.id, 'subscriptions'))) || []
    const cachedCur = localStorage.getItem(getStorageKey(user.id, 'currency')) || null
    setTransactions(cachedTx)
    setSubscriptions(cachedSub)
    setCurrencyState(cachedCur)
  }, [user?.id])

  // Fetch API Data
  useEffect(() => {
    if (!user) return
    let isMounted = true

    const fetchData = async () => {
      setIsLoading(true)
      try {
        const token = await getAuthToken()
        if (!token) return

        const [txRes, subRes, curRes] = await Promise.all([
          fetch(`${API_URL}/cashflow/transactions`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_URL}/cashflow/subscriptions`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_URL}/cashflow/currency`, { headers: { 'Authorization': `Bearer ${token}` } })
        ])

        if (txRes.ok && isMounted) {
          const txData = await txRes.json()
          setTransactions(txData)
          localStorage.setItem(getStorageKey(user.id, 'transactions'), JSON.stringify(txData))
        }
        
        if (subRes.ok && isMounted) {
          const subData = await subRes.json()
          setSubscriptions(subData)
          localStorage.setItem(getStorageKey(user.id, 'subscriptions'), JSON.stringify(subData))
        }

        if (curRes.ok && isMounted) {
          const curData = await curRes.json()
          setCurrencyState(curData.currency)
          localStorage.setItem(getStorageKey(user.id, 'currency'), curData.currency)
        }
      } catch (err) {
        console.error("Cashflow API Fetch Error:", err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchData()
    return () => { isMounted = false }
  }, [user?.id])

  // Keep local storage synced for mutations
  useEffect(() => {
    if (!user) return
    localStorage.setItem(getStorageKey(user.id, 'transactions'), JSON.stringify(transactions))
  }, [transactions, user?.id])

  useEffect(() => {
    if (!user) return
    localStorage.setItem(getStorageKey(user.id, 'subscriptions'), JSON.stringify(subscriptions))
  }, [subscriptions, user?.id])

  // --- ACTIONS ---
  
  const setCurrency = useCallback(async (newCurrency: string) => {
    if (!user) return
    const prev = currency
    setCurrencyState(newCurrency)
    localStorage.setItem(getStorageKey(user.id, 'currency'), newCurrency)

    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/cashflow/currency`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currency: newCurrency })
      })
      if (!res.ok) throw new Error("Failed to save currency")
    } catch (err) {
      console.error(err)
      setCurrencyState(prev) // rollback
    }
  }, [user?.id, currency])

  const addTransaction = useCallback(async (tx: Omit<Transaction, "id">) => {
    if (!user) return
    const token = await getAuthToken()
    const payload = { ...tx, id: crypto.randomUUID() }

    const res = await fetch(`${API_URL}/cashflow/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    })

    if (!res.ok) throw new Error("Failed to add transaction")
    const createdTx = await res.json()
    setTransactions((prev) => [createdTx, ...prev])
  }, [user?.id])

  const updateTransaction = useCallback(async (id: string, tx: Omit<Transaction, "id">) => {
    if (!user) return
    let previousTx: Transaction[] = []
    setTransactions((prev) => {
      previousTx = [...prev]
      return prev.map((t) => (t.id === id ? { ...t, ...tx } : t))
    })

    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/cashflow/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(tx)
      })
      if (!res.ok) throw new Error("Failed to update transaction")
    } catch (err) {
      setTransactions(previousTx)
      throw err
    }
  }, [user?.id])

  const removeTransaction = useCallback(async (id: string) => {
    if (!user) return
    let previousTx: Transaction[] = []
    setTransactions((prev) => {
      previousTx = [...prev]
      return prev.filter((t) => t.id !== id)
    })

    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/cashflow/transactions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Failed to delete transaction")
    } catch (err) {
      setTransactions(previousTx)
      throw err
    }
  }, [user?.id])

  const addSubscription = useCallback(async (sub: Omit<Subscription, "id" | "lastProcessed">) => {
    if (!user) return
    const token = await getAuthToken()
    const payload = { ...sub, id: crypto.randomUUID() }

    const res = await fetch(`${API_URL}/cashflow/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    })

    if (!res.ok) throw new Error("Failed to add subscription")
    const createdSub = await res.json()
    setSubscriptions((prev) => [...prev, createdSub])
  }, [user?.id])

  const removeSubscription = useCallback(async (id: string) => {
    if (!user) return
    let previousSub: Subscription[] = []
    setSubscriptions((prev) => {
      previousSub = [...prev]
      return prev.filter((s) => s.id !== id)
    })

    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/cashflow/subscriptions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Failed to delete subscription")
    } catch (err) {
      setSubscriptions(previousSub)
      throw err
    }
  }, [user?.id])

  const value = useMemo(
    () => ({
      transactions,
      subscriptions,
      currency,
      isLoading,
      addTransaction,
      updateTransaction,
      removeTransaction,
      addSubscription,
      removeSubscription,
      setCurrency,
      isCurrencySet: currency !== null && currency.trim() !== "",
    }),
    [transactions, subscriptions, currency, isLoading, addTransaction, updateTransaction, removeTransaction, addSubscription, removeSubscription, setCurrency]
  )

  return <CashflowContext.Provider value={value}>{children}</CashflowContext.Provider>
}

export function useCashflow() {
  const context = useContext(CashflowContext)
  if (!context) {
    throw new Error("useCashflow must be used within a CashflowProvider")
  }
  return context
}
