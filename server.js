// Bibliotecas Necessárias
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit'); // Corrigido aqui
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORTA = process.env.PORT || 3000;

// Configuração de Pastas e Banco de Dados Local
const PASTA_DADOS = path.join(__dirname, 'dados');
const ARQUIVO_DADOS = path.join(PASTA_DADOS, 'banco_eleitores_pro.json');
const PASTA_UPLOADS = path.join(__dirname, 'uploads');

[PASTA_DADOS, PASTA_UPLOADS].forEach(pasta => {
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
});
if (!fs.existsSync(ARQUIVO_DADOS)) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify([], null, 2), 'utf8');
}

// Credenciais Administrativas
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "Rogerio123";

// --- MIDDLEWARES DE SEGURANÇA ---
app.use(helmet({ contentSecurityPolicy: false })); 
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Limita o número de cadastros por minuto para evitar robôs
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 50, 
    message: 'Muitos acessos detectados. Tente novamente em 15 minutos.'
});
app.use('/enviar', limiter);

// Configuração de Sessão para o Login
app.use(session({
    secret: 'chave_secreta_gabinete_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 3600000 } // 1 hora de login
}));

// Configuração de Upload de Fotos
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, PASTA_UPLOADS),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, Date.now() + '_' + Math.random().toString(36).substring(7) + ext);
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Máximo 5MB por foto
});

// Funções de Apoio
function lerDados() { return JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8')); }
function salvarDados(dados) { fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2)); }

// ----------------------------------------------------
// ROTA 1: FORMULÁRIO DO CIDADÃO (VISUAL PREMIUM)
// ----------------------------------------------------
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gabinete Digital - Vereador Irmão Rogério</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        body { background-color: #f1f5f9; font-family: 'Segoe UI', sans-serif; }
        .hero { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 40px 0; border-radius: 0 0 30px 30px; margin-bottom: 40px; }
        .card-form { background: white; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); padding: 30px; border: 1px solid #e2e8f0; }
        .section-tag { font-size: 11px; font-weight: 800; color: #0d6efd; text-transform: uppercase; border-bottom: 2px solid #eee; padding-bottom: 5px; margin: 25px 0 15px 0; }
        .btn-enviar { background: #10b981; border: none; border-radius: 50px; padding: 15px; font-weight: bold; transition: 0.3s; }
        .btn-enviar:hover { background: #059669; transform: translateY(-2px); }
    </style>
</head>
<body>
    <div class="hero text-center">
        <h2>🏛️ GABINETE DIGITAL</h2>
        <p class="opacity-75">Vereador Irmão Rogério - Sempre ao seu lado</p>
    </div>
    <div class="container mb-5" style="max-width: 800px;">
        <div class="card-form">
            <form action="/enviar" method="POST" enctype="multipart/form-data">
                <div class="section-tag">Identificação do Eleitor</div>
                <div class="row g-3">
                    <div class="col-12"><label class="form-label">Nome Completo *</label><input type="text" name="nome" class="form-control" required></div>
                    <div class="col-md-6"><label class="form-label">Apelido</label><input type="text" name="apelido" class="form-control"></div>
                    <div class="col-md-6"><label class="form-label">Nascimento *</label><input type="date" name="nascimento" class="form-control" required></div>
                    <div class="col-12"><label class="form-label">Nome da Mãe</label><input type="text" name="nome_mae" class="form-control"></div>
                </div>

                <div class="section-tag">Contato e Localização</div>
                <div class="row g-3">
                    <div class="col-md-6"><label class="form-label">WhatsApp *</label><input type="text" name="whatsapp" class="form-control" required placeholder="(00) 00000-0000"></div>
                    <div class="col-md-6"><label class="form-label">Bairro *</label><input type="text" name="bairro" class="form-control" required></div>
                    <div class="col-12"><label class="form-label">Endereço Completo</label><input type="text" name="endereco" class="form-control"></div>
                </div>

                <div class="section-tag">Dados Eleitorais</div>
                <div class="row g-3">
                    <div class="col-md-4"><label class="form-label">Título</label><input type="text" name="titulo" class="form-control"></div>
                    <div class="col-md-4"><label class="form-label">Zona</label><input type="text" name="zona" class="form-control"></div>
                    <div class="col-md-4"><label class="form-label">Seção</label><input type="text" name="secao" class="form-control"></div>
                </div>

                <div class="section-tag">Sua Demanda</div>
                <div class="col-12"><textarea name="mensagem" class="form-control" rows="4" placeholder="Descreva sua solicitação..." required></textarea></div>
                <div class="col-12 mt-3"><label class="form-label">Foto do Local (Opcional)</label><input type="file" name="anexo" class="form-control"></div>

                <button type="submit" class="btn btn-enviar text-white w-100 mt-4">ENVIAR E GERAR COMPROVANTE</button>
            </form>
        </div>
    </div>
</body>
</html>`);
});

// ----------------------------------------------------
// ROTA 2: PROCESSAR DADOS E GERAR WHATSAPP
// ----------------------------------------------------
app.post('/enviar', upload.single('anexo'), (req, res) => {
    const dados = lerDados();
    const protocolo = "GB-" + Date.now().toString().slice(-6);
    const novo = { id: protocolo, data: new Date().toLocaleString(), ...req.body, foto: req.file ? req.file.filename : null, status: 'Pendente' };
    dados.push(novo);
    salvarDados(dados);

    const linkWa = `https://api.whatsapp.com/send?phone=55${novo.whatsapp.replace(/\D/g,'')}&text=Olá! Segue meu protocolo de atendimento: ${protocolo}`;
    res.send(`<div style="text-align:center; padding:50px; font-family:sans-serif;">
        <h1 style="color:#10b981;">✅ REGISTRADO!</h1>
        <p>Seu protocolo: <b>${protocolo}</b></p>
        <a href="${linkWa}" target="_blank" style="padding:15px 30px; background:#25d366; color:white; border-radius:30px; text-decoration:none; font-weight:bold;">RECEBER NO WHATSAPP</a>
        <br><br><a href="/">Voltar ao Início</a>
    </div>`);
});

// ----------------------------------------------------
// ROTA 3: PAINEL ADMINISTRATIVO COM DASHBOARD
// ----------------------------------------------------
app.get('/login', (req, res) => {
    res.send(`<body style="display:flex; align-items:center; justify-content:center; height:100vh; background:#0f172a; font-family:sans-serif;">
        <form action="/login" method="POST" style="background:white; padding:40px; border-radius:15px; width:300px;">
            <h3>Admin Login</h3>
            <input type="text" name="usuario" placeholder="Usuário" style="width:100%; padding:10px; margin:10px 0;">
            <input type="password" name="senha" placeholder="Senha" style="width:100%; padding:10px; margin:10px 0;">
            <button style="width:100%; padding:10px; background:#0d6efd; color:white; border:none; border-radius:5px;">ENTRAR</button>
        </form>
    </body>`);
});

app.post('/login', (req, res) => {
    if (req.body.usuario === ADMIN_USER && req.body.senha === ADMIN_PASS) {
        req.session.autenticado = true;
        return res.redirect('/admin');
    }
    res.send("<script>alert('Login Errado!'); window.location.href='/login';</script>");
});

app.get('/admin', (req, res) => {
    if (!req.session.autenticado) return res.redirect('/login');
    const dados = lerDados();
    let linhas = dados.map(d => `<tr><td>${d.id}</td><td>${d.nome}</td><td>${d.whatsapp}</td><td>${d.bairro}</td><td>${d.status}</td></tr>`).join('');
    res.send(`
    <html>
    <head><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"></head>
    <body class="p-4 bg-light">
        <div class="d-flex justify-content-between"><h2>📊 Dashboard de Demandas</h2><a href="/logout" class="btn btn-danger">Sair</a></div>
        <div class="row my-4">
            <div class="col-4"><div class="card p-3 text-center"><b>Total</b><br>${dados.length}</div></div>
        </div>
        <table class="table table-striped table-hover bg-white shadow-sm">
            <thead class="table-dark"><tr><th>Protocolo</th><th>Eleitor</th><th>WhatsApp</th><th>Bairro</th><th>Status</th></tr></thead>
            <tbody>${linhas}</tbody>
        </table>
    </body>
    </html>`);
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

app.listen(PORTA, () => console.log("Servidor Profissional Rodando na Porta " + PORTA));
