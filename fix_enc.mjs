import fs from 'fs';

const files = [
    'src/lib/utils.tsx',
    'src/app/page.tsx',
    'src/components/TabTransactions.tsx',
    'src/components/TabOverview.tsx',
    'src/components/TabBudget.tsx',
    'src/components/TabCards.tsx',
    'src/components/TabAnnual.tsx',
    'src/app/admin/page.tsx',
];

for (const f of files) {
    if (!fs.existsSync(f)) continue;
    try {
        const content = fs.readFileSync(f, 'utf8');
        // Convert from corrupt utf8 back to original utf8
        const fixed = Buffer.from(content, 'latin1').toString('utf8');

        fs.writeFileSync(f, fixed, 'utf8');
        console.log('FIXED: ' + f);
    } catch (e) {
        console.error('ERROR on ' + f + ': ' + e.message);
    }
}
