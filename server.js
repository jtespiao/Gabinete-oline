const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

// CONFIGURAÇÕES DE AMBIENTE (Render / Nuvem)
const PORTA = process.env.PORT || 3000;
const PASTA_DADOS = path.join(__dirname, 'dados');
const ARQUIVO_DADOS = path.join(PASTA_DADOS, 'demandas_gabinete.json');
const PASTA_UPLOADS = path.join(__dirname, 'uploads');

// CREDENCIAIS ADMIN
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "Rogerio123";

// Garante que os diretórios existam
[PASTA_DADOS, PASTA_UPLOADS].forEach(pasta => {
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
});
if (!fs.existsSync(ARQUIVO_DADOS)) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify([], null, 2), 'utf8');
}

// Servidor Principal
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const url = new URL(req.url, `http://${req.headers.host}`);

    // ----------------------------------------------------
    // 1. ROTA: PÁGINA INICIAL (O FORMULÁRIO VISUAL)
    // ----------------------------------------------------
    if (url.pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Gabinete Digital - Irmão Rogério</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }
                    body { background: #f0f4f8; padding: 20px; color: #102a43; display: flex; flex-direction: column; align-items: center; }
                    .container { background: white; width: 100%; max-width: 800px; padding: 40px; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-top: 6px solid #0063c6; }
                    h1 { color: #0b2146; text-align: center; font-size: 24px; margin-bottom: 10px; }
                    p { text-align: center; color: #627d98; margin-bottom: 30px; }
                    .form-group { margin-bottom: 15px; }
                    label { display: block; font-size: 12px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
                    input, textarea, select { width: 100%; padding: 12px; border: 2px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
                    button { width: 100%; padding: 15px; background: #0063c6; color: white; border: none; border-radius: 30px; font-weight: bold; cursor: pointer; font-size: 16px; transition: 0.3s; margin-top: 10px; }
                    button:hover { background: #0b2146; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>VEREADOR IRMÃO ROGÉRIO</h1>
                    <p>Preencha os campos abaixo para registrar sua demanda</p>
                    <form action="/api/demandas" method="POST">
                        <div class="form-group"><label>Nome Completo *</label><input type="text" name="nome_completo" required></div>
                        <div class="form-group"><label>WhatsApp/Telefone *</label><input type="text" name="telefone" required></div>
                        <div class="form-group"><label>Bairro *</label><input type="text" name="bairro" required></div>
                        <div class="form-group"><label>Assunto</label><input type="text" name="assunto"></div>
                        <div class="form-group"><label>Descrição da Demanda *</label><textarea name="descricao" rows="5" required></textarea></div>
                        <button type="submit">CONFIRMAR CADASTRO</button>
                    </form>
                </div>
                <p style="margin-top:20px; font-size:12px;">© 2024 Gabinete Digital Pro</p>
            </body>
            </html>
        `);
        return;
    }

    // ----------------------------------------------------
    // 2. ROTA: RECEBER DADOS DO FORMULÁRIO (POST)
    // ----------------------------------------------------
    if (url.pathname === '/api/demandas' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            const dadosForm = querystring.parse(body);
            const conteudo = fs.readFileSync(ARQUIVO_DADOS, 'utf8');
            const demandas = JSON.parse(conteudo || '[]');

            const novaDemanda = {
                protocolo: 'GB-' + Math.floor(100000 + Math.random() * 900000),
                data: new Date().toLocaleString('pt-BR'),
                status: 'Pendente',
                ...dadosForm
            };

            demandas.push(novaDemanda);
            fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(demandas, null, 2));

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<h2>Sucesso!</h2><p>Protocolo: ${novaDemanda.protocolo}</p><a href="/">Voltar</a>`);
        });
        return;
    }

    // ----------------------------------------------------
    // 3. ROTA: PAINEL ADMIN VISUAL (GET /admin)
    // ----------------------------------------------------
    if (url.pathname === '/admin' && req.method === 'GET') {
        const auth = req.headers['authorization'];
        if (!auth) {
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Acesso Restrito"' });
            return res.end('Acesso negado.');
        }
        const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
        if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
            res.writeHead(401); return res.end('Usuario ou senha incorretos.');
        }

        const demandas = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
        let linhas = demandas.map(d => `
            <tr>
                <td style="font-family:monospace; font-weight:bold;">${d.protocolo}</td>
                <td><b>${d.nome_completo}</b><br>${d.telefone}</td>
                <td>${d.bairro}</td>
                <td>${d.descricao}</td>
                <td><span style="background:#feebc8; color:#c05621; padding:5px; border-radius:5px; font-weight:bold;">${d.status}</span></td>
            </tr>
        `).join('');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <html>
            <head>
                <title>Painel Admin - Monitor de Demandas</title>
                <style>
                    body { font-family: sans-serif; background: #f0f4f8; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; }
                    th { background: #0b2146; color: white; padding: 15px; text-align: left; }
                    td { padding: 15px; border-bottom: 1px solid #eee; font-size: 14px; }
                    h2 { color: #0b2146; }
                </style>
            </head>
            <body>
                <h2>🏛️ Painel Administrativo - Gabinete Digital</h2>
                <br>
                <table>
                    <tr><th>Protocolo</th><th>Cidadão</th><th>Bairro</th><th>Mensagem</th><th>Status</th></tr>
                    ${linhas || '<tr><td colspan="5">Nenhuma demanda cadastrada.</td></tr>'}
                </table>
            </body>
            </html>
        `);
        return;
    }

    // Fallback para rotas não encontradas
    res.writeHead(404);
    res.end("Página não encontrada.");
});

server.listen(PORTA, () => {
    console.log(`Servidor rodando na porta ${PORTA}`);
});
