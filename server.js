/**
 * SISTEMA DE GESTÃO PARLAMENTAR E CADASTRO ELEITORAL PRO
 * Versão: 2.0.0 (Enterprise)
 * Tecnologias: Node.js, Express, better-sqlite3, Multer, Bcrypt, Helmet
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

// --- CONFIGURAÇÕES TÉCNICAS ---
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'gabinete-digital-secure-key-2026';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS_HASH = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync('Rogerio123', 10);

// --- BANCO DE DADOS (SQLITE) ---
const db = new Database('gabinete_pro.db');
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
        email TEXT,
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
        data_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// --- SISTEMA DE UPLOAD SEGURO ---
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
        const tipos = /jpeg|jpg|png|pdf/;
        const valid = tipos.test(path.extname(file.originalname).toLowerCase()) && tipos.test(file.mimetype);
        if (valid) return cb(null, true);
        cb(new Error('Apenas imagens (JPG/PNG) ou PDF são permitidos.'));
    }
});

// --- APP & SEGURANÇA ---
const app = express();

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
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
    name: '__gabinete_session',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600000 * 3 // 3 horas
    }
}));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Muitas tentativas. Bloqueado por 15 minutos."
});

// --- HELPERS ---
const checkAuth = (req, res, next) => {
    if (req.session.adminAuth) return next();
    res.redirect('/login');
};

const Layout = (content, title = "Gabinete Digital Pro") => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        :root { --primary-navy: #0f172a; --primary-blue: #2563eb; --success-green: #10b981; }
        body { background: #f8fafc; font-family: 'Inter', sans-serif; color: #1e293b; }
        .form-section { background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); padding: 30px; margin-bottom: 25px; border-left: 6px solid var(--primary-blue); }
        .section-title { font-size: 1.1rem; font-weight: 700; color: var(--primary-navy); margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; }
        .section-title i { margin-right: 10px; color: var(--primary-blue); }
        .btn-send { background: var(--primary-blue); border: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; transition: 0.3s; }
        .btn-send:hover { background: #1d4ed8; transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(37,99,235,0.3); }
        .form-control:focus { border-color: var(--primary-blue); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .admin-sidebar { background: var(--primary-navy); min-height: 100vh; color: white; padding-top: 20px; }
        .stat-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    </style>
</head>
<body>
    ${content}
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;

// --- ROTAS DO ELEITOR (CADASTRO COMPLETO) ---
app.get('/', (req, res) => {
    const html = `
    <div class="py-5" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);">
        <div class="container text-center text-white">
            <h1 class="display-5 fw-bold mb-2">Gabinete Online</h1>
            <p class="lead opacity-75">Sua demanda direto com quem trabalha por você.</p>
        </div>
    </div>
    
    <div class="container" style="margin-top: -40px;">
        <div class="row justify-content-center">
            <div class="col-lg-10">
                <form action="/enviar" method="POST" enctype="multipart/form-data" class="mb-5">
                    
                    <div class="form-section">
                        <div class="section-title"><i class="fas fa-id-card"></i> 1. Identificação Pessoal</div>
                        <div class="row g-3">
                            <div class="col-md-8">
                                <label class="form-label">Nome Completo *</label>
                                <input type="text" name="nome" class="form-control" required>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">Apelido (Como é conhecido)</label>
                                <input type="text" name="apelido" class="form-control">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Data de Nascimento *</label>
                                <input type="date" name="nascimento" class="form-control" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Nome da Mãe</label>
                                <input type="text" name="nome_mae" class="form-control">
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <div class="section-title"><i class="fas fa-phone-alt"></i> 2. Contato e Redes Sociais</div>
                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label">WhatsApp *</label>
                                <input type="text" name="whatsapp" id="mask-wa" class="form-control" placeholder="(00) 00000-0000" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">E-mail</label>
                                <input type="email" name="email" class="form-control">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Instagram (@usuario)</label>
                                <input type="text" name="instagram" class="form-control">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Link do Facebook</label>
                                <input type="url" name="facebook" class="form-control">
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <div class="section-title"><i class="fas fa-vote-yea"></i> 3. Dados Eleitorais</div>
                        <div class="row g-3">
                            <div class="col-md-4">
                                <label class="form-label">Título de Eleitor</label>
                                <input type="text" name="titulo" class="form-control" maxlength="12">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">Zona</label>
                                <input type="text" name="zona" class="form-control">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">Seção</label>
                                <input type="text" name="secao" class="form-control">
                            </div>
                            <div class="col-12">
                                <label class="form-label">Nível de Apoio / Engajamento</label>
                                <select name="apoio" class="form-select">
                                    <option value="Apoiador">Apoiador Ativo</option>
                                    <option value="Simpatizante">Simpatizante</option>
                                    <option value="Neutro" selected>Ainda não definido</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <div class="section-title"><i class="fas fa-map-marker-alt"></i> 4. Localização</div>
                        <div class="row g-3">
                            <div class="col-md-3">
                                <label class="form-label">CEP</label>
                                <input type="text" name="cep" id="mask-cep" class="form-control">
                            </div>
                            <div class="col-md-5">
                                <label class="form-label">Bairro *</label>
                                <input type="text" name="bairro" class="form-control" required>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">Cidade</label>
                                <input type="text" class="form-control" value="Primavera do Leste" disabled>
                            </div>
                            <div class="col-12">
                                <label class="form-label">Endereço / Logradouro</label>
                                <input type="text" name="endereco" class="form-control" placeholder="Rua, Número, Complemento...">
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <div class="section-title"><i class="fas fa-edit"></i> 5. Relato da Demanda</div>
                        <div class="row g-3">
                            <div class="col-12">
                                <label class="form-label">Descreva detalhadamente o que você precisa *</label>
                                <textarea name="mensagem" class="form-control" rows="5" required minlength="10"></textarea>
                            </div>
                            <div class="col-12">
                                <label class="form-label">Anexar Documento ou Foto (Opcional)</label>
                                <input type="file" name="anexo" class="form-control">
                            </div>
                        </div>
                    </div>

                    <div class="text-center mb-5">
                        <button type="submit" class="btn btn-send text-white btn-lg px-5">
                            <i class="fas fa-check-circle me-2"></i>CONFIRMAR E ENVIAR CADASTRO
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script>
        document.getElementById('mask-wa').oninput = function(e) {
            let x = e.target.value.replace(/\\D/g, '').match(/(\\d{0,2})(\\d{0,5})(\\d{0,4})/);
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        };
        document.getElementById('mask-cep').oninput = function(e) {
            let x = e.target.value.replace(/\\D/g, '').match(/(\\d{0,5})(\\d{0,3})/);
            e.target.value = !x[2] ? x[1] : x[1] + '-' + x[2];
        };
    </script>
    `;
    res.send(Layout(html, "Cadastro de Demandas"));
});

// --- PROCESSAMENTO DO CADASTRO ---
app.post('/enviar', upload.single('anexo'), [
    body('nome').trim().notEmpty(),
    body('whatsapp').trim().notEmpty(),
    body('bairro').trim().notEmpty(),
    body('mensagem').trim().notEmpty()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).send("Erro na validação dos dados.");

    const p = req.body;
    const protocolo = 'GB' + Date.now().toString().slice(-6);
    const arquivo = req.file ? req.file.filename : null;

    try {
        db.prepare(`
            INSERT INTO eleitores (
                protocolo, nome, apelido, nascimento, nome_mae, whatsapp, email, 
                instagram, facebook, titulo, zona, secao, apoio, cep, bairro, endereco, mensagem, arquivo_caminho
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            protocolo, p.nome, p.apelido, p.nascimento, p.nome_mae, p.whatsapp, p.email,
            p.instagram, p.facebook, p.titulo, p.zona, p.secao, p.apoio, p.cep, p.bairro, p.endereco, p.mensagem, arquivo
        );

        const waUrl = `https://api.whatsapp.com/send?phone=55${p.whatsapp.replace(/\D/g,'')}&text=Olá! Sua demanda foi registrada.\n*Protocolo:* ${protocolo}\n*Status:* Pendente.`;

        res.send(Layout(`
            <div class="container d-flex align-items-center justify-content-center min-vh-100">
                <div class="card p-5 text-center shadow border-0" style="border-radius: 20px; max-width: 500px;">
                    <div class="text-success mb-4"><i class="fas fa-check-circle fa-5x"></i></div>
                    <h2 class="fw-bold mb-3">Protocolo Gerado!</h2>
                    <p class="text-muted mb-4">Sua solicitação foi salva. Guarde seu número de atendimento:</p>
                    <div class="h3 bg-light p-3 rounded text-primary fw-bold mb-4">${protocolo}</div>
                    <a href="${waUrl}" class="btn btn-success btn-lg w-100 rounded-pill mb-3">RECEBER NO WHATSAPP</a>
                    <a href="/" class="btn btn-outline-secondary w-100 rounded-pill">VOLTAR</a>
                </div>
            </div>
        `));
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao processar banco de dados.");
    }
});

// --- ÁREA ADMINISTRATIVA ---
app.get('/login', (req, res) => {
    res.send(Layout(`
        <div class="container d-flex align-items-center justify-content-center min-vh-100">
            <div class="card p-4 shadow border-0" style="width: 380px; border-radius: 15px;">
                <div class="text-center mb-4"><i class="fas fa-lock fa-3x text-primary"></i><h4 class="mt-2 fw-bold">Admin Login</h4></div>
                <form action="/login" method="POST">
                    <div class="mb-3"><label class="form-label">Usuário</label><input type="text" name="user" class="form-control" required></div>
                    <div class="mb-4"><label class="form-label">Senha</label><input type="password" name="pass" class="form-control" required></div>
                    <button class="btn btn-primary w-100 py-2 fw-bold shadow-sm">ACESSAR PAINEL</button>
                </form>
            </div>
        </div>
    `, "Login"));
});

app.post('/login', loginLimiter, (req, res) => {
    const { user, pass } = req.body;
    if (user === ADMIN_USER && bcrypt.compareSync(pass, ADMIN_PASS_HASH)) {
        req.session.adminAuth = true;
        return res.redirect('/admin');
    }
    res.status(401).send('<script>alert("Erro"); window.location="/login";</script>');
});

app.get('/admin', checkAuth, (req, res) => {
    const search = req.query.q ? `%${req.query.q}%` : '%';
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const stats = db.prepare(`
        SELECT COUNT(*) as total, 
        SUM(CASE WHEN status = 'Pendente' THEN 1 ELSE 0 END) as pendentes,
        SUM(CASE WHEN apoio = 'Apoiador' THEN 1 ELSE 0 END) as apoiadores
        FROM eleitores
    `).get();

    const eleitores = db.prepare(`
        SELECT * FROM eleitores WHERE nome LIKE ? OR protocolo LIKE ? OR bairro LIKE ? 
        ORDER BY data_registro DESC LIMIT ? OFFSET ?
    `).all(search, search, search, limit, offset);

    const count = db.prepare('SELECT COUNT(*) as c FROM eleitores WHERE nome LIKE ? OR protocolo LIKE ? OR bairro LIKE ?').get(search, search, search).c;
    const totalPages = Math.ceil(count / limit);

    let listHtml = eleitores.map(e => `
        <tr>
            <td class="fw-bold">#${e.protocolo}</td>
            <td><b>${escapeHtml(e.nome)}</b><br><small class="text-muted">${escapeHtml(e.apelido || 'S/A')}</small></td>
            <td>${escapeHtml(e.whatsapp)}<br><small>${escapeHtml(e.bairro)}</small></td>
            <td>Z: ${escapeHtml(e.zona || '-')} / S: ${escapeHtml(e.secao || '-')}</td>
            <td><span class="badge ${e.status === 'Resolvido' ? 'bg-success' : 'bg-warning text-dark'}">${e.status}</span></td>
            <td class="text-end">
                <button class="btn btn-sm btn-info text-white" onclick='showDetails(${JSON.stringify(e)})'><i class="fas fa-eye"></i></button>
                <a href="/admin/status/${e.id}/Resolvido" class="btn btn-sm btn-success"><i class="fas fa-check"></i></a>
            </td>
        </tr>
    `).join('');

    const html = `
    <div class="container-fluid">
        <div class="row">
            <div class="col-md-2 admin-sidebar d-none d-md-block">
                <div class="px-3 mb-5"><h5>DASHBOARD</h5></div>
                <nav class="nav flex-column px-2">
                    <a href="/admin" class="nav-link text-white bg-primary rounded p-3 mb-2"><i class="fas fa-users me-2"></i>Demandas</a>
                    <a href="/logout" class="nav-link text-white-50 p-3"><i class="fas fa-power-off me-2"></i>Sair</a>
                </nav>
            </div>
            <div class="col-md-10 p-4">
                <div class="row g-4 mb-4">
                    <div class="col-md-4"><div class="stat-card"><h6>Total Registros</h6><h2 class="fw-bold">${stats.total}</h2></div></div>
                    <div class="col-md-4"><div class="stat-card"><h6>Apoiadores</h6><h2 class="fw-bold text-success">${stats.apoiadores || 0}</h2></div></div>
                    <div class="col-md-4"><div class="stat-card"><h6>Pendentes</h6><h2 class="fw-bold text-warning">${stats.pendentes || 0}</h2></div></div>
                </div>

                <div class="card shadow-sm border-0 p-4">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h4 class="fw-bold m-0">Monitoramento de Eleitores</h4>
                        <form class="d-flex"><input name="q" class="form-control me-2" placeholder="Pesquisar..." value="${req.query.q || ''}"><button class="btn btn-primary">Ok</button></form>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead><tr><th>Prot.</th><th>Nome</th><th>Contato</th><th>Local Voto</th><th>Status</th><th class="text-end">Ações</th></tr></thead>
                            <tbody>${listHtml || '<tr><td colspan="6" class="text-center py-5">Nenhum registro.</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <div class="modal fade" id="modalD" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content" id="mBody"></div></div></div>
    
    <script>
        function showDetails(e) {
            document.getElementById('mBody').innerHTML = \`
                <div class="modal-header border-0 pb-0"><h5 class="fw-bold">Ficha de: \${e.nome}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
                <div class="modal-body">
                    <div class="row g-3">
                        <div class="col-md-6"><small class="text-muted">NOME DA MÃE</small><div>\${e.nome_mae || '-'}</div></div>
                        <div class="col-md-6"><small class="text-muted">TÍTULO</small><div>\${e.titulo || '-'}</div></div>
                        <div class="col-md-6"><small class="text-muted">INSTAGRAM</small><div>\${e.instagram || '-'}</div></div>
                        <div class="col-md-6"><small class="text-muted">ENDEREÇO</small><div>\${e.endereco || '-'}</div></div>
                        <div class="col-12"><hr><small class="text-muted">RELATO</small><p class="bg-light p-3 rounded">\${e.mensagem}</p></div>
                        <div class="col-12">\${e.arquivo_caminho ? '<a href="/uploads/' + e.arquivo_caminho + '" target="_blank" class="btn btn-primary w-100">ABRIR ANEXO</a>' : ''}</div>
                    </div>
                </div>
            \`;
            new bootstrap.Modal(document.getElementById('modalD')).show();
        }
    </script>
    `;
    res.send(Layout(html, "Painel Administrativo"));
});

app.get('/admin/status/:id/:status', checkAuth, (req, res) => {
    db.prepare('UPDATE eleitores SET status = ? WHERE id = ?').run(req.params.status, req.params.id);
    res.redirect('/admin');
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// --- START ---
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
