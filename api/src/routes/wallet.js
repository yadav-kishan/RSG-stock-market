import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const walletRouter = Router();

// Schema for P2P transfer
const p2pTransferSchema = z.object({
  recipientReferralCode: z.string().min(1, 'Recipient referral code is required'),
  amount: z.number().min(1, 'Minimum transfer amount is $1')
});

// P2P Transfer (Package Wallet -> Package Wallet)
walletRouter.post('/p2p-transfer', requireAuth, async (req, res) => {
  const parse = p2pTransferSchema.safeParse(req.body);

  if (!parse.success) {
    return res.status(400).json({ error: parse.error.errors[0].message });
  }

  const { recipientReferralCode, amount } = parse.data;
  const senderId = req.user.id;

  try {
    // 1. Verify Sender has enough balance in Package Wallet
    const senderWallet = await prisma.wallets.findUnique({
      where: { user_id: senderId }
    });

    if (!senderWallet || Number(senderWallet.package_balance) < amount) {
      return res.status(400).json({ error: 'Insufficient funds in Package Wallet' });
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
      // Deduct from Sender
      await tx.wallets.update({
        where: { user_id: senderId },
        data: { package_balance: { decrement: amount } }
      });

      // Add to Recipient
      // Upsert recipient wallet just in case
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
          description: `P2P Transfer to ${recipient.full_name} (${recipientReferralCode})`,
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
      message: `Successfully transferred $${amount} to ${recipient.full_name}`
    });

  } catch (error) {
    console.error('P2P Transfer Error:', error);
    res.status(500).json({ error: 'Transfer failed' });
  }
});