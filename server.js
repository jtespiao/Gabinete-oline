const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORTA = process.env.PORT || 3000;

// Configuração de Caminhos
const PASTA_DADOS = path.join(__dirname, 'dados');
const ARQUIVO_DADOS = path.join(PASTA_DADOS, 'banco_eleitores_pro.json');
const PASTA_UPLOADS = path.join(__dirname, 'uploads');

[PASTA_DADOS, PASTA_UPLOADS].forEach(pasta => {
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
});
if (!fs.existsSync(ARQUIVO_DADOS)) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify([], null, 2), 'utf8');
}

// Configurações de Segurança e Sessão
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "Rogerio123";

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({
    secret: 'gabinete_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 3600000 }
}));

// Upload de Arquivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, PASTA_UPLOADS),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, Date.now() + '_' + Math.random().toString(36).substring(7) + ext);
    }
});
const upload = multer({ storage: storage });

// Auxiliares de Dados
function lerDados() { return JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8')); }
function salvarDados(dados) { fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2)); }

// --- ROTAS DO CIDADÃO ---
app.get('/', (req, res) => {
    // [Aqui mantemos o formulário animado que você já tem]
    // Reutilize o código do formulário da resposta anterior aqui.
    res.redirect('/login'); // Redirecionando apenas para teste, mas mantenha seu HTML do form.
});

app.post('/enviar', upload.single('anexo'), (req, res) => {
    const dados = lerDados();
    const protocolo = "GAB-" + Date.now().toString().slice(-6);
    const novo = { 
        id: protocolo, 
        data: new Date().toLocaleString('pt-BR'), 
        ...req.body, 
        status: 'Pendente', 
        foto: req.file ? req.file.filename : null 
    };
    dados.push(novo);
    salvarDados(dados);
    res.send(`<h1>Sucesso! Protocolo: ${protocolo}</h1><a href="/">Voltar</a>`);
});

// ----------------------------------------------------
// PAINEL ADMINISTRATIVO PROFISSIONAL
// ----------------------------------------------------

app.get('/login', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8"><title>Login Gabinete</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    </head>
    <body class="bg-dark d-flex align-items-center justify-content-center vh-100">
        <div class="card p-4 shadow-lg" style="width: 350px; border-radius: 20px;">
            <h4 class="text-center mb-4">Gabinete Digital</h4>
            <form action="/login" method="POST">
                <div class="mb-3"><label>Usuário</label><input type="text" name="usuario" class="form-control" required></div>
                <div class="mb-3"><label>Senha</label><input type="password" name="senha" class="form-control" required></div>
                <button class="btn btn-primary w-100">ACESSAR PAINEL</button>
            </form>
        </div>
    </body>
    </html>`);
});

app.post('/login', (req, res) => {
    if (req.body.usuario === ADMIN_USER && req.body.senha === ADMIN_PASS) {
        req.session.autenticado = true;
        return res.redirect('/admin');
    }
    res.send("<script>alert('Acesso Negado'); window.location.href='/login';</script>");
});

app.get('/admin', (req, res) => {
    if (!req.session.autenticado) return res.redirect('/login');
    
    const eleitores = lerDados();
    const total = eleitores.length;
    const pendentes = eleitores.filter(e => e.status === 'Pendente').length;

    let tabela = eleitores.map(e => `
        <tr>
            <td><small class="text-muted">${e.data}</small><br><b>${e.id}</b></td>
            <td><b>${e.nome}</b><br><span class="badge bg-info text-dark">${e.bairro}</span></td>
            <td><a href="https://wa.me/55${e.whatsapp.replace(/\D/g,'')}" target="_blank" class="text-decoration-none">🟢 ${e.whatsapp}</a></td>
            <td>
                <select class="form-select form-select-sm" onchange="alterarStatus('${e.id}', this.value)">
                    <option value="Pendente" ${e.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                    <option value="Em Andamento" ${e.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
                    <option value="Concluído" ${e.status === 'Concluído' ? 'selected' : ''}>Concluído</option>
                </select>
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick='verDetalhes(${JSON.stringify(e)})'>👁️ Ver Tudo</button>
                <button class="btn btn-sm btn-danger" onclick="excluir('${e.id}')">🗑️</button>
            </td>
        </tr>
    `).join('');

    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>Painel Admin - Gabinete Digital</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            body { background: #f4f7f6; font-family: 'Inter', sans-serif; }
            .sidebar { background: #0f172a; color: white; min-height: 100vh; padding: 20px; }
            .card-box { background: white; border-radius: 15px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: none; }
            .table thead { background: #f8fafc; }
        </style>
    </head>
    <body>
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-2 sidebar d-none d-md-block">
                    <h4 class="fw-bold text-primary mb-4">Gabinete Pro</h4>
                    <hr>
                    <nav class="nav flex-column">
                        <a class="nav-link text-white active" href="#"><i class="fas fa-users me-2"></i> Eleitores</a>
                        <a class="nav-link text-white" href="/logout"><i class="fas fa-sign-out-alt me-2"></i> Sair</a>
                    </nav>
                </div>
                <div class="col-md-10 p-4">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h3 class="fw-bold">Gestão de Eleitores</h3>
                        <div class="d-flex gap-2">
                            <input type="text" id="busca" class="form-control" placeholder="Buscar por nome, bairro, titulo..." onkeyup="filtrar()">
                            <button class="btn btn-success" onclick="exportarCSV()"><i class="fas fa-file-excel"></i> Exportar</button>
                        </div>
                    </div>

                    <div class="row g-3 mb-4">
                        <div class="col-md-4"><div class="card-box"><h6>Total Eleitores</h6><h2>${total}</h2></div></div>
                        <div class="col-md-4"><div class="card-box text-warning"><h6>Pendentes</h6><h2>${pendentes}</h2></div></div>
                        <div class="col-md-4"><div class="card-box text-success"><h6>Taxa de Sucesso</h6><h2>${total > 0 ? Math.round(((total-pendentes)/total)*100) : 0}%</h2></div></div>
                    </div>

                    <div class="card-box p-0 overflow-hidden">
                        <table class="table table-hover align-middle mb-0" id="tabelaMain">
                            <thead>
                                <tr><th>Protocolo</th><th>Eleitor</th><th>WhatsApp</th><th>Status</th><th>Ações</th></tr>
                            </thead>
                            <tbody>${tabela}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal de Detalhes -->
        <div class="modal fade" id="modalDetalhes" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content" style="border-radius:20px;">
                    <div class="modal-header"><h5 class="fw-bold">Ficha Completa do Eleitor</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body" id="conteudoDetalhes"></div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        <script>
            function verDetalhes(e) {
                let html = \`
                    <div class="row g-3">
                        <div class="col-md-6"><b>Nome da Mãe:</b> <br> \${e.nome_mae || '-'}</div>
                        <div class="col-md-6"><b>Data Nasc:</b> <br> \${e.nascimento}</div>
                        <div class="col-md-6"><b>Título:</b> <br> \${e.titulo || '-'}</div>
                        <div class="col-md-3"><b>Zona:</b> <br> \${e.zona || '-'}</div>
                        <div class="col-md-3"><b>Seção:</b> <br> \${e.secao || '-'}</div>
                        <div class="col-md-6"><b>Instagram:</b> <br> \${e.instagram || '-'}</div>
                        <div class="col-md-6"><b>Endereço:</b> <br> \${e.endereco || '-'}</div>
                        <div class="col-12"><hr><b>Demanda:</b> <br> \${e.mensagem}</div>
                        <div class="col-12">\${e.foto ? '<a href="/uploads/'+e.foto+'" target="_blank" class="btn btn-sm btn-outline-primary">Ver Anexo</a>' : 'Sem Anexo'}</div>
                    </div>
                \`;
                document.getElementById('conteudoDetalhes').innerHTML = html;
                new bootstrap.Modal(document.getElementById('modalDetalhes')).show();
            }

            function alterarStatus(id, status) {
                fetch('/admin/status', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({id, status})
                }).then(() => location.reload());
            }

            function excluir(id) {
                if(confirm('Deseja apagar este eleitor?')) {
                    fetch('/admin/excluir', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({id})
                    }).then(() => location.reload());
                }
            }

            function filtrar() {
                let b = document.getElementById('busca').value.toLowerCase();
                let trs = document.querySelectorAll('#tabelaMain tbody tr');
                trs.forEach(tr => tr.style.display = tr.innerText.toLowerCase().includes(b) ? '' : 'none');
            }

            function exportarCSV() {
                window.location.href = '/admin/exportar';
            }
        </script>
    </body>
    </html>`);
});

// APIs de Ação
app.post('/admin/status', (req, res) => {
    let dados = lerDados();
    dados = dados.map(d => d.id === req.body.id ? {...d, status: req.body.status} : d);
    salvarDados(dados);
    res.json({sucesso: true});
});

app.post('/admin/excluir', (req, res) => {
    let dados = lerDados();
    dados = dados.filter(d => d.id !== req.body.id);
    salvarDados(dados);
    res.json({sucesso: true});
});

app.get('/admin/exportar', (req, res) => {
    const dados = lerDados();
    const csv = "Protocolo;Data;Nome;WhatsApp;Bairro;Titulo;Zona;Secao;Status\\n" + 
                dados.map(d => `${d.id};${d.data};${d.nome};${d.whatsapp};${d.bairro};${d.titulo};${d.zona};${d.secao};${d.status}`).join("\\n");
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=eleitores.csv');
    res.send(csv);
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });
app.use('/uploads', express.static(PASTA_UPLOADS));

app.listen(PORTA, () => console.log("Painel Admin Pro Online!"));
