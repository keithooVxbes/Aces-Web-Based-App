import { supabase } from '../config/supabase.js';

export const exportService = {
  async exportUserData(userId: string) {
    // Perform parallel queries for all modules
    const [
      profileRes,
      assignmentsRes,
      foldersRes,
      notesRes,
      schedulesRes,
      transactionsRes,
      categoriesRes,
      subscriptionsRes
    ] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      supabase.from('assignments').select('*').eq('user_id', userId),
      supabase.from('note_folders').select('*').eq('user_id', userId),
      supabase.from('notes').select('*').eq('user_id', userId),
      supabase.from('schedules').select('*').eq('user_id', userId),
      supabase.from('transactions').select('*').eq('user_id', userId),
      supabase.from('categories').select('*').eq('user_id', userId),
      supabase.from('subscriptions').select('*').eq('user_id', userId)
    ]);

    // Handle potential errors if necessary (Supabase will return error in res.error)
    if (profileRes.error && profileRes.error.code !== 'PGRST116') {
      console.error('Error fetching profile for export:', profileRes.error);
    }
    if (assignmentsRes.error) console.error('Error fetching assignments:', assignmentsRes.error);
    if (foldersRes.error) console.error('Error fetching folders:', foldersRes.error);
    if (notesRes.error) console.error('Error fetching notes:', notesRes.error);
    if (schedulesRes.error) console.error('Error fetching schedules:', schedulesRes.error);
    if (transactionsRes.error) console.error('Error fetching transactions:', transactionsRes.error);
    if (categoriesRes.error) console.error('Error fetching categories:', categoriesRes.error);
    if (subscriptionsRes.error) console.error('Error fetching subscriptions:', subscriptionsRes.error);

    return {
      profile: profileRes.data || {},
      assignments: assignmentsRes.data || [],
      note_folders: foldersRes.data || [],
      notes: notesRes.data || [],
      schedules: schedulesRes.data || [],
      transactions: transactionsRes.data || [],
      categories: categoriesRes.data || [],
      subscriptions: subscriptionsRes.data || []
    };
  }
};
