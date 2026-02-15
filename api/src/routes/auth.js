import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSupabaseAuth } from '../middleware/requireSupabaseAuth.js';
import prisma from '../lib/prisma.js';
import { generateUniqueReferralCode } from '../utils/referralCode.js';
import otpStore from '../lib/otpStore.js';
import emailService from '../services/emailService.js';

// Generate a short unique ID (24 characters) that fits in VarChar(30)
function generateShortId() {
  return crypto.randomBytes(12).toString('hex');
}

export const authRouter = Router();

// ==========================================
// NEW: Supabase Auth Sync
// ==========================================

// Sync Supabase user to local database
authRouter.post('/sync', requireSupabaseAuth, async (req, res) => {
  try {
    const { email, id: supabaseId, user_metadata } = req.supabaseUser;

    // Check if user already exists
    let user = await prisma.users.findUnique({ where: { email } });

    if (user) {
      // User exists, return their info
      return res.json({
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          referral_code: user.referral_code
        }
      });
    }

    // User doesn't exist, create them
    console.log(`Syncing new user ${email} from Supabase...`);

    const { full_name, sponsor_referral_code, position, country, phone } = user_metadata || {};

    if (!full_name || !sponsor_referral_code || !position) {
      // Metadata might be missing if signed up via other means, handling gracefully or erroring
      // For now, require them as per flow
      return res.status(400).json({ error: 'Missing required user metadata (Sponsor, Position, Name)' });
    }

    // Validate sponsor
    const sponsor = await prisma.users.findUnique({ where: { referral_code: sponsor_referral_code } });
    if (!sponsor) {
      return res.status(400).json({ error: 'Invalid sponsor code in metadata' });
    }

    const referralCode = await generateUniqueReferralCode();
    const userId = generateShortId();

    user = await prisma.users.create({
      data: {
        id: userId,
        full_name,
        email,
        password_hash: null, // Managed by Supabase
        referral_code: referralCode,
        sponsor_id: sponsor.id,
        position: position, // 'LEFT' or 'RIGHT'
        country: country || null,
        phone: phone || null,
        role: 'USER',
        wallets: { create: { balance: 0 } }
      }
    });

    console.log(`Synced user created: ${user.email} (${user.id})`);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        referral_code: user.referral_code
      }
    });

  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: 'Failed to sync user' });
  }
});

// DEPRECATED ENDPOINTS
// Old auth endpoints (OTP-based) have been removed in favor of Supabase Auth + /sync

// Sponsor lookup
authRouter.get('/sponsor/:code', async (req, res) => {
  const code = req.params.code;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  try {
    const sponsor = await prisma.users.findUnique({
      where: { referral_code: code },
      select: { full_name: true, referral_code: true }
    });
    if (!sponsor) return res.status(404).json({ error: 'Sponsor not found' });
    return res.json(sponsor);
  } catch {
    return res.status(500).json({ error: 'Lookup failed' });
  }
});

// Get current user info
authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        full_name: true,
        email: true,
        role: true,
        referral_code: true,
        country: true,
        phone: true,
        created_at: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ error: 'Failed to get user info' });
  }
});

// ============================================
// OTP endpoints for deposits and withdrawals
// (These remain the same - custom business logic)
// ============================================

// Generate OTP for deposit verification
authRouter.post('/send-deposit-otp', requireAuth, async (req, res) => {
  const { amount, blockchain } = req.body;
  const userId = req.user.id;

  if (!amount || !blockchain || amount < 100 || amount % 10 !== 0) {
    return res.status(400).json({ error: 'Invalid deposit amount or blockchain' });
  }

  try {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with 10 minutes expiration
    const otpData = {
      otp,
      userId,
      amount,
      blockchain,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    };

    otpStore.set(userId, otpData);

    // Get user info for sending OTP
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { email: true, full_name: true }
    });

    if (!user?.email) {
      return res.status(400).json({ error: 'User email not found' });
    }

    // Send OTP via email with timeout and immediate fallback
    console.log(`Generated OTP for ${user.email}: ${otp}`);
    console.log(`Deposit details - Amount: $${amount}, Blockchain: ${blockchain}`);

    let emailSent = false;
    try {
      const emailTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email timeout')), 15000)
      );

      await Promise.race([
        emailService.sendOTP(user.email, otp, 'deposit', user.full_name),
        emailTimeout
      ]);

      emailSent = true;
      console.log(`OTP email sent successfully to ${user.email}`);
    } catch (emailError) {
      console.error('Email sending failed or timed out:', emailError);
      console.log(`Fallback - OTP for ${user.email}: ${otp}`);
    }

    res.json({
      success: true,
      message: emailSent
        ? 'OTP sent to your registered email address'
        : 'OTP generated successfully. Check console for OTP code.',
      ...(process.env.NODE_ENV !== 'production' && { otp, email_sent: emailSent })
    });
  } catch (error) {
    console.error('OTP generation error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Generate OTP for income withdrawal verification
authRouter.post('/send-withdrawal-otp', requireAuth, async (req, res) => {
  const { type, amount, blockchain, withdrawal_address } = req.body;
  const userId = req.user.id;

  if (!type || !blockchain || !withdrawal_address || type !== 'income') {
    return res.status(400).json({ error: 'Invalid withdrawal parameters' });
  }

  if (!amount || amount < 10 || amount % 10 !== 0) {
    return res.status(400).json({ error: 'Invalid withdrawal amount' });
  }

  try {
    // Verify user has sufficient balance for income withdrawal
    const wallet = await prisma.wallets.findUnique({
      where: { user_id: userId }
    });

    if (!wallet || Number(wallet.balance) < amount) {
      return res.status(400).json({ error: 'Insufficient balance for withdrawal' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with 10 minutes expiration
    const otpData = {
      otp,
      userId,
      type: 'income_withdrawal',
      amount,
      blockchain,
      withdrawal_address,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    };

    otpStore.set(`withdrawal_${userId}`, otpData);

    // Get user info for sending OTP
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { email: true, full_name: true }
    });

    if (!user?.email) {
      return res.status(400).json({ error: 'User email not found' });
    }

    // Send OTP via email
    try {
      await emailService.sendOTP(user.email, otp, 'withdrawal', user.full_name);
      console.log(`OTP email sent to ${user.email} for withdrawal verification`);

      res.json({
        success: true,
        message: 'OTP sent to your registered email address',
        ...(process.env.NODE_ENV !== 'production' && { otp })
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      console.log(`Fallback - Withdrawal OTP for ${user.email}: ${otp}`);
      console.log(`Withdrawal details - Type: ${type}, Amount: $${amount}, Blockchain: ${blockchain}`);

      res.json({
        success: true,
        message: 'OTP generated (Email service temporarily unavailable - check console)',
        ...(process.env.NODE_ENV !== 'production' && { otp })
      });
    }
  } catch (error) {
    console.error('Withdrawal OTP generation error:', error);
    res.status(500).json({ error: 'Failed to send withdrawal OTP' });
  }
});

// Generate OTP for investment withdrawal verification
authRouter.post('/send-investment-withdrawal-otp', requireAuth, async (req, res) => {
  const { type, investment_id, blockchain, withdrawal_address } = req.body;
  const userId = req.user.id;

  if (!type || !investment_id || !blockchain || !withdrawal_address || type !== 'investment') {
    return res.status(400).json({ error: 'Invalid investment withdrawal parameters' });
  }

  try {
    // Verify investment exists and belongs to user
    const investment = await prisma.investments.findUnique({
      where: {
        id: investment_id,
        user_id: userId
      }
    });

    if (!investment) {
      return res.status(404).json({ error: 'Investment not found or access denied' });
    }

    if (investment.status !== 'active') {
      return res.status(400).json({ error: `Cannot withdraw from ${investment.status} investment` });
    }

    // Check 6-month lock period
    const currentDate = new Date();
    const investmentDate = new Date(investment.start_date);
    const monthsDifference = (currentDate.getFullYear() - investmentDate.getFullYear()) * 12 +
      (currentDate.getMonth() - investmentDate.getMonth());

    if (monthsDifference < 6) {
      const unlockDate = new Date(investmentDate);
      unlockDate.setMonth(unlockDate.getMonth() + 6);
      return res.status(400).json({
        error: `Investment locked until ${unlockDate.toLocaleDateString()}. Lock period: 6 months from investment date.`
      });
    }

    // Check if there's already a pending withdrawal
    const existingWithdrawal = await prisma.transactions.findFirst({
      where: {
        user_id: userId,
        description: { contains: investment_id },
        income_source: 'investment_withdrawal',
        status: 'PENDING'
      }
    });

    if (existingWithdrawal) {
      return res.status(400).json({ error: 'There is already a pending withdrawal request for this investment' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with 10 minutes expiration
    const otpData = {
      otp,
      userId,
      type: 'investment_withdrawal',
      investment_id,
      amount: investment.amount,
      blockchain,
      withdrawal_address,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    };

    otpStore.set(`withdrawal_${userId}`, otpData);

    // Get user info for sending OTP
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { email: true, full_name: true }
    });

    if (!user?.email) {
      return res.status(400).json({ error: 'User email not found' });
    }

    // Send OTP via email
    try {
      await emailService.sendOTP(user.email, otp, 'investment_withdrawal', user.full_name);
      console.log(`OTP email sent to ${user.email} for investment withdrawal verification`);

      res.json({
        success: true,
        message: 'OTP sent to your registered email address',
        ...(process.env.NODE_ENV !== 'production' && { otp })
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      console.log(`Fallback - Investment withdrawal OTP for ${user.email}: ${otp}`);
      console.log(`Investment withdrawal details - Investment ID: ${investment_id}, Amount: $${investment.amount}, Blockchain: ${blockchain}`);

      res.json({
        success: true,
        message: 'OTP generated (Email service temporarily unavailable - check console)',
        ...(process.env.NODE_ENV !== 'production' && { otp })
      });
    }
  } catch (error) {
    console.error('Investment withdrawal OTP generation error:', error);
    res.status(500).json({ error: 'Failed to send investment withdrawal OTP' });
  }
});

// Verify OTP and create deposit transaction
const depositSchema = z.object({
  amount: z.number()
    .min(100, 'Minimum deposit amount is $100')
    .refine((val) => val % 10 === 0, 'Amount must be in multiples of $10'),
  blockchain: z.string().min(1, 'Blockchain selection is required'),
  otp_code: z.string().min(6, 'OTP code is required').max(6, 'OTP code must be 6 digits'),
  transaction_hash: z.string().optional(),
  screenshot: z.string().optional() // Base64 encoded image
});

authRouter.post('/verify-deposit-otp', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const parse = depositSchema.safeParse(req.body);

  if (!parse.success) {
    return res.status(400).json({
      success: false,
      error: parse.error.flatten()
    });
  }

  const { amount, blockchain, otp_code, transaction_hash, screenshot } = parse.data;

  try {
    // Verify OTP first
    const otpData = otpStore.get(userId);

    if (!otpData) {
      return res.status(400).json({
        success: false,
        error: 'OTP not found or expired. Please request a new OTP.'
      });
    }

    if (otpData.otp !== otp_code) {
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP code'
      });
    }

    if (new Date() > otpData.expiresAt) {
      otpStore.delete(userId);
      return res.status(400).json({
        success: false,
        error: 'OTP has expired. Please request a new OTP.'
      });
    }

    // Verify OTP data matches request
    if (otpData.amount !== amount || otpData.blockchain !== blockchain) {
      return res.status(400).json({
        success: false,
        error: 'OTP data does not match deposit request'
      });
    }

    // Get user info for transaction description
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { email: true, full_name: true }
    });

    // Create deposit transaction with screenshot and details
    let descriptionDetails = `Crypto deposit of $${amount} via ${blockchain}`;
    if (transaction_hash) {
      descriptionDetails += ` (Tx: ${transaction_hash})`;
    }
    descriptionDetails += ` - OTP verified`;
    if (screenshot) {
      descriptionDetails += ` - Screenshot provided`;
    }

    // Create transaction and metadata in a database transaction
    const result = await prisma.$transaction(async (prisma) => {
      // Create the main transaction record
      const transaction = await prisma.transactions.create({
        data: {
          user_id: userId,
          amount,
          type: 'credit',
          income_source: `${blockchain}_deposit`,
          status: 'PENDING',
          description: descriptionDetails,
        },
      });

      // Create deposit metadata with screenshot and details
      const metadata = await prisma.deposit_metadata.create({
        data: {
          transaction_id: transaction.id,
          blockchain,
          screenshot: screenshot || null,
          transaction_hash: transaction_hash || null,
          wallet_address: null,
          ip_address: null,
          user_agent: null,
        },
      });

      return { transaction, metadata };
    });

    const transaction = result.transaction;

    // Clear OTP after successful submission
    otpStore.delete(userId);

    console.log(`Deposit transaction created for ${user?.email}: $${amount} via ${blockchain}`);
    console.log(`Transaction ID: ${transaction.id}, Status: PENDING`);

    res.status(201).json({
      success: true,
      message: 'Deposit request submitted successfully! Your transaction is being processed.',
      transaction: {
        id: transaction.id,
        amount: Number(transaction.amount),
        blockchain,
        status: transaction.status,
        timestamp: transaction.timestamp,
      },
    });
  } catch (error) {
    console.error('Deposit verification failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process deposit request'
    });
  }
});
