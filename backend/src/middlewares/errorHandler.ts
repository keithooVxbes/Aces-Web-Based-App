import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Catch Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors = (err.issues || []).map((e: any) => ({
      path: e.path.join('.'),
      message: e.message
    }));
    return res.status(400).json({ 
      error: "Validation failed", 
      details: formattedErrors 
    });
  }

  // Always log the original error for debugging purposes in the backend console
  console.error('[Error Logger]', err);
  
  const status = err.status || 500;
  
  // If in production and it's a 500 error, obscure the details to avoid leaking DB schemas
  const isProduction = process.env.NODE_ENV === 'production';
  const message = (isProduction && status === 500) 
    ? 'Internal Server Error' 
    : (err.message || 'Internal Server Error');
  
  res.status(status).json({ 
    error: message,
    // Provide stack trace only in development
    ...(isProduction ? {} : { stack: err.stack })
  });
};
