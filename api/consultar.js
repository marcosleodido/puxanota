import axios from 'axios';

export default async function handler(request, response) {
    // Pega a chave da URL (ex: /api/consultar?chave=123...)
    const { chave } = request.query;

    // Pega sua chave de API secreta das "Environment Variables" da Vercel
    const API_KEY = process.env.CONSULTA_DANFE_API_KEY;

    if (!API_KEY) {
        return response.status(500).json({ error: 'Chave de API do serviço não configurada no servidor.' });
    }

    if (!chave || chave.length !== 44) {
        return response.status(400).json({ error: 'Chave de acesso da NF-e inválida.' });
    }

    try {
        const requestBody = { "nfe": chave };
        
        const requestConfig = {
            headers: {
                'Authorization': `Bearer ${API_KEY}`, // Verifique na documentação se é 'Bearer' ou outro formato
                'Content-Type': 'application/json'
            }
        };

        const apiResponse = await axios.post(
            'https://consultadanfe.com/CDanfe/api_generate', 
            requestBody, 
            requestConfig
        );

        response.setHeader('Access-Control-Allow-Origin', '*');
        return response.status(200).json(apiResponse.data);

    } catch (error) {
        console.error('Erro ao chamar a API consultadanfe:', error.response?.data || error.message);
        return response.status(500).json({ error: 'Falha ao consultar o serviço externo.' });
    }
}
