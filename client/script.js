// simples cliente que consome o servidor (mesma origem)
const el = sel => document.querySelector(sel);
const msgEl = el('#msg');

function showMsg(text, success=true) {
  msgEl.style.display = 'block';
  msgEl.textContent = text;
  msgEl.style.background = success ? '#28a745' : '#dc3545';
  setTimeout(()=>{ msgEl.style.display='none'; }, 7000);
}

async function downloadBlobAsFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// gerar por chave
el('#btnGerarChave').addEventListener('click', async () => {
  const chave = el('#chaveInput').value.trim();
  if (!chave) return showMsg('Preencha a chave de acesso', false);
  try {
    el('#btnGerarChave').disabled = true;
    showMsg('Gerando PDF... Aguarde', true);

    const resp = await fetch('/generate-by-key', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({chave})
    });

    if (!resp.ok) {
      const j = await resp.json().catch(()=>null);
      showMsg('Erro: ' + (j?.error || resp.statusText), false);
      el('#btnGerarChave').disabled = false;
      return;
    }

    const blob = await resp.blob();
    downloadBlobAsFile(blob, `danfe_${chave}.pdf`);
    showMsg('Download iniciado', true);
  } catch (err) {
    console.error(err);
    showMsg('Erro ao gerar PDF', false);
  } finally {
    el('#btnGerarChave').disabled = false;
  }
});

// gerar por xml (arquivo)
el('#btnGerarXml').addEventListener('click', async () => {
  const f = el('#xmlFile').files[0];
  if (!f) return showMsg('Escolha um arquivo XML', false);
  try {
    el('#btnGerarXml').disabled = true;
    showMsg('Enviando XML... Aguarde', true);

    const form = new FormData();
    form.append('xmlfile', f);

    const resp = await fetch('/generate-by-xml-file', {
      method: 'POST',
      body: form
    });

    if (!resp.ok) {
      const j = await resp.json().catch(()=>null);
      showMsg('Erro: ' + (j?.error || resp.statusText), false);
      el('#btnGerarXml').disabled = false;
      return;
    }

    const blob = await resp.blob();
    downloadBlobAsFile(blob, `danfe_por_xml.pdf`);
    showMsg('Download iniciado', true);
  } catch (err) {
    console.error(err);
    showMsg('Erro ao gerar PDF', false);
  } finally {
    el('#btnGerarXml').disabled = false;
  }
});

// enviar xml para "minha área"
el('#btnAddXml').addEventListener('click', async () => {
  const f = el('#xmlFileAdd').files[0];
  if (!f) return showMsg('Escolha um arquivo XML para enviar', false);
  try {
    el('#btnAddXml').disabled = true;
    showMsg('Enviando XML para sua área... Aguarde', true);

    const text = await f.text();
    const resp = await fetch('/add-xml', {
      method: 'POST',
      headers: {'Content-Type': 'application/xml'},
      body: text
    });

    if (!resp.ok) {
      const j = await resp.json().catch(()=>null);
      showMsg('Erro: ' + (j?.error || JSON.stringify(j)), false);
      el('#btnAddXml').disabled = false;
      return;
    }

    const j = await resp.json().catch(()=>null);
    showMsg('XML enviado com sucesso', true);
    console.log('Resposta add-xml:', j);
  } catch (err) {
    console.error(err);
    showMsg('Erro ao enviar XML', false);
  } finally {
    el('#btnAddXml').disabled = false;
  }
});
