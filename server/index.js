require('dotenv').config();
const express = require('express');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const upload = multer({ dest: 'tmp/' });

app.use(bodyParser.json({ limit: '15mb' }));
app.use(bodyParser.text({ type: ['text/*', 'application/xml'], limit: '15mb' }));

// Servir frontend estático
const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

const API_BASE = (process.env.MEU_DANFE_API_BASE || 'https://api.meudanfe.com.br/v2').replace(/\/$/, '');
const API_KEY = process.env.MEU_DANFE_API_KEY || '';
const PORT = process.env.PORT || 3000;

if (!API_KEY) {
  console.warn('ATENÇÃO: configure MEU_DANFE_API_KEY em server/.env antes de rodar.');
}

/* util: tenta extrair base64 de respostas JSON */
function extractBase64FromJson(json) {
  if (!json || typeof json !== 'object') return null;
  const possibleKeys = ['base64','pdf','file','file_base64','danfe','dacte','data','document','b64','danfe_base64','fileBase64'];
  for (const k of possibleKeys) {
    if (json[k] && typeof json[k] === 'string') return json[k];
  }
  // one-level deep
  for (const vKey of Object.keys(json)) {
    const v = json[vKey];
    if (v && typeof v === 'object') {
      for (const k of possibleKeys) {
        if (v[k] && typeof v[k] === 'string') return v[k];
      }
    }
  }
  return null;
}

function sendPdfFromBase64(res, base64String, filename = 'danfe.pdf') {
  try {
    const buffer = Buffer.from(base64String, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    return res.send(buffer);
  } catch (err) {
    console.error('Erro ao decodificar Base64', err);
    return res.status(500).json({error: 'Falha ao decodificar PDF Base64'});
  }
}

/**
 * ROTA: gerar por CHAVE (usado pelo frontend)
 * POST /generate-by-key  { "chave": "XXXXXXXX..." }
 */
app.post('/generate-by-key', async (req, res) => {
  try {
    const { chave } = req.body;
    if (!chave) return res.status(400).json({ error: 'Campo "chave" é obrigatório' });

    const url = `${API_BASE}/fd/get/da/${encodeURIComponent(chave)}`;

    const apiResp = await axios.get(url, {
      headers: { 'Api-Key': API_KEY, 'Accept': 'application/json' },
      timeout: 30000
    });

    const base64 = extractBase64FromJson(apiResp.data);
    if (base64) return sendPdfFromBase64(res, base64, `danfe_${chave}.pdf`);

    return res.status(500).json({ error: 'Base64 não encontrado na resposta da API', apiResponse: apiResp.data });
  } catch (err) {
    console.error(err?.response?.data || err.message || err);
    return res.status(500).json({ error: 'Erro ao chamar API por chave', details: err?.response?.data || err.message });
  }
});

/**
 * ROTA: gerar por XML enviado como texto raw (Content-Type: application/xml)
 * POST /generate-by-xml-text  (body = raw xml)
 */
app.post('/generate-by-xml-text', async (req, res) => {
  try {
    const xml = req.body;
    if (!xml || !xml.toString().trim()) return res.status(400).json({ error: 'XML (raw) é obrigatório no body' });

    const url = `${API_BASE}/fd/convert/xml-to-da`;
    const apiResp = await axios.post(url, xml, {
      headers: { 'Api-Key': API_KEY, 'Content-Type': 'application/xml', 'Accept': 'application/json' },
      timeout: 30000
    });

    const base64 = extractBase64FromJson(apiResp.data);
    if (base64) return sendPdfFromBase64(res, base64, 'danfe_por_xml.pdf');

    return res.status(500).json({ error: 'Base64 não encontrado na resposta da API', apiResponse: apiResp.data });
  } catch (err) {
    console.error(err?.response?.data || err.message || err);
    return res.status(500).json({ error: 'Erro ao converter XML', details: err?.response?.data || err.message });
  }
});

/**
 * ROTA: gerar por XML via upload multipart/form-data (campo xmlfile)
 * POST /generate-by-xml-file
 */
app.post('/generate-by-xml-file', upload.single('xmlfile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Campo xmlfile é obrigatório' });
    const xmlPath = path.resolve(req.file.path);
    const xml = fs.readFileSync(xmlPath, 'utf8');

    const url = `${API_BASE}/fd/convert/xml-to-da`;
    const apiResp = await axios.post(url, xml, {
      headers: { 'Api-Key': API_KEY, 'Content-Type': 'application/xml', 'Accept': 'application/json' },
      timeout: 30000
    });

    fs.unlinkSync(xmlPath);

    const base64 = extractBase64FromJson(apiResp.data);
    if (base64) return sendPdfFromBase64(res, base64, 'danfe_por_xml.pdf');

    return res.status(500).json({ error: 'Base64 não encontrado na resposta da API', apiResponse: apiResp.data });
  } catch (err) {
    console.error(err?.response?.data || err.message || err);
    return res.status(500).json({ error: 'Erro ao converter XML (file)', details: err?.response?.data || err.message });
  }
});

/**
 * ROTA: adicionar XML na área do cliente (PUT /fd/add/xml)
 * POST /add-xml  (body = raw xml)
 */
app.post('/add-xml', async (req, res) => {
  try {
    const xml = req.body;
    if (!xml || !xml.toString().trim()) return res.status(400).json({ error: 'XML (raw) é obrigatório no body' });

    const url = `${API_BASE}/fd/add/xml`;
    const apiResp = await axios.put(url, xml, {
      headers: { 'Api-Key': API_KEY, 'Content-Type': 'application/xml', 'Accept': 'application/json' },
      timeout: 30000
    });

    return res.status(apiResp.status).json(apiResp.data);
  } catch (err) {
    console.error(err?.response?.data || err.message || err);
    return res.status(500).json({ error: 'Erro ao adicionar XML na área do cliente', details: err?.response?.data || err.message });
  }
});

// fallback: serve index.html for any unmatched GET (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

app.listen(PORT, () => console.log(`Server rodando na porta ${PORT}`));
