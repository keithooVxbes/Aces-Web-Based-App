import { z } from 'zod';

export const createTransactionSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive({ message: "Amount must be a positive number" }),
  category: z.string().min(1, "Category cannot be empty").max(50),
  description: z.string().max(255).optional().default(''),
  date: z.string().min(1, "Date cannot be empty")
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const createSubscriptionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name cannot be empty").max(100),
  amount: z.number().positive({ message: "Amount must be a positive number" }),
  category: z.string().min(1, "Category cannot be empty").max(50),
  startDate: z.string().min(1, "Start date cannot be empty"),
  lastProcessed: z.string().optional()
});

export const updateSubscriptionSchema = createSubscriptionSchema.partial();

export const updateCurrencySchema = z.object({
  currency: z.string().min(1, "Currency cannot be empty").max(5)
});
