const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

// --- CONFIGURAÇÕES DE AMBIENTE ---
const PORTA = process.env.PORT || 3000;
const PASTA_DADOS = path.join(__dirname, 'dados');
const ARQUIVO_DADOS = path.join(PASTA_DADOS, 'banco_eleitores_pro.json');
const PASTA_UPLOADS = path.join(__dirname, 'uploads');

// --- ACESSO ADMINISTRATIVO ---
const ADMIN_USER = "admin";
const ADMIN_PASS = "Rogerio123";

// Inicialização de pastas e arquivos
if (!fs.existsSync(PASTA_DADOS)) fs.mkdirSync(PASTA_DADOS, { recursive: true });
if (!fs.existsSync(PASTA_UPLOADS)) fs.mkdirSync(PASTA_UPLOADS, { recursive: true });
if (!fs.existsSync(ARQUIVO_DADOS)) fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify([], null, 2));

// Função para processar formulários (Multipart/Upload)
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

    // 1. ROTA: FORMULÁRIO DE CADASTRO (HOME)
    if (req.method === 'GET' && url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gabinete Digital - Vereador Irmão Rogério</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Segoe UI', sans-serif; }
        body { background:#f4f7f9; padding:20px; display:flex; flex-direction:column; align-items:center; }
        .form-card { background:#fff; width:100%; max-width:850px; border-radius:15px; box-shadow:0 10px 30px rgba(0,0,0,0.1); border-top:10px solid #0056b3; padding:35px; }
        h1 { text-align:center; color:#0b2146; font-size:26px; margin-bottom:5px; }
        .section-header { background:#e7f3ff; color:#0056b3; padding:10px 15px; font-weight:bold; margin-top:25px; border-radius:8px; font-size:13px; text-transform:uppercase; border-left:5px solid #0056b3; }
        .grid { display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-top:12px; }
        .field { display:flex; flex-direction:column; }
        .full { grid-column:span 2; }
        label { font-size:12px; font-weight:bold; color:#4b4f56; margin-bottom:5px; }
        input, select, textarea { padding:12px; border:1px solid #cbd5e1; border-radius:8px; font-size:15px; background:#f9fafb; }
        input:focus { border-color:#0056b3; outline:none; background:#fff; }
        button { width:100%; padding:18px; background:#28a745; color:#fff; border:none; border-radius:40px; font-size:18px; font-weight:bold; cursor:pointer; margin-top:30px; transition:0.3s; }
        button:hover { background:#218838; transform:translateY(-2px); }
        @media (max-width:600px) { .grid { grid-template-columns:1fr; } }
    </style>
</head>
<body>
    <div class="form-card">
        <h1>🏛️ VEREADOR IRMÃO ROGÉRIO</h1>
        <p style="text-align:center; color:#627d98; font-size:15px;">Sistema de Cadastro e Atendimento Parlamentar</p>
        <form action="/enviar" method="POST" enctype="multipart/form-data">
            <div class="grid">
                <div class="section-header" style="grid-column:span 2;">Informações do Eleitor</div>
                <div class="field full"><label>Nome Completo *</label><input type="text" name="nome" required></div>
                <div class="field"><label>Apelido / Como gosta de ser chamado</label><input type="text" name="apelido"></div>
                <div class="field"><label>Data de Nascimento *</label><input type="date" name="nascimento" required></div>
                <div class="field full"><label>Nome da Mãe (Fundamental para o Banco de Dados)</label><input type="text" name="nome_mae"></div>

                <div class="section-header" style="grid-column:span 2;">Contato & Redes Sociais</div>
                <div class="field"><label>WhatsApp (Somente números) *</label><input type="text" name="whatsapp" id="tel" required placeholder="Ex: 66999998877"></div>
                <div class="field"><label>Instagram (@usuario)</label><input type="text" name="instagram" placeholder="@"></div>
                <div class="field full"><label>Facebook (Link do Perfil)</label><input type="text" name="facebook"></div>

                <div class="section-header" style="grid-column:span 2;">Informações de Campanha / Voto</div>
                <div class="field"><label>Título de Eleitor</label><input type="text" name="titulo"></div>
                <div class="field"><label>Zona Eleitoral</label><input type="text" name="zona"></div>
                <div class="field"><label>Seção Eleitoral</label><input type="text" name="secao"></div>
                <div class="field"><label>Grau de Apoio</label>
                    <select name="apoio">
                        <option value="Apoiador 100%">Apoiador 100%</option>
                        <option value="Simpatizante">Simpatizante</option>
                        <option value="Em negociação">Em negociação</option>
                    </select>
                </div>

                <div class="section-header" style="grid-column:span 2;">Localização e Endereço</div>
                <div class="field"><label>CEP (Busca Automática)</label><input type="text" name="cep" id="cep"></div>
                <div class="field"><label>Bairro *</label><input type="text" name="bairro" id="bairro" required></div>
                <div class="field full"><label>Endereço / Logradouro (Rua, Nº, Apto)</label><input type="text" name="endereco" id="rua"></div>

                <div class="section-header" style="grid-column:span 2;">Demanda Parlamentar</div>
                <div class="field full"><label>Relate seu pedido ou sugestão detalhadamente *</label><textarea name="mensagem" rows="4" required></textarea></div>
                <div class="field full"><label>Enviar Foto/Documento (Opcional)</label><input type="file" name="anexo"></div>

                <button type="submit">GRAVAR DADOS E SOLICITAR CÓPIA WHATSAPP</button>
            </div>
        </form>
    </div>
    <script>
        document.getElementById('tel').oninput = function(e) {
            let x = e.target.value.replace(/\\D/g, '').match(/(\\d{0,2})(\\d{0,5})(\\d{0,4})/);
            if(x) e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        };
        document.getElementById('cep').onblur = function() {
            let v = this.value.replace(/\\D/g, '');
            if(v.length==8) fetch(\`https://viacep.com.br/ws/\${v}/json/\`).then(r=>r.json()).then(d=>{
                if(!d.erro){ document.getElementById('bairro').value=d.bairro; document.getElementById('rua').value=d.logradouro; }
            });
        };
    </script>
</body>
</html>`);

    // 2. ROTA: RECEBER E SALVAR DADOS (POST)
    } else if (req.method === 'POST' && url === '/enviar') {
        processarRequisicao(req, (resul) => {
            const lista = JSON.parse(fs.readFileSync(ARQUIVO_DADOS));
            const protocolo = "GAB" + Date.now().toString().slice(-6);
            const novo = { id: protocolo, data: new Date().toLocaleString('pt-BR'), ...resul.campos, foto: resul.arquivo };
            lista.push(novo);
            fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(lista, null, 2));

            // Link do WhatsApp com todos os dados preenchidos para o eleitor
            const msg = `🏛️ *COMPROVANTE DE CADASTRO*\nGabinete Vereador Irmão Rogério\n\n*Protocolo:* ${protocolo}\n*Nome:* ${novo.nome}\n*WhatsApp:* ${novo.whatsapp}\n*Bairro:* ${novo.bairro}\n*Demanda:* ${novo.mensagem}\n\n_Cadastro realizado com sucesso via Gabinete Digital!_`;
            const waLink = `https://api.whatsapp.com/send?phone=55${novo.whatsapp.replace(/\D/g,'')}&text=${encodeURIComponent(msg)}`;

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
                <div style="text-align:center; padding:60px; font-family:sans-serif; background:#f4f7f9; min-height:100vh;">
                    <div style="background:white; padding:40px; border-radius:20px; display:inline-block; box-shadow:0 10px 20px rgba(0,0,0,0.05);">
                        <h1 style="color:#28a745;">✅ SUCESSO!</h1>
                        <p style="font-size:18px; color:#4b4f56;">Seus dados foram gravados no sistema.</p>
                        <p style="font-size:20px;">Protocolo: <b>${protocolo}</b></p>
                        <br><br>
                        <a href="${waLink}" style="display:inline-block; padding:20px 40px; background:#25d366; color:white; text-decoration:none; border-radius:50px; font-weight:bold; font-size:18px;">
                            📩 RECEBER MINHA CÓPIA NO WHATSAPP
                        </a>
                        <br><br>
                        <a href="/" style="color:#0056b3; font-weight:bold;">Voltar para o início</a>
                    </div>
                </div>
            `);
        });

    // 3. ROTA: PAINEL ADMINISTRATIVO (CORRIGIDO)
    } else if (req.method === 'GET' && url === '/admin') {
        const auth = req.headers['authorization'];
        
        // Se não houver autenticação ou se estiver errada, pede novamente
        if (!auth) {
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Acesso Restrito ao Gabinete"' });
            return res.end('Autenticacao necessaria.');
        }

        const creds = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
        if (creds[0] !== ADMIN_USER || creds[1] !== ADMIN_PASS) {
            // Se a senha estiver errada, enviamos o 401 de novo para forçar a caixinha de login
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Senha Incorreta - Tente Novamente"' });
            return res.end('Usuario ou senha incorretos.');
        }

        const dados = JSON.parse(fs.readFileSync(ARQUIVO_DADOS));
        let tabela = dados.map(d => `
            <tr>
                <td style="font-family:monospace; color:#0056b3;"><b>${d.id}</b><br>${d.data}</td>
                <td>
                    <b>${d.nome}</b> (${d.apelido || 'N/A'})<br>
                    <small>Mãe: ${d.nome_mae || 'N/I'}</small><br>
                    <small>Nasc: ${d.nascimento}</small>
                </td>
                <td>
                    📱 ${d.whatsapp}<br>
                    📸 ${d.instagram || '-'}<br>
                    👤 ${d.facebook || '-'}
                </td>
                <td>
                    📍 ${d.bairro}<br>
                    🏠 ${d.endereco || '-'}<br>
                    🗳️ <b>Z: ${d.zona || '-'} S: ${d.secao || '-'}</b><br>
                    ⭐ Apoio: ${d.apoio}
                </td>
                <td style="font-size:12px; color:#333;">${d.mensagem}</td>
                <td style="text-align:center;">${d.foto ? `<a href="/uploads/${d.foto}" target="_blank" style="text-decoration:none;">🖼️ VER</a>` : '-'}</td>
            </tr>
        `).join('');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <html>
            <head>
                <title>Painel Admin - Campanha Pro</title>
                <style>
                    body{font-family:sans-serif; background:#f0f2f5; padding:20px;}
                    .container{background:#fff; border-radius:12px; padding:25px; box-shadow:0 4px 15px rgba(0,0,0,0.1);}
                    table{width:100%; border-collapse:collapse; margin-top:15px;}
                    th,td{border:1px solid #e1e4e8; padding:12px; text-align:left;}
                    th{background:#0056b3; color:white; font-size:12px; text-transform:uppercase;}
                    tr:hover{background:#f8f9fa;}
                    .header{display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #eee; padding-bottom:15px;}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>📊 BANCO DE DADOS - GABINETE DIGITAL</h2>
                        <span>Total de Eleitores: <b>${dados.length}</b></span>
                    </div>
                    <table>
                        <thead>
                            <tr><th>Protocolo</th><th>Identificação</th><th>Contatos</th><th>Voto/Local</th><th>Relato</th><th>Anexo</th></tr>
                        </thead>
                        <tbody>${tabela || '<tr><td colspan="6" style="text-align:center">Nenhum registro até agora.</td></tr>'}</tbody>
                    </table>
                </div>
            </body>
            </html>
        `);

    // 4. SERVIR ARQUIVOS DE UPLOAD
    } else if (url.startsWith('/uploads/')) {
        const file = path.join(__dirname, url);
        if (fs.existsSync(file)) {
            res.writeHead(200);
            fs.createReadStream(file).pipe(res);
        } else {
            res.writeHead(404); res.end();
        }

    } else {
        res.writeHead(404); res.end('Nao encontrado');
    }
});

servidor.listen(PORTA, () => console.log("Servidor Profissional rodando na porta " + PORTA));
