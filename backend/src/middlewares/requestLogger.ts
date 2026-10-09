import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = uuidv4();
  const start = Date.now();
  
  // Attach requestId to req for downstream usage if needed
  (req as any).requestId = requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const isProduction = process.env.NODE_ENV === 'production';
    
    // In production we want standard logs, in development we can be noisy
    console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.originalUrl} - ${res.statusCode} [${duration}ms]`);
  });

  next();
};
