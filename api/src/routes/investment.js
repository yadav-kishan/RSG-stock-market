import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
export const investmentRouter = Router();

const PLATFORM_FEE = 1; // $1 platform fee

// This middleware ensures that for all subsequent routes on this router,
// req.user will be defined.
investmentRouter.use(requireAuth);

const depositSchema = z.object({
  amount: z.number().positive(),
  package_name: z.string().min(1),
});

/**
 * Create a new investment from Investment Wallet balance.
 * Monthly profit is only generated on investments.
 * $1 platform fee applies.
 */
investmentRouter.post('/deposit', async (req, res) => {
  const parse = depositSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

  const { amount, package_name } = parse.data;
  const userId = req.user.id;
  const totalDeduction = amount + PLATFORM_FEE;

  try {
    const startDate = new Date();
    const unlockDate = new Date(startDate);
    unlockDate.setMonth(unlockDate.getMonth() + 6);

    let profitRate = 0;
    if (amount >= 100 && amount <= 999) {
      profitRate = 12;
    } else if (amount >= 1000) {
      profitRate = 15;
    }

    if (profitRate === 0) {
      return res.status(400).json({ error: 'Investment amount does not fit any package.' });
    }

    const newInvestment = await prisma.$transaction(async (tx) => {
      // 1. Check user has unlocked investment
      const user = await tx.users.findUnique({
        where: { id: userId },
        select: { investment_unlocked: true, sponsor_id: true, full_name: true, email: true }
      });

      if (!user?.investment_unlocked) {
        throw new Error('You must unlock investment first.');
      }

      // 2. Check and Deduct from Investment Wallet (balance) + platform fee
      const wallet = await tx.wallets.findUnique({ where: { user_id: userId } });

      if (!wallet || Number(wallet.balance) < totalDeduction) {
        throw new Error(`Insufficient Investment Wallet balance. Need $${totalDeduction} ($${amount} + $${PLATFORM_FEE} fee), have $${wallet?.balance || 0}`);
      }

      // Deduct from Investment Wallet
      await tx.wallets.update({
        where: { user_id: userId },
        data: { balance: { decrement: totalDeduction } }
      });

      // Log Debit Transaction
      await tx.transactions.create({
        data: {
          user_id: userId,
          amount: amount,
          type: 'debit',
          income_source: 'package_investment',
          description: `Investment purchase from Investment Wallet - ${package_name} (Fee: $${PLATFORM_FEE})`,
          status: 'COMPLETED'
        }
      });

      // Record fee transaction
      await tx.transactions.create({
        data: {
          user_id: userId,
          amount: PLATFORM_FEE,
          type: 'debit',
          income_source: 'platform_fee',
          description: `Platform fee for investment deposit of $${amount}`,
          status: 'COMPLETED'
        }
      });

      // 3. Create Active Investment Record
      const createdInvestment = await tx.investments.create({
        data: {
          user_id: userId,
          amount,
          package_name,
          monthly_profit_rate: profitRate,
          status: 'active',
          start_date: startDate,
          unlock_date: unlockDate,
        },
      });

      // 4. Store "Deposit" Transaction for ROI Calculation (Locked Capital)
      await tx.transactions.create({
        data: {
          user_id: userId,
          amount: amount,
          type: 'credit',
          income_source: 'investment_deposit',
          description: `Investment Active Capital - $${amount} - Locked for 6 months`,
          status: 'COMPLETED',
          unlock_date: new Date(Date.now() + (6 * 30 * 24 * 60 * 60 * 1000))
        },
      });

      // NOTE: Referral income is now distributed on "Unlock Investment" only.
      // No direct income on individual deposits.

      return createdInvestment;
    });

    return res.status(201).json(newInvestment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Deposit failed' });
  }
});

investmentRouter.get('/history', async (req, res) => {
  const userId = req.user.id;
  try {
    const history = await prisma.investments.findMany({
      where: { user_id: userId },
      orderBy: { start_date: 'desc' },
    });
    return res.json(history);
  } catch {
    return res.status(500).json({ error: 'Failed to load investments' });
  }
});
