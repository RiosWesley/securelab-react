// --- START OF FILE gemini-assistant.js ---

/**
 * gemini-assistant.js - Interface do chat assistente Gemini.
 * AGORA APENAS RENDERIZA A UI E CHAMA O GeminiService.
 */

class GeminiAssistant {
    constructor() {
        this.initialized = false;
        this.visible = false;
        this.container = null;
        this.conversationContainer = null;
        this.inputField = null;
        this.sendButton = null;
        this.inputHistory = [];
        this.historyIndex = -1;
    }

    /** Inicializa o componente */
    init() {
        if (this.initialized) return;

        this.container = document.createElement('div');
        this.container.className = 'gemini-assistant';
        // HTML (mantido como antes, parece bom)
        this.container.innerHTML = `
            <div class="gemini-header">
                <div class="gemini-branding">
                    <div class="gemini-avatar"><i class="fas fa-robot"></i></div>
                    <h3>Assistente Gemini</h3>
                </div>
                <div class="gemini-actions">
                    <button class="gemini-action-btn gemini-clear-btn" title="Limpar conversa"><i class="fas fa-trash"></i></button>
                    <button class="gemini-action-btn gemini-toggle-btn" title="Minimizar"><i class="fas fa-minus"></i></button>
                </div>
            </div>
            <div class="gemini-conversation-container"><div class="gemini-conversation"></div></div>
            <div class="gemini-suggestions">
                <button class="gemini-suggestion">Resumo da atividade recente</button>
                <button class="gemini-suggestion">Mostrar acessos negados hoje</button>
                <button class="gemini-suggestion">Algum dispositivo offline?</button>
            </div>
            <div class="gemini-input-container">
                <textarea class="gemini-input" placeholder="Pergunte ao assistente..." rows="1"></textarea>
                <button class="gemini-send-btn" disabled><i class="fas fa-paper-plane"></i></button>
            </div>
        `;
        document.body.appendChild(this.container);

        this.conversationContainer = this.container.querySelector('.gemini-conversation');
        this.inputField = this.container.querySelector('.gemini-input');
        this.sendButton = this.container.querySelector('.gemini-send-btn');

        this._setupEventListeners();
        this._addMessage('assistant', 'Olá! Sou o assistente Gemini. Pergunte-me sobre os dados do sistema.');
        this.initialized = true;

        // Visibilidade inicial baseada na config
        const config = window.GEMINI_CONFIG?.assistant;
        const startVisible = (window.innerWidth > 768 || !config?.mobileMinimized) ? (config?.initiallyOpen ?? false) : false;
        this.toggle(startVisible);


        console.log(`Gemini Assistant UI initialized. Configured start: ${startVisible ? 'visible (expanded)' : 'hidden (minimized)'}.`);

    }

    /** Configura event listeners (lógica mantida) */
    _setupEventListeners() {
        this.sendButton.addEventListener('click', () => this._handleSendMessage());
        this.inputField.addEventListener('keydown', (e) => {
            // Auto-expandir
            setTimeout(() => {
                this.inputField.style.height = 'auto';
                this.inputField.style.height = (this.inputField.scrollHeight) + 'px';
            }, 0);
            // Enviar com Enter (sem Shift)
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!this.sendButton.disabled) this._handleSendMessage(); }
            // Histórico com setas
            if (e.key === 'ArrowUp' && this.inputHistory.length > 0) {
                e.preventDefault();
                if (this.historyIndex < this.inputHistory.length - 1) this.historyIndex++;
                this.inputField.value = this.inputHistory[this.inputHistory.length - 1 - this.historyIndex];
                this.inputField.selectionStart = this.inputField.selectionEnd = this.inputField.value.length;
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    this.inputField.value = this.inputHistory[this.inputHistory.length - 1 - this.historyIndex];
                    this.inputField.selectionStart = this.inputField.selectionEnd = this.inputField.value.length;
                } else {
                    this.historyIndex = -1; this.inputField.value = '';
                }
            } else if (!['Shift', 'Control', 'Alt', 'Meta', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                // Não resetar index aqui, deixa o input normal
            }
        });
        this.inputField.addEventListener('input', () => {
            this.sendButton.disabled = !this.inputField.value.trim();
            this.historyIndex = -1; // Resetar navegação do histórico ao digitar
            // Auto-expandir
            this.inputField.style.height = 'auto';
            this.inputField.style.height = (this.inputField.scrollHeight) + 'px';
        });
        this.container.querySelector('.gemini-toggle-btn').addEventListener('click', () => this.toggle());
        this.container.querySelector('.gemini-clear-btn').addEventListener('click', () => this.clearConversation());
        this.container.querySelectorAll('.gemini-suggestion').forEach(button => {
            button.addEventListener('click', () => {
                this.inputField.value = button.textContent;
                this.sendButton.disabled = false;
                this.inputField.focus();
                // Opcional: enviar imediatamente -> this._handleSendMessage();
            });
        });
    }

    // --- MÉTODOS REMOVIDOS ---
    // _initSystemContext() -> Não é mais necessário aqui
    // _loadSystemData() -> Não é mais necessário aqui

    /** Lida com o envio de mensagem do usuário */
    async _handleSendMessage() {
        const message = this.inputField.value.trim();
        if (!message) return;
        if (!window.geminiService) {
            console.error("GeminiService is not available for chat.");
            this._addMessage('assistant-error', "Erro: Serviço de IA indisponível.");
            return;
        }

        // Adiciona ao histórico de input da UI (lógica mantida)
        if (this.inputHistory.length === 0 || this.inputHistory[this.inputHistory.length - 1] !== message) {
            if (this.inputHistory.length >= 50) this.inputHistory.shift();
            this.inputHistory.push(message);
        }
        this.historyIndex = -1;

        this._addMessage('user', this._escapeHtml(message)); // Mostra msg do usuário (escapada)
        this.inputField.value = '';
        this.inputField.style.height = 'auto';
        this.sendButton.disabled = true;
        this._scrollToBottom();

        // Mostra indicador de "digitando"
        const loadingMsgElement = this._addMessage('assistant', '<div class="gemini-typing-indicator"><span></span><span></span><span></span></div>');
        this._scrollToBottom();

        try {
            // *** CHAMADA CENTRALIZADA AO SERVIÇO ***
            const responseText = await window.geminiService.sendMessageToChat(message);

            console.log(">>>> RAW Gemini Response:", JSON.stringify(responseText));
            // *************************************

            // Atualiza a UI com a resposta formatada
            this._updateMessage(loadingMsgElement, 'assistant', this._formatResponse(responseText));

        } catch (error) {
            console.error('Error getting Gemini chat response:', error);
            // Exibe erro na UI
            const errorMessage = error.message || 'Desculpe, ocorreu um erro.';
            this._updateMessage(loadingMsgElement, 'assistant-error', this._escapeHtml(errorMessage));
        }

        this._scrollToBottom(); // Garante scroll após resposta/erro
    }

    /** Adiciona mensagem à UI (Lógica mantida) */
    _addMessage(role, contentHtml) {
        const messageElement = document.createElement('div');
        const baseRole = role.startsWith('assistant') ? 'assistant' : 'user';
        messageElement.className = `gemini-message gemini-${baseRole}-message ${role}`; // Aplica classes
        const avatarHtml = role.startsWith('assistant') ? `<div class="gemini-message-avatar"><i class="fas fa-robot"></i></div>` : '';
        messageElement.innerHTML = `${avatarHtml}<div class="gemini-message-content">${contentHtml}</div>`;
        this.conversationContainer.appendChild(messageElement);
        return messageElement;
    }

    /** Atualiza mensagem existente na UI (Lógica mantida) */
    _updateMessage(messageElement, role, contentHtml) {
        const baseRole = role.startsWith('assistant') ? 'assistant' : 'user';
        messageElement.className = `gemini-message gemini-${baseRole}-message ${role}`; // Atualiza classes
        const contentElement = messageElement.querySelector('.gemini-message-content');
        let avatarElement = messageElement.querySelector('.gemini-message-avatar');

        // Garante avatar para assistente, remove para usuário
        if (role.startsWith('assistant') && !avatarElement) {
            const newAvatar = document.createElement('div'); newAvatar.className = 'gemini-message-avatar'; newAvatar.innerHTML = '<i class="fas fa-robot"></i>';
            messageElement.insertBefore(newAvatar, contentElement || null);
            avatarElement = newAvatar;
        } else if (role === 'user' && avatarElement) {
            avatarElement.remove();
        }
        // Atualiza conteúdo
        if (contentElement) contentElement.innerHTML = contentHtml;
        else { // Fallback
            const newContent = document.createElement('div'); newContent.className = 'gemini-message-content'; newContent.innerHTML = contentHtml;
            messageElement.appendChild(newContent);
        }
    }

    /** Rola para o final (mantido) */
    _scrollToBottom() {
        if (this.visible && this.container) {
            const scrollContainer = this.container.querySelector('.gemini-conversation-container');
            if (scrollContainer) scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
        }
    }

    /** Formata resposta (markdown básico para HTML) (lógica mantida) */
    /** Formata resposta (markdown básico para HTML) (lógica de lista aprimorada) */
    _formatResponse(response) {
        if (!response) return '';

        // 1. Escape HTML primeiro
        let formatted = this._escapeHtml(response);

        // 2. Lidar com Blocos de Código (para não interferir com outros marcadores)
        const codeBlocks = [];
        formatted = formatted.replace(/```(?:[a-zA-Z]+\n)?([\s\S]*?)```/g, (match, p1) => {
            const placeholder = `___CODEBLOCK_${codeBlocks.length}___`;
            codeBlocks.push(`<pre class="gemini-code-block"><code>${this._escapeHtml(p1.trim())}</code></pre>`);
            return placeholder;
        });

        // 3. Ênfase e Código Inline (Bold, Italic, Strikethrough, Inline Code)
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Regex de Itálico mais simples (pode precisar de ajuste se houver conflitos, mas menos propenso a erros)
        formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>'); // Para *italic*
        formatted = formatted.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');     // Para _italic_
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
                if (currentListType) { resultHtml += `</${currentListType}>\n`; currentListType = null; } // Fecha lista antes do bloco
                const index = parseInt(trimmedLine.split('_')[2]);
                resultHtml += codeBlocks[index] + '\n';
                continue;
            }


            // Títulos (Simples: ## Titulo)
            const headingMatch = trimmedLine.match(/^(#{1,4})\s+(.*)/);
            if (headingMatch) {
                if (currentListType) { resultHtml += `</${currentListType}>\n`; currentListType = null; }
                const level = headingMatch[1].length;
                resultHtml += `<h${level + 2}>${headingMatch[2]}</h${level + 2}>\n`;
                continue;
            }

            // Listas
            const ulMatch = trimmedLine.match(/^([*-])\s+(.*)/); // Exige conteúdo após espaço
            const olMatch = trimmedLine.match(/^(\d+)\.\s+(.*)/); // Exige conteúdo após espaço
            // Regex mais permissiva para capturar itens mesmo sem conteúdo após espaço inicial
            const potentialEmptyUlMatch = trimmedLine.match(/^([*-])(\s*)$/);
            const potentialEmptyOlMatch = trimmedLine.match(/^(\d+)\.(\s*)$/);


            let isListItem = false;
            let itemContent = '';
            let listTypeRequired = null;
            let orderedAttrs = '';

            if (olMatch) { // Item ordenado com conteúdo
                isListItem = true;
                itemContent = olMatch[2]; // Conteúdo já capturado
                listTypeRequired = 'ol';
                orderedAttrs = ` value="${olMatch[1]}"`;
            } else if (ulMatch) { // Item não ordenado com conteúdo
                isListItem = true;
                itemContent = ulMatch[2]; // Conteúdo já capturado
                listTypeRequired = 'ul';
            } else if (potentialEmptyOlMatch || potentialEmptyUlMatch) {
                // Detectou um item de lista potencialmente vazio (ex: "*" ou "1.")
                console.warn("Detected potentially empty list item:", trimmedLine);
                // TRATAR COMO VAZIO E PULAR - NÃO RENDERIZAR <li></li> vazio
                isListItem = false; // Marca para não criar <li>
                // Se estava em uma lista, e a linha seguinte não é lista, fecha a lista atual
                if (currentListType && (i + 1 >= lines.length || !lines[i+1].trim().match(/^([*-]|\d+\.)\s/))) {
                    resultHtml += `</${currentListType}>\n`;
                    currentListType = null;
                }
                continue; // Pula para a próxima linha
            }


            if (isListItem) {
                // Inicia/Troca tipo de lista se necessário
                if (currentListType !== listTypeRequired) {
                    if (currentListType) resultHtml += `</${currentListType}>\n`;
                    resultHtml += `<${listTypeRequired}>\n`;
                    currentListType = listTypeRequired;
                }
                // Adiciona item (itemContent já deve ter conteúdo aqui)
                resultHtml += `<li${orderedAttrs}>${itemContent}</li>\n`;
            } else {
                // Não é item de lista
                if (currentListType) { // Fecha lista anterior se estava aberta
                    resultHtml += `</${currentListType}>\n`;
                    currentListType = null;
                }
                // Se não for linha vazia, trata como parágrafo
                if (trimmedLine.length > 0) {
                    resultHtml += `<p>${trimmedLine}</p>\n`;
                }
                // Linhas vazias são ignoradas (não adicionam <p></p> nem <br>)
            }
        }

        // Fecha lista se terminar aberta
        if (currentListType) {
            resultHtml += `</${currentListType}>\n`;
        }

        return resultHtml.trim(); // Retorna HTML final
    }

    /** Escapa HTML (mantido) */
    _escapeHtml(str) {
        if (!str) return '';
        const map = { '&': '&', '<': '<', '>': '>', '"': '"', "'": '' };
            return String(str).replace(/[&<>"']/g, m => map[m]);
        }

        /** Alterna visibilidade (mantido) */
        toggle(forceVisible) {
            const shouldBeVisible = forceVisible !== undefined ? forceVisible : !this.visible;
            if (shouldBeVisible === this.visible) return;
            this.visible = shouldBeVisible;
            const toggleIcon = this.container.querySelector('.gemini-toggle-btn i');
            if (this.visible) {
                this.container.classList.remove('gemini-minimized');
                if (toggleIcon) toggleIcon.className = 'fas fa-minus';
                this._scrollToBottom();
                this.inputField.focus();
            } else {
                this.container.classList.add('gemini-minimized');
                if (toggleIcon) toggleIcon.className = 'fas fa-expand-arrows-alt';
            }
            console.log("Assistant toggled, visible:", this.visible);
        }
    // Dentro da classe GeminiAssistant

    /** Alterna visibilidade (com logs de depuração) */
    toggle(forceVisible) {
        // --- LOG INICIAL ---
        console.log(`>>> toggle() chamado. forceVisible: ${forceVisible}, estado atual this.visible: ${this.visible}`);

        // Calcula o estado desejado
        const shouldBeVisible = forceVisible !== undefined ? forceVisible : !this.visible;
        console.log(`>>> toggle(): Calculado shouldBeVisible: ${shouldBeVisible}`);


        // Atualiza o estado interno
        this.visible = shouldBeVisible;
        const toggleIcon = this.container.querySelector('.gemini-toggle-btn i');

        // Aplica/Remove classe e atualiza UI
        if (this.visible) {
            console.log(">>> toggle(): Definindo para VISÍVEL. Removendo classe 'gemini-minimized'.");
            this.container.classList.remove('gemini-minimized');
            if (toggleIcon) toggleIcon.className = 'fas fa-minus';
            // Ações extras ao abrir (scroll, focus)
            this._scrollToBottom();
            // Adicionado um pequeno delay no foco para evitar problemas se o elemento ainda não estiver totalmente pronto
            setTimeout(() => { if(this.inputField) this.inputField.focus(); }, 100);
        } else {
            console.log(">>> toggle(): Definindo para OCULTO (Minimizado). Adicionando classe 'gemini-minimized'.");
            this.container.classList.add('gemini-minimized');
            if (toggleIcon) toggleIcon.className = 'fas fa-expand-arrows-alt';
        }

        // --- LOG FINAL ---
        console.log(`>>> toggle(): Estado final -> this.visible: ${this.visible}, Elemento tem classe 'gemini-minimized': ${this.container.classList.contains('gemini-minimized')}`);
    }

        /** Limpa a conversa */
        clearConversation() {
            this.conversationContainer.innerHTML = ''; // Limpa UI
            if (window.geminiService?.clearChatConversation) {
                window.geminiService.clearChatConversation(); // Limpa histórico no serviço
            }
            this._addMessage('assistant', 'Conversa limpa. Em que posso ajudar?');
            this.inputHistory = []; // Limpa histórico de input da UI
            this.historyIndex = -1;
            console.log("Chat conversation cleared.");
        }
    }



// Inicialização (mantida, depende de config e Firebase)
    const geminiAssistant = new GeminiAssistant();
    window.geminiAssistant = geminiAssistant;

    document.addEventListener('DOMContentLoaded', () => {
    const config = window.GEMINI_CONFIG?.assistant;
    if (config?.autoInitialize && typeof firebase !== 'undefined') {
    const delay = config?.initialDelay ?? 1000;
    setTimeout(() => {
    // Tenta inicializar após auth state change ou fallback
    let initialized = false;
    firebase.auth().onAuthStateChanged((user) => {
    if (!geminiAssistant.initialized && !initialized) {
    console.log("Auth state ready, initializing Gemini Assistant...");
    geminiAssistant.init();
    initialized = true;
}
});
setTimeout(() => {
    if (!geminiAssistant.initialized && !initialized) {
        console.log("Fallback init for Gemini Assistant...");
        geminiAssistant.init();
    }
}, 1500);
}, delay);
} else {
    console.log("Gemini Assistant auto-init skipped.");
}
});

// --- END OF FILE gemini-assistant.js ---