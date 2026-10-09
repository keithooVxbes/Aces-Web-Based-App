import { supabase } from '../config/supabase';

// Interfaces for API input/output matching frontend
export interface TransactionFrontend {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string; // ISO format or just YYYY-MM-DD from frontend
}

export interface SubscriptionFrontend {
  id: string;
  name: string;
  amount: number;
  category: string;
  startDate: string;
  lastProcessed: string;
}

// Helpers
function normalizeDate(isoString: string): string {
  if (!isoString) return new Date().toISOString().split('T')[0];
  // Extract YYYY-MM-DD to avoid timezone shift
  return isoString.split('T')[0];
}

async function getOrCreateCategory(userId: string, categoryName: string, type: 'income' | 'expense' = 'expense'): Promise<string> {
  // First attempt to find existing
  let { data } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', categoryName)
    .maybeSingle();

  if (data?.id) return data.id;

  // If not found, create new
  const { data: newData, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      name: categoryName,
      type: type
    })
    .select('id')
    .single();

  if (error) throw error;
  return newData.id;
}

export const cashflowService = {
  // --- TRANSACTIONS ---
  async getTransactions(userId: string): Promise<TransactionFrontend[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        id,
        type,
        amount,
        description,
        transaction_date,
        categories (name)
      `)
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      type: row.type,
      amount: Number(row.amount),
      category: row.categories?.name || 'Uncategorized',
      description: row.description || '',
      date: row.transaction_date,
    }));
  },

  async createTransaction(userId: string, tx: TransactionFrontend): Promise<TransactionFrontend> {
    const categoryId = await getOrCreateCategory(userId, tx.category, tx.type);
    
    const dbPayload = {
      id: tx.id,
      user_id: userId,
      category_id: categoryId,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      transaction_date: normalizeDate(tx.date)
    };

    const { data, error } = await supabase
      .from('transactions')
      .insert(dbPayload)
      .select(`
        id,
        type,
        amount,
        description,
        transaction_date,
        categories (name)
      `)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      type: data.type,
      amount: Number(data.amount),
      category: (data.categories as any)?.name || tx.category,
      description: data.description || '',
      date: data.transaction_date
    };
  },

  async updateTransaction(userId: string, id: string, updates: Partial<TransactionFrontend>): Promise<void> {
    const dbPayload: any = {};
    if (updates.type !== undefined) dbPayload.type = updates.type;
    if (updates.amount !== undefined) dbPayload.amount = updates.amount;
    if (updates.description !== undefined) dbPayload.description = updates.description;
    if (updates.date !== undefined) dbPayload.transaction_date = normalizeDate(updates.date);
    
    if (updates.category !== undefined) {
      const typeForCat = updates.type || 'expense'; // Default fallback, but it's okay for lookup
      dbPayload.category_id = await getOrCreateCategory(userId, updates.category, typeForCat as any);
    }

    const { error } = await supabase
      .from('transactions')
      .update(dbPayload)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async deleteTransaction(userId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  },

  // --- SUBSCRIPTIONS ---
  async getSubscriptions(userId: string): Promise<SubscriptionFrontend[]> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        id,
        name,
        amount,
        start_date,
        last_processed,
        categories (name)
      `)
      .eq('user_id', userId);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      amount: Number(row.amount),
      category: row.categories?.name || 'Uncategorized',
      startDate: row.start_date,
      lastProcessed: row.last_processed || new Date().toISOString()
    }));
  },

  async createSubscription(userId: string, sub: SubscriptionFrontend): Promise<SubscriptionFrontend> {
    const categoryId = await getOrCreateCategory(userId, sub.category, 'expense');
    
    const dbPayload = {
      id: sub.id,
      user_id: userId,
      category_id: categoryId,
      name: sub.name,
      amount: sub.amount,
      start_date: normalizeDate(sub.startDate),
      last_processed: sub.lastProcessed || null
    };

    const { data, error } = await supabase
      .from('subscriptions')
      .insert(dbPayload)
      .select(`
        id,
        name,
        amount,
        start_date,
        last_processed,
        categories (name)
      `)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      amount: Number(data.amount),
      category: (data.categories as any)?.name || sub.category,
      startDate: data.start_date,
      lastProcessed: data.last_processed || new Date().toISOString()
    };
  },

  async updateSubscription(userId: string, id: string, updates: Partial<SubscriptionFrontend>): Promise<void> {
    const dbPayload: any = {};
    if (updates.name !== undefined) dbPayload.name = updates.name;
    if (updates.amount !== undefined) dbPayload.amount = updates.amount;
    if (updates.startDate !== undefined) dbPayload.start_date = normalizeDate(updates.startDate);
    if (updates.lastProcessed !== undefined) dbPayload.last_processed = updates.lastProcessed;
    
    if (updates.category !== undefined) {
      dbPayload.category_id = await getOrCreateCategory(userId, updates.category, 'expense');
    }

    const { error } = await supabase
      .from('subscriptions')
      .update(dbPayload)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async deleteSubscription(userId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  },

  // --- CURRENCY ---
  async updateCurrency(userId: string, currency: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ currency })
      .eq('id', userId);
    if (error) throw error;
  },
  
  async getCurrency(userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('users')
      .select('currency')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data.currency || '$';
  }
};
