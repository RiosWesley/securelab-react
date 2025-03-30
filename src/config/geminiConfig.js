// --- START OF FILE src/config/geminiConfig.js ---

/**
 * geminiConfig.js - Configurações para a integração com a API Gemini no projeto React
 */

const GEMINI_CONFIG = {
    // Chave API e Endpoint
    // !! IMPORTANTE: Mova a chave API para variáveis de ambiente em produção !!
    // Ex: apiKey: import.meta.env.VITE_GEMINI_API_KEY || "SUA_CHAVE_AQUI_PARA_DEV",
    apiKey: "AIzaSyB_zYq8J9iAGLjqjLvHa5JaR6MvdLvPp4k", // Sua chave API (Substitua ou use env var)
    apiEndpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest/:generateContent", // Modelo Flash ou Pro (Verifique o endpoint mais recente)

    // Configurações de Geração
    maxTokens: 8192,
    temperature: 0.3, // Mais determinístico para análise

    // Configurações de Segurança
    safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
    ],

    // Configurações da UI (Adaptáveis para React)
    chatAssistant: { // Renamed from 'assistant'
        enabled: true, // Added to explicitly enable the popup
        initiallyOpen: false,
        autoInitialize: true, // Controlará a montagem do componente
        initialDelay: 1500, // Pode ser usado com useEffect/setTimeout
        mobileMinimized: true // Lógica de UI no componente
    },
    insights: {
        autoRefresh: true,
        refreshInterval: 900000, // 15 min (Usado em useEffect)
        maxInsights: 4 // Limite na UI/processamento
    },

    // Configuração de Cache de Dados (Gerenciado no serviço/hook)
    dataCache: {
        ttlSeconds: 60 // Tempo de vida do cache em segundos
    },

    // Limites para busca de dados (Usado no serviço/hook)
    dataLimits: {
        users: 150,
        doors: 100,
        devices: 100,
        logs: 300,
        logDays: 7
    }
};

export default GEMINI_CONFIG;

console.log("GEMINI_CONFIG loaded:", GEMINI_CONFIG);
// --- END OF FILE src/config/geminiConfig.js ---
