// --- START OF FILE gemini-service.js ---

/**
 * gemini-service.js - Serviço centralizado para integração com Gemini API e dados Firebase.
 */

class GeminiService {
    constructor() {
        // Carregar configuração
        if (typeof window.GEMINI_CONFIG === 'undefined') {
            console.error("CRITICAL: window.GEMINI_CONFIG is not defined.");
            // Configuração de fallback mínima para evitar erros imediatos
            this.config = { apiKey: "", apiEndpoint: "", temperature: 0.5, maxTokens: 4096, safetySettings: [], dataCache: { ttlSeconds: 60 }, dataLimits: { users: 50, doors: 50, devices: 50, logs: 100, logDays: 7 } };
        } else {
            this.config = window.GEMINI_CONFIG;
            if (!this.config.apiKey) console.warn("Gemini API Key is missing in GEMINI_CONFIG.");
            if (!this.config.apiEndpoint) console.warn("Gemini API Endpoint is missing in GEMINI_CONFIG.");
        }

        this.conversationHistory = []; // Histórico APENAS para o chat
        this.systemDataContext = null; // Cache para dados do Firebase
        this.lastDataFetchTime = 0; // Timestamp da última busca de dados

        console.log("GeminiService initialized. Data cache TTL:", this.config.dataCache.ttlSeconds, "s");
    }

    /**
     * Busca dados do Firebase se o cache expirou. Centraliza a coleta de dados.
     * @private
     * @returns {Promise<Object>} O objeto de contexto de dados do sistema.
     */
    async _fetchSystemData() {
        const now = Date.now();
        const cacheTTL = (this.config.dataCache?.ttlSeconds ?? 60) * 1000; // TTL em milissegundos

        // Verifica se o cache é válido
        if (this.systemDataContext && (now - this.lastDataFetchTime < cacheTTL)) {
            console.log("Using cached system data.");
            return this.systemDataContext;
        }

        console.log("Fetching fresh system data from Firebase...");
        if (typeof firebase === 'undefined' || typeof firebase.database === 'undefined') {
            throw new Error('Firebase database is not available.');
        }

        const limits = this.config.dataLimits || { users: 100, doors: 50, devices: 50, logs: 200, logDays: 30 }; // Fallback limits
        const logDays = limits.logDays;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - logDays);
        const cutoffISO = cutoffDate.toISOString();

        try {
            const results = await Promise.allSettled([
                firebase.database().ref('users').limitToFirst(limits.users).once('value'),
                firebase.database().ref('doors').limitToFirst(limits.doors).once('value'),
                firebase.database().ref('devices').limitToFirst(limits.devices).once('value'),
                firebase.database().ref('access_logs')
                    .orderByChild('timestamp')
                    .startAt(cutoffISO) // Busca a partir da data de corte
                    .limitToLast(limits.logs) // Pega os N mais recentes no período
                    .once('value')
            ]);

            const getData = (result) => result.status === 'fulfilled' ? (result.value.val() || {}) : {};

            const usersData = getData(results[0]);
            const doorsData = getData(results[1]);
            const devicesData = getData(results[2]);
            const logsData = getData(results[3]); // Já limitado pela query

            // Processar e estruturar o contexto para o Gemini
            const context = {
                timestamp: new Date().toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                systemInfo: {
                    name: "SecureLab RFID",
                    description: "Sistema de controle de acesso RFID.",
                    currentPage: window.location.pathname, // Pode ser útil
                },
                dataSummary: {
                    userCount: Object.keys(usersData).length,
                    doorCount: Object.keys(doorsData).length,
                    deviceCount: Object.keys(devicesData).length,
                    logCountFetched: Object.keys(logsData).length,
                    logPeriodDays: logDays,
                    deviceStatus: {
                        online: Object.values(devicesData).filter(d => d.status === 'online').length,
                        offline: Object.values(devicesData).filter(d => d.status === 'offline').length,
                    },
                    doorStatus: {
                        locked: Object.values(doorsData).filter(d => d.status === 'locked').length,
                        unlocked: Object.values(doorsData).filter(d => d.status === 'unlocked').length,
                    }
                },
                // Estrutura para ajudar o modelo a entender os dados
                dataSchema: {
                    users: { _description: `Map of user objects (limited to ${limits.users})`, _exampleFields: ["name", "email", "status", "rfid_tag"] },
                    doors: { _description: `Map of door objects (limited to ${limits.doors})`, _exampleFields: ["name", "location", "status"] },
                    devices: { _description: `Map of device objects (limited to ${limits.devices})`, _exampleFields: ["name", "status", "firmware_version", "last_online"] },
                    recentLogs: { _description: `Map of recent access logs (limited to ${limits.logs} from last ${logDays} days)`, _exampleFields: ["user_name", "door_name", "action", "timestamp", "reason"] }
                },
                // Dados reais (limitados)
                data: {
                    users: usersData,
                    doors: doorsData,
                    devices: devicesData,
                    recentLogs: logsData // Renomeado para clareza
                }
            };

            this.systemDataContext = context;
            this.lastDataFetchTime = now;
            console.log("System data fetched and cached.", context.dataSummary);
            return this.systemDataContext;

        } catch (error) {
            console.error('Error fetching system data for Gemini:', error);
            // Limpa o cache em caso de erro para forçar nova tentativa
            this.systemDataContext = null;
            this.lastDataFetchTime = 0;
            throw new Error(`Falha ao buscar dados do sistema: ${error.message}`);
        }
    }

    /**
     * Constrói o prompt do sistema dinamicamente, incluindo visão geral da UI.
     * @private
     * @param {Object} context - Os dados do sistema buscados (JSON).
     * @param {Object} options - Opções como { isInsightRequest: true }.
     * @returns {string} O texto do prompt do sistema.
     */
    _buildSystemPrompt(context, options = {}) {
        // ---- NOVO: Resumo da Interface e Funcionalidades (Baseado na Documentação) ----
        // ATENÇÃO: O conteúdo aqui deve ser uma string Javascript válida.
        const uiFunctionalitySummary = `
**Resumo da Interface e Funcionalidades do SecureLab 2.0 (Baseado na Documentação):**

*   **Dashboard (\`dashboard.html\`):** Visão geral do sistema, estatísticas rápidas (usuários, portas, dispositivos), atividade recente, status, insights da IA, gráfico de atividade. Ponto de partida principal.
*   **Usuários (\`users.html\`):** Gerenciamento completo de usuários. Permite: visualizar lista, buscar, filtrar, adicionar novos usuários, editar informações (nome, email, RFID tag, etc.), definir permissões/grupos, ativar/desativar usuários.
*   **Portas (\`doors.html\`):** Gerenciamento das portas controladas. Permite: visualizar lista de portas, ver status (trancada/destrancada, online/offline), adicionar novas portas, editar configurações (nome, localização), definir agendamentos de acesso, controlar remotamente (trancar/destrancar - *lembre-se, VOCÊ não pode fazer isso, apenas orientar o usuário*).
*   **Dispositivos (\`devices.html\`):** Gerenciamento dos leitores RFID e controladores. Permite: visualizar lista de dispositivos, ver status (online/offline), IP, MAC, versão de firmware, última atividade, configurar parâmetros (se aplicável), diagnósticos.
*   **Logs de Acesso (\`logs.html\`):** Visualização do histórico detalhado de eventos. Permite: ver todos os logs (acesso concedido/negado, porta trancada/destrancada), filtrar por data, usuário, porta, tipo de evento, exportar logs. Essencial para auditoria.
*   **Configurações (\`settings.html\`):** Configurações gerais do sistema (ainda não detalhado na doc, mas provavelmente inclui perfil do admin, configurações de notificação, etc.).
*   **Login (\`login.html\`):** Página de autenticação.
*   **Recursos Comuns:** Funções como troca de tema (claro/escuro), notificações, menu lateral para navegação.
`;
        // ---- FIM DO NOVO RESUMO ----

        // Instruções base (Refinadas)
        // ATENÇÃO: A string começa com crase (`).
        let promptText = `Você é o assistente AI do SecureLab RFID, um sistema de controle de acesso. Sua função é dupla:
1.  **Analisar os dados ATUAIS fornecidos** para gerar insights e responder perguntas sobre o estado e atividade do sistema.
2.  **Guiar o administrador sobre COMO USAR o sistema SecureLab**, com base no resumo da interface fornecido.

**Instruções Gerais:**
*   **Use o CONTEXTO ATUAL DO SISTEMA (JSON abaixo) para:** Responder perguntas sobre dados específicos (logs recentes, status de dispositivos/portas, contagens), identificar padrões nos dados recentes, gerar insights sobre a situação atual. **Exemplo:** "Quantos dispositivos estão offline AGORA?", "Liste os acessos negados HOJE.". **IMPORTANTE:** Não invente dados. Se a informação não estiver no JSON, informe isso.
*   **Use o RESUMO DA INTERFACE E FUNCIONALIDADES (acima) para:** Responder perguntas sobre **como realizar tarefas** no sistema. **Exemplo:** "Como adiciono um novo usuário?", "Onde posso ver o histórico de acessos?", "Como configuro uma porta?". Oriente o usuário sobre qual página visitar e quais ações procurar.
*   Seja claro, conciso e direto ao ponto.
*   **SEM PROCESSAMENTO INTERNO:** Não descreva seu processo de pensamento (e.g., "Vou verificar a documentação...").

**Restrições CRÍTICAS:**
*   **NÃO EXECUTE AÇÕES:** Você é um assistente informativo e analítico. **NÃO PODE** trancar/destrancar portas, adicionar/editar/remover usuários/dispositivos, mudar configurações, etc. Se pedirem, explique que você não pode e **oriente como o usuário pode fazer isso** usando o Resumo da Interface.
*   **Combine as Fontes:** Se uma pergunta exigir ambos (e.g., "Vejo um alerta sobre dispositivo offline, como resolvo?"), use o JSON para confirmar o status e o Resumo da Interface para orientar sobre como ir à página de Dispositivos para diagnóstico.

${uiFunctionalitySummary}

**CONTEXTO ATUAL DO SISTEMA (Dados do Firebase - Status e Logs Recentes):**
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`
`; // <-- Fim da primeira string multilinhas

        // Instruções de formato de saída (Adicionadas à string promptText)
        if (options.isInsightRequest) {
            // ATENÇÃO: A string começa com crase (`).
            promptText += `
**Instrução de Formato (INSIGHTS):** Responda **APENAS** com um objeto JSON válido contendo 'summary' (string) e 'insights' (array de objetos com type, title, description, priority, relatedItems). NENHUM outro texto antes ou depois do JSON.
Exemplo: {"summary": "...", "insights": [{"type": "anomaly", "title": "...", "description": "...", "priority": "high", "relatedItems": ["devices"]}]}
Prioridades válidas: 'low', 'medium', 'high'.
Tipos válidos: 'anomaly', 'pattern', 'recommendation', 'info'.`; // <-- Fim da string para Insights
        } else { // Chat normal
            // ATENÇÃO: A string começa com crase (`).
            promptText += `
**Instrução de Formato (CHAT):** Responda em **linguagem natural**, de forma clara e conversacional. **NÃO** use formato JSON a menos que explicitamente pedido pelo usuário. Use markdown simples (negrito **, itálico *, listas -, blocos de código \`\`\`) quando apropriado para clareza.`; // <-- Fim da string para Chat
        }

        return promptText;
    } // Fim da função _buildSystemPrompt

    /**
     * Envia a requisição para a API Gemini.
     * @private
     * @param {Array} requestContents - O array de 'contents' para a API (histórico + mensagem atual).
     * @param {string} systemPromptText - O prompt do sistema construído.
     * @param {boolean} isInsightRequest - Define a temperatura e valida a resposta.
     * @returns {Promise<string>} A resposta de texto do modelo Gemini.
     */
    async _callGeminiAPI(requestContents, systemPromptText, isInsightRequest = false) {
        if (!this.config.apiKey || !this.config.apiEndpoint) {
            throw new Error("API Key or Endpoint for Gemini not configured.");
        }

        const payload = {
            // System Prompt usando systemInstruction
            systemInstruction: {
                role: "system", // Ou 'user' se 'system' der erro
                parts: [{ text: systemPromptText }]
            },
            contents: requestContents,
            generationConfig: {
                temperature: isInsightRequest ? 0.2 : (this.config.temperature ?? 0.5), // Mais baixo para insights
                maxOutputTokens: this.config.maxTokens ?? 4096,
                // topP, topK podem ser adicionados aqui
            },
            safetySettings: this.config.safetySettings || []
        };

        // Debug: Logar o payload (sem o contexto completo se for muito grande)
        console.log("Sending payload to Gemini:", {
            // Mostra apenas as chaves do contexto para evitar log gigante
            systemInstruction: payload.systemInstruction.parts[0].text.substring(0, 300) + "...", // Log inicial do prompt
            contents: payload.contents, // Logar histórico + mensagem atual
            generationConfig: payload.generationConfig
        });

        try {
            const response = await fetch(`${this.config.apiEndpoint}?key=${this.config.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(60000) // Timeout de 60s
            });

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
            console.log("Received response from Gemini:", JSON.stringify(data, null, 2)); // Log completo da resposta

            // Verificações de segurança e conteúdo (mantidas da versão anterior)
            if (data.promptFeedback?.blockReason) {
                throw new Error(`Solicitação bloqueada (Prompt): ${data.promptFeedback.blockReason}`);
            }
            const candidate = data.candidates?.[0];
            if (candidate?.finishReason === "SAFETY") {
                const safetyRating = candidate.safetyRatings?.find(r => r.blocked);
                throw new Error(`Resposta bloqueada por segurança (${safetyRating?.category || 'Não especificado'})`);
            }
            if (candidate?.finishReason === "MAX_TOKENS") {
                // Retorna o texto parcial e avisa no console
                console.warn("Gemini response may be truncated due to MAX_TOKENS.");
                // return candidate?.content?.parts?.[0]?.text || ""; // Retorna o que tiver
                throw new Error(`A resposta excedeu o limite de tamanho. Tente ser mais específico.`); // Ou pode lançar erro
            }

            const responseText = candidate?.content?.parts?.[0]?.text;
            if (!responseText && candidate?.finishReason !== 'STOP') {
                console.error("Gemini response missing text or finished unexpectedly.", candidate);
                throw new Error(`Resposta inválida ou vazia do modelo (${candidate?.finishReason || 'desconhecido'}).`);
            }
            if (!responseText) {
                console.warn("Gemini response text is empty, but finishReason is STOP.");
                return ""; // Retorna string vazia se for um STOP válido sem texto
            }


            // Validação extra para Insights: Tenta parsear como JSON
            if (isInsightRequest) {
                try {
                    // Remove possíveis ```json ... ``` do início/fim
                    const cleanedJson = responseText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
                    JSON.parse(cleanedJson); // Apenas valida, não retorna o objeto parseado aqui
                    return cleanedJson; // Retorna a string JSON validada
                } catch (e) {
                    console.error("Insight response is not valid JSON:", e, responseText);
                    throw new Error("A resposta da análise de insights não é um JSON válido.");
                }
            }

            return responseText; // Retorna texto normal para chat

        } catch (error) {
            console.error('Error calling Gemini API:', error);
            const userMessage = error.name === 'AbortError'
                ? 'A requisição ao assistente demorou muito.'
                : error.message || 'Erro desconhecido ao contatar o assistente.';
            // Não rejeitamos a promessa aqui, o chamador tratará o erro
            throw new Error(userMessage); // Relança o erro com mensagem amigável
        }
    }

    /**
     * Envia uma mensagem para o chat do assistente.
     * @param {string} userMessage - A mensagem do usuário.
     * @returns {Promise<string>} A resposta do assistente em linguagem natural.
     */
    async sendMessageToChat(userMessage) {
        if (!userMessage) throw new Error("Mensagem do usuário não pode ser vazia.");

        try {
            // 1. Obter contexto de dados atualizado (cache ou busca)
            const context = await this._fetchSystemData();

            // 2. Construir prompt do sistema
            const systemPrompt = this._buildSystemPrompt(context, { isInsightRequest: false });

            // 3. Preparar histórico + mensagem atual
            // Filtra o histórico local para enviar apenas user/model
            const historyToSend = this.conversationHistory.filter(msg => msg.role === 'user' || msg.role === 'model');

            const requestContents = [
                ...historyToSend,
                { role: "user", parts: [{ text: userMessage }] }
            ];

            // 4. Adicionar mensagem do usuário ao histórico *local*
            // Adiciona ANTES da chamada para que não se perca se a chamada falhar
            this.conversationHistory.push({ role: "user", parts: [{ text: userMessage }] });


            // 5. Chamar a API
            const responseText = await this._callGeminiAPI(requestContents, systemPrompt, false);

            // 6. Adicionar resposta do modelo ao histórico *local*
            this.conversationHistory.push({ role: "model", parts: [{ text: responseText }] });

            // Limitar tamanho do histórico local (ex: últimos 10 pares)
            const maxHistoryPairs = 10;
            if (this.conversationHistory.length > maxHistoryPairs * 2) {
                this.conversationHistory = this.conversationHistory.slice(-(maxHistoryPairs * 2));
            }

            // 7. Retornar resposta
            return responseText;

        } catch (error) {
            console.error("Error in sendMessageToChat:", error);
            // O erro já foi tratado em _callGeminiAPI ou _fetchSystemData, apenas relança
            throw error;
        }
    }

    /**
     * Gera insights acionáveis analisando os dados do sistema.
     * @returns {Promise<Object>} Um objeto com { summary: string, insights: Array<Object> }.
     */
    async generateInsights() {
        const insightPromptMessage = `Analise os dados do sistema SecureLab fornecidos no contexto ('CONTEXTO ATUAL DO SISTEMA') e gere um resumo ('summary') e uma lista de insights acionáveis ('insights') sobre segurança, atividade, performance ou possíveis problemas. Siga ESTRITAMENTE o formato JSON especificado nas instruções, sem NENHUM texto adicional. Baseie TUDO nos dados fornecidos. Priorize anomalias e padrões relevantes. Limite a ${this.config.insights?.maxInsights ?? 4} insights.`;

        try {
            // 1. Obter contexto de dados atualizado
            const context = await this._fetchSystemData();

            // 2. Construir prompt do sistema específico para insights
            const systemPrompt = this._buildSystemPrompt(context, { isInsightRequest: true });

            // 3. Preparar conteúdo da requisição (sem histórico de chat)
            const requestContents = [
                { role: "user", parts: [{ text: insightPromptMessage }] }
                // NÃO incluir histórico de chat aqui
            ];

            // 4. Chamar a API especificando que é para insights
            const jsonResponseString = await this._callGeminiAPI(requestContents, systemPrompt, true);

            // 5. Parsear a string JSON (já validada em _callGeminiAPI)
            try {
                const insightsData = JSON.parse(jsonResponseString);
                // Validação básica da estrutura recebida
                if (!insightsData || typeof insightsData.summary !== 'string' || !Array.isArray(insightsData.insights)) {
                    console.error("Estrutura de insights JSON inválida recebida:", insightsData);
                    throw new Error("Formato de resposta de insights inesperado.");
                }
                // Adiciona fonte para UI saber
                insightsData.source = 'gemini';
                return insightsData;
            } catch(parseError){
                // Se o parse falhar aqui (apesar da validação anterior), algo está errado
                console.error("Erro final ao parsear JSON de insights:", parseError, jsonResponseString);
                throw new Error("Falha ao processar a resposta JSON dos insights.");
            }


        } catch (error) {
            console.error("Error in generateInsights:", error);
            // Retorna um objeto de erro padronizado para a UI de Insights
            return {
                summary: "Erro na Análise",
                insights: [{
                    type: "error",
                    title: "Falha ao Gerar Insights via API",
                    description: error.message || "Erro desconhecido ao contatar o serviço de análise.",
                    priority: "high",
                    relatedItems: []
                }],
                source: 'gemini-error' // Indica erro na API
            };
        }
    }

    /**
     * Limpa o histórico de conversação do chat.
     */
    clearChatConversation() {
        this.conversationHistory = [];
        console.log("Gemini chat conversation history cleared.");
    }
}

// Inicializar e exportar a instância única (Singleton)
const geminiService = new GeminiService();
window.geminiService = geminiService; // Expor globalmente

// --- END OF FILE gemini-service.js ---