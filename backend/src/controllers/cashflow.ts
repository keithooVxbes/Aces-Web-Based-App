import { Request, Response, NextFunction } from 'express';
import { cashflowService } from '../services/cashflow.js';
import { 
  createTransactionSchema, 
  updateTransactionSchema, 
  createSubscriptionSchema, 
  updateSubscriptionSchema, 
  updateCurrencySchema 
} from '../validators/cashflow.js';

// --- TRANSACTIONS ---
export const getTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transactions = await cashflowService.getTransactions(req.user!.id);
    res.json(transactions);
  } catch (error) { next(error); }
};

export const createTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = createTransactionSchema.parse(req.body);
    const transaction = await cashflowService.createTransaction(req.user!.id, {
      ...validatedData,
      id: validatedData.id || ""
    });
    res.status(201).json(transaction);
  } catch (error) { next(error); }
};

export const updateTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = updateTransactionSchema.parse(req.body);
    await cashflowService.updateTransaction(req.user!.id, req.params.id, validatedData);
    res.json({ success: true });
  } catch (error) { next(error); }
};

export const deleteTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await cashflowService.deleteTransaction(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (error) { next(error); }
};

// --- SUBSCRIPTIONS ---
export const getSubscriptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscriptions = await cashflowService.getSubscriptions(req.user!.id);
    res.json(subscriptions);
  } catch (error) { next(error); }
};

export const createSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = createSubscriptionSchema.parse(req.body);
    const subscription = await cashflowService.createSubscription(req.user!.id, {
      ...validatedData,
      id: validatedData.id || "",
      lastProcessed: validatedData.lastProcessed || ""
    });
    res.status(201).json(subscription);
  } catch (error) { next(error); }
};

export const updateSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = updateSubscriptionSchema.parse(req.body);
    await cashflowService.updateSubscription(req.user!.id, req.params.id, validatedData);
    res.json({ success: true });
  } catch (error) { next(error); }
};

export const deleteSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await cashflowService.deleteSubscription(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (error) { next(error); }
};

// --- CURRENCY ---
export const getCurrency = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currency = await cashflowService.getCurrency(req.user!.id);
    res.json({ currency });
  } catch (error) { next(error); }
};

export const updateCurrency = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = updateCurrencySchema.parse(req.body);
    await cashflowService.updateCurrency(req.user!.id, validatedData.currency);
    res.json({ success: true });
  } catch (error) { next(error); }
};
