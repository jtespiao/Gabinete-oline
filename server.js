const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

// CONFIGURAÇÕES DE AMBIENTE (Nuvem)
const PORTA = process.env.PORT || 3000;
const PASTA_DADOS = path.join(__dirname, 'dados');
const ARQUIVO_DADOS = path.join(PASTA_DADOS, 'demandas_gabinete.json');
const PASTA_UPLOADS = path.join(__dirname, 'uploads');

// LOGIN DO PAINEL ADMIN (Mude aqui para sua segurança)
const ADMIN_USER = "admin";
const ADMIN_PASS = "Rogerio123";

// Garante a existência das pastas
[PASTA_DADOS, PASTA_UPLOADS].forEach(pasta => {
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
});
if (!fs.existsSync(ARQUIVO_DADOS)) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify([], null, 2), 'utf8');
}

// Função para processar Uploads sem bibliotecas externas
function processarMultipart(req, callback) {
    let contentType = req.headers['content-type'];
    let boundary = contentType.split('boundary=')[1];
    let dadosBuffer = [];
    req.on('data', chunk => dadosBuffer.push(chunk));
    req.on('end', () => {
        let bufferCompleto = Buffer.concat(dadosBuffer);
        let partes = [];
        let index = bufferCompleto.indexOf('--' + boundary);
        while (index !== -1) {
            let proximoIndex = bufferCompleto.indexOf('--' + boundary, index + boundary.length + 2);
            if (proximoIndex === -1) break;
            let parte = bufferCompleto.slice(index + boundary.length + 4, proximoIndex - 2);
            partes.push(parte);
            index = proximoIndex;
        }
        let resultado = { campos: {}, arquivo: null };
        partes.forEach(parte => {
            let headerEnd = parte.indexOf('\r\n\r\n');
            if (headerEnd === -1) return;
            let header = parte.slice(0, headerEnd).toString();
            let corpo = parte.slice(headerEnd + 4);
            let nameMatch = header.match(/name="([^"]+)"/);
            let filenameMatch = header.match(/filename="([^"]+)"/);
            if (filenameMatch && filenameMatch[1]) {
                if (corpo.length > 0) {
                    let nomeArquivo = Date.now() + '_' + filenameMatch[1].replace(/\s+/g, '_');
                    fs.writeFileSync(path.join(PASTA_UPLOADS, nomeArquivo), corpo);
                    resultado.arquivo = nomeArquivo;
                }
            } else if (nameMatch) {
                resultado.campos[nameMatch[1]] = corpo.toString('utf8').trim();
            }
        });
        callback(resultado);
    });
}

const servidor = http.createServer((req, res) => {
    
    // 1. O FORMULÁRIO (HOME)
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        // Aqui vai o código HTML Gigante que você mandou no começo (O formulário do Irmão Rogério)
        // [VOU RESUMIR PARA CABER AQUI, MAS VOCÊ PODE COLAR O SEU HTML COMPLETO AQUI]
        res.end(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Autocadastro - Vereador</title>
                <!-- COLE AQUI TODO O SEU STYLE E HTML DO FORMULÁRIO -->
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; font-family: sans-serif; }
                    body { background: #f0f4f8; padding: 20px; }
                    .container { background: white; max-width: 800px; margin: auto; padding: 20px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                    h1 { color: #0b2146; text-align: center; margin-bottom: 20px; }
                    input, select, textarea { width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 5px; }
                    button { width: 100%; padding: 15px; background: #0063c6; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>VEREADOR IRMÃO ROGÉRIO</h1>
                    <form action="/enviar" method="POST" enctype="multipart/form-data">
                        <label>Nome Completo:</label><input type="text" name="nome" required>
                        <label>WhatsApp:</label><input type="text" name="contato" required>
                        <label>Bairro:</label><input type="text" name="bairro" required>
                        <label>Mensagem:</label><textarea name="mensagem" rows="4"></textarea>
                        <label>Anexo:</label><input type="file" name="anexo">
                        <button type="submit">CONFIRMAR CADASTRO</button>
                    </form>
                </div>
            </body>
            </html>
        `);

    // 2. PAINEL ADMIN ( PROTEGIDO POR SENHA )
    } else if (req.method === 'GET' && req.url === '/admin') {
        const auth = req.headers['authorization'];
        if (!auth) {
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Acesso Restrito"' });
            return res.end('Acesso negado.');
        }
        const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
        if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
            res.writeHead(401); return res.end('Login Invalido.');
        }

        const demandas = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
        
        // Geração da Tabela (O código que você mostrou no print)
        let linhas = demandas.map(d => `
            <tr>
                <td>${d.id_protocolo || 'GB-'+Date.now()}</td>
                <td>${d.nome} <br> ${d.contato}</td>
                <td>${d.bairro} - ${d.cidade || 'MT'}</td>
                <td>${d.mensagem}</td>
                <td><span style="background:orange; padding:5px; border-radius:5px;">${d.status || 'PENDENTE'}</span></td>
            </tr>
        `).join('');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <html>
            <head>
                <title>Painel Admin</title>
                <style>
                    body { font-family: sans-serif; background: #f0f4f8; }
                    table { width: 100%; border-collapse: collapse; background: white; }
                    th { background: #0b2146; color: white; padding: 15px; text-align: left; }
                    td { padding: 15px; border-bottom: 1px solid #eee; }
                </style>
            </head>
            <body>
                <h2 style="padding:20px;">🏛️ Monitor de Demandas - Painel Administrativo</h2>
                <table>
                    <tr><th>Protocolo</th><th>Dados</th><th>Localização</th><th>Mensagem</th><th>Status</th></tr>
                    ${linhas}
                </table>
            </body>
            </html>
        `);

    // 3. RECEBER DADOS
    } else if (req.method === 'POST' && req.url === '/enviar') {
        processarMultipart(req, (resultado) => {
            const demandas = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
            const nova = {
                id_protocolo: 'GB-' + Math.floor(Math.random() * 100000),
                status: 'PENDENTE',
                data_registro: new Date().toISOString(),
                ...resultado.campos,
                arquivo: resultado.arquivo
            };
            demandas.push(nova);
            fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(demandas, null, 2));
            res.end("<h1>Cadastro Realizado!</h1><a href='/'>Voltar</a>");
        });

    } else {
        res.writeHead(404); res.end("404 Not Found");
    }
});

servidor.listen(PORTA, () => {
    console.log("Servidor ativo na porta " + PORTA);
});
