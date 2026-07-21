const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

const PORTA = process.env.PORT || 3000;
const PASTA_PROJETO = path.join(__dirname, 'dados');
const ARQUIVO_DADOS = path.join(PASTA_PROJETO, 'demandas_campanha.json');
const PASTA_UPLOADS = path.join(__dirname, 'uploads');

const ADMIN_USER = "admin";
const ADMIN_PASS = "Rogerio123";

[PASTA_PROJETO, PASTA_UPLOADS].forEach(pasta => {
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
});
if (!fs.existsSync(ARQUIVO_DADOS)) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify([], null, 2), 'utf8');
}

function processarMultipart(req, callback) {
    let contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('boundary=')) {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => callback({ campos: querystring.parse(body), arquivo: null }));
        return;
    }
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
            if (filenameMatch && filenameMatch[1] && corpo.length > 0) {
                let nomeArquivo = Date.now() + '_' + filenameMatch[1].replace(/\s+/g, '_');
                fs.writeFileSync(path.join(PASTA_UPLOADS, nomeArquivo), corpo);
                resultado.arquivo = nomeArquivo;
            } else if (nameMatch) {
                resultado.campos[nameMatch[1]] = corpo.toString('utf8').trim();
            }
        });
        callback(resultado);
    });
}

const servidor = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cadastro Eleitoral - Gabinete Digital</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }
        body { background: #f0f4f8; padding: 20px; color: #102a43; }
        .container { background: white; max-width: 900px; margin: auto; padding: 30px; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-top: 8px solid #0063c6; }
        h2 { text-align: center; color: #0b2146; margin-bottom: 25px; text-transform: uppercase; }
        .aba-container { display: flex; justify-content: center; gap: 20px; margin-bottom: 30px; }
        .aba { padding: 10px 25px; background: #e2e8f0; border-radius: 20px; cursor: pointer; font-weight: bold; transition: 0.3s; }
        .aba.ativa { background: #0063c6; color: white; }
        .secao-titulo { grid-column: span 2; background: #f8fafc; padding: 10px; margin: 20px 0 10px 0; color: #0063c6; font-weight: bold; border-left: 5px solid #0063c6; text-transform: uppercase; font-size: 14px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .form-group { display: flex; flex-direction: column; }
        .full { grid-column: span 2; }
        label { font-size: 11px; font-weight: bold; margin-bottom: 5px; color: #486581; }
        input, select, textarea { padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
        button { grid-column: span 2; padding: 18px; background: #22c55e; color: white; border: none; border-radius: 35px; font-weight: bold; cursor: pointer; font-size: 16px; margin-top: 20px; }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <h2>🏛️ Cadastro de Eleitor - Irmão Rogério</h2>
        <form action="/enviar" method="POST" enctype="multipart/form-data">
            <div class="grid">
                <div class="secao-titulo">Dados Pessoais</div>
                <div class="form-group full"><label>Nome Completo *</label><input type="text" name="nome" required></div>
                <div class="form-group"><label>Apelido / Como gosta de ser chamado</label><input type="text" name="apelido"></div>
                <div class="form-group"><label>Data de Nascimento *</label><input type="date" name="nascimento" required></div>
                <div class="form-group full"><label>Nome da Mãe</label><input type="text" name="nome_mae"></div>
                
                <div class="secao-titulo">Contato e Redes Sociais</div>
                <div class="form-group"><label>WhatsApp/Celular *</label><input type="text" name="whatsapp" required placeholder="(00) 00000-0000"></div>
                <div class="form-group"><label>E-mail</label><input type="email" name="email"></div>
                <div class="form-group"><label>Instagram (@usuario)</label><input type="text" name="instagram"></div>
                <div class="form-group"><label>Facebook (Link)</label><input type="text" name="facebook"></div>

                <div class="secao-titulo">Informações Eleitorais (Campanha)</div>
                <div class="form-group"><label>Título de Eleitor</label><input type="text" name="titulo"></div>
                <div class="form-group"><label>Zona Eleitoral</label><input type="text" name="zona"></div>
                <div class="form-group"><label>Seção Eleitoral</label><input type="text" name="secao"></div>

                <div class="secao-titulo">Endereço Residencial</div>
                <div class="form-group"><label>CEP</label><input type="text" id="cep" name="cep"></div>
                <div class="form-group"><label>Bairro *</label><input type="text" id="bairro" name="bairro" required></div>
                <div class="form-group full"><label>Rua / Logradouro</label><input type="text" id="rua" name="rua"></div>
                <div class="form-group"><label>Número</label><input type="text" name="numero"></div>
                <div class="form-group"><label>Cidade</label><input type="text" id="cidade" name="cidade" value="Primavera do Leste"></div>

                <div class="secao-titulo">Demanda / Relato</div>
                <div class="form-group full"><label>O que você precisa ou sugere para a cidade? *</label><textarea name="mensagem" rows="4" required></textarea></div>
                <div class="form-group full"><label>Anexar Foto (Opcional)</label><input type="file" name="anexo"></div>
                
                <button type="submit">GRAVAR NO BANCO DE DADOS</button>
            </div>
        </form>
    </div>
    <script>
        document.getElementById('cep').addEventListener('blur', function() {
            let cep = this.value.replace(/\\D/g, '');
            if (cep.length === 8) {
                fetch(\`https://viacep.com.br/ws/\${cep}/json/\`).then(r => r.json()).then(d => {
                    if(!d.erro) {
                        document.getElementById('bairro').value = d.bairro;
                        document.getElementById('rua').value = d.logradouro;
                        document.getElementById('cidade').value = d.localidade;
                    }
                });
            }
        });
    </script>
</body>
</html>
        `);

    } else if (req.method === 'POST' && req.url === '/enviar') {
        processarMultipart(req, (resultado) => {
            const demandas = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
            const nova = {
                protocolo: 'ELEI' + Date.now().toString().slice(-5),
                data: new Date().toLocaleString('pt-BR'),
                ...resultado.campos,
                arquivo: resultado.arquivo
            };
            demandas.push(nova);
            salvarDemandas(demandas);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end("<h1>Cadastro concluído! Obrigado pelo apoio.</h1><a href='/'>Voltar</a>");
        });

    } else if (req.method === 'GET' && req.url === '/admin') {
        const auth = req.headers['authorization'];
        if (!auth) {
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin"' });
            return res.end('Login Requerido.');
        }
        const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
        if (user !== ADMIN_USER || pass !== ADMIN_PASS) return res.end('Erro.');

        const demandas = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
        let linhas = demandas.map(d => `
            <tr>
                <td><b>${d.nome}</b><br>(${d.apelido || 'Sem apelido'})</td>
                <td>${d.whatsapp}<br>${d.instagram || ''}</td>
                <td>Bairro: ${d.bairro}<br>Zona: ${d.zona} | Seção: ${d.secao}</td>
                <td>${d.mensagem}</td>
                <td><a href="/uploads/${d.arquivo}" target="_blank">${d.arquivo ? 'Ver Foto' : '-'}</a></td>
            </tr>
        `).join('');

        res.end(`
            <style>table{width:100%; border-collapse:collapse; font-family:sans-serif;} th,td{border:1px solid #ddd; padding:10px; text-align:left;} th{background:#0b2146; color:white;}</style>
            <h2>Banco de Dados de Campanha</h2>
            <table>
                <tr><th>Eleitor</th><th>Contato/Redes</th><th>Localização/Voto</th><th>Demanda</th><th>Foto</th></tr>
                ${linhas}
            </table>
        `);

    } else if (req.url.startsWith('/uploads/')) {
        const file = path.join(__dirname, req.url);
        if (fs.existsSync(file)) fs.createReadStream(file).pipe(res);
        else res.end('404');
    }
});

function salvarDemandas(d) { fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(d, null, 2)); }

servidor.listen(PORTA, () => console.log("Rodando porta " + PORTA));
