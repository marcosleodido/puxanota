const gerarBtn = document.getElementById('gerarBtn');
const xmlInput = document.getElementById('xmlInput');
const statusText = document.getElementById('status');

gerarBtn.addEventListener('click', async () => {
    const xmlContent = xmlInput.value.trim();

    if (!xmlContent) {
        statusText.textContent = "⚠️ Cole o conteúdo do XML antes de gerar!";
        return;
    }

    statusText.textContent = "⏳ Gerando DANFE, aguarde...";

    // 🔥 URL atualizada com o proxy CORS Anywhere
    const apiUrl = 'https://cors-anywhere.herokuapp.com/https://consultadanfe.com/CDanfe/api_generate';

    const formData = new URLSearchParams();
    formData.append('codigo_xml', xmlContent);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: formData
        });

        const data = await response.json();

        if (data.status === 'success') {
            const byteCharacters = atob(data.pdf.base64);
            const byteNumbers = new Array(byteCharacters.length);

            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }

            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.pdf.filename || "danfe.pdf";
            a.click();

            statusText.textContent = "✅ DANFE gerado com sucesso!";
        } else {
            statusText.textContent = "❌ Erro ao gerar DANFE: " + (data.message || "Verifique o XML.");
        }
    } catch (error) {
        statusText.textContent = "❌ Ocorreu um erro: " + error.message;
    }
});
