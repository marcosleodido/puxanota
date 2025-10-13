document.addEventListener('DOMContentLoaded', () => {
    const chaveNfeInput = document.getElementById('chaveNfe');
    const consultarBtn = document.getElementById('consultarBtn');
    const resultadoDiv = document.getElementById('resultado');

    consultarBtn.addEventListener('click', () => {
        const chave = chaveNfeInput.value.trim();

        if (chave.length !== 44 || !/^\d+$/.test(chave)) {
            resultadoDiv.innerHTML = `<p style="color: red;">Por favor, insira uma chave de NF-e válida com 44 dígitos numéricos.</p>`;
            return;
        }

        consultarDanfe(chave);
    });

    async function consultarDanfe(chave) {
        resultadoDiv.innerHTML = `<p>Consultando, por favor aguarde...</p>`;
        
        // URL da API que você forneceu
        const apiUrl = 'https://consultadanfe.com/CDanfe/api_generate';

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                // A API provavelmente espera um JSON, então enviamos nesse formato
                body: JSON.stringify({ chNFe: chave }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Erro na API: ${response.statusText}`);
            }

            // Tentamos interpretar a resposta como JSON.
            const data = await response.json();

            // Mostramos a resposta completa para depuração
            resultadoDiv.innerHTML = `<h3>Resposta da API:</h3><pre>${JSON.stringify(data, null, 2)}</pre>`;
            
        } catch (error) {
            console.error('Falha na consulta:', error);
            resultadoDiv.innerHTML = `<p style="color: red;">Não foi possível consultar a nota. Verifique a chave ou tente novamente mais tarde.</p>`;
        }
    }
});
