import prisma from '../lib/prisma.js';

/**
 * Top-up March 2026 trading bonus entries from 2% to 5%.
 * For each existing March trading_bonus, calculates the extra 3% and credits it.
 */
async function topUpMarchProfit() {
  console.log('=== Top-up March 2026 Profit: 2% → 5% ===\n');

  const marchBonuses = await prisma.transactions.findMany({
    where: {
      income_source: 'trading_bonus',
      status: 'COMPLETED',
      timestamp: {
        gte: new Date('2026-03-01T00:00:00.000Z'),
        lt: new Date('2026-04-01T00:00:00.000Z')
      }
    },
    select: { id: true, user_id: true, amount: true, description: true }
  });

  console.log(`Found ${marchBonuses.length} March trading bonus entries\n`);

  let totalTopUp = 0;

  for (const bonus of marchBonuses) {
    const originalAmount = parseFloat(bonus.amount);
    // Original was 2%, need 5%, so extra = (5/2 - 1) * original = 1.5 * original
    const extraAmount = parseFloat((originalAmount * 1.5).toFixed(2)); // 3% more (= 1.5x the 2%)

    if (extraAmount <= 0) continue;

    // Check if top-up already applied
    const alreadyApplied = await prisma.transactions.findFirst({
      where: {
        user_id: bonus.user_id,
        income_source: 'trading_bonus_topup',
        description: { contains: bonus.id }
      }
    });

    if (alreadyApplied) {
      console.log(`  ⏭ Skipping bonus ${bonus.id} — top-up already applied`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.wallets.update({
        where: { user_id: bonus.user_id },
        data: { income_balance: { increment: extraAmount } }
      });

      await tx.transactions.create({
        data: {
          user_id: bonus.user_id,
          amount: extraAmount,
          type: 'credit',
          income_source: 'trading_bonus_topup',
          status: 'COMPLETED',
          description: `Top-up from 2%→5% for March bonus ${bonus.id} (extra 3% = $${extraAmount})`
        }
      });
    });

    totalTopUp += extraAmount;
    console.log(`  ✅ User ${bonus.user_id}: original $${originalAmount} → +$${extraAmount} top-up`);
  }

  console.log(`\n=== Done. Total top-up distributed: $${totalTopUp.toFixed(2)} ===`);
  process.exit(0);
}

topUpMarchProfit().catch(err => { console.error(err); process.exit(1); });
