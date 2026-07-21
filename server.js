const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

// --- CONFIGURAÇÕES DO SERVIDOR ---
const PORTA = process.env.PORT || 3000;
const PASTA_DADOS = path.join(__dirname, 'dados');
const ARQUIVO_DADOS = path.join(PASTA_DADOS, 'banco_eleitores.json');
const PASTA_UPLOADS = path.join(__dirname, 'uploads');

// --- CREDENCIAIS DE ACESSO AO PAINEL ---
const ADMIN_USER = "admin";
const ADMIN_PASS = "Rogerio123";

// Inicialização de pastas e arquivos
if (!fs.existsSync(PASTA_DADOS)) fs.mkdirSync(PASTA_DADOS, { recursive: true });
if (!fs.existsSync(PASTA_UPLOADS)) fs.mkdirSync(PASTA_UPLOADS, { recursive: true });
if (!fs.existsSync(ARQUIVO_DADOS)) fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify([], null, 2));

// Função para processar formulários com arquivos (Multipart)
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
                resultado.campos[nomeMatch[1]] = corpo.toString('utf8').trim();
            }
        });
        callback(resultado);
    });
}

const servidor = http.createServer((req, res) => {
    const url = req.url;

    // 1. ROTA: FORMULÁRIO DE CADASTRO
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
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { background:#f0f2f5; color:#1c1e21; padding:20px; display:flex; flex-direction:column; align-items:center; }
        .form-card { background:#fff; width:100%; max-width:850px; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.1); border-top:10px solid #0056b3; padding:40px; }
        h1 { text-align:center; color:#0056b3; margin-bottom:10px; font-size:28px; }
        p.subtitle { text-align:center; color:#606770; margin-bottom:30px; }
        .section-title { grid-column:span 2; background:#e7f3ff; color:#0056b3; padding:10px; font-weight:bold; margin-top:20px; border-radius:5px; font-size:14px; text-transform:uppercase; }
        .grid { display:grid; grid-template-columns:1fr 1fr; gap:15px; }
        @media (max-width:600px) { .grid { grid-template-columns:1fr; } .section-title { grid-column:span 1; } }
        .field { display:flex; flex-direction:column; margin-bottom:10px; }
        .full { grid-column:span 2; }
        label { font-size:12px; font-weight:700; margin-bottom:5px; color:#4b4f56; }
        input, select, textarea { padding:12px; border:1px solid #dddfe2; border-radius:8px; font-size:15px; background:#f5f6f7; }
        input:focus { border-color:#0056b3; outline:none; background:#fff; }
        button { width:100%; padding:18px; background:#28a745; color:#fff; border:none; border-radius:30px; font-size:18px; font-weight:bold; cursor:pointer; margin-top:25px; transition:0.2s; }
        button:hover { background:#218838; transform:scale(1.02); }
    </style>
</head>
<body>
    <div class="form-card">
        <h1>🏛️ VEREADOR IRMÃO ROGÉRIO</h1>
        <p class="subtitle">Banco de Dados para Atendimento e Mobilização</p>
        <form action="/enviar" method="POST" enctype="multipart/form-data">
            <div class="grid">
                <div class="section-title">Informações Pessoais</div>
                <div class="field full"><label>Nome Completo *</label><input type="text" name="nome" required></div>
                <div class="field"><label>Como prefere ser chamado (Apelido)</label><input type="text" name="apelido"></div>
                <div class="field"><label>Data de Nascimento *</label><input type="date" name="nascimento" required></div>
                <div class="field full"><label>Nome da Mãe (Fundamental para cadastro)</label><input type="text" name="nome_mae"></div>

                <div class="section-title">Contato & Engajamento Social</div>
                <div class="field"><label>WhatsApp/Celular *</label><input type="text" name="whatsapp" id="tel" required placeholder="(00) 00000-0000"></div>
                <div class="field"><label>E-mail</label><input type="email" name="email"></div>
                <div class="field"><label>Instagram (@seu_perfil)</label><input type="text" name="instagram" placeholder="@"></div>
                <div class="field"><label>Facebook (Link)</label><input type="text" name="facebook"></div>

                <div class="section-title">Dados Eleitorais (Exclusivo Campanha)</div>
                <div class="field"><label>Título de Eleitor</label><input type="text" name="titulo" maxlength="12"></div>
                <div class="field"><label>Zona</label><input type="text" name="zona"></div>
                <div class="field"><label>Seção</label><input type="text" name="secao"></div>
                <div class="field"><label>Militante / Apoiador?</label>
                    <select name="apoio">
                        <option value="Sim">Sim, sou apoiador</option>
                        <option value="Nao">Apenas morador</option>
                        <option value="Talvez">Gostaria de conhecer mais</option>
                    </select>
                </div>

                <div class="section-title">Endereço de Atendimento</div>
                <div class="field"><label>CEP (Busca Automática)</label><input type="text" name="cep" id="cep" placeholder="00000-000"></div>
                <div class="field"><label>Bairro *</label><input type="text" name="bairro" id="bairro" required></div>
                <div class="field full"><label>Rua e Número</label><input type="text" name="endereco" id="rua"></div>

                <div class="section-title">Sua Demanda ou Sugestão</div>
                <div class="field full"><label>Descreva sua solicitação *</label><textarea name="mensagem" rows="4" required></textarea></div>
                <div class="field full"><label>Anexar Foto do Local/Problema (Opcional)</label><input type="file" name="anexo"></div>

                <button type="submit">GRAVAR NO SISTEMA</button>
            </div>
        </form>
    </div>

    <script>
        // Máscara de Telefone
        document.getElementById('tel').oninput = function(e) {
            let x = e.target.value.replace(/\\D/g, '').match(/(\\d{0,2})(\\d{0,5})(\\d{0,4})/);
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        };
        // Busca CEP
        document.getElementById('cep').onblur = function() {
            let v = this.value.replace(/\\D/g, '');
            if(v.length==8) fetch(\`https://viacep.com.br/ws/\${v}/json/\`).then(r=>r.json()).then(d=>{
                if(!d.erro){ document.getElementById('bairro').value=d.bairro; document.getElementById('rua').value=d.logradouro; }
            });
        };
    </script>
</body>
</html>
        `);

    // 2. ROTA: RECEBER DADOS (POST)
    } else if (req.method === 'POST' && url === '/enviar') {
        processarRequisicao(req, (resul) => {
            const lista = JSON.parse(fs.readFileSync(ARQUIVO_DADOS));
            const novo = {
                id: "ELEI-" + Date.now().toString().slice(-6),
                data_hora: new Date().toLocaleString('pt-BR'),
                ...resul.campos,
                foto: resul.arquivo
            };
            lista.push(novo);
            fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(lista, null, 2));
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end("<div style='text-align:center; padding:50px; font-family:sans-serif;'><h1>✅ Cadastro Realizado!</h1><p>Obrigado por fortalecer nosso trabalho.</p><br><a href='/'>Fazer novo cadastro</a></div>");
        });

    // 3. ROTA: PAINEL ADMINISTRATIVO
    } else if (req.method === 'GET' && url === '/admin') {
        const auth = req.headers['authorization'];
        if (!auth) {
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Acesso Protegido"' });
            return res.end('Login Requerido');
        }
        
        const creds = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
        if (creds[0] !== ADMIN_USER || creds[1] !== ADMIN_PASS) {
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Acesso Protegido"' });
            return res.end('Credenciais Incorretas');
        }

        const dados = JSON.parse(fs.readFileSync(ARQUIVO_DADOS));
        let tabela = dados.map(d => `
            <tr>
                <td><b>${d.nome}</b><br><small>${d.apelido || ''}</small></td>
                <td>${d.whatsapp}<br><small>${d.instagram || ''}</small></td>
                <td>Bairro: ${d.bairro}<br><small>Z: ${d.zona} S: ${d.secao}</small></td>
                <td style="max-width:200px; font-size:12px;">${d.mensagem}</td>
                <td>${d.foto ? `<a href="/uploads/${d.foto}" target="_blank">🖼️ Ver Foto</a>` : 'Sem foto'}</td>
            </tr>
        `).join('');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <html>
            <head>
                <style>
                    body{font-family:sans-serif; background:#f0f2f5; padding:20px;}
                    table{width:100%; border-collapse:collapse; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);}
                    th,td{padding:12px; border-bottom:1px solid #eee; text-align:left;}
                    th{background:#0056b3; color:#fff; text-transform:uppercase; font-size:12px;}
                    tr:hover{background:#f9f9f9;}
                </style>
            </head>
            <body>
                <h2>📊 Banco de Dados Estratégico - Gabinete</h2>
                <p>Total de Eleitores: <b>${dados.length}</b></p><br>
                <table>
                    <tr><th>Eleitor</th><th>Contato/Rede</th><th>Localização/Voto</th><th>Demanda</th><th>Anexo</th></tr>
                    ${tabela || '<tr><td colspan="5" style="text-align:center">Nenhum registro encontrado</td></tr>'}
                </table>
            </body>
            </html>
        `);

    // 4. ROTA: SERVIR FOTOS
    } else if (url.startsWith('/uploads/')) {
        const caminho = path.join(__dirname, url);
        if (fs.existsSync(caminho)) {
            res.writeHead(200);
            fs.createReadStream(caminho).pipe(res);
        } else {
            res.writeHead(404); res.end();
        }

    } else {
        res.writeHead(404); res.end('Pagina nao encontrada');
    }
});

servidor.listen(PORTA, () => console.log("Servidor Profissional Online na porta " + PORTA));
