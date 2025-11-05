require('dotenv').config();
const express = require('express');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const upload = multer({ dest: 'tmp/' });
const app = express();

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.text({ type: ['text/*', 'application/xml'], limit: '10mb' }));

const API_BASE = process.env.MEU_DANFE_API_BASE || 'https://api.meudanfe.com.br/v2';
const API_KEY = process.env.MEU_DANFE_API_KEY || '';
const PORT = process.env.PORT || 3000;

if (!API_KEY) {
  console.warn('ATENÇÃO: configure MEU_DANFE_API_KEY no .env antes de rodar.');
}

/**
 * Utilitária para extrair string Base64 do JSON de resposta.
 * Procura por chaves comuns e retorna a string Base64 encontrada (ou null).
 */
function extractBase64FromJson(json) {
  if (!json || typeof json !== 'object') return null;

  // chaves comuns onde a API pode enviar o BASE64
  const possibleKeys = [
    'base64', 'pdf', 'file', 'file_base64', 'danfe', 'dacte', 'data',
    'danfe_base64', 'document', 'fileBase64', 'b64'
  ];

  // 1) procura em nível top
  for (const k of possibleKeys) {
    if (json[k] && typeof json[k] === 'string') return json[k];
  }

  // 2) procura recursiva simples (uma camada)
  for (const k of Object.keys(json)) {
    if (json[k] && typeof json[k] === 'object') {
      for (const k2 of possibleKeys) {
        if (json[k][k2] && typeof json[k][k2] === 'string') return json[k][k2];
      }
    }
  }

  return null;
}

/**
 * Converte base64 para Buffer e envia como PDF.
 */
function sendPdfFromBase64(res, base64String, filename = 'danfe.pdf') {
  try {
    const buffer = Buffer.from(base64String, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    return res.send(buffer);
  } catch (err) {
    console.error('Erro ao decodificar Base64:', err);
    return res.status(500).json({ error: 'Falha ao decodificar PDF Base64' });
  }
}

/**
 * 1) Gerar PDF pela CHAVE DE ACESSO (GET /fd/get/da/{Chave-Acesso})
 * Endpoint local: POST /generate-by-key  { "chave": "XXXXX" }
 */
app.post('/generate-by-key', async (req, res) => {
  try {
    const { chave } = req.body;
    if (!chave) return res.status(400).json({ error: 'Campo "chave" é obrigatório' });

    const url = `${API_BASE.replace(/\/$/, '')}/fd/get/da/${encodeURIComponent(chave)}`;

    const apiResp = await axios.get(url, {
      headers: {
        'Api-Key': API_KEY,
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    const base64 = extractBase64FromJson(apiResp.data);
    if (base64) return sendPdfFromBase64(res, base64, `danfe_${chave}.pdf`);

    // se não achou base64, retorna JSON pra debug
    return res.status(500).json({ error: 'Base64 não encontrado na resposta da API', apiResponse: apiResp.data });
  } catch (err) {
    console.error(err?.response?.data || err.message || err);
    return res.status(500).json({ error: 'Erro ao chamar API por chave', details: err?.response?.data || err.message });
  }
});

/**
 * 2) Gerar PDF enviando o XML no body para /fd/convert/xml-to-da (POST)
 * Endpoint local: POST /generate-by-xml-text  body: raw XML (content-type text/xml)
 *
 * Também oferecemos /generate-by-xml-file que aceita multipart/form-data com campo 'xmlfile'
 */
app.post('/generate-by-xml-text', async (req, res) => {
  try {
    const xml = req.body;
    if (!xml || typeof xml !== 'string' || xml.trim().length === 0) {
      return res.status(400).json({ error: 'XML no body da requisição é obrigatório (raw XML)' });
    }

    const url = `${API_BASE.replace(/\/$/, '')}/fd/convert/xml-to-da`;

    const apiResp = await axios.post(url, xml, {
      headers: {
        'Api-Key': API_KEY,
        'Content-Type': 'application/xml',
        'Accept': 'application/json'
      },
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

// multipart/form-data upload (campo xmlfile)
app.post('/generate-by-xml-file', upload.single('xmlfile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Campo xmlfile é obrigatório (multipart/form-data)' });

    const xmlPath = path.resolve(req.file.path);
    const xml = fs.readFileSync(xmlPath, { encoding: 'utf8' });

    // chama a mesma API convert
    const url = `${API_BASE.replace(/\/$/, '')}/fd/convert/xml-to-da`;
    const apiResp = await axios.post(url, xml, {
      headers: {
        'Api-Key': API_KEY,
        'Content-Type': 'application/xml',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    // remove arquivo temporário
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
 * 3) Adicionar XML na área do cliente: PUT /fd/add/xml
 * Endpoint local: POST /add-xml (raw XML body)
 * AVISO: enviar o mesmo XML várias vezes pode bloquear a conta (conforme doc)
 */
app.post('/add-xml', async (req, res) => {
  try {
    const xml = req.body;
    if (!xml || typeof xml !== 'string' || xml.trim().length === 0) {
      return res.status(400).json({ error: 'XML no body da requisição é obrigatório (raw XML)' });
    }

    const url = `${API_BASE.replace(/\/$/, '')}/fd/add/xml`;

    const apiResp = await axios.put(url, xml, {
      headers: {
        'Api-Key': API_KEY,
        'Content-Type': 'application/xml',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    // apenas repassa a resposta da API (normalmente um JSON com status)
    return res.status(apiResp.status).json(apiResp.data);
  } catch (err) {
    console.error(err?.response?.data || err.message || err);
    return res.status(500).json({ error: 'Erro ao adicionar XML na área do cliente', details: err?.response?.data || err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server rodando na porta ${PORT} - endpoints prontos: /generate-by-key, /generate-by-xml-text, /generate-by-xml-file, /add-xml`);
});
