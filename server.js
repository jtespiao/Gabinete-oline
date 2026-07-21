/**
 * SISTEMA PROFISSIONAL DE GESTÃO DE GABINETE DIGITAL
 * Arquitetura: Monolítica Segura (Single File)
 * Engenharia: Software Sênior
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const Database = require('better-sqlite3');
const multer = require('multer');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const escapeHtml = require('escape-html');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// --- CONFIGURAÇÕES E AMBIENTE ---
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-secret-6e93-4a21-8f12';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync('Rogerio123', 10);

// --- INICIALIZAÇÃO DO BANCO DE DADOS (SQLITE) ---
const db = new Database('gabinete_digital.db');
db.pragma('journal_mode = WAL');

db.prepare(`
    CREATE TABLE IF NOT EXISTS eleitores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        protocolo TEXT UNIQUE NOT NULL,
        nome TEXT NOT NULL,
        apelido TEXT,
        nascimento TEXT NOT NULL,
        nome_mae TEXT,
        whatsapp TEXT NOT NULL,
        instagram TEXT,
        facebook TEXT,
        titulo TEXT,
        zona TEXT,
        secao TEXT,
        apoio TEXT,
        cep TEXT,
        bairro TEXT NOT NULL,
        endereco TEXT,
        mensagem TEXT NOT NULL,
        arquivo_caminho TEXT,
        status TEXT DEFAULT 'Pendente',
        data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare('CREATE INDEX IF NOT EXISTS idx_protocolo ON eleitores(protocolo)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_status ON eleitores(status)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_nome ON eleitores(nome)').run();

// --- CONFIGURAÇÃO DE UPLOADS (MULTER) ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uuidv4()}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|pdf/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Erro: Arquivo deve ser JPG, PNG ou PDF.'));
    }
});

// --- MIDDLEWARES ---
const app = express();

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://unpkg.com", "'unsafe-inline'"],
            "style-src": ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "'unsafe-inline'"],
            "font-src": ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            "img-src": ["'self'", "data:", "blob:"]
        },
    }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));

app.use(session({
    name: '__sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 2 // 2 horas
    }
}));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Muitas tentativas de login. Tente novamente em 15 minutos."
});

const globalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60
});

app.use(globalLimiter);

// --- HELPERS ---
const checkAuth = (req, res, next) => {
    if (req.session.userId) return next();
    res.redirect('/login');
};

const formatBrDate = (isoDate) => {
    return new Date(isoDate).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

// --- TEMPLATES HTML (VIEW ENGINE NATIVO) ---
const Layout = (content, title = "Gabinete Digital") => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
    <style>
        :root { --primary-color: #004a99; --accent-color: #00c853; }
        body { background-color: #f4f7f9; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }
        .bg-primary-custom { background-color: var(--primary-color) !important; }
        .btn-primary-custom { background-color: var(--primary-color); border: none; color: white; transition: 0.3s; }
        .btn-primary-custom:hover { background-color: #003366; color: white; transform: translateY(-2px); }
        .card-form { border-radius: 15px; border: none; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
        .section-header { border-left: 5px solid var(--primary-color); padding-left: 15px; margin-bottom: 25px; color: var(--primary-color); font-weight: bold; }
        .nav-admin { background: #1a237e; min-height: 100vh; color: white; }
        .nav-admin .nav-link { color: rgba(255,255,255,0.8); transition: 0.2s; }
        .nav-admin .nav-link:hover { color: white; background: rgba(255,255,255,0.1); }
        .nav-admin .active { color: white; background: var(--primary-color) !important; font-weight: bold; }
        .stat-card { border-radius: 12px; border: none; transition: 0.3s; }
        .stat-card:hover { transform: scale(1.02); }
    </style>
</head>
<body>
    ${content}
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
    <script>AOS.init({ duration: 800, once: true });</script>
</body>
</html>`;

// --- ROTAS PÚBLICAS ---
app.get('/', (req, res) => {
    const html = `
    <nav class="navbar navbar-dark bg-primary-custom shadow-sm">
        <div class="container justify-content-center">
            <span class="navbar-brand mb-0 h1"><i class="fas fa-landmark me-2"></i>GABINETE DIGITAL</span>
        </div>
    </nav>
    <div class="container my-5">
        <div class="row justify-content-center">
            <div class="col-lg-9">
                <div class="card card-form p-4 p-md-5" data-aos="fade-up">
                    <div class="text-center mb-5">
                        <h2 class="fw-bold">Atendimento ao Cidadão</h2>
                        <p class="text-muted">Preencha os campos abaixo para registrar sua demanda oficial junto ao Gabinete Parlamentar.</p>
                    </div>
                    
                    <form action="/enviar" method="POST" enctype="multipart/form-data">
                        <div class="section-header">1. Identificação do Eleitor</div>
                        <div class="row g-3">
                            <div class="col-md-8">
                                <label class="form-label">Nome Completo *</label>
                                <input type="text" name="nome" class="form-control" required maxlength="100">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">Apelido / Como quer ser chamado</label>
                                <input type="text" name="apelido" class="form-control" maxlength="50">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Data de Nascimento *</label>
                                <input type="date" name="nascimento" class="form-control" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Nome da Mãe</label>
                                <input type="text" name="nome_mae" class="form-control" maxlength="100">
                            </div>
                        </div>

                        <div class="section-header mt-5">2. Contato e Redes Sociais</div>
                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label">WhatsApp *</label>
                                <input type="text" name="whatsapp" id="mask-tel" class="form-control" placeholder="(00) 00000-0000" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Instagram (@usuario)</label>
                                <input type="text" name="instagram" class="form-control" placeholder="@">
                            </div>
                            <div class="col-md-12">
                                <label class="form-label">Link do Facebook</label>
                                <input type="url" name="facebook" class="form-control" placeholder="https://facebook.com/seu-perfil">
                            </div>
                        </div>

                        <div class="section-header mt-5">3. Informações Eleitorais</div>
                        <div class="row g-3">
                            <div class="col-md-4">
                                <label class="form-label">Título de Eleitor</label>
                                <input type="text" name="titulo" class="form-control" maxlength="12">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">Zona</label>
                                <input type="text" name="zona" class="form-control" maxlength="5">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">Seção</label>
                                <input type="text" name="secao" class="form-control" maxlength="5">
                            </div>
                            <div class="col-md-12">
                                <label class="form-label">Nível de Apoio</label>
                                <select name="apoio" class="form-select">
                                    <option value="Apoiador">Apoiador</option>
                                    <option value="Simpatizante">Simpatizante</option>
                                    <option value="Em negociação">Em negociação</option>
                                </select>
                            </div>
                        </div>

                        <div class="section-header mt-5">4. Localização</div>
                        <div class="row g-3">
                            <div class="col-md-4">
                                <label class="form-label">CEP</label>
                                <input type="text" name="cep" id="mask-cep" class="form-control" placeholder="00000-000">
                            </div>
                            <div class="col-md-8">
                                <label class="form-label">Bairro *</label>
                                <input type="text" name="bairro" class="form-control" required>
                            </div>
                            <div class="col-md-12">
                                <label class="form-label">Endereço Residencial</label>
                                <input type="text" name="endereco" class="form-control" placeholder="Rua, Número, Complemento">
                            </div>
                        </div>

                        <div class="section-header mt-5">5. Sua Demanda</div>
                        <div class="row g-3">
                            <div class="col-md-12">
                                <label class="form-label">Relate seu pedido ou sugestão detalhadamente *</label>
                                <textarea name="mensagem" class="form-control" rows="5" required minlength="10"></textarea>
                            </div>
                            <div class="col-md-12">
                                <label class="form-label">Anexar Foto ou Documento (Opcional - Máx 5MB)</label>
                                <input type="file" name="anexo" class="form-control" accept=".jpg,.jpeg,.png,.pdf">
                            </div>
                        </div>

                        <div class="text-center mt-5">
                            <button type="submit" class="btn btn-primary-custom btn-lg px-5 shadow-sm">
                                <i class="fas fa-paper-plane me-2"></i>REGISTRAR SOLICITAÇÃO
                            </button>
                        </div>
                    </form>
                </div>
                <div class="text-center mt-4 text-muted small">
                    &copy; 2024 Gabinete Digital Pro - Atendimento Parlamentar Certificado
                </div>
            </div>
        </div>
    </div>
    <script>
        document.getElementById('mask-tel').oninput = function(e) {
            let x = e.target.value.replace(/\\D/g, '').match(/(\\d{0,2})(\\d{0,5})(\\d{0,4})/);
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        };
        document.getElementById('mask-cep').oninput = function(e) {
            let x = e.target.value.replace(/\\D/g, '').match(/(\\d{0,5})(\\d{0,3})/);
            e.target.value = !x[2] ? x[1] : x[1] + '-' + x[2];
        };
    </script>
    `;
    res.send(Layout(html));
});

app.post('/enviar', upload.single('anexo'), [
    body('nome').trim().escape().notEmpty(),
    body('whatsapp').trim().escape().notEmpty(),
    body('bairro').trim().escape().notEmpty(),
    body('mensagem').trim().escape().notEmpty()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).send('Dados inválidos. Verifique os campos.');

    const protocolo = 'GB' + Date.now().toString().slice(-6);
    const { nome, apelido, nascimento, nome_mae, whatsapp, instagram, facebook, titulo, zona, secao, apoio, cep, bairro, endereco, mensagem } = req.body;
    const arquivo_caminho = req.file ? req.file.filename : null;

    try {
        db.prepare(`
            INSERT INTO eleitores (protocolo, nome, apelido, nascimento, nome_mae, whatsapp, instagram, facebook, titulo, zona, secao, apoio, cep, bairro, endereco, mensagem, arquivo_caminho)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(protocolo, nome, apelido, nascimento, nome_mae, whatsapp, instagram, facebook, titulo, zona, secao, apoio, cep, bairro, endereco, mensagem, arquivo_caminho);

        const waMsg = `Olá! Recebemos sua demanda no Gabinete Digital.\n\n*Protocolo:* ${protocolo}\n*Status:* Pendente\n\nEm breve nossa equipe entrará em contato.`;
        const waLink = `https://api.whatsapp.com/send?phone=55${whatsapp.replace(/\D/g, '')}&text=${encodeURIComponent(waMsg)}`;

        const successHtml = `
        <div class="container d-flex align-items-center justify-content-center min-vh-100">
            <div class="card p-5 text-center shadow-lg border-0" style="border-radius: 20px; max-width: 500px;">
                <div class="mb-4 text-success"><i class="fas fa-check-circle fa-5x"></i></div>
                <h2 class="fw-bold mb-3">Solicitação Enviada!</h2>
                <p class="text-muted mb-4">Sua demanda foi registrada com sucesso sob o protocolo:</p>
                <div class="h4 bg-light p-3 rounded border border-primary text-primary mb-4 fw-bold">${protocolo}</div>
                <a href="${waLink}" class="btn btn-success btn-lg w-100 rounded-pill mb-3">
                    <i class="fab fa-whatsapp me-2"></i>RECEBER NO WHATSAPP
                </a>
                <a href="/" class="btn btn-outline-secondary w-100 rounded-pill">Voltar ao Início</a>
            </div>
        </div>`;
        res.send(Layout(successHtml));
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro interno ao salvar demanda.');
    }
});

// --- ROTAS ADMIN E LOGIN ---
app.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect('/admin');
    const html = `
    <div class="container d-flex align-items-center justify-content-center min-vh-100">
        <div class="card p-4 shadow border-0" style="width: 100%; max-width: 400px; border-radius: 15px;">
            <div class="text-center mb-4">
                <i class="fas fa-user-shield fa-3x text-primary"></i>
                <h3 class="mt-3 fw-bold">Login Administrativo</h3>
            </div>
            <form action="/login" method="POST">
                <div class="mb-3">
                    <label class="form-label">Usuário</label>
                    <input type="text" name="username" class="form-control" required autocomplete="off">
                </div>
                <div class="mb-4">
                    <label class="form-label">Senha</label>
                    <input type="password" name="password" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-primary-custom w-100 btn-lg shadow">ENTRAR</button>
            </form>
            <div class="text-center mt-4">
                <a href="/" class="text-muted small text-decoration-none">← Voltar para o Site</a>
            </div>
        </div>
    </div>`;
    res.send(Layout(html, "Admin Login"));
});

app.post('/login', authLimiter, (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
        req.session.userId = 'admin';
        return res.redirect('/admin');
    }
    res.status(401).send('<script>alert("Credenciais Inválidas"); window.location="/login";</script>');
});

app.get('/admin', checkAuth, (req, res) => {
    const q = req.query.q ? `%${req.query.q}%` : '%';
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const stats = db.prepare(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'Pendente' THEN 1 ELSE 0 END) as pendentes,
            SUM(CASE WHEN apoio = 'Apoiador' THEN 1 ELSE 0 END) as apoiadores
        FROM eleitores
    `).get();

    const count = db.prepare('SELECT COUNT(*) as count FROM eleitores WHERE nome LIKE ? OR protocolo LIKE ? OR bairro LIKE ?').get(q, q, q).count;
    const totalPages = Math.ceil(count / limit);

    const data = db.prepare(`
        SELECT * FROM eleitores 
        WHERE nome LIKE ? OR protocolo LIKE ? OR bairro LIKE ?
        ORDER BY data_criacao DESC
        LIMIT ? OFFSET ?
    `).all(q, q, q, limit, offset);

    let rows = data.map(d => `
        <tr data-aos="fade-in">
            <td class="fw-bold text-primary">#${escapeHtml(d.protocolo)}</td>
            <td>
                <div><b>${escapeHtml(d.nome)}</b></div>
                <small class="text-muted">(${escapeHtml(d.apelido || 'S/A')})</small>
            </td>
            <td>
                <div><i class="fab fa-whatsapp text-success"></i> ${escapeHtml(d.whatsapp)}</div>
                <div class="small text-muted">${escapeHtml(d.bairro)}</div>
            </td>
            <td>
                <div class="small"><b>Mãe:</b> ${escapeHtml(d.nome_mae || '-')}</div>
                <div class="small"><b>Voto:</b> Z:${escapeHtml(d.zona || '-')} S:${escapeHtml(d.secao || '-')}</div>
            </td>
            <td>
                <span class="badge ${d.status === 'Resolvido' ? 'bg-success' : 'bg-warning text-dark'}">${escapeHtml(d.status)}</span><br>
                <small class="text-muted">Apoio: ${escapeHtml(d.apoio)}</small>
            </td>
            <td class="text-end">
                <button class="btn btn-sm btn-info text-white" onclick="viewDetails(${JSON.stringify(d).replace(/"/g, '&quot;')})"><i class="fas fa-eye"></i></button>
                <div class="dropdown d-inline">
                    <button class="btn btn-sm btn-secondary dropdown-toggle" data-bs-toggle="dropdown"><i class="fas fa-sync"></i></button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="/admin/status/${d.id}/Resolvido">Resolvido</a></li>
                        <li><a class="dropdown-item" href="/admin/status/${d.id}/Pendente">Pendente</a></li>
                        <li><a class="dropdown-item" href="/admin/status/${d.id}/Em Análise">Em Análise</a></li>
                    </ul>
                </div>
            </td>
        </tr>
    `).join('');

    const html = `
    <div class="container-fluid">
        <div class="row">
            <nav class="col-md-3 col-lg-2 nav-admin p-4 d-flex flex-column">
                <div class="mb-5 text-center">
                    <i class="fas fa-landmark fa-2x mb-2"></i>
                    <h5 class="fw-bold">ADMIN PANEL</h5>
                </div>
                <ul class="nav flex-column mb-auto">
                    <li class="nav-item mb-2"><a href="/admin" class="nav-link active rounded"><i class="fas fa-users me-2"></i>Demandas</a></li>
                    <li class="nav-item mb-2"><a href="/logout" class="nav-link rounded"><i class="fas fa-sign-out-alt me-2"></i>Sair</a></li>
                </ul>
            </nav>
            <main class="col-md-9 col-lg-10 ms-sm-auto p-4">
                <div class="row g-3 mb-4">
                    <div class="col-md-4">
                        <div class="card stat-card bg-white p-3 shadow-sm border-start border-primary border-4">
                            <div class="text-muted small fw-bold">TOTAL ELEITORES</div>
                            <div class="h2 fw-bold mb-0">${stats.total}</div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card stat-card bg-white p-3 shadow-sm border-start border-success border-4">
                            <div class="text-muted small fw-bold">APOIADORES ATIVOS</div>
                            <div class="h2 fw-bold mb-0 text-success">${stats.apoiadores || 0}</div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card stat-card bg-white p-3 shadow-sm border-start border-warning border-4">
                            <div class="text-muted small fw-bold">DEMANDAS PENDENTES</div>
                            <div class="h2 fw-bold mb-0 text-warning">${stats.pendentes || 0}</div>
                        </div>
                    </div>
                </div>

                <div class="card border-0 shadow-sm p-4">
                    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                        <h4 class="fw-bold mb-0">Monitoramento de Demandas</h4>
                        <form class="d-flex" method="GET">
                            <input class="form-control me-2" type="search" name="q" placeholder="Buscar..." value="${req.query.q || ''}">
                            <button class="btn btn-primary" type="submit">Filtrar</button>
                        </form>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-hover align-middle">
                            <thead class="table-light">
                                <tr>
                                    <th>Prot.</th><th>Eleitor</th><th>WhatsApp</th><th>Ident. Eleitoral</th><th>Status</th><th class="text-end">Ações</th>
                                </tr>
                            </thead>
                            <tbody>${rows || '<tr><td colspan="6" class="text-center py-5">Nenhuma demanda encontrada.</td></tr>'}</tbody>
                        </table>
                    </div>
                    
                    <nav class="mt-4">
                        <ul class="pagination justify-content-center">
                            ${Array.from({ length: totalPages }, (_, i) => `
                                <li class="page-item ${page === i + 1 ? 'active' : ''}">
                                    <a class="page-link" href="?page=${i + 1}&q=${req.query.q || ''}">${i + 1}</a>
                                </li>
                            `).join('')}
                        </ul>
                    </nav>
                </div>
            </main>
        </div>
    </div>

    <!-- Modal Detalhes -->
    <div class="modal fade" id="detailModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content shadow-lg border-0" style="border-radius:15px;">
                <div class="modal-header border-0 pb-0">
                    <h5 class="modal-title fw-bold" id="mProt"></h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-4" id="mBody"></div>
            </div>
        </div>
    </div>

    <script>
        function viewDetails(d) {
            document.getElementById('mProt').innerText = 'Demanda #' + d.protocolo;
            document.getElementById('mBody').innerHTML = \`
                <div class="row g-3">
                    <div class="col-md-6"><label class="small text-muted fw-bold">NOME</label><div>\${d.nome}</div></div>
                    <div class="col-md-6"><label class="small text-muted fw-bold">CONTATO</label><div>\${d.whatsapp}</div></div>
                    <div class="col-md-4"><label class="small text-muted fw-bold">NASCIMENTO</label><div>\${d.nascimento}</div></div>
                    <div class="col-md-8"><label class="small text-muted fw-bold">NOME DA MÃE</label><div>\${d.nome_mae || '-'}</div></div>
                    <div class="col-md-4"><label class="small text-muted fw-bold">ZONA</label><div>\${d.zona || '-'}</div></div>
                    <div class="col-md-4"><label class="small text-muted fw-bold">SEÇÃO</label><div>\${d.secao || '-'}</div></div>
                    <div class="col-md-4"><label class="small text-muted fw-bold">APOIO</label><div>\${d.apoio}</div></div>
                    <div class="col-md-6"><label class="small text-muted fw-bold">INSTAGRAM</label><div>\${d.instagram || '-'}</div></div>
                    <div class="col-md-6"><label class="small text-muted fw-bold">BAIRRO</label><div>\${d.bairro}</div></div>
                    <div class="col-12"><hr><label class="small text-muted fw-bold">RELATO</label><div class="p-3 bg-light rounded shadow-inner" style="white-space: pre-wrap;">\${d.mensagem}</div></div>
                    <div class="col-12 mt-4">\${d.arquivo_caminho ? '<a href="/uploads/' + d.arquivo_caminho + '" target="_blank" class="btn btn-primary w-100 shadow-sm"><i class="fas fa-download me-2"></i>ABRIR ANEXO OFICIAL</a>' : '<button class="btn btn-outline-secondary w-100" disabled>Nenhum Anexo</button>'}</div>
                </div>
            \`;
            new bootstrap.Modal(document.getElementById('detailModal')).show();
        }
    </script>
    `;
    res.send(Layout(html, "Painel Administrativo"));
});

app.get('/admin/status/:id/:newStatus', checkAuth, (req, res) => {
    try {
        db.prepare('UPDATE eleitores SET status = ? WHERE id = ?').run(req.params.newStatus, req.params.id);
        res.redirect('/admin');
    } catch (e) {
        res.status(500).send('Erro ao atualizar status.');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(PORT, () => {
    console.log(`[SERVIDO ATIVO] Sistema operando em http://localhost:${PORT}`);
});
