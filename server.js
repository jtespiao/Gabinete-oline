const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

// Configurações de Porta e Pastas para o Render
const PORTA = process.env.PORT || 3000;
const PASTA_DADOS = path.join(__dirname, 'dados');
const ARQUIVO_DADOS = path.join(PASTA_DADOS, 'demandas.json');

// LOGIN DO PAINEL ADMIN (Mude para o seu cliente)
const ADMIN_USER = "admin";
const ADMIN_PASS = "Rogerio123";

if (!fs.existsSync(PASTA_DADOS)) fs.mkdirSync(PASTA_DADOS);
if (!fs.existsSync(ARQUIVO_DADOS)) fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify([]));

const servidor = http.createServer((req, res) => {
    
    // 1. PÁGINA INICIAL (FORMULÁRIO)
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Gabinete Digital</title>
                <style>
                    body { font-family: sans-serif; background: #f0f4f8; padding: 20px; color: #102a43; }
                    .card { background: white; max-width: 500px; margin: auto; padding: 30px; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                    h2 { color: #0063c6; text-align: center; }
                    input, textarea, button { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ccc; border-radius: 8px; box-sizing: border-box; }
                    button { background: #22c55e; color: white; border: none; font-weight: bold; cursor: pointer; }
                    .footer { text-align: center; font-size: 12px; color: #627d98; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>🏛️ Gabinete Digital</h2>
                    <p style="text-align:center">Envie sua demanda para o vereador</p>
                    <form action="/enviar" method="POST">
                        <label>Nome Completo:</label>
                        <input type="text" name="nome" required>
                        <label>WhatsApp:</label>
                        <input type="text" name="whatsapp" required placeholder="(00) 00000-0000">
                        <label>Sua Mensagem:</label>
                        <textarea name="mensagem" rows="4" required></textarea>
                        <button type="submit">Enviar Solicitação</button>
                    </form>
                </div>
                <div class="footer">© 2024 Gabinete Digital Pro</div>
            </body>
            </html>
        `);

    // 2. PROCESSAR ENVIO
    } else if (req.method === 'POST' && req.url === '/enviar') {
        let corpo = '';
        req.on('data', chunk => corpo += chunk.toString());
        req.on('end', () => {
            const dados = querystring.parse(corpo);
            const demandas = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
            demandas.push({ id: Date.now(), data: new Date().toLocaleString('pt-BR'), ...dados });
            fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(demandas, null, 2));
            res.end("<h1>Sucesso! Recebemos sua demanda.</h1><a href='/'>Voltar</a>");
        });

    // 3. PAINEL ADMIN (PROTEGIDO)
    } else if (req.method === 'GET' && req.url === '/admin') {
        const auth = req.headers['authorization'];
        if (!auth) {
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Acesso Restrito"' });
            return res.end('Acesso negado.');
        }
        const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
        if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
            res.writeHead(401); return res.end('Usuario ou senha invalidos.');
        }

        const demandas = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
        let linhas = demandas.map(d => `<tr><td>${d.data}</td><td>${d.nome}</td><td>${d.whatsapp}</td><td>${d.mensagem}</td></tr>`).join('');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <h2>Painel de Gestão - Demandas</h2>
            <table border="1" style="width:100%; border-collapse: collapse;">
                <tr style="background:#0b2146; color:white"><th>Data</th><th>Nome</th><th>WhatsApp</th><th>Mensagem</th></tr>
                ${linhas}
            </table>
            <br><a href="/">Sair</a>
        `);

    } else {
        res.writeHead(404); res.end("Nao encontrado");
    }
});

servidor.listen(PORTA, () => {
    console.log("Servidor rodando na porta " + PORTA);
});
