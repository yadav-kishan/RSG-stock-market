import prisma from '../lib/prisma.js';

const CUTOFF_DATE = new Date('2026-03-01T00:00:00.000Z');
const PROFIT_RATE = 0.02; // 2%

async function distributeManualMonthlyProfit() {
    console.log('=== Manual Monthly Profit Distribution ===');
    console.log(`Cutoff: only users who deposited before ${CUTOFF_DATE.toDateString()}`);
    console.log(`Rate: ${PROFIT_RATE * 100}% of Investment Wallet balance\n`);

    // 1. Find users who had a wallet-credited deposit before March 1, 2026
    const earlyDepositors = await prisma.transactions.findMany({
        where: {
            timestamp: { lt: CUTOFF_DATE },
            type: 'credit',
            income_source: { endsWith: '_deposit' },
            status: 'COMPLETED'
        },
        select: { user_id: true },
        distinct: ['user_id']
    });

    const eligibleUserIds = earlyDepositors.map(d => d.user_id);
    console.log(`Found ${eligibleUserIds.length} users who deposited before March 1\n`);

    if (eligibleUserIds.length === 0) {
        console.log('No eligible users found. Exiting.');
        process.exit(0);
    }

    // 2. Get their wallets with investment balance > 0
    const wallets = await prisma.wallets.findMany({
        where: {
            user_id: { in: eligibleUserIds },
            balance: { gt: 0 }
        },
        select: { user_id: true, balance: true }
    });

    console.log(`Of those, ${wallets.length} have Investment Wallet balance > 0\n`);

    let totalProfitDistributed = 0;

    for (const wallet of wallets) {
        const investmentBalance = parseFloat(wallet.balance);
        const profit = parseFloat((investmentBalance * PROFIT_RATE).toFixed(2));

        if (profit <= 0) continue;

        // Check: did this user already receive a March 2026 trading bonus? (avoid double-credit)
        const alreadyPaid = await prisma.transactions.findFirst({
            where: {
                user_id: wallet.user_id,
                income_source: 'trading_bonus',
                timestamp: { gte: new Date('2026-03-01T00:00:00.000Z') }
            }
        });

        if (alreadyPaid) {
            console.log(`  ⏭  Skipping user ${wallet.user_id} — already received March profit`);
            continue;
        }

        await prisma.$transaction(async (tx) => {
            // Credit profit to Income Wallet
            await tx.wallets.update({
                where: { user_id: wallet.user_id },
                data: { income_balance: { increment: profit } }
            });

            // Record the transaction
            await tx.transactions.create({
                data: {
                    user_id: wallet.user_id,
                    amount: profit,
                    type: 'credit',
                    income_source: 'trading_bonus',
                    status: 'COMPLETED',
                    description: `Manual March 2026 monthly profit (2%) on Investment Wallet balance of $${investmentBalance.toFixed(2)}`
                }
            });
        });

        totalProfitDistributed += profit;
        console.log(`  ✅  User ${wallet.user_id}: $${investmentBalance.toFixed(2)} × 2% = +$${profit.toFixed(2)} → Income Wallet`);
    }

    console.log(`\n=== Done ===`);
    console.log(`Total profit distributed: $${totalProfitDistributed.toFixed(2)}`);
    process.exit(0);
}

distributeManualMonthlyProfit().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
