import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in request context' });
    }

    // Attempt to fetch extra details from the public.users table
    // (PGRST116 means the row was not found, which is normal if the user just registered and hasn't set up a profile)
    const { data: dbUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('Error fetching user profile from database:', error);
    }

    res.json({
      success: true,
      auth_user: req.user,
      profile: dbUser || null,
      message: 'Authentication successful. Frontend -> Backend -> Supabase connection verified.'
    });
  } catch (error) {
    next(error);
  }
};
