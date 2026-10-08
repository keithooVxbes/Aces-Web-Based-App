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
import { errorHandler } from './middlewares/errorHandler';

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notes', noteRoutes);

// Error handling middleware (must be after routes)
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Backend server is running on port ${port}`);
});
