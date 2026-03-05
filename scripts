const fs = require('fs');

const inFile = 'c:/Users/maju2/Downloads/Gestor Financeiro WhatsApp (3).json';
const outFile = 'c:/Users/maju2/Downloads/Gestor Financeiro WhatsApp (Oficial).json';

try {
    const data = JSON.parse(fs.readFileSync(inFile, 'utf8'));

    for (let node of data.nodes) {
        if (node.name === 'Buscar Resumo Supabase') {
            node.parameters.url = "=https://aeulsmnxikrrcsphpybd.supabase.co/rest/v1/transacoes?phone=eq.{{ $('Detectar Intenção').first().json.phone }}&data=gte.{{ $now.startOf('month').toFormat('yyyy-MM-dd') }}&data=lte.{{ $now.endOf('month').toFormat('yyyy-MM-dd') }}&select=*";
        }

        if (node.name === 'Formatar Resumo') {
            node.parameters.jsCode = `const transacoes = $input.all().map(item => item.json);
const phone = $('Detectar Intenção').first().json.phone;

const totalGastos = transacoes.filter(r => r.tipo === 'gasto').reduce((acc, r) => acc + parseFloat(r.valor || 0), 0);
const totalReceitas = transacoes.filter(r => r.tipo === 'receita').reduce((acc, r) => acc + parseFloat(r.valor || 0), 0);
const saldo = totalReceitas - totalGastos;

const catMap = {};
transacoes.filter(r => r.tipo === 'gasto').forEach(r => {
  catMap[r.categoria] = (catMap[r.categoria] || 0) + parseFloat(r.valor || 0);
});

const categorias = Object.entries(catMap)
  .sort((a, b) => b[1] - a[1])
  .map(([cat, val]) => \`  • \${cat}: R$ \${val.toFixed(2)}\`)
  .join('\\n');

const saldoEmoji = saldo >= 0 ? '🟢' : '🔴';

let dashUrl = process.env.DASHBOARD_URL || 'https://gestor-zap.vercel.app';
let token = null;

try {
  const userData = $('Criar Buscar Usuario').first().json;
  if (Array.isArray(userData) && userData.length > 0) {
    token = userData[0].token;
  } else if (userData && userData.token) {
    token = userData.token;
  }
} catch(e) {}

if (token) {
  dashUrl += '/?token=' + token;
}

const mensagem = \`📊 *Extrato do Mês*\\n\\n💸 Gastos: R$ \${totalGastos.toFixed(2)}\\n💰 Receitas: R$ \${totalReceitas.toFixed(2)}\\n\${saldoEmoji} Saldo: R$ \${saldo.toFixed(2)}\\n\\n📂 *Por categoria:*\\n\${categorias || '  Nenhum gasto ainda'}\\n\\n🌐 Dashboard: \${dashUrl}\`;

return [{ json: { phone, mensagem } }];`;
        }
    }

    // Modifica também o E Parcelado -> Gerar Parcelas pra garantir q o return tá enviando Array.
    // Já conferi que o do usuário tava retornando 1 item, quero que tenha itens separados.
    for (let node of data.nodes) {
        if (node.name === 'Gerar Parcelas') {
            node.parameters.jsCode = `const tx = $json.transacao;
const phone = $('Detectar Intenção').first().json.phone;
const baseDate = new Date(tx.data + 'T12:00:00');

const itensParaSalvar = [];

for (let i = 0; i < tx.n_parcelas; i++) {
  const d = new Date(baseDate);
  d.setMonth(d.getMonth() + i);
  
  itensParaSalvar.push({
    json: {
      phone: phone,
      tipo: 'gasto',
      valor: tx.valor_parcela,
      categoria: tx.categoria,
      descricao: tx.descricao + ' (' + (i+1) + '/' + tx.n_parcelas + ')',
      data: d.toISOString().split('T')[0]
    }
  });
}

return itensParaSalvar;`;
        }

        if (node.name === 'Salvar Compra Parcelada') {
            node.parameters.jsonBody = `={
  "phone": "{{ $('Processar Resposta Claude').first().json.phone }}",
  "descricao": "{{ $('Processar Resposta Claude').first().json.transacao.descricao }}",
  "valor_total": {{ $('Processar Resposta Claude').first().json.transacao.valor_total }},
  "n_parcelas": {{ $('Processar Resposta Claude').first().json.transacao.n_parcelas }},
  "valor_parcela": {{ $('Processar Resposta Claude').first().json.transacao.valor_parcela }},
  "categoria": "{{ $('Processar Resposta Claude').first().json.transacao.categoria }}",
  "data_inicio": "{{ $('Processar Resposta Claude').first().json.transacao.data }}",
  "ativa": true
}`;
        }

        if (node.name === 'Salvar Parcelas Supabase') {
            node.parameters.jsonBody = `={
  "phone": "{{ $json.phone }}",
  "tipo": "{{ $json.tipo }}",
  "valor": {{ $json.valor }},
  "categoria": "{{ $json.categoria }}",
  "descricao": "{{ $json.descricao }}",
  "data": "{{ $json.data }}"
}`;
        }

        if (node.name === 'Confirmar Parcelado (Z-API)') {
            node.parameters.jsonBody = `={
  "phone": "{{ $('Processar Resposta Claude').first().json.phone }}",
  "message": "Compra parcelada registrada!\\n\\n{{ $('Processar Resposta Claude').first().json.transacao.descricao }}\\nTotal: R$ {{ $('Processar Resposta Claude').first().json.transacao.valor_total.toFixed(2) }}\\n{{ $('Processar Resposta Claude').first().json.transacao.n_parcelas }}x de R$ {{ $('Processar Resposta Claude').first().json.transacao.valor_parcela.toFixed(2) }}\\n\\nAs parcelas foram lançadas nos próximos meses! Digite *dashboard* para ver o extrato atualizado."
}`;
        }
    }

    fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
    console.log('Success! Saved to ' + outFile);
} catch (e) {
    console.error(e);
}
