const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORTA = process.env.PORT || 3000;

const PASTA_DADOS = path.join(__dirname, 'dados');
const ARQUIVO_DADOS = path.join(PASTA_DADOS, 'banco_eleitores_pro.json');
const PASTA_UPLOADS = path.join(__dirname, 'uploads');

[PASTA_DADOS, PASTA_UPLOADS].forEach(pasta => {
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
});
if (!fs.existsSync(ARQUIVO_DADOS)) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify([], null, 2), 'utf8');
}

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "Rogerio123";

app.use(helmet({ contentSecurityPolicy: false })); 
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    message: 'Muitos acessos detectados. Tente novamente em breve.'
});
app.use('/enviar', limiter);

app.use(session({
    secret: 'gabinete_digital_premium_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 3600000 }
}));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, PASTA_UPLOADS),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, Date.now() + '_' + Math.random().toString(36).substring(7) + ext);
    }
});
const upload = multer({ storage: storage });

function lerDados() { return JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8')); }
function salvarDados(dados) { fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2)); }

// ----------------------------------------------------
// ROTA 1: FORMULÁRIO COM ANIMAÇÕES (FRONT-END)
// ----------------------------------------------------
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gabinete Digital - Vereador Irmão Rogério</title>
    
    <!-- Bibliotecas de Estilo e Animação -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css" rel="stylesheet">
    <link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">

    <style>
        :root { --primary: #0d6efd; --success: #10b981; --dark: #0f172a; }
        body { background-color: #f8fafc; font-family: 'Segoe UI', sans-serif; overflow-x: hidden; }
        
        /* Cabeçalho Animado */
        .hero { 
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); 
            color: white; padding: 60px 0; border-radius: 0 0 50px 50px; 
            margin-bottom: 50px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }

        /* Card do Formulário com efeito de flutuação */
        .card-form { 
            background: white; border-radius: 25px; 
            box-shadow: 0 15px 35px rgba(0,0,0,0.05); 
            padding: 40px; border: 1px solid #e2e8f0;
            transition: transform 0.3s ease;
        }
        .card-form:hover { transform: translateY(-5px); }

        .section-tag { 
            font-size: 12px; font-weight: 800; color: var(--primary); 
            text-transform: uppercase; border-bottom: 2px solid #f1f5f9; 
            padding-bottom: 5px; margin: 30px 0 15px 0; 
        }

        /* Botão com Animação de Brilho */
        .btn-enviar { 
            background: linear-gradient(90deg, #10b981, #059669); 
            border: none; border-radius: 50px; padding: 18px; 
            font-weight: bold; font-size: 18px; transition: 0.4s;
            position: relative; overflow: hidden;
        }
        .btn-enviar:hover { 
            transform: scale(1.03); 
            box-shadow: 0 10px 20px rgba(16, 185, 129, 0.4); 
        }

        /* Inputs Suaves */
        .form-control { 
            border-radius: 12px; padding: 12px; border: 2px solid #f1f5f9; 
            transition: 0.3s; 
        }
        .form-control:focus { 
            border-color: var(--primary); box-shadow: 0 0 0 4px rgba(13, 110, 253, 0.1); 
        }
    </style>
</head>
<body>

    <div class="hero text-center animate__animated animate__fadeInDown">
        <i class="fa-solid fa-building-columns fa-3x mb-3 animate__animated animate__bounceIn animate__delay-1s"></i>
        <h1 class="fw-bold">GABINETE DIGITAL</h1>
        <p class="opacity-75">Sua voz ativa no mandato do Vereador Irmão Rogério</p>
    </div>

    <div class="container mb-5" style="max-width: 850px;">
        <div class="card-form animate__animated animate__fadeInUp" data-aos="fade-up">
            <form action="/enviar" method="POST" enctype="multipart/form-data" id="mainForm">
                
                <div data-aos="fade-right">
                    <div class="section-tag">1. Quem é você?</div>
                    <div class="row g-3">
                        <div class="col-12"><label class="form-label">Nome Completo *</label><input type="text" name="nome" class="form-control" required></div>
                        <div class="col-md-6"><label class="form-label">Como quer ser chamado?</label><input type="text" name="apelido" class="form-control"></div>
                        <div class="col-md-6"><label class="form-label">Data de Nascimento *</label><input type="date" name="nascimento" class="form-control" required></div>
                    </div>
                </div>

                <div data-aos="fade-left">
                    <div class="section-tag">2. Como falamos com você?</div>
                    <div class="row g-3">
                        <div class="col-md-6"><label class="form-label">WhatsApp *</label><input type="text" name="whatsapp" id="tel" class="form-control" required placeholder="(00) 00000-0000"></div>
                        <div class="col-md-6"><label class="form-label">Bairro *</label><input type="text" name="bairro" id="bairro" class="form-control" required></div>
                        <div class="col-12"><label class="form-label">Endereço Residencial</label><input type="text" name="endereco" id="rua" class="form-control"></div>
                    </div>
                </div>

                <div data-aos="fade-up">
                    <div class="section-tag">3. O que você precisa?</div>
                    <div class="col-12"><textarea name="mensagem" class="form-control" rows="4" placeholder="Escreva aqui seu pedido ou sugestão para o vereador..." required></textarea></div>
                    <div class="col-12 mt-3"><label class="form-label">Foto do Problema/Local (Opcional)</label><input type="file" name="anexo" class="form-control"></div>
                </div>

                <button type="submit" class="btn btn-enviar text-white w-100 mt-5 shadow animate__animated animate__pulse animate__infinite">
                    <i class="fa-solid fa-paper-plane me-2"></i> ENVIAR AGORA
                </button>
            </form>
        </div>
    </div>

    <!-- Scripts de Animação -->
    <script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
    <script>
        AOS.init({ duration: 1000, once: true });

        // Máscara de Telefone
        document.getElementById('tel').addEventListener('input', function(e) {
            let x = e.target.value.replace(/\\D/g, '').match(/(\\d{0,2})(\\d{0,5})(\\d{0,4})/);
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        });

        // Loading ao enviar
        document.getElementById('mainForm').onsubmit = function() {
            let btn = this.querySelector('button');
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';
            btn.style.opacity = '0.7';
        };
    </script>
</body>
</html>`);
});

// ----------------------------------------------------
// ROTA 2: SUCESSO COM ANIMAÇÃO
// ----------------------------------------------------
app.post('/enviar', upload.single('anexo'), (req, res) => {
    const dados = lerDados();
    const protocolo = "GAB-" + Date.now().toString().slice(-6);
    const novo = { id: protocolo, data: new Date().toLocaleString(), ...req.body, status: 'Pendente' };
    dados.push(novo);
    salvarDados(dados);

    const waLink = `https://api.whatsapp.com/send?phone=55${novo.whatsapp.replace(/\D/g,'')}&text=Olá! Registrei minha demanda no Gabinete Digital. Protocolo: ${protocolo}`;

    res.send(`
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css" rel="stylesheet">
    <body class="bg-light d-flex align-items-center justify-content-center vh-100">
        <div class="text-center p-5 bg-white rounded-5 shadow animate__animated animate__zoomIn" style="max-width:500px;">
            <div class="text-success mb-4 animate__animated animate__bounceIn animate__delay-1s">
                <i class="fa-solid fa-circle-check fa-5x" style="color:#10b981;"></i>
            </div>
            <h2 class="fw-bold">Tudo Certo!</h2>
            <p class="text-muted">Sua demanda foi gravada com o protocolo:</p>
            <div class="h3 fw-bold text-primary mb-4 p-3 bg-light rounded">${protocolo}</div>
            <a href="${waLink}" target="_blank" class="btn btn-success btn-lg w-100 rounded-pill mb-3">RECEBER NO WHATSAPP</a>
            <br><a href="/" class="text-decoration-none">Fazer novo cadastro</a>
        </div>
        <script src="https://kit.fontawesome.com/your-code.js"></script>
    </body>`);
});

// LOGIN E ADMIN (Mantidos iguais ao anterior para segurança)
app.get('/login', (req, res) => {
    res.send(`<body style="display:flex; align-items:center; justify-content:center; height:100vh; background:#0f172a; font-family:sans-serif;">
        <form action="/login" method="POST" style="background:white; padding:40px; border-radius:15px; width:300px;" class="animate__animated animate__fadeIn">
            <h3 style="text-align:center">Admin Login</h3>
            <input type="text" name="usuario" placeholder="Usuário" style="width:100%; padding:12px; margin:10px 0; border:1px solid #ddd; border-radius:8px;">
            <input type="password" name="senha" placeholder="Senha" style="width:100%; padding:12px; margin:10px 0; border:1px solid #ddd; border-radius:8px;">
            <button style="width:100%; padding:12px; background:#0d6efd; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">ENTRAR</button>
        </form>
    </body>`);
});

app.post('/login', (req, res) => {
    if (req.body.usuario === ADMIN_USER && req.body.senha === ADMIN_PASS) {
        req.session.autenticado = true;
        return res.redirect('/admin');
    }
    res.send("<script>alert('Acesso Negado!'); window.location.href='/login';</script>");
});

app.get('/admin', (req, res) => {
    if (!req.session.autenticado) return res.redirect('/login');
    const dados = lerDados();
    let linhas = dados.map(d => `<tr class="animate__animated animate__fadeIn"><td>${d.id}</td><td>${d.nome}</td><td>${d.whatsapp}</td><td>${d.bairro}</td><td><span class="badge bg-warning text-dark">${d.status}</span></td></tr>`).join('');
    res.send(`
    <html>
    <head>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css" rel="stylesheet">
    </head>
    <body class="p-4 bg-light">
        <div class="container bg-white p-4 rounded-4 shadow animate__animated animate__slideInDown">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2 class="fw-bold">📊 Gestão de Demandas</h2>
                <a href="/logout" class="btn btn-outline-danger btn-sm">Sair</a>
            </div>
            <table class="table table-hover">
                <thead class="table-dark"><tr><th>Protocolo</th><th>Eleitor</th><th>WhatsApp</th><th>Bairro</th><th>Status</th></tr></thead>
                <tbody>${linhas || '<tr><td colspan="5" class="text-center">Nenhum dado</td></tr>'}</tbody>
            </table>
        </div>
    </body>
    </html>`);
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

app.listen(PORTA, () => console.log("Servidor com Animações Rodando na Porta " + PORTA));
