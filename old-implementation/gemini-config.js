// --- START OF FILE gemini-config.js ---

/**
 * gemini-config.js - Configurações para a integração com a API Gemini
 */

const GEMINI_CONFIG = {
    // Chave API e Endpoint (mantidos como antes)
    apiKey: "AIzaSyB_zYq8J9iAGLjqjLvHa5JaR6MvdLvPp4k", // Sua chave API
    apiEndpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-exp-03-25:generateContent", // Modelo Flash ou Pro

    // Configurações de Geração (mantidos como antes)
    maxTokens: 8192,
    temperature: 0.3, // Mais determinístico para análise

    // Configurações de Segurança (mantidos como antes)
    safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
    ],

    // Configurações da UI (mantidos como antes)
    assistant: {
        initiallyOpen: false,
        autoInitialize: true,
        initialDelay: 1500,
        mobileMinimized: true
    },
    insights: {
        autoRefresh: true,
        refreshInterval: 900000, // 15 min
        maxInsights: 4
    },

    // NOVO: Configuração de Cache de Dados
    dataCache: {
        ttlSeconds: 60 // Tempo de vida do cache em segundos (e.g., 60s = 1 minuto)
                       // Ajuste conforme a frequência esperada de atualização dos dados
    },

    // NOVO: Limites para busca de dados (para controlar o tamanho do contexto)
    dataLimits: {
        users: 150, // Limite de usuários a serem enviados no contexto
        doors: 100,
        devices: 100,
        logs: 300,  // Limite de logs *recentes* a serem enviados
        logDays: 7  // Buscar logs dos últimos 7 dias
    }
};

window.GEMINI_CONFIG = GEMINI_CONFIG;
console.log("GEMINI_CONFIG loaded:", window.GEMINI_CONFIG);
// --- END OF FILE gemini-config.js ---