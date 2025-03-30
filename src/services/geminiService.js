// --- START OF FILE src/services/geminiService.js ---

/**
 * geminiService.js - Serviço centralizado para integração com Gemini API e dados Firebase (React version).
 */

import { getDatabase, ref, query, orderByChild, startAt, limitToFirst, limitToLast, get } from 'firebase/database';
import GEMINI_CONFIG from '../config/geminiConfig'; // Importa a config do React

// Cache simples na memória
let systemDataContext = null;
let lastDataFetchTime = 0;
let conversationHistory = []; // Histórico APENAS para o chat

/**
 * Busca dados do Firebase se o cache expirou.
 * @private
 * @returns {Promise<Object>} O objeto de contexto de dados do sistema.
 */
async function fetchSystemData() {
    const now = Date.now();
    const config = GEMINI_CONFIG; // Usa a config importada
    const cacheTTL = (config.dataCache?.ttlSeconds ?? 60) * 1000;

    if (systemDataContext && (now - lastDataFetchTime < cacheTTL)) {
        console.log("Using cached system data.");
        return systemDataContext;
    }

    console.log("Fetching fresh system data from Firebase...");
    const db = getDatabase();
    if (!db) {
        throw new Error('Firebase database is not available. Ensure Firebase is initialized.');
    }

    const limits = config.dataLimits || { users: 100, doors: 50, devices: 50, logs: 200, logDays: 30 };
    const logDays = limits.logDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - logDays);
    const cutoffISO = cutoffDate.toISOString();

    try {
        // Usando 'get' para buscar dados uma vez
        const usersQuery = query(ref(db, 'users'), limitToFirst(limits.users));
        const doorsQuery = query(ref(db, 'doors'), limitToFirst(limits.doors));
        const devicesQuery = query(ref(db, 'devices'), limitToFirst(limits.devices));
        const logsQuery = query(
            ref(db, 'access_logs'),
            orderByChild('timestamp'),
            startAt(cutoffISO),
            limitToLast(limits.logs) // Note: Firebase RTDB limitToLast might fetch more initially if combined with startAt. Filtering might be needed.
        );

        const results = await Promise.allSettled([
            get(usersQuery),
            get(doorsQuery),
            get(devicesQuery),
            get(logsQuery)
        ]);

        const getData = (result) => result.status === 'fulfilled' ? (result.value.val() || {}) : {};

        const usersData = getData(results[0]);
        const doorsData = getData(results[1]);
        const devicesData = getData(results[2]);
        let logsData = getData(results[3]);

        // Pós-filtragem para logs se limitToLast + startAt não for exato
        const logEntries = Object.entries(logsData)
            .sort(([, a], [, b]) => new Date(b.timestamp) - new Date(a.timestamp)) // Ordena descendente por data
            .slice(0, limits.logs); // Pega os N mais recentes
        logsData = Object.fromEntries(logEntries);


        const context = {
            timestamp: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            systemInfo: {
                name: "SecureLab RFID (React)",
                description: "Sistema de controle de acesso RFID.",
                // currentPage: window.location.pathname, // Menos útil em SPA talvez, mas pode manter
            },
            dataSummary: {
                userCount: Object.keys(usersData).length,
                doorCount: Object.keys(doorsData).length,
                deviceCount: Object.keys(devicesData).length,
                logCountFetched: Object.keys(logsData).length,
                logPeriodDays: logDays,
                deviceStatus: {
                    online: Object.values(devicesData).filter(d => d?.status === 'online').length,
                    offline: Object.values(devicesData).filter(d => d?.status === 'offline').length,
                },
                doorStatus: {
                    locked: Object.values(doorsData).filter(d => d?.status === 'locked').length,
                    unlocked: Object.values(doorsData).filter(d => d?.status === 'unlocked').length,
                }
            },
            dataSchema: {
                 users: { _description: `Map of user objects (limited to ${limits.users})`, _exampleFields: ["name", "email", "status", "rfid_tag"] },
                 doors: { _description: `Map of door objects (limited to ${limits.doors})`, _exampleFields: ["name", "location", "status"] },
                 devices: { _description: `Map of device objects (limited to ${limits.devices})`, _exampleFields: ["name", "status", "firmware_version", "last_online"] },
                 recentLogs: { _description: `Map of recent access logs (limited to ${limits.logs} from last ${logDays} days, ordered most recent first)`, _exampleFields: ["user_name", "door_name", "action", "timestamp", "reason"] }
            },
            data: {
                users: usersData,
                doors: doorsData,
                devices: devicesData,
                recentLogs: logsData
            }
        };

        systemDataContext = context;
        lastDataFetchTime = now;
        console.log("System data fetched and cached.", context.dataSummary);
        return systemDataContext;

    } catch (error) {
        console.error('Error fetching system data for Gemini:', error);
        systemDataContext = null;
        lastDataFetchTime = 0;
        throw new Error(`Falha ao buscar dados do sistema: ${error.message}`);
    }
}

/**
 * Constrói o prompt do sistema dinamicamente.
 * @private
 * @param {Object} context - Os dados do sistema buscados (JSON).
 * @param {Object} options - Opções como { isInsightRequest: true }.
 * @returns {string} O texto do prompt do sistema.
 */
function buildSystemPrompt(context, options = {}) {
    const config = GEMINI_CONFIG;
    // Resumo da Interface (Pode ser atualizado conforme o app React evolui)
    const uiFunctionalitySummary = `
**Resumo da Interface e Funcionalidades do SecureLab React:**

*   **Dashboard (/):** Visão geral, cards de status, gráfico de atividade, atividade recente, status das portas, *Painel de Insights*.
*   **Usuários (/users):** Gerenciamento de usuários (visualizar, adicionar, editar, permissões).
*   **Portas (/doors):** Gerenciamento de portas (visualizar, status, adicionar, editar, controle remoto *orientado*).
*   **Dispositivos (/devices):** Gerenciamento de dispositivos (visualizar, status, detalhes).
*   **Logs (/logs):** Histórico detalhado de eventos (visualizar, filtrar).
*   **Configurações (/settings):** Configurações gerais, perfil.
*   **Login (/login):** Autenticação.
*   **Componentes Globais:** Layout com Sidebar e Header, *Assistente Gemini (chat flutuante)*, Botão de Tema.
`;

    let promptText = `Você é o assistente AI do SecureLab RFID (versão React), um sistema de controle de acesso. Sua função é dupla:
1.  **Analisar os dados ATUAIS fornecidos** para gerar insights e responder perguntas sobre o estado e atividade do sistema.
2.  **Guiar o administrador sobre COMO USAR o sistema SecureLab React**, com base no resumo da interface fornecido.

**Instruções Gerais:**
*   **Use o CONTEXTO ATUAL DO SISTEMA (JSON abaixo) para:** Responder perguntas sobre dados específicos (logs recentes, status, contagens), identificar padrões, gerar insights. **Exemplo:** "Quantos dispositivos estão offline AGORA?", "Liste os acessos negados HOJE.". **IMPORTANTE:** Não invente dados. Se a informação não estiver no JSON, informe isso. Use o timestamp e timezone do contexto para referência temporal.
*   **Use o RESUMO DA INTERFACE E FUNCIONALIDADES (acima) para:** Responder perguntas sobre **como realizar tarefas** no sistema. **Exemplo:** "Como adiciono um novo usuário?", "Onde vejo o histórico?". Oriente o usuário sobre qual rota (e.g., /users) visitar e quais ações procurar.
*   Seja claro, conciso e direto. Use português brasileiro.
*   **SEM PROCESSAMENTO INTERNO:** Não descreva seu processo de pensamento.

**Restrições CRÍTICAS:**
*   **NÃO EXECUTE AÇÕES:** Você é um assistente informativo. **NÃO PODE** trancar/destrancar portas, adicionar/editar/remover dados, mudar configurações. Se pedirem, explique que você não pode e **oriente como o usuário pode fazer isso** usando o Resumo da Interface.
*   **Combine as Fontes:** Se necessário, use o JSON para confirmar dados e o Resumo da Interface para orientar a ação do usuário.

${uiFunctionalitySummary}

**CONTEXTO ATUAL DO SISTEMA (Dados do Firebase - Status e Logs Recentes):**
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`
`;

    if (options.isInsightRequest) {
        promptText += `
**Instrução de Formato (INSIGHTS):** Responda **APENAS** com um objeto JSON válido contendo 'summary' (string) e 'insights' (array de objetos com type, title, description, priority, relatedItems). NENHUM outro texto antes ou depois do JSON.
Exemplo: {"summary": "...", "insights": [{"type": "anomaly", "title": "...", "description": "...", "priority": "high", "relatedItems": ["devices"]}]}
Prioridades válidas: 'low', 'medium', 'high'.
Tipos válidos: 'anomaly', 'pattern', 'recommendation', 'info'.`;
    } else { // Chat normal
        promptText += `
**Instrução de Formato (CHAT):** Responda em **linguagem natural**, de forma clara e conversacional. **NÃO** use formato JSON a menos que explicitamente pedido. Use markdown simples (negrito **, itálico *, listas -, blocos de código \`\`\`) quando apropriado.`;
    }

    return promptText;
}

/**
 * Envia a requisição para a API Gemini.
 * @private
 * @param {Array} requestContents - O array de 'contents' para a API.
 * @param {string} systemPromptText - O prompt do sistema construído.
 * @param {boolean} isInsightRequest - Define a temperatura e valida a resposta.
 * @returns {Promise<string>} A resposta de texto do modelo Gemini.
 */
async function callGeminiAPI(requestContents, systemPromptText, isInsightRequest = false) {
    const config = GEMINI_CONFIG;
    if (!config.apiKey || !config.apiEndpoint) {
        throw new Error("API Key or Endpoint for Gemini not configured.");
    }

    const payload = {
        systemInstruction: {
            role: "system", // Gemini API prefere 'system' ou 'user' aqui
            parts: [{ text: systemPromptText }]
        },
        contents: requestContents,
        generationConfig: {
            temperature: isInsightRequest ? 0.2 : (config.temperature ?? 0.5),
            maxOutputTokens: config.maxTokens ?? 8192,
            // responseMimeType: isInsightRequest ? "application/json" : "text/plain", // Pode tentar forçar JSON
        },
        safetySettings: config.safetySettings || []
    };

    console.log("Sending payload to Gemini:", {
        // systemInstruction: payload.systemInstruction.parts[0].text.substring(0, 300) + "...", // Log inicial
        contents: payload.contents,
        generationConfig: payload.generationConfig
    });

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const response = await fetch(`${config.apiEndpoint}?key=${config.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorData;
            let errorText = `HTTP error ${response.status}`;
            try {
                errorData = await response.json();
                errorText = errorData?.error?.message || JSON.stringify(errorData);
            } catch (e) { /* Ignore json parse error */ }
            console.error('Gemini API Error:', errorText, errorData);
            throw new Error(`Erro na API Gemini (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        console.log("Received response from Gemini:", JSON.stringify(data, null, 2));

        if (data.promptFeedback?.blockReason) {
            throw new Error(`Solicitação bloqueada (Prompt): ${data.promptFeedback.blockReason}`);
        }
        const candidate = data.candidates?.[0];
        if (!candidate) {
             throw new Error("Nenhuma resposta válida recebida do modelo.");
        }
        if (candidate.finishReason === "SAFETY") {
            const safetyRating = candidate.safetyRatings?.find(r => r.blocked);
            throw new Error(`Resposta bloqueada por segurança (${safetyRating?.category || 'Não especificado'})`);
        }
        if (candidate.finishReason === "MAX_TOKENS") {
            console.warn("Gemini response may be truncated due to MAX_TOKENS.");
            // Considerar lançar erro ou retornar parcial
             throw new Error(`A resposta excedeu o limite de tamanho. Tente ser mais específico.`);
        }

        const responseText = candidate?.content?.parts?.[0]?.text;

        if (!responseText && candidate?.finishReason !== 'STOP') {
             console.error("Gemini response missing text or finished unexpectedly.", candidate);
             throw new Error(`Resposta inválida ou vazia do modelo (${candidate?.finishReason || 'desconhecido'}).`);
        }
         if (!responseText && candidate?.finishReason === 'STOP') {
             console.warn("Gemini response text is empty, but finishReason is STOP.");
             return ""; // Retorna string vazia se for um STOP válido sem texto
         }


        if (isInsightRequest) {
            try {
                // More robust JSON extraction: find the first '{' and last '}'
                const startIndex = responseText.indexOf('{');
                const endIndex = responseText.lastIndexOf('}');
                if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
                    throw new Error("Could not find valid JSON structure in the response.");
                }
                const jsonString = responseText.substring(startIndex, endIndex + 1);
                JSON.parse(jsonString); // Validate the extracted JSON
                return jsonString; // Return the validated JSON string
            } catch (e) {
                console.error("Insight response processing error:", e, "\nOriginal response text:", responseText);
                // Include the original error message if available, otherwise use a generic one
                const errorMessage = e instanceof Error ? e.message : "Unknown JSON processing error";
                throw new Error(`A resposta da análise de insights não pôde ser processada como JSON válido: ${errorMessage}`);
            }
        }

        return responseText;

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        const userMessage = error.name === 'AbortError'
            ? 'A requisição ao assistente demorou muito.'
            : error.message || 'Erro desconhecido ao contatar o assistente.';
        throw new Error(userMessage);
    }
}

// --- Funções Exportadas ---

/**
 * Envia uma mensagem para o chat do assistente.
 * @param {string} userMessage - A mensagem do usuário.
 * @returns {Promise<string>} A resposta do assistente em linguagem natural.
 */
export async function sendMessageToChat(userMessage) {
    if (!userMessage) throw new Error("Mensagem do usuário não pode ser vazia.");

    try {
        const context = await fetchSystemData();
        const systemPrompt = buildSystemPrompt(context, { isInsightRequest: false });

        // Filtra histórico local para enviar apenas user/model
        const historyToSend = conversationHistory.filter(msg => msg.role === 'user' || msg.role === 'model');

        const requestContents = [
            ...historyToSend,
            { role: "user", parts: [{ text: userMessage }] }
        ];

        // Adiciona ANTES da chamada
        conversationHistory.push({ role: "user", parts: [{ text: userMessage }] });

        const responseText = await callGeminiAPI(requestContents, systemPrompt, false);

        // Adiciona resposta ao histórico
        conversationHistory.push({ role: "model", parts: [{ text: responseText }] });

        // Limita tamanho do histórico local (ex: últimos 10 pares)
        const maxHistoryPairs = 10;
        if (conversationHistory.length > maxHistoryPairs * 2) {
            conversationHistory = conversationHistory.slice(-(maxHistoryPairs * 2));
        }

        return responseText;

    } catch (error) {
        console.error("Error in sendMessageToChat:", error);
        throw error; // Relança para o componente tratar
    }
}

/**
 * Gera insights acionáveis analisando os dados do sistema.
 * @returns {Promise<Object>} Um objeto com { summary: string, insights: Array<Object> }.
 */
export async function generateInsights() {
    const config = GEMINI_CONFIG;
    const insightPromptMessage = `Analise os dados do sistema SecureLab fornecidos no contexto ('CONTEXTO ATUAL DO SISTEMA') e gere um resumo ('summary') e uma lista de insights acionáveis ('insights') sobre segurança, atividade, performance ou possíveis problemas. Siga ESTRITAMENTE o formato JSON especificado nas instruções, sem NENHUM texto adicional. Baseie TUDO nos dados fornecidos. Priorize anomalias e padrões relevantes. Limite a ${config.insights?.maxInsights ?? 4} insights.`;

    try {
        const context = await fetchSystemData();
        const systemPrompt = buildSystemPrompt(context, { isInsightRequest: true });

        const requestContents = [
            { role: "user", parts: [{ text: insightPromptMessage }] }
            // NÃO incluir histórico de chat
        ];

        const jsonResponseString = await callGeminiAPI(requestContents, systemPrompt, true);

        try {
            const insightsData = JSON.parse(jsonResponseString);
            if (!insightsData || typeof insightsData.summary !== 'string' || !Array.isArray(insightsData.insights)) {
                console.error("Estrutura de insights JSON inválida recebida:", insightsData);
                throw new Error("Formato de resposta de insights inesperado.");
            }
            insightsData.source = 'gemini'; // Adiciona fonte
            return insightsData;
        } catch (parseError) {
            console.error("Erro final ao parsear JSON de insights:", parseError, jsonResponseString);
            throw new Error("Falha ao processar a resposta JSON dos insights.");
        }

    } catch (error) {
        console.error("Error in generateInsights:", error);
        // Retorna um objeto de erro padronizado
        return {
            summary: "Erro na Análise",
            insights: [{
                type: "error",
                title: "Falha ao Gerar Insights via API",
                description: error.message || "Erro desconhecido ao contatar o serviço de análise.",
                priority: "high",
                relatedItems: []
            }],
            source: 'gemini-error'
        };
    }
}

/**
 * Limpa o histórico de conversação do chat (localmente).
 */
export function clearChatConversation() {
    conversationHistory = [];
    console.log("Gemini chat conversation history cleared.");
}

/**
 * Retorna o histórico de conversação atual (para a UI).
 * @returns {Array} Array de objetos { role: 'user'|'model', parts: [{text: string}] }
 */
export function getChatHistory() {
    // Retorna uma cópia para evitar mutação externa
    return [...conversationHistory];
}


// --- END OF FILE src/services/geminiService.js ---
