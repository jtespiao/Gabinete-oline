const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

const PORTA = process.env.PORT || 3000;
const PASTA_PROJETO = path.join(__dirname, 'dados');
const ARQUIVO_DADOS = path.join(PASTA_PROJETO, 'demandas_gabinete.json');
const PASTA_UPLOADS = path.join(__dirname, 'uploads');

// Garante a existência das pastas
[PASTA_PROJETO, PASTA_UPLOADS].forEach(pasta => {
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
});
if (!fs.existsSync(ARQUIVO_DADOS)) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify([], null, 2), 'utf8');
}

const servidor = http.createServer((req, res) => {
    // Rota Principal
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end("<h1>Servidor Online!</h1><p>O Gabinete Digital esta funcionando.</p>");
    } else {
        res.writeHead(404);
        res.end("Pagina nao encontrada");
    }
});

servidor.listen(PORTA, () => {
    console.log("Servidor rodando com sucesso na porta " + PORTA);
});
