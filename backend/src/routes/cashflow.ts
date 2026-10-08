import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  getCurrency,
  updateCurrency
} from '../controllers/cashflow';

const router = Router();

// Transactions
router.get('/transactions', requireAuth, getTransactions);
router.post('/transactions', requireAuth, createTransaction);
router.put('/transactions/:id', requireAuth, updateTransaction);
router.delete('/transactions/:id', requireAuth, deleteTransaction);

// Subscriptions
router.get('/subscriptions', requireAuth, getSubscriptions);
router.post('/subscriptions', requireAuth, createSubscription);
router.put('/subscriptions/:id', requireAuth, updateSubscription);
router.delete('/subscriptions/:id', requireAuth, deleteSubscription);

// Currency
router.get('/currency', requireAuth, getCurrency);
router.put('/currency', requireAuth, updateCurrency);

export default router;
