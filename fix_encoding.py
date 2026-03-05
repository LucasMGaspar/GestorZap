import os

files = [
    'src/lib/utils.tsx',
    'src/app/page.tsx',
    'src/components/TabTransactions.tsx',
    'src/components/TabOverview.tsx',
    'src/components/TabBudget.tsx',
    'src/components/TabCards.tsx',
    'src/components/TabAnnual.tsx',
    'src/components/Empty.tsx',
    'src/components/ICard.tsx',
    'src/components/MCard.tsx',
    'src/components/ChartTooltip.tsx',
    'src/app/admin/page.tsx',
]

for f in files:
    if not os.path.exists(f):
        print(f'SKIP (not found): {f}')
        continue
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
    try:
        fixed = content.encode('latin-1').decode('utf-8')
        with open(f, 'w', encoding='utf-8', newline='\r\n') as fh:
            fh.write(fixed)
        print(f'FIXED: {f}')
    except Exception as e:
        print(f'OK (no fix needed): {f} — {e}')
