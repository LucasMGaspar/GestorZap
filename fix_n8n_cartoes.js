const fs = require('fs');

const inputFile = 'C:\\Users\\maju2\\Downloads\\Gestor Financeiro WhatsApp (Oficial).json';
const outputFile = 'C:\\Users\\maju2\\Downloads\\Gestor Financeiro WhatsApp (VincularCartoes).json';

let data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// 1. Injetar Node de Buscar Cartões
const buscarCartoesNode = {
    "parameters": {
        "url": "https://aeulsmnxikrrcsphpybd.supabase.co/rest/v1/cartoes?phone=eq.{{ $('Detectar Intenção').first().json.phone }}&select=*",
        "sendHeaders": true,
        "headerParameters": {
            "parameters": [
                { "name": "apikey", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFldWxzbW54aWtycmNzcGhweWJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA0MDM0NCwiZXhwIjoyMDg3NjE2MzQ0fQ.6ZWsf1N75U4q-UoyookHukDI9_wMOAAUoU2xwkwRae4" },
                { "name": "Authorization", "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFldWxzbW54aWtycmNzcGhweWJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA0MDM0NCwiZXhwIjoyMDg3NjE2MzQ0fQ.6ZWsf1N75U4q-UoyookHukDI9_wMOAAUoU2xwkwRae4" }
            ]
        },
        "options": {}
    },
    "id": "node-buscar-cartoes-" + Date.now(),
    "name": "Buscar Cartoes do Usuario",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [22200, 12600]
};

// 2. Injetar Node de Vincular JS
const vincularCartaoNode = {
    "parameters": {
        "jsCode": `const transacao = $('Transação Válida?').first().json.transacao;
const cartoes = $input.first().json; // Array vindo do Supabase

let cartao_id = null;
let cartao_obj = null;

if (transacao.cartao && Array.isArray(cartoes)) {
  const nomeCartaoClean = String(transacao.cartao).toLowerCase().trim();
  const encontrado = cartoes.find(c => c.nome_cartao.toLowerCase().includes(nomeCartaoClean));
  if (encontrado) {
    cartao_id = encontrado.id;
    cartao_obj = encontrado;
  }
}

// Injeta os dados do cartao na transacao
return [{
  json: {
    ...$('Transação Válida?').first().json,
    transacao: {
      ...transacao,
      cartao_id,
      cartao_obj
    }
  }
}];`
    },
    "id": "node-vincular-cartoes-" + Date.now(),
    "name": "Vincular Cartao (JS)",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [22350, 12600]
};

data.nodes.push(buscarCartoesNode);
data.nodes.push(vincularCartaoNode);

// 3. Atualizar as Connections
const transacaoValida = data.connections['Transação Válida?'];
// Guardamos o que estava no branch 1 (E Parcelado?)
const eParceladoNodeOld = transacaoValida.main[1];
// Ligamos a saída do T. Valida 1 -> no Buscar Cartões
transacaoValida.main[1] = [{ "node": buscarCartoesNode.name, "type": "main", "index": 0 }];

data.connections[buscarCartoesNode.name] = { main: [[{ "node": vincularCartaoNode.name, "type": "main", "index": 0 }]] };
data.connections[vincularCartaoNode.name] = { main: [eParceladoNodeOld] };

// 4. Modificar "Gerar Parcelas"
const gerarNode = data.nodes.find(n => n.name === 'Gerar Parcelas');
gerarNode.parameters.jsCode = `const tx = $('Vincular Cartao (JS)').first().json.transacao;
const phone = $('Detectar Intenção').first().json.phone;

const itensParaSalvar = [];

let diaFechamento = tx.cartao_obj ? parseInt(tx.cartao_obj.dia_fechamento) : null;
let diaVencimento = tx.cartao_obj ? parseInt(tx.cartao_obj.dia_vencimento) : null;
const dataCompra = new Date(tx.data + 'T12:00:00');

for (let i = 0; i < tx.n_parcelas; i++) {
  let dataDaParcela = new Date(tx.data + 'T12:00:00');
  
  if (diaFechamento && diaVencimento) {
    const diaDaCompra = dataCompra.getDate();
    let deslocamentoDeMes = i;
    
    // Se comprou num dia pós-fechamento, a primeira fatura pula o mês vigente
    if (diaDaCompra > diaFechamento) {
      deslocamentoDeMes += 1;
    }
    
    dataDaParcela.setMonth(dataDaParcela.getMonth() + deslocamentoDeMes);
    dataDaParcela.setDate(diaVencimento);
  } else {
    dataDaParcela.setMonth(dataDaParcela.getMonth() + i);
  }

  itensParaSalvar.push({
    json: {
      phone: phone,
      tipo: 'gasto',
      valor: tx.valor_parcela,
      categoria: tx.categoria,
      descricao: tx.descricao + ' (' + (i+1) + '/' + tx.n_parcelas + ')',
      data: dataDaParcela.toISOString().split('T')[0],
      cartao_id: tx.cartao_id || null
    }
  });
}
return itensParaSalvar;`;

// 5. Update Claude Prompts to extract "cartao"
const claudeTextNode = data.nodes.find(n => n.name === 'Claude Parsear Texto');
claudeTextNode.parameters.jsonBody = claudeTextNode.parameters.jsonBody
    .replace(
        '\\\"data\\\": \\\"YYYY-MM-DD\\\"}\\\\n',
        '\\\"data\\\": \\\"YYYY-MM-DD\\\", \\\"cartao\\\": \\\"nome_do_cartao_se_tiver\\\"}\\\\n'
    ).replace(
        '\\\"data\\\": \\\"YYYY-MM-DD\\\"}\\\\n',
        '\\\"data\\\": \\\"YYYY-MM-DD\\\", \\\"cartao\\\": \\\"nome_do_cartao_se_tiver\\\"}\\\\n'
    );

const claudeImageNode = data.nodes.find(n => n.name === 'Claude Analisar Imagem');
if (claudeImageNode) {
    claudeImageNode.parameters.jsonBody = claudeImageNode.parameters.jsonBody.replace(
        '\\\"data\\\": \\\"YYYY-MM-DD\\\"}\\n',
        '\\\"data\\\": \\\"YYYY-MM-DD\\\", \\\"cartao\\\": \\\"nome_do_cartao_se_mencionado\\\"}\\n'
    );
}

// 6. Fix Supabase Inserts to include "cartao_id"
const addCartaoIdToJsonBody = (nodeName, baseJsonPath) => {
    const node = data.nodes.find(n => n.name === nodeName);
    if (!node) return;

    // We attach cartao_id right after "data" or "ativa"
    node.parameters.jsonBody = node.parameters.jsonBody.replace(
        /"data": "([^"]+)"\n\}/g,
        '"data": "$1",\n  "cartao_id": {{ ' + baseJsonPath + '.cartao_id ? `"${' + baseJsonPath + '.cartao_id}"` : null }}\n}'
    );
    // For Parcelado overall saving
    node.parameters.jsonBody = node.parameters.jsonBody.replace(
        /"ativa": true\n\}/g,
        '"ativa": true,\n  "cartao_id": {{ $("Vincular Cartao (JS)").first().json.transacao.cartao_id ? `"${$("Vincular Cartao (JS)").first().json.transacao.cartao_id}"` : null }}\n}'
    );
};

// "Salvar Parcelas Supabase" (Loop) uses $json from the loop
addCartaoIdToJsonBody('Salvar Parcelas Supabase', '$json');

// "Salvar no Supabase" (Normal transaction) uses $("Vincular Cartao (JS)")
addCartaoIdToJsonBody('Salvar no Supabase', '$(\'Vincular Cartao (JS)\').first().json.transacao');

// "Salvar Compra Parcelada"
addCartaoIdToJsonBody('Salvar Compra Parcelada', '');

fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
console.log('Saved modified n8n JSON to:', outputFile);
