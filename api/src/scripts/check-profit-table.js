import prisma from '../lib/prisma.js';

async function checkProfitDistribution() {
    const users = await prisma.users.findMany({
        where: { role: 'USER' },
        select: { id: true, full_name: true, email: true },
        orderBy: { created_at: 'asc' }
    });

    console.log('\n' + '='.repeat(110));
    console.log(
        'NAME'.padEnd(25) + ' | ' +
        'EMAIL'.padEnd(30) + ' | ' +
        'INV WALLET'.padEnd(12) + ' | ' +
        'PKG WALLET'.padEnd(12) + ' | ' +
        'INCOME WALLET'.padEnd(14) + ' | ' +
        'MAR PROFIT'.padEnd(12) + ' | ' +
        'STATUS'
    );
    console.log('='.repeat(110));

    for (const user of users) {
        const wallet = await prisma.wallets.findUnique({ where: { user_id: user.id } });
        const marchProfit = await prisma.transactions.findFirst({
            where: {
                user_id: user.id,
                income_source: 'trading_bonus',
                timestamp: { gte: new Date('2026-03-01T00:00:00.000Z') }
            },
            select: { amount: true, timestamp: true }
        });

        const inv = Number(wallet?.balance || 0).toFixed(2);
        const pkg = Number(wallet?.package_balance || 0).toFixed(2);
        const income = Number(wallet?.income_balance || 0).toFixed(2);
        const profit = marchProfit ? `+$${Number(marchProfit.amount).toFixed(2)}` : 'NOT PAID';
        const status = marchProfit ? '✅ PAID' : (Number(inv) > 0 ? '❌ MISSING' : '— NO BAL');

        console.log(
            (user.full_name || '').substring(0, 24).padEnd(25) + ' | ' +
            user.email.substring(0, 29).padEnd(30) + ' | ' +
            `$${inv}`.padEnd(12) + ' | ' +
            `$${pkg}`.padEnd(12) + ' | ' +
            `$${income}`.padEnd(14) + ' | ' +
            profit.padEnd(12) + ' | ' +
            status
        );
    }

    console.log('='.repeat(110));
    const paid = users.length; // will recalc below
    let paidCount = 0, missingCount = 0;
    for (const user of users) {
        const wallet = await prisma.wallets.findUnique({ where: { user_id: user.id }, select: { balance: true } });
        const marchProfit = await prisma.transactions.findFirst({
            where: { user_id: user.id, income_source: 'trading_bonus', timestamp: { gte: new Date('2026-03-01T00:00:00.000Z') } }
        });
        if (marchProfit) paidCount++;
        else if (Number(wallet?.balance || 0) > 0) missingCount++;
    }
    console.log(`\nSUMMARY: ✅ ${paidCount} paid | ❌ ${missingCount} missing (have balance but not paid)\n`);
    process.exit(0);
}

checkProfitDistribution().catch(err => { console.error(err); process.exit(1); });
