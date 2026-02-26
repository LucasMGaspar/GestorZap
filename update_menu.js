const fs = require('fs');

const inputFile = 'C:\\Users\\maju2\\Downloads\\Gestor Financeiro WhatsApp (VincularCartoes).json';

let data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

const helpNode = data.nodes.find(n => n.name === 'Mensagem de Ajuda (Z-API)');
if (helpNode) {
    helpNode.parameters.jsonBody = `={
  "phone": "{{ $('Detectar Intenção').first().json.phone }}",
  "message": "👋 Olá! Sou seu *Gestor Financeiro* 💰\\n\\n📝 *Registrar gasto:*\\n  _'Gastei 50 no mercado'_\\n  _'Paguei 89,90 de aluguel'_\\n\\n💳 *Compras no Cartão (NOVO):*\\n  _'Comprei uma roupa de 300 em 3x no Nubank'_\\n  (As parcelas vão cair no dia de vencimento do cartão que você cadastrou no dashboard!)\\n\\n💵 *Registrar receita:*\\n  _'Recebi 3000 de salário'_\\n\\n🧾 *Comprovante:*\\n  Envie uma foto do comprovante!\\n\\n📊 *Ver extrato e configurar Cartões:*\\n  Digite _dashboard_ ou _menu_\\n\\nVamos lá! 🚀"
}`;
    fs.writeFileSync(inputFile, JSON.stringify(data, null, 2));
    console.log('Mensagem de ajuda atualizada com sucesso no arquivo JSON!');
} else {
    console.log('Nó de ajuda não encontrado!');
}
