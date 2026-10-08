import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

// Extend Express Request object to include the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
    }

    // Extract the JWT token
    const token = authHeader.split(' ')[1];
    
    // Validate the token against Supabase Auth
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // Attach the validated user to the request
    req.user = data.user;
    
    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    next(error);
  }
};
