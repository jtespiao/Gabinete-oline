const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

// CONFIGURAÇÕES DE AMBIENTE (Nuvem / Render)
const PORTA = process.env.PORT || 3000;
const PASTA_PROJETO = path.join(__dirname, 'dados');
const ARQUIVO_DADOS = path.join(PASTA_PROJETO, 'demandas_gabinete.json');
const PASTA_UPLOADS = path.join(__dirname, 'uploads');

// SENHA DO ADMIN (Para proteger os dados na internet)
const ADMIN_USER = "admin";
const ADMIN_PASS = "Rogerio123";

// Garante a existência das pastas e do arquivo de dados
[PASTA_PROJETO, PASTA_UPLOADS].forEach(pasta => {
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
});
if (!fs.existsSync(ARQUIVO_DADOS)) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify([], null, 2), 'utf8');
}

// Função auxiliar para processar requisições multipart (Upload de Arquivos + Campos)
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
            if (filenameMatch && filenameMatch[1]) {
                if (corpo.length > 0) {
                    let nomeArquivo = Date.now() + '_' + filenameMatch[1].replace(/\s+/g, '_');
                    fs.writeFileSync(path.join(PASTA_UPLOADS, nomeArquivo), corpo);
                    resultado.arquivo = nomeArquivo;
                }
            } else if (nameMatch) {
                resultado.campos[nameMatch[1]] = corpo.toString().trim();
            }
        });
        callback(resultado);
    });
}

// Servidor Principal
const servidor = http.createServer((req, res) => {
    
    // 1. FORMULÁRIO COMPLETO (PÁGINA INICIAL)
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Autocadastro - Vereador Irmão Rogério</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', system-ui, sans-serif; }
                    body { background: linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%); color: #102a43; min-height: 100vh; padding: 50px 20px; display: flex; flex-direction: column; align-items: center; }
                    .container-form { background: #ffffff; width: 100%; max-width: 850px; border-radius: 16px; padding: 40px; box-shadow: 0 10px 25px rgba(0, 62, 126, 0.07); border: 1px solid #bcccdc; position: relative; overflow: hidden; }
                    .container-form::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 6px; background: linear-gradient(90deg, #0063c6, #22c55e); }
                    .titulo-gabinete { font-size: 26px; font-weight: 800; color: #0b2146; text-transform: uppercase; text-align: center; margin-bottom: 6px; }
                    .tipo-cadastro { display: flex; justify-content: center; gap: 30px; margin-bottom: 35px; background: #f0f4f8; padding: 8px; border-radius: 30px; width: fit-content; margin: auto; }
                    .tipo-cadastro label { cursor: pointer; padding: 8px 24px; border-radius: 20px; font-size: 14px; font-weight: 700; color: #486581; transition: 0.3s; }
                    .tipo-cadastro input { display: none; }
                    .tipo-cadastro label:has(input:checked) { background: #0063c6; color: #fff; }
                    .grid-campos { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                    .secao-titulo { grid-column: span 2; font-size: 13px; font-weight: 800; color: #0063c6; text-transform: uppercase; margin: 25px 0 5px 0; border-left: 4px solid #0063c6; padding-left: 10px; }
                    .form-group { display: flex; flex-direction: column; }
                    .full-width { grid-column: span 2; }
                    label { font-size: 12px; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; }
                    input, select, textarea { padding: 12px; border: 2px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
                    .smart-captcha { grid-column: span 2; max-width: 310px; background: #f9f9f9; border: 1px solid #d3d3d3; padding: 12px; display: flex; align-items: center; gap: 10px; cursor: pointer; }
                    .btn-enviar { padding: 16px; background: #a0aec0; color: white; border: none; border-radius: 30px; font-weight: bold; cursor: not-allowed; text-transform: uppercase; }
                    .btn-enviar.active { background: #22c55e; cursor: pointer; }
                    .hidden { display: none !important; }
                </style>
            </head>
            <body>
                <h1 class="titulo-gabinete">VEREADOR IRMÃO ROGÉRIO</h1>
                <div class="container-form">
                    <form action="/enviar" method="POST" enctype="multipart/form-data" onsubmit="return validarFormulario()">
                        <div class="tipo-cadastro">
                            <label><input type="radio" name="tipo_cadastro" value="Contato" checked onclick="alternarAbas('Contato')">👨‍💼 Pessoa Física</label>
                            <label><input type="radio" name="tipo_cadastro" value="Entidade" onclick="alternarAbas('Entidade')">🏢 Entidade/Empresa</label>
                        </div>
                        <div class="grid-campos">
                            <div id="grupo-contato" class="full-width grid-campos">
                                <div class="form-group"><label>Nome Completo *</label><input type="text" id="nome_pf" name="nome" required></div>
                                <div class="form-group"><label>Nascimento *</label><input type="date" id="data_nascimento_pf" name="data_nascimento" required></div>
                                <div class="form-group"><label>Celular/WhatsApp *</label><input type="text" id="celular_pf" name="contato" required placeholder="(00) 00000-0000"></div>
                                <div class="form-group"><label>Título de Eleitor</label><input type="text" id="titulo_eleitor" name="titulo_eleitor"></div>
                            </div>
                            <div id="grupo-entidade" class="full-width grid-campos hidden">
                                <div class="form-group"><label>Razão Social *</label><input type="text" id="nome_pj" name="nome_entidade"></div>
                                <div class="form-group"><label>CNPJ *</label><input type="text" id="cnpj" name="cnpj" placeholder="00.000.000/0000-00"></div>
                                <div class="form-group"><label>Celular Comercial *</label><input type="text" id="celular_pj" name="celular_entidade"></div>
                            </div>
                            <div class="secao-titulo">Endereço</div>
                            <div class="form-group"><label>CEP</label><input type="text" id="cep" name="cep" maxlength="9"></div>
                            <div class="form-group"><label>Bairro *</label><input type="text" id="bairro" name="bairro" required></div>
                            <div class="form-group full-width"><label>Cidade *</label><input type="text" id="cidade" name="cidade" required></div>
                            <div class="secao-titulo">Relato</div>
                            <div class="form-group full-width"><label>Descrição da Demanda *</label><textarea name="mensagem" rows="4" required></textarea></div>
                            <div class="form-group full-width"><label>Anexo (Opcional)</label><input type="file" name="anexo"></div>
                            
                            <div class="smart-captcha" onclick="validarCaptcha()">
                                <div id="check-box" style="width:20px; height:20px; border:2px solid #ccc; background:#fff;"></div>
                                <span id="txt-captcha">Não sou um robô</span>
                            </div>

                            <div class="full-width"><button type="submit" id="btn-submit" class="btn-enviar" disabled>Confirmar Cadastro</button></div>
                        </div>
                    </form>
                </div>
                <script>
                    let captchaOk = false;
                    function validarCaptcha() {
                        document.getElementById('check-box').style.background = '#22c55e';
                        document.getElementById('txt-captcha').innerText = 'Verificado';
                        captchaOk = true;
                        document.getElementById('btn-submit').disabled = false;
                        document.getElementById('btn-submit').classList.add('active');
                    }
                    function alternarAbas(tipo) {
                        document.getElementById('grupo-contato').classList.toggle('hidden', tipo !== 'Contato');
                        document.getElementById('grupo-entidade').classList.toggle('hidden', tipo === 'Contato');
                        document.getElementById('nome_pf').required = (tipo === 'Contato');
                        document.getElementById('nome_pj').required = (tipo !== 'Contato');
                    }
                    // Máscaras Básicas
                    document.getElementById('celular_pf').addEventListener('input', e => {
                        let x = e.target.value.replace(/\\D/g, '').match(/(\\d{0,2})(\\d{0,5})(\\d{0,4})/);
                        e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
                    });
                    document.getElementById('cep').addEventListener('blur', e => {
                        let cep = e.target.value.replace(/\\D/g, '');
                        if(cep.length === 8) {
                            fetch(\`https://viacep.com.br/ws/\${cep}/json/\`).then(r => r.json()).then(d => {
                                if(!d.erro) { document.getElementById('bairro').value = d.bairro; document.getElementById('cidade').value = d.localidade; }
                            });
                        }
                    });
                    function validarFormulario() { if(!captchaOk) { alert('Valide o captcha'); return false; } return true; }
                </script>
            </body>
            </html>
        `);

    // 2. PROCESSAR ENVIO (POST /ENVIAR)
    } else if (req.method === 'POST' && req.url === '/enviar') {
        processarMultipart(req, (resultado) => {
            const demandas = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
            const id_protocolo = 'PROTO' + Date.now().toString().slice(-6);
            const novaDemanda = {
                id_protocolo,
                status: 'Pendente',
                data_registro: new Date().toISOString(),
                ...resultado.campos,
                arquivo: resultado.arquivo
            };
            demandas.push(novaDemanda);
            fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(demandas, null, 2));
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<h2>Sucesso! Protocolo: \${id_protocolo}</h2><a href="/">Voltar</a>`);
        });

    // 3. PAINEL ADMIN (COM PROTEÇÃO BASIC AUTH)
    } else if (req.method === 'GET' && req.url === '/admin') {
        const auth = req.headers['authorization'];
        if (!auth) {
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Acesso Restrito"' });
            return res.end('Login necessário.');
        }
        const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
        if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
            res.writeHead(401); return res.end('Acesso negado.');
        }

        const demandas = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
        let linhas = demandas.map(item => `
            <tr>
                <td style="font-weight:bold; color:#0063c6;">\${item.id_protocolo}</td>
                <td>\${item.nome || item.nome_entidade} <br><small>\${item.contato || item.celular_entidade}</small></td>
                <td>\${item.bairro} / \${item.cidade}</td>
                <td>\${item.mensagem}</td>
                <td>
                    <form action="/atualizar-status" method="POST">
                        <input type="hidden" name="id_protocolo" value="\${item.id_protocolo}">
                        <select name="novo_status" onchange="this.form.submit()">
                            <option \${item.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                            <option \${item.status === 'Em Análise' ? 'selected' : ''}>Em Análise</option>
                            <option \${item.status === 'Resolvido' ? 'selected' : ''}>Resolvido</option>
                        </select>
                    </form>
                </td>
            </tr>
        `).join('');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <html>
            <head>
                <title>Painel Admin</title>
                <style>
                    body { font-family: sans-serif; background: #f0f4f8; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; }
                    th { background: #0b2146; color: white; padding: 12px; text-align: left; }
                    td { padding: 12px; border-bottom: 1px solid #eee; }
                </style>
            </head>
            <body>
                <h2>🏛️ Gestão de Demandas - Gabinete</h2>
                <table>
                    <thead><tr><th>Protocolo</th><th>Cidadão</th><th>Local</th><th>Relato</th><th>Status</th></tr></thead>
                    <tbody>\${linhas}</tbody>
                </table>
            </body>
            </html>
        `);

    // 4. ATUALIZAR STATUS
    } else if (req.method === 'POST' && req.url === '/atualizar-status') {
        let corpo = '';
        req.on('data', chunk => corpo += chunk.toString());
        req.on('end', () => {
            const dados = querystring.parse(corpo);
            const demandas = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
            const idx = demandas.findIndex(d => d.id_protocolo === dados.id_protocolo);
            if (idx !== -1) {
                demandas[idx].status = dados.novo_status;
                fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(demandas, null, 2));
            }
            res.writeHead(302, { 'Location': '/admin' });
            res.end();
        });

    } else {
        res.writeHead(404); res.end('Página não encontrada.');
    }
});

servidor.listen(PORTA, () => {
    console.log("Servidor completo rodando na porta " + PORTA);
});
