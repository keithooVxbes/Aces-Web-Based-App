import rateLimit from 'express-rate-limit';

// Global API Limiter (Generous limit for normal app usage)
// 100 requests per 5 minutes per IP
export const globalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, 
  max: 100, 
  message: {
    error: 'Too many requests',
    details: 'You have exceeded the API request limit. Please try again later.'
  },
  standardHeaders: true, 
  legacyHeaders: false, 
});

// Auth Limiter (Stricter limit to prevent brute force)
// 10 requests per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many login attempts',
    details: 'You have exceeded the login request limit. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Export Limiter (Very strict limit to prevent resource abuse)
// 3 requests per 15 minutes per IP
export const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    error: 'Too many export requests',
    details: 'Data export is limited to 3 times per 15 minutes to save resources.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
