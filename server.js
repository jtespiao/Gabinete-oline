const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

const PORTA = process.env.PORT || 3000;
const PASTA_DADOS = path.join(__dirname, 'dados');
const ARQUIVO_DADOS = path.join(PASTA_DADOS, 'banco_vendas_licenca.json');
const PASTA_UPLOADS = path.join(__dirname, 'uploads');

const ADMIN_USER = "admin";
const ADMIN_PASS = "Rogerio123";

if (!fs.existsSync(PASTA_DADOS)) fs.mkdirSync(PASTA_DADOS, { recursive: true });
if (!fs.existsSync(PASTA_UPLOADS)) fs.mkdirSync(PASTA_UPLOADS, { recursive: true });
if (!fs.existsSync(ARQUIVO_DADOS)) fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify([], null, 2));

function processarRequisicao(req, callback) {
    let contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('boundary=')) {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => callback({ campos: querystring.parse(body), arquivo: null }));
        return;
    }
    let boundary = contentType.split('boundary=')[1];
    let chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
        let buffer = Buffer.concat(chunks);
        let partes = [];
        let start = buffer.indexOf('--' + boundary) + boundary.length + 4;
        while (start < buffer.length) {
            let end = buffer.indexOf('--' + boundary, start) - 2;
            if (end < 0) break;
            partes.push(buffer.slice(start, end));
            start = end + boundary.length + 4;
        }
        let resultado = { campos: {}, arquivo: null };
        partes.forEach(parte => {
            let divisor = parte.indexOf('\r\n\r\n');
            let cabecalho = parte.slice(0, divisor).toString();
            let corpo = parte.slice(divisor + 4);
            let nomeMatch = cabecalho.match(/name="([^"]+)"/);
            let arquivoMatch = cabecalho.match(/filename="([^"]+)"/);
            if (arquivoMatch && arquivoMatch[1] && corpo.length > 0) {
                let nomeFinal = Date.now() + "_" + arquivoMatch[1].replace(/\s+/g, '_');
                fs.writeFileSync(path.join(PASTA_UPLOADS, nomeFinal), corpo);
                resultado.arquivo = nomeFinal;
            } else if (nomeMatch) {
                resultado.campos[nameMatch[1]] = corpo.toString('utf8').trim();
            }
        });
        callback(resultado);
    });
}

const servidor = http.createServer((req, res) => {
    const url = req.url;

    if (req.method === 'GET' && url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gabinete Digital - Irmão Rogério</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Segoe UI', sans-serif; }
        body { background:#f0f2f5; padding:20px; display:flex; flex-direction:column; align-items:center; }
        .form-card { background:#fff; width:100%; max-width:850px; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.1); border-top:10px solid #0056b3; padding:30px; }
        h1 { text-align:center; color:#0056b3; margin-bottom:5px; font-size:24px; }
        .section-title { background:#e7f3ff; color:#0056b3; padding:8px; font-weight:bold; margin-top:15px; border-radius:5px; font-size:13px; text-transform:uppercase; }
        .grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:10px; }
        .field { display:flex; flex-direction:column; }
        .full { grid-column:span 2; }
        label { font-size:11px; font-weight:bold; color:#4b4f56; margin-bottom:4px; }
        input, select, textarea { padding:10px; border:1px solid #dddfe2; border-radius:6px; font-size:14px; background:#f5f6f7; }
        button { width:100%; padding:15px; background:#28a745; color:#fff; border:none; border-radius:30px; font-size:16px; font-weight:bold; cursor:pointer; margin-top:20px; }
        @media (max-width:600px) { .grid { grid-template-columns:1fr; } }
    </style>
</head>
<body>
    <div class="form-card">
        <h1>🏛️ VEREADOR IRMÃO ROGÉRIO</h1>
        <p style="text-align:center; color:#606770; font-size:14px;">Cadastro de Atendimento ao Cidadão</p>
        <form action="/enviar" method="POST" enctype="multipart/form-data">
            <div class="grid">
                <div class="section-title" style="grid-column:span 2;">1. Identificação do Eleitor</div>
                <div class="field full"><label>Nome Completo *</label><input type="text" name="nome" required></div>
                <div class="field"><label>Apelido / Como gosta de ser chamado</label><input type="text" name="apelido"></div>
                <div class="field"><label>Data de Nascimento *</label><input type="date" name="nascimento" required></div>
                <div class="field full"><label>Nome da Mãe</label><input type="text" name="nome_mae"></div>

                <div class="section-title" style="grid-column:span 2;">2. Contato e Redes Sociais</div>
                <div class="field"><label>WhatsApp * (Somente números)</label><input type="text" name="whatsapp" id="tel" required placeholder="66999999999"></div>
                <div class="field"><label>E-mail</label><input type="email" name="email"></div>
                <div class="field"><label>Instagram (@exemplo)</label><input type="text" name="instagram"></div>
                <div class="field"><label>Facebook (Link do Perfil)</label><input type="text" name="facebook"></div>

                <div class="section-title" style="grid-column:span 2;">3. Dados Eleitorais</div>
                <div class="field"><label>Título de Eleitor</label><input type="text" name="titulo"></div>
                <div class="field"><label>Zona</label><input type="text" name="zona"></div>
                <div class="field"><label>Seção</label><input type="text" name="secao"></div>
                <div class="field"><label>Nível de Apoio</label>
                    <select name="apoio">
                        <option value="Apoiador">Apoiador</option>
                        <option value="Neutro">Neutro</option>
                        <option value="Oposição">Oposição</option>
                    </select>
                </div>

                <div class="section-title" style="grid-column:span 2;">4. Localização</div>
                <div class="field"><label>CEP</label><input type="text" name="cep" id="cep"></div>
                <div class="field"><label>Bairro *</label><input type="text" name="bairro" id="bairro" required></div>
                <div class="field full"><label>Endereço Completo (Rua, Número, Complemento)</label><input type="text" name="endereco" id="rua"></div>

                <div class="section-title" style="grid-column:span 2;">5. Relato da Demanda</div>
                <div class="field full"><label>Descreva seu pedido ou sugestão *</label><textarea name="mensagem" rows="3" required></textarea></div>
                <div class="field full"><label>Anexar Foto (Opcional)</label><input type="file" name="anexo"></div>

                <button type="submit">FINALIZAR E RECEBER CÓPIA NO WHATSAPP</button>
            </div>
        </form>
    </div>
    <script>
        document.getElementById('cep').onblur = function() {
            let v = this.value.replace(/\\D/g, '');
            if(v.length==8) fetch(\`https://viacep.com.br/ws/\${v}/json/\`).then(r=>r.json()).then(d=>{
                if(!d.erro){ document.getElementById('bairro').value=d.bairro; document.getElementById('rua').value=d.logradouro; }
            });
        };
    </script>
</body>
</html>`);

    } else if (req.method === 'POST' && url === '/enviar') {
        processarRequisicao(req, (resul) => {
            const lista = JSON.parse(fs.readFileSync(ARQUIVO_DADOS));
            const protocolo = "GB" + Date.now().toString().slice(-6);
            const novo = { id: protocolo, data_hora: new Date().toLocaleString('pt-BR'), ...resul.campos, foto: resul.arquivo };
            lista.push(novo);
            fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(lista, null, 2));

            // Prepara a mensagem do WhatsApp
            const msg = `Olá! Sou o sistema do Vereador Irmão Rogério. Segue o comprovante da sua demanda:\n\n📌 *Protocolo:* ${protocolo}\n👤 *Nome:* ${novo.nome}\n🎂 *Nascimento:* ${novo.nascimento}\n📍 *Bairro:* ${novo.bairro}\n📝 *Relato:* ${novo.mensagem}\n\nObrigado por sua participação!`;
            const waLink = `https://api.whatsapp.com/send?phone=55${novo.whatsapp.replace(/\D/g,'')}&text=${encodeURIComponent(msg)}`;

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
                <div style="text-align:center; padding:50px; font-family:sans-serif;">
                    <h1 style="color:#28a745;">✅ CADASTRO REALIZADO!</h1>
                    <p>Seu protocolo é: <b>${protocolo}</b></p>
                    <br>
                    <a href="${waLink}" style="display:inline-block; padding:20px; background:#25d366; color:white; text-decoration:none; border-radius:10px; font-weight:bold; font-size:18px;">
                        📩 CLIQUE AQUI PARA RECEBER SUA CÓPIA NO WHATSAPP
                    </a>
                    <br><br>
                    <a href="/" style="color:#666;">Voltar ao início</a>
                </div>
            `);
        });

    } else if (req.method === 'GET' && url === '/admin') {
        const auth = req.headers['authorization'];
        if (!auth) { res.writeHead(401, {'WWW-Authenticate':'Basic'}); return res.end(); }
        const creds = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
        if (creds[0] !== ADMIN_USER || creds[1] !== ADMIN_PASS) return res.end('Erro');

        const dados = JSON.parse(fs.readFileSync(ARQUIVO_DADOS));
        let tabela = dados.map(d => `
            <tr>
                <td><b>${d.id}</b><br>${d.data_hora}</td>
                <td>
                    <b>${d.nome}</b> (${d.apelido || 'N/A'})<br>
                    Mãe: ${d.nome_mae || 'Não informado'}<br>
                    Nasc: ${d.nascimento}
                </td>
                <td>
                    📱 ${d.whatsapp}<br>
                    📸 ${d.instagram || '-'}<br>
                    👤 ${d.facebook || '-'}
                </td>
                <td>
                    📍 ${d.bairro}<br>
                    🏠 ${d.endereco || '-'}<br>
                    🗳️ Z: ${d.zona} S: ${d.secao}
                </td>
                <td style="font-size:11px;">${d.mensagem}</td>
                <td>${d.foto ? `<a href="/uploads/${d.foto}" target="_blank">VER ANEXO</a>` : '-'}</td>
            </tr>
        `).join('');

        res.end(`
            <style>
                table{width:100%; border-collapse:collapse; font-family:sans-serif; font-size:13px;} 
                th,td{border:1px solid #ddd; padding:8px; text-align:left;} 
                th{background:#0056b3; color:white;}
                tr:nth-child(even){background:#f2f2f2;}
            </style>
            <h2>🏛️ PAINEL ESTRATÉGICO - TODAS AS INFORMAÇÕES</h2>
            <p>Total de Eleitores: <b>${dados.length}</b></p>
            <table>
                <tr><th>Protocolo</th><th>Dados Pessoais</th><th>Contatos/Redes</th><th>Localização/Voto</th><th>Demanda</th><th>Anexo</th></tr>
                ${tabela}
            </table>
        `);

    } else if (url.startsWith('/uploads/')) {
        const caminho = path.join(__dirname, url);
        if (fs.existsSync(caminho)) fs.createReadStream(caminho).pipe(res);
        else res.end('404');
    }
});

servidor.listen(PORTA, () => console.log("Servidor Online"));
