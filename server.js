const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

// CONFIGURAÇÕES DE AMBIENTE (Render / Nuvem)
const PORTA = process.env.PORT || 3000;
const PASTA_DADOS = path.join(__dirname, 'dados');
const ARQUIVO_DADOS = path.join(PASTA_DADOS, 'demandas_gabinete.json');
const PASTA_UPLOADS = path.join(__dirname, 'uploads');

// CREDENCIAIS ADMIN (Prioriza variáveis de ambiente do Render)
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "Rogerio123";

// Garante que os diretórios necessários existam
[PASTA_DADOS, PASTA_UPLOADS].forEach(pasta => {
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
});

if (!fs.existsSync(ARQUIVO_DADOS)) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify([], null, 2), 'utf8');
}

// Funções Auxiliares de Banco de Dados JSON
function lerDemandas() {
    try {
        const conteudo = fs.readFileSync(ARQUIVO_DADOS, 'utf8');
        return JSON.parse(conteudo || '[]');
    } catch (e) {
        return [];
    }
}

function salvarDemandas(dados) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2), 'utf8');
}

// Servidor HTTP Principal
const server = http.createServer((req, res) => {
    // Configuração de CORS para permitir requisições no Render
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    // ----------------------------------------------------
    // 1. ROTA: NOVA DEMANDA (POST /api/demandas)
    // ----------------------------------------------------
    if (pathname === '/api/demandas' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const dadosForm = JSON.parse(body);
                const demandas = lerDemandas();

                const novaDemanda = {
                    protocolo: 'GB-' + Date.now().toString().slice(-6),
                    data_criacao: new Date().toISOString(),
                    status: 'Pendente', // Status inicial
                    nome_completo: dadosForm.nome_completo || '',
                    cpf: (dadosForm.cpf || '').replace(/\D/g, ''),
                    telefone: dadosForm.telefone || '',
                    bairro: dadosForm.bairro || '',
                    endereco: dadosForm.endereco || '',
                    assunto: dadosForm.assunto || '',
                    descricao: dadosForm.observacao || dadosForm.descricao || '',
                    resposta_admin: ''
                };

                demandas.push(novaDemanda);
                salvarDemandas(demandas);

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    sucesso: true, 
                    mensagem: 'Demanda registrada com sucesso!', 
                    protocolo: novaDemanda.protocolo 
                }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ sucesso: false, erro: 'Dados inválidos.' }));
            }
        });
        return;
    }

    // ----------------------------------------------------
    // 2. ROTA ELEITOR: CONSULTAR STATUS (GET /api/eleitor/consulta)
    // ----------------------------------------------------
    if (pathname === '/api/eleitor/consulta' && req.method === 'GET') {
        const busca = parsedUrl.searchParams.get('busca') || '';
        const buscaLimpa = busca.replace(/\D/g, '');
        const demandas = lerDemandas();

        // Busca por Protocolo exato ou por CPF
        const resultados = demandas.filter(d => 
            d.protocolo.toLowerCase() === busca.toLowerCase() || 
            (buscaLimpa && d.cpf === buscaLimpa)
        ).map(d => ({
            protocolo: d.protocolo,
            data: d.data_criacao,
            status: d.status,
            assunto: d.assunto,
            resposta: d.resposta_admin || 'Sua solicitação está em análise pelo gabinete.'
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ sucesso: true, demandas: resultados }));
    }

    // ----------------------------------------------------
    // 3. ROTA ADMIN: LOGIN (POST /api/admin/login)
    // ----------------------------------------------------
    if (pathname === '/api/admin/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const creds = JSON.parse(body);
                if (creds.usuario === ADMIN_USER && creds.senha === ADMIN_PASS) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ sucesso: true, token: 'auth-admin-ok' }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ sucesso: false, erro: 'Usuário ou senha incorretos.' }));
                }
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ sucesso: false, erro: 'Requisição inválida.' }));
            }
        });
        return;
    }

    // ----------------------------------------------------
    // 4. ROTA ADMIN: LISTAR TODAS AS DEMANDAS (GET /api/admin/demandas)
    // ----------------------------------------------------
    if (pathname === '/api/admin/demandas' && req.method === 'GET') {
        const token = req.headers['authorization'];
        if (token !== 'Bearer auth-admin-ok') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ erro: 'Acesso negado.' }));
        }

        const demandas = lerDemandas();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ sucesso: true, demandas }));
    }

    // ----------------------------------------------------
    // 5. ROTA ADMIN: ATUALIZAR STATUS DA DEMANDA (PUT /api/admin/demandas)
    // ----------------------------------------------------
    if (pathname === '/api/admin/demandas' && req.method === 'PUT') {
        const token = req.headers['authorization'];
        if (token !== 'Bearer auth-admin-ok') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ erro: 'Acesso negado.' }));
        }

        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const { protocolo, novo_status, resposta } = JSON.parse(body);
                let demandas = lerDemandas();

                let encontrada = false;
                demandas = demandas.map(d => {
                    if (d.protocolo === protocolo) {
                        encontrada = true;
                        return {
                            ...d,
                            status: novo_status || d.status,
                            resposta_admin: resposta !== undefined ? resposta : d.resposta_admin
                        };
                    }
                    return d;
                });

                if (encontrada) {
                    salvarDemandas(demandas);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ sucesso: true, mensagem: 'Status atualizado com sucesso!' }));
                } else {
                    res.writeHead(444, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ sucesso: false, erro: 'Demanda não encontrada.' }));
                }
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ sucesso: false, erro: 'Dados inválidos.' }));
            }
        });
        return;
    }

    // Serve arquivos estáticos da pasta frontend/public se existirem
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    if (fs.existsSync(filePath) && !fs.lstatSync(filePath).isDirectory()) {
        const ext = path.extname(filePath);
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg'
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
        return fs.createReadStream(filePath).pipe(res);
    }

    // Rota Rota de Fallback (Página Inicial / Status Operacional)
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'Servidor Gabinete Online Ativo', versao: '1.0.0' }));
});

server.listen(PORTA, () => {
    console.log(`Servidor do Gabinete rodando na porta ${PORTA}`);
});
