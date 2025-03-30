// --- START OF FILE simplified-gemini-insights.js ---

/**
 * simplified-gemini-insights.js - Componente de UI para Insights Gemini.
 * AGORA APENAS RENDERIZA A UI E CHAMA O GeminiService.
 */

class SimplifiedInsights {
    constructor() {
        this.container = null;
        this.options = {
            autoRefresh: window.GEMINI_CONFIG?.insights?.autoRefresh ?? true,
            refreshInterval: window.GEMINI_CONFIG?.insights?.refreshInterval ?? 15 * 60 * 1000,
            maxInsights: window.GEMINI_CONFIG?.insights?.maxInsights ?? 4 // Mantido para UI, embora o prompt tb limite
        };
        this.refreshTimer = null;
        this.isLoading = false;
        this.lastUpdateTime = null;

        // Referências de elementos (inicializadas no render)
        this.loadingElement = null;
        this.summaryElement = null;
        this.summaryTextElement = null;
        this.insightsListElement = null;
        this.timestampElement = null;
    }

    /**
     * Inicializa o componente.
     * @param {string} containerId - ID do container.
     * @param {Object} [options] - Opções de override.
     */
    init(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Insights container with ID "${containerId}" not found.`);
            return;
        }
        this.options = { ...this.options, ...options };

        this.render(); // Cria a estrutura HTML
        this.refreshInsights(); // Busca inicial

        if (this.options.autoRefresh && this.options.refreshInterval > 0) {
            this.startAutoRefresh();
        }
        console.log("SimplifiedInsights initialized with options:", this.options);
    }

    /** Renderiza a estrutura HTML do componente */
    render() {
        // HTML (mantido como estava, parece bom)
        this.container.innerHTML = `
          <div class="gemini-insights-panel">
            <div class="gemini-insights-header">
              <h3><i class="fas fa-lightbulb"></i> Insights</h3>
              <div class="gemini-insights-actions">
                <button class="gemini-insights-refresh" title="Atualizar insights">
                  <i class="fas fa-sync-alt"></i>
                </button>
              </div>
            </div>
            <div class="gemini-insights-body">
              <div class="gemini-insights-summary">
                <div class="gemini-insights-loading" style="display: none;">
                  <div class="gemini-insights-spinner"></div> <p>Gerando insights...</p>
                </div>
                <div class="gemini-insights-summary-content">
                  <div class="gemini-insights-summary-icon"><i class="fas fa-brain"></i></div>
                  <p>Analisando dados...</p>
                </div>
              </div>
              <div class="gemini-insights-list">
                 <div class="gemini-no-insights">Carregando...</div>
              </div>
            </div>
            <div class="gemini-insights-footer">
              <span class="gemini-insights-updated">Aguardando...</span>
              <a href="#" class="gemini-insights-more">Perguntar <i class="fas fa-chevron-right"></i></a>
            </div>
          </div>
        `;

        // Guarda referências
        this.loadingElement = this.container.querySelector('.gemini-insights-loading');
        this.summaryElement = this.container.querySelector('.gemini-insights-summary-content');
        this.summaryTextElement = this.container.querySelector('.gemini-insights-summary-content p');
        this.insightsListElement = this.container.querySelector('.gemini-insights-list');
        this.timestampElement = this.container.querySelector('.gemini-insights-updated');

        // Event Listeners
        this.container.querySelector('.gemini-insights-refresh').addEventListener('click', () => {
            this.refreshInsights();
            const icon = this.container.querySelector('.gemini-insights-refresh i');
            if (icon) { icon.classList.add('fa-spin'); setTimeout(() => icon.classList.remove('fa-spin'), 1000); }
        });
        this.container.querySelector('.gemini-insights-more').addEventListener('click', (e) => {
            e.preventDefault();
            if (window.geminiAssistant?.toggle) window.geminiAssistant.toggle(true);
            else console.warn("geminiAssistant not found or toggle method missing.");
        });
    }

    /** Inicia o auto-refresh */
    startAutoRefresh() {
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        if(this.options.refreshInterval <= 0) return;
        this.refreshTimer = setInterval(() => this.refreshInsights(), this.options.refreshInterval);
        console.log(`Insights auto-refresh started (${this.options.refreshInterval}ms)`);
    }

    /** Para o auto-refresh */
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer); this.refreshTimer = null;
            console.log("Insights auto-refresh stopped.");
        }
    }

    /**
     * Atualiza os insights chamando o GeminiService.
     */
    async refreshInsights() {
        if (this.isLoading) return;
        if (!window.geminiService) {
            console.error("GeminiService is not available for insights.");
            this.displayError("Serviço de IA indisponível.");
            return;
        }

        console.log("Refreshing insights...");
        this.isLoading = true;
        this.showLoading(true);
        this.insightsListElement.innerHTML = '<div class="gemini-no-insights">Atualizando...</div>';
        this.summaryTextElement.textContent = "Buscando novos insights...";

        try {
            // *** CHAMADA CENTRALIZADA AO SERVIÇO ***
            const insightsData = await window.geminiService.generateInsights();

            // Usa o maxInsights da config para limitar o que é exibido na UI,
            // mesmo que a API retorne mais (como fallback)
            if (insightsData?.insights && insightsData.insights.length > this.options.maxInsights) {
                console.log(`Limiting displayed insights from ${insightsData.insights.length} to ${this.options.maxInsights}`);
                insightsData.insights = insightsData.insights.slice(0, this.options.maxInsights);
            }


            this.displayInsights(insightsData); // Renderiza o resultado
            this.updateTimestamp();

        } catch (error) { // Erros de rede/fetch podem ocorrer antes da chamada do serviço
            console.error('Error during insight refresh process:', error);
            this.displayError(`Falha ao atualizar: ${error.message}`);
        } finally {
            this.isLoading = false;
            this.showLoading(false);
            console.log("Insight refresh finished.");
        }
    }

    // --- MÉTODOS REMOVIDOS ---
    // collectSystemData() -> Agora no GeminiService
    // generateInsights() -> Agora no GeminiService
    // generateLocalInsights() -> Removido (foco na API, mas pode ser readicionado como fallback *dentro* do service se necessário)
    // computeSystemStats() -> Lógica similar agora no GeminiService para `dataSummary`

    /**
     * Exibe os insights na UI (Lógica de renderização mantida).
     * @param {Object} insightsData - Objeto { summary, insights, source } vindo do serviço.
     */
    displayInsights(insightsData) {
        if (!insightsData || !this.summaryTextElement || !this.insightsListElement) {
            this.displayError("Erro interno ao exibir insights.");
            return;
        }

        // Adiciona a fonte da informação (gemini, local, erro)
        let sourceText = '';
        switch(insightsData.source) {
            case 'gemini': sourceText = '(via Gemini)'; break;
            case 'local': sourceText = '(Análise Local)'; break; // Se reintroduzido
            case 'gemini-error': sourceText = '(Erro API)'; break;
            case 'local-error': sourceText = '(Erro Local)'; break; // Se reintroduzido
        }
        this.summaryTextElement.textContent = `${insightsData.summary || "Análise concluída"} ${sourceText}`;
        this.summaryElement.style.display = "flex";

        this.insightsListElement.innerHTML = ''; // Limpa lista anterior

        const insightsToShow = insightsData.insights || [];

        if (insightsToShow.length === 0) {
            this.insightsListElement.innerHTML = '<div class="gemini-no-insights">Nenhum insight relevante encontrado.</div>';
            return;
        }

        // Caso especial: A única "insight" é uma mensagem de erro do serviço
        if (insightsToShow.length === 1 && insightsToShow[0].type === 'error') {
            this.displayError(insightsToShow[0].description || "Falha na geração dos insights.");
            // Ajusta o sumário para refletir o erro também
            this.summaryTextElement.textContent = `${insightsToShow[0].title || "Erro na Análise"} ${sourceText}`;
            return; // Não mostra o erro como um item normal
        }

        // Renderiza cada insight válido
        insightsToShow.forEach(insight => {
            // Não mostra erros se houver outros insights válidos
            if (insight.type === 'error') return;

            const insightElement = document.createElement('div');
            const type = insight.type || 'info'; // Default type 'info'
            const priority = insight.priority || 'low';
            insightElement.className = `gemini-insight gemini-insight-${type} gemini-priority-${priority}`;

            // Lógica de ícone/estilo (mantida como antes)
            let iconClass = 'fas fa-info-circle';
            let iconStyle = ''; // CSS deve cuidar disso primariamente agora
            let titleStyle = '';
            let priorityMarker = '';

            switch (type) {
                case 'anomaly': iconClass = 'fas fa-exclamation-triangle'; break;
                case 'pattern': iconClass = 'fas fa-chart-line'; break;
                case 'recommendation': iconClass = 'fas fa-lightbulb'; break;
                case 'info': iconClass = 'fas fa-info-circle'; break;
            }

            switch (priority) {
                case 'high':
                    priorityMarker = `<span class="gemini-priority-marker high" title="Prioridade Alta">!!</span>`;
                    break;
                case 'medium':
                    priorityMarker = `<span class="gemini-priority-marker medium" title="Prioridade Média">!</span>`;
                    break;
            }

            const relatedItemsHtml = (insight.relatedItems && insight.relatedItems.length > 0)
                ? `<div class="gemini-insight-related">
                       ${insight.relatedItems.map(item => `<span class="gemini-insight-tag">${this._escapeHtml(item)}</span>`).join('')}
                     </div>`
                : '';

            insightElement.innerHTML = `
                <div class="gemini-insight-icon" style="${iconStyle}">
                  <i class="${iconClass}"></i>
                </div>
                <div class="gemini-insight-content">
                  <h4 class="gemini-insight-title" ${titleStyle}>${priorityMarker} ${this._escapeHtml(insight.title || 'Insight')}</h4>
                   <div class="gemini-insight-description-content">
                     ${this._formatResponse(insight.description || 'Sem detalhes.')}
                   </div>
                  ${relatedItemsHtml}
                </div>
              `;
            this.insightsListElement.appendChild(insightElement);
        });
    }

    /** Helper para escapar HTML (mantido) */
    _escapeHtml(str) {
        if (!str) return '';
        const text = String(str);
        const map = { '&': '&', '<': '<', '>': '>', '"': '"', "'": '' };
            return text.replace(/[&<>"']/g, m => map[m]);
        }

        /** Exibe mensagem de erro na UI (mantido) */
        displayError(message) {
            if (this.summaryTextElement) this.summaryTextElement.textContent = "Erro ao gerar insights";
            if (this.insightsListElement) {
                this.insightsListElement.innerHTML = `<div class="gemini-insights-error"><i class="fas fa-exclamation-circle"></i><p>${this._escapeHtml(message)}</p></div>`;
            }
            this.showLoading(false);
        }

        /** Mostra/esconde loading (mantido) */
        showLoading(isLoading) {
            if (this.loadingElement) this.loadingElement.style.display = isLoading ? 'flex' : 'none';
            // O sumário fica visível, apenas o texto muda
        }

        /** Atualiza timestamp (mantido) */
        updateTimestamp() {
            this.lastUpdateTime = new Date();
            if (this.timestampElement) {
                const timeString = this.lastUpdateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                this.timestampElement.textContent = `Atualizado às ${timeString}`;
            }
        }

    /**
     * Formata resposta (markdown básico para HTML) - COPIADO DE GeminiAssistant
     * @param {string} response - Resposta bruta
     * @returns {string} Resposta formatada com HTML
     */
    _formatResponse(response) {
        if (!response) return '';

        // 1. Escape HTML primeiro
        let formatted = this._escapeHtml(response);

        // 2. Lidar com Blocos de Código
        const codeBlocks = [];
        formatted = formatted.replace(/```(?:[a-zA-Z]+\n)?([\s\S]*?)```/g, (match, p1) => {
            const placeholder = `___CODEBLOCK_${codeBlocks.length}___`;
            codeBlocks.push(`<pre class="gemini-code-block"><code>${this._escapeHtml(p1.trim())}</code></pre>`);
            return placeholder;
        });

        // 3. Ênfase e Código Inline
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
        formatted = formatted.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');
        formatted = formatted.replace(/~~(.*?)~~/g, '<del>$1</del>');
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        // 4. Processar Linhas (Listas, Parágrafos, Títulos)
        const lines = formatted.split('\n');
        let resultHtml = '';
        let currentListType = null; // null, 'ul', 'ol'

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Restaurar blocos de código
            if (trimmedLine.startsWith('___CODEBLOCK_')) {
                if (currentListType) { resultHtml += `</${currentListType}>\n`; currentListType = null; }
                const index = parseInt(trimmedLine.split('_')[2]);
                resultHtml += codeBlocks[index] + '\n';
                continue;
            }

            // Títulos
            const headingMatch = trimmedLine.match(/^(#{1,4})\s+(.*)/);
            if (headingMatch) {
                if (currentListType) { resultHtml += `</${currentListType}>\n`; currentListType = null; }
                const level = headingMatch[1].length;
                resultHtml += `<h${level + 2}>${headingMatch[2]}</h${level + 2}>\n`;
                continue;
            }

            // Listas
            const ulMatch = trimmedLine.match(/^([*-])\s+(.*)/);
            const olMatch = trimmedLine.match(/^(\d+)\.\s+(.*)/);
            const potentialEmptyUlMatch = trimmedLine.match(/^([*-])(\s*)$/);
            const potentialEmptyOlMatch = trimmedLine.match(/^(\d+)\.(\s*)$/);

            let isListItem = false;
            let itemContent = '';
            let listTypeRequired = null;
            let orderedAttrs = '';

            if (olMatch) { // Item ordenado com conteúdo
                isListItem = true; itemContent = olMatch[2]; listTypeRequired = 'ol'; orderedAttrs = ` value="${olMatch[1]}"`;
            } else if (ulMatch) { // Item não ordenado com conteúdo
                isListItem = true; itemContent = ulMatch[2]; listTypeRequired = 'ul';
            } else if (potentialEmptyOlMatch || potentialEmptyUlMatch) { // Item vazio - PULAR
                // console.warn("Detected potentially empty list item in insights:", trimmedLine);
                isListItem = false;
                if (currentListType && (i + 1 >= lines.length || !lines[i+1].trim().match(/^([*-]|\d+\.)\s/))) {
                    resultHtml += `</${currentListType}>\n`; currentListType = null;
                }
                continue;
            }

            if (isListItem) {
                if (currentListType !== listTypeRequired) {
                    if (currentListType) resultHtml += `</${currentListType}>\n`;
                    resultHtml += `<${listTypeRequired}>\n`;
                    currentListType = listTypeRequired;
                }
                resultHtml += `<li${orderedAttrs}>${itemContent}</li>\n`;
            } else { // Não é item de lista
                if (currentListType) { resultHtml += `</${currentListType}>\n`; currentListType = null; }
                if (trimmedLine.length > 0) { // Trata como parágrafo
                    resultHtml += `<p>${trimmedLine}</p>\n`;
                }
            }
        }
        if (currentListType) resultHtml += `</${currentListType}>\n`; // Fecha lista final
        return resultHtml.trim();
        }
    }

// Inicialização (mantida)
    const geminiInsights = new SimplifiedInsights();
    window.geminiInsights = geminiInsights;

    document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
    if (document.getElementById('gemini-insights-container')) {
    const insightOptions = window.GEMINI_CONFIG?.insights || {};
    geminiInsights.init('gemini-insights-container', insightOptions);
} else {
    console.warn("Insights container 'gemini-insights-container' not found.");
}
}, 1200); // Delay
});
// --- END OF FILE simplified-gemini-insights.js ---