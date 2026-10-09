import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load env from backend/.env
dotenv.config();

import authRoutes from './routes/auth';
import assignmentRoutes from './routes/assignment';
import profileRoutes from './routes/profile';
import noteRoutes from './routes/note';
import scheduleRoutes from './routes/schedule';
import cashflowRoutes from './routes/cashflow';
import exportRoutes from './routes/export';
import { errorHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';
import { globalLimiter, authLimiter, exportLimiter } from './middlewares/rateLimiter';

const app = express();
const port = process.env.PORT || 5000;

// CORS Configuration
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [process.env.FRONTEND_URL || ''] 
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(requestLogger);
app.use('/api/', globalLimiter); // Apply global limit to all API routes

// Basic health check endpoint
app.get(['/health', '/api/health'], (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'ACES API', 
    timestamp: new Date().toISOString() 
  });
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/cashflow', cashflowRoutes);
app.use('/api/export', exportLimiter, exportRoutes);

// Error handling middleware (must be after routes)
app.use(errorHandler);

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Backend server is running on port ${port}`);
  });
}

// Export for Vercel Serverless
export default app;
