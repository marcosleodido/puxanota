"""
Script Python de exemplo para usar a API MeuDanfe via seus endpoints fornecidos.
Salva PDF no disco decodificando o Base64 retornado pelo serviço.
"""

import os
import requests
import base64
import json

API_BASE = os.getenv('MEU_DANFE_API_BASE', 'https://api.meudanfe.com.br/v2')
API_KEY = os.getenv('MEU_DANFE_API_KEY', 'troque_pela_sua_api_key_aqui')

def extract_base64_from_json(j):
    # procura por chaves comuns
    keys = ['base64','pdf','file','file_base64','danfe','data','document','b64','danfe_base64']
    if not isinstance(j, dict):
        return None
    for k in keys:
        if k in j and isinstance(j[k], str):
            return j[k]
    # tenta procurar em sub-objetos
    for v in j.values():
        if isinstance(v, dict):
            for k in keys:
                if k in v and isinstance(v[k], str):
                    return v[k]
    return None

def gerar_por_chave(chave, out_path='danfe_por_chave.pdf'):
    url = f"{API_BASE}/fd/get/da/{chave}"
    headers = {'Api-Key': API_KEY, 'Accept': 'application/json'}
    r = requests.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    j = r.json()
    b64 = extract_base64_from_json(j)
    if not b64:
        print('Base64 não encontrado na resposta:', json.dumps(j, indent=2, ensure_ascii=False))
        return
    data = base64.b64decode(b64)
    with open(out_path, 'wb') as f:
        f.write(data)
    print('PDF salvo em', out_path)

def gerar_por_xml(xml_path, out_path='danfe_por_xml.pdf'):
    url = f"{API_BASE}/fd/convert/xml-to-da"
    headers = {'Api-Key': API_KEY, 'Content-Type': 'application/xml', 'Accept': 'application/json'}
    with open(xml_path, 'rb') as f:
        xml = f.read()
    r = requests.post(url, headers=headers, data=xml, timeout=30)
    r.raise_for_status()
    j = r.json()
    b64 = extract_base64_from_json(j)
    if not b64:
        print('Base64 não encontrado na resposta:', json.dumps(j, indent=2, ensure_ascii=False))
        return
    data = base64.b64decode(b64)
    with open(out_path, 'wb') as f:
        f.write(data)
    print('PDF salvo em', out_path)

def adicionar_xml(xml_path):
    url = f"{API_BASE}/fd/add/xml"
    headers = {'Api-Key': API_KEY, 'Content-Type': 'application/xml', 'Accept': 'application/json'}
    with open(xml_path, 'rb') as f:
        xml = f.read()
    r = requests.put(url, headers=headers, data=xml, timeout=30)
    print('Status:', r.status_code)
    try:
        print('Resposta:', r.json())
    except Exception:
        print('Resposta (raw):', r.text)


if __name__ == '__main__':
    # Exemplos de uso (descomente para usar)
    # gerar_por_chave('000201... (chave completa)')
    # gerar_por_xml('/caminho/para/nota.xml')
    # adicionar_xml('/caminho/para/nota.xml')
    pass
