import prisma from '../lib/prisma.js';

async function migrateIncomeBalance() {
    console.log('Starting migration to populate income_balance for all users...');

    const users = await prisma.users.findMany({ select: { id: true, email: true } });

    let count = 0;
    for (const user of users) {
        const userId = user.id;

        // Check if wallet exists
        const wallet = await prisma.wallets.findUnique({ where: { user_id: userId } });
        if (!wallet) continue;

        // Calculate total income (excluding old system anomalies and deposits)
        const totalIncomeAgg = await prisma.transactions.aggregate({
            _sum: { amount: true },
            where: {
                user_id: userId,
                type: 'credit',
                income_source: {
                    notIn: ['daily_profit'],
                    not: { endsWith: '_deposit' }
                },
                status: 'COMPLETED',
                description: { not: { contains: '[OLD SYSTEM' } }
            }
        });
        const totalIncome = Number(totalIncomeAgg._sum.amount || 0);

        // Calculate total withdrawals
        const totalWithdrawnAgg = await prisma.transactions.aggregate({
            _sum: { amount: true },
            where: {
                user_id: userId,
                OR: [
                    { type: 'debit', income_source: { in: ['withdrawal', 'income_withdrawal', 'investment_withdrawal'] } },
                    { type: 'WITHDRAWAL' }
                ],
                status: { in: ['COMPLETED', 'PENDING'] }
            }
        });
        const totalWithdrawn = Number(totalWithdrawnAgg._sum.amount || 0);

        // Available income
        const availableIncome = Math.max(0, totalIncome - totalWithdrawn);

        // Only migrate if they have available income and income_balance hasn't been migrated yet
        // (Assuming income_balance starts at 0 for all existing users after schema push)
        if (availableIncome > 0 && Number(wallet.income_balance) === 0) {
            // amount to move from balance -> income_balance
            // capping at whatever their balance currently is to prevent negative Investment Wallet balance
            const amountToMove = Math.min(Number(wallet.balance) || 0, availableIncome);

            await prisma.wallets.update({
                where: { user_id: userId },
                data: {
                    income_balance: availableIncome,
                    balance: { decrement: amountToMove }
                }
            });
            console.log(`Migrated ${availableIncome} to income_balance for user ${user.email} (deduced ${amountToMove} from balance)`);
            count++;
        }
    }

    console.log(`Migration complete. Updated ${count} wallets.`);
    process.exit(0);
}

migrateIncomeBalance().catch(console.error);
