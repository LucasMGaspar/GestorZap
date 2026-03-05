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
        let content = fs.readFileSync(f, 'utf8');
        if (content.charCodeAt(0) === 65533 || content.charCodeAt(0) === 0xFEFF) {
            content = content.substring(1);
            fs.writeFileSync(f, content, 'utf8');
            console.log('CLEANED BOM: ' + f);
        }
    } catch (e) {
        console.error('ERROR on ' + f + ': ' + e.message);
    }
}
