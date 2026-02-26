const fs = require('fs');
const inputFile = 'C:\\Users\\maju2\\Downloads\\Gestor Financeiro WhatsApp (VincularCartoes).json';
let data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// 1. Fix Buscar Cartoes to always output data
const buscarCartoesNode = data.nodes.find(n => n.name === 'Buscar Cartoes do Usuario');
if (buscarCartoesNode) {
    buscarCartoesNode.alwaysOutputData = true;
}

// 2. Fix Buscar Resumo Supabase to always output data (just in case)
const buscarResumoNode = data.nodes.find(n => n.name === 'Buscar Resumo Supabase');
if (buscarResumoNode) {
    buscarResumoNode.alwaysOutputData = true;
}

// 3. Update Vincular Cartao (JS) logic
const vincularCartaoNode = data.nodes.find(n => n.name === 'Vincular Cartao (JS)');
if (vincularCartaoNode) {
    vincularCartaoNode.parameters.jsCode = `const transacao = $('Transação Válida?').first().json.transacao;
// Pega os cartões, mas filtra objetos vazios caso "alwaysOutputData" force um vazio
const cartoes = $input.all().map(i => i.json).filter(c => c.id); 

let cartao_id = null;
let cartao_obj = null;
let erroCartao = false;
let msgErroCartao = "";

const isParcelado = transacao.tipo === "parcelado";
const mencionouCartao = !!transacao.cartao;

if (mencionouCartao) {
  const nomeCartaoClean = String(transacao.cartao).toLowerCase().trim();
  const encontrado = cartoes.find(c => c.nome_cartao && c.nome_cartao.toLowerCase().includes(nomeCartaoClean));
  if (encontrado) {
    cartao_id = encontrado.id;
    cartao_obj = encontrado;
  } else {
    erroCartao = true;
    msgErroCartao = \`💳 Ops! Você mencionou o cartão *\${transacao.cartao}*, mas ele não está cadastrado no seu Dashboard.\\n\\nPor favor, acesse o painel, cadastre esse cartão (com os dias de fechamento e vencimento) e tente registrar a compra novamente!\`;
  }
} else if (isParcelado) {
  // Compras parceladas PRECISAM de cartão para controlarmos as faturas
  erroCartao = true;
  msgErroCartao = \`💳 Compras parceladas precisam estar vinculadas a um cartão de crédito para acompanharmos as faturas.\\n\\nPor favor, repita a mensagem dizendo em qual cartão você parcelou (Ex: "Comprei X por 100 em 2x no Nubank").\\n\\nE lembre-se de cadastrar o cartão no Dashboard!\`;
}

return [{
  json: {
    ...$('Transação Válida?').first().json,
    transacao: {
      ...transacao,
      cartao_id,
      cartao_obj
    },
    erroCartao,
    msgErroCartao
  }
}];`;
}

// 4. Create new nodes
const ifErroCartaoNode = {
    "parameters": {
        "conditions": {
            "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 1 },
            "conditions": [
                { "id": "erro-cartao-check", "leftValue": "={{ $json.erroCartao }}", "rightValue": true, "operator": { "type": "boolean", "operation": "true", "singleValue": true } }
            ],
            "combinator": "and"
        }
    },
    "id": "node-if-erro-cartao-" + Date.now(),
    "name": "Tem Erro Cartao?",
    "type": "n8n-nodes-base.if",
    "typeVersion": 2,
    "position": [22480, 12600]
};

const msgErroCartaoNode = {
    "parameters": {
        "method": "POST",
        "url": "=https://api.z-api.io/instances/3EF33F89070AD1679DB37670C93BF737/token/6BC35B496A0FA884EF07090B/send-text",
        "sendHeaders": true,
        "headerParameters": {
            "parameters": [
                { "name": "Client-Token", "value": "=F60ed71a76e7e421e97b54f4318bda7f0S" },
                { "name": "Content-Type", "value": "application/json" }
            ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"phone\": \"{{ $json.phone }}\",\n  \"message\": \"{{ $json.msgErroCartao }}\"\n}",
        "options": {}
    },
    "id": "node-msg-erro-cartao-" + Date.now(),
    "name": "Mensagem Erro Cartao (Z-API)",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [22750, 12850]
};

data.nodes.push(ifErroCartaoNode);
data.nodes.push(msgErroCartaoNode);

// 5. Re-wire connections
// Cortou: Vincular Cartao (JS) -> E Parcelado?
const vincularConnectionsRaw = data.connections['Vincular Cartao (JS)'];
if (vincularConnectionsRaw && vincularConnectionsRaw.main && vincularConnectionsRaw.main.length > 0) {
    const outputs = vincularConnectionsRaw.main[0];

    // Connect Vincular to If
    data.connections['Vincular Cartao (JS)'] = { main: [[{ "node": "Tem Erro Cartao?", "type": "main", "index": 0 }]] };

    // connect If -> False is outputs (E Parcelado) -> True is MsgErro
    data.connections['Tem Erro Cartao?'] = {
        main: [
            [{ "node": "Mensagem Erro Cartao (Z-API)", "type": "main", "index": 0 }], // True
            outputs // False (goes to E Parcelado?)
        ]
    };
}


// 6. Fix "Formatar Resumo" for empty arrays
const formatResumoNode = data.nodes.find(n => n.name === 'Formatar Resumo');
if (formatResumoNode) {
    formatResumoNode.parameters.jsCode = `const transacoes = $input.all().map(item => item.json).filter(t => t.id); // ignore empty
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

const outputFile = 'C:\\Users\\maju2\\Downloads\\Gestor Financeiro WhatsApp (VincularCartoes_Fix2).json';
fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
console.log('Fixed n8n JSON generated at:', outputFile);
