import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const walletRouter = Router();

const PLATFORM_FEE = 1; // $1 platform fee on all transactions
const UNLOCK_COST = 100; // $100 to unlock investment
const REFERRAL_BONUS = 10; // Fixed $10 referral bonus on unlock

// ============================================================
// UNLOCK INVESTMENT ($100 from Package Wallet)
// ============================================================
walletRouter.post('/unlock-investment', requireAuth, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check if already unlocked
      const user = await tx.users.findUnique({
        where: { id: userId },
        select: { investment_unlocked: true, sponsor_id: true, full_name: true, email: true }
      });

      if (user.investment_unlocked) {
        throw new Error('Investment is already unlocked.');
      }

      // 2. Check package wallet balance (no platform fee on unlock)
      const wallet = await tx.wallets.findUnique({ where: { user_id: userId } });

      if (!wallet || Number(wallet.package_balance) < UNLOCK_COST) {
        throw new Error(`Insufficient Package Wallet balance. Need $${UNLOCK_COST}, have $${wallet?.package_balance || 0}`);
      }

      // 3. Deduct $100 from Package Wallet
      await tx.wallets.update({
        where: { user_id: userId },
        data: { package_balance: { decrement: UNLOCK_COST } }
      });

      // 4. Set investment_unlocked = true
      await tx.users.update({
        where: { id: userId },
        data: {
          investment_unlocked: true,
          investment_unlocked_at: new Date()
        }
      });

      // 5. Record the unlock transaction
      await tx.transactions.create({
        data: {
          user_id: userId,
          amount: UNLOCK_COST,
          type: 'debit',
          income_source: 'unlock_investment',
          description: `Investment unlocked - $${UNLOCK_COST} deducted from Package Wallet`,
          status: 'COMPLETED'
        }
      });

      // 6. Distribute $10 referral bonus to direct sponsor
      if (user.sponsor_id) {
        await tx.wallets.upsert({
          where: { user_id: user.sponsor_id },
          create: { user_id: user.sponsor_id, balance: REFERRAL_BONUS, package_balance: 0 },
          update: { balance: { increment: REFERRAL_BONUS } }
        });

        await tx.transactions.create({
          data: {
            user_id: user.sponsor_id,
            amount: REFERRAL_BONUS,
            type: 'credit',
            income_source: 'direct_income',
            description: `Referral bonus ($${REFERRAL_BONUS}) - ${user.full_name || user.email} unlocked investment`,
            status: 'COMPLETED',
            referral_level: 1
          }
        });
      }

      return { success: true };
    });

    res.json({
      success: true,
      message: 'Investment unlocked successfully! You can now transfer funds to your Investment Wallet.'
    });

  } catch (error) {
    console.error('Unlock Investment Error:', error);
    res.status(400).json({ error: error.message || 'Failed to unlock investment' });
  }
});

// ============================================================
// TRANSFER: Package Wallet → Investment Wallet
// Min $100, multiples of $10, $1 platform fee
// ============================================================
const transferSchema = z.object({
  amount: z.number()
    .min(100, 'Minimum transfer amount is $100')
    .refine(val => val % 10 === 0, 'Amount must be in multiples of $10')
});

walletRouter.post('/transfer-to-investment', requireAuth, async (req, res) => {
  const parse = transferSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.errors[0].message });
  }

  const { amount } = parse.data;
  const userId = req.user.id;
  const totalDeduction = amount + PLATFORM_FEE; // amount + $1 fee

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Check investment is unlocked
      const user = await tx.users.findUnique({
        where: { id: userId },
        select: { investment_unlocked: true }
      });

      if (!user?.investment_unlocked) {
        throw new Error('You must unlock investment first before transferring.');
      }

      // 2. Check package wallet balance
      const wallet = await tx.wallets.findUnique({ where: { user_id: userId } });

      if (!wallet || Number(wallet.package_balance) < totalDeduction) {
        throw new Error(`Insufficient Package Wallet balance. Need $${totalDeduction} ($${amount} + $${PLATFORM_FEE} fee), have $${wallet?.package_balance || 0}`);
      }

      // 3. Deduct from Package Wallet (amount + fee)
      await tx.wallets.update({
        where: { user_id: userId },
        data: {
          package_balance: { decrement: totalDeduction },
          balance: { increment: amount } // Credit to Investment Wallet
        }
      });

      // 4. Record transfer transaction
      await tx.transactions.create({
        data: {
          user_id: userId,
          amount: amount,
          type: 'credit',
          income_source: 'package_to_investment',
          description: `Transferred $${amount} from Package to Investment Wallet (Fee: $${PLATFORM_FEE})`,
          status: 'COMPLETED'
        }
      });

      // 5. Record fee transaction
      await tx.transactions.create({
        data: {
          user_id: userId,
          amount: PLATFORM_FEE,
          type: 'debit',
          income_source: 'platform_fee',
          description: `Platform fee for Package→Investment transfer of $${amount}`,
          status: 'COMPLETED'
        }
      });
    });

    res.json({
      success: true,
      message: `Successfully transferred $${amount} to Investment Wallet (Fee: $${PLATFORM_FEE})`
    });

  } catch (error) {
    console.error('Transfer to Investment Error:', error);
    res.status(400).json({ error: error.message || 'Transfer failed' });
  }
});

// ============================================================
// P2P Transfer (Package Wallet → Package Wallet) + $1 fee
// ============================================================
const p2pTransferSchema = z.object({
  recipientReferralCode: z.string().min(1, 'Recipient referral code is required'),
  amount: z.number().min(1, 'Minimum transfer amount is $1')
});

walletRouter.post('/p2p-transfer', requireAuth, async (req, res) => {
  const parse = p2pTransferSchema.safeParse(req.body);

  if (!parse.success) {
    return res.status(400).json({ error: parse.error.errors[0].message });
  }

  const { recipientReferralCode, amount } = parse.data;
  const senderId = req.user.id;
  const totalDeduction = amount + PLATFORM_FEE; // amount + $1 fee

  try {
    // 1. Verify Sender has enough balance in Package Wallet (amount + fee)
    const senderWallet = await prisma.wallets.findUnique({
      where: { user_id: senderId }
    });

    if (!senderWallet || Number(senderWallet.package_balance) < totalDeduction) {
      return res.status(400).json({ error: `Insufficient Package Wallet balance. Need $${totalDeduction} ($${amount} + $${PLATFORM_FEE} fee)` });
    }

    // 2. Find Recipient
    const recipient = await prisma.users.findUnique({
      where: { referral_code: recipientReferralCode },
      select: { id: true, full_name: true, email: true }
    });

    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    if (recipient.id === senderId) {
      return res.status(400).json({ error: 'Cannot transfer to yourself' });
    }

    // 3. Execute Transfer Transaction
    await prisma.$transaction(async (tx) => {
      // Deduct from Sender (amount + fee)
      await tx.wallets.update({
        where: { user_id: senderId },
        data: { package_balance: { decrement: totalDeduction } }
      });

      // Add to Recipient (full amount, no fee on receiving end)
      await tx.wallets.upsert({
        where: { user_id: recipient.id },
        create: {
          user_id: recipient.id,
          balance: 0,
          package_balance: amount
        },
        update: {
          package_balance: { increment: amount }
        }
      });

      // Record Transaction for Sender (Debit)
      await tx.transactions.create({
        data: {
          user_id: senderId,
          amount: amount,
          type: 'debit',
          income_source: 'p2p_transfer_sent',
          description: `P2P Transfer to ${recipient.full_name} (${recipientReferralCode}) (Fee: $${PLATFORM_FEE})`,
          status: 'COMPLETED'
        }
      });

      // Record fee transaction for Sender
      await tx.transactions.create({
        data: {
          user_id: senderId,
          amount: PLATFORM_FEE,
          type: 'debit',
          income_source: 'platform_fee',
          description: `Platform fee for P2P transfer of $${amount} to ${recipient.full_name}`,
          status: 'COMPLETED'
        }
      });

      // Record Transaction for Recipient (Credit)
      await tx.transactions.create({
        data: {
          user_id: recipient.id,
          amount: amount,
          type: 'credit',
          income_source: 'p2p_transfer_received',
          description: `P2P Transfer received from ${req.user.email}`,
          status: 'COMPLETED'
        }
      });
    });

    res.json({
      success: true,
      message: `Successfully transferred $${amount} to ${recipient.full_name} (Fee: $${PLATFORM_FEE})`
    });

  } catch (error) {
    console.error('P2P Transfer Error:', error);
    res.status(500).json({ error: 'Transfer failed' });
  }
});