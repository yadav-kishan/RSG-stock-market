import prisma from '../lib/prisma.js';

async function checkAdminWallet() {
    // Find the admin user
    const admin = await prisma.users.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true, email: true, full_name: true }
    });

    if (!admin) {
        console.log('No admin user found');
        process.exit(0);
    }

    console.log(`\n=== ADMIN: ${admin.full_name} (${admin.email}) ===\n`);

    // Get wallet
    const wallet = await prisma.wallets.findUnique({ where: { user_id: admin.id } });
    console.log('WALLET BALANCES:');
    console.log(`  Investment Wallet (balance):      $${wallet?.balance || 0}`);
    console.log(`  Package Wallet (package_balance): $${wallet?.package_balance || 0}`);
    console.log(`  Total Income Wallet:              $${wallet?.income_balance || 0}`);

    // Get all investments (from investments table)
    const investments = await prisma.investments.findMany({
        where: { user_id: admin.id }
    });
    console.log(`\nACTIVE INVESTMENTS (in investments table): ${investments.length}`);
    for (const inv of investments) {
        const monthly2pct = parseFloat(inv.amount) * 0.02;
        console.log(`  - ${inv.package_name}: $${inv.amount} | Status: ${inv.status} | 2% monthly = $${monthly2pct.toFixed(2)}`);
    }

    // Get all deposit transactions
    const deposits = await prisma.transactions.findMany({
        where: {
            user_id: admin.id,
            type: 'credit',
            income_source: { endsWith: '_deposit' },
            status: 'COMPLETED'
        }
    });
    console.log(`\nCRYPTO DEPOSITS (in transactions table): ${deposits.length}`);
    let totalDeposited = 0;
    for (const dep of deposits) {
        totalDeposited += parseFloat(dep.amount);
        const monthly2pct = parseFloat(dep.amount) * 0.02;
        console.log(`  - ${dep.income_source}: $${dep.amount} | 2% monthly = $${monthly2pct.toFixed(2)}`);
    }
    console.log(`  TOTAL DEPOSITED: $${totalDeposited.toFixed(2)}`);
    console.log(`  EXPECTED 2% MONTHLY PROFIT: $${(totalDeposited * 0.02).toFixed(2)}`);

    // Get income breakdown
    const incomeBreakdown = await prisma.transactions.groupBy({
        by: ['income_source'],
        _sum: { amount: true },
        where: {
            user_id: admin.id,
            type: 'credit',
            status: 'COMPLETED',
            income_source: { not: { endsWith: '_deposit' } }
        }
    });

    console.log('\nINCOME BREAKDOWN:');
    let totalIncome = 0;
    for (const item of incomeBreakdown) {
        const amt = parseFloat(item._sum.amount);
        totalIncome += amt;
        console.log(`  - ${item.income_source}: $${amt.toFixed(2)}`);
    }
    console.log(`  TOTAL INCOME: $${totalIncome.toFixed(2)}`);

    process.exit(0);
}

checkAdminWallet().catch(console.error);
