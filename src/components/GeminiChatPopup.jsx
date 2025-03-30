import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sendMessageToChat, getChatHistory, clearChatConversation } from '../services/geminiService';
import GEMINI_CONFIG from '../config/geminiConfig';
import '../styles/gemini-chat-popup.css'; // Import the CSS file

// Helper function to escape HTML (ensure consistency or move to utils)
const escapeHtml = (unsafe) => {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&") // Use & for ampersand
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/'/g, "&#039;");
}

// Basic Markdown to HTML formatter (ensure consistency or move to utils)
const formatResponse = (response) => {
    if (!response) return '';
    let formatted = escapeHtml(response);

    // Code Blocks (``` ```) - Simple version
    formatted = formatted.replace(/```(?:[a-zA-Z]+\n)?([\s\S]*?)```/g, (match, p1) => {
        return `<pre class="gemini-code-block"><code>${escapeHtml(p1.trim())}</code></pre>`;
    });

    // Bold (**text**)
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic (*text* or _text_)
    formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    formatted = formatted.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');
    // Strikethrough (~~text~~)
    formatted = formatted.replace(/~~(.*?)~~/g, '<del>$1</del>');
    // Inline Code (`code`)
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Basic Paragraphs (split by newline, wrap non-empty lines)
    return formatted.split('\n').map(line => line.trim() ? `<p>${line}</p>` : '').join('');
};


const GeminiChatPopup = () => {
    const config = GEMINI_CONFIG.chatAssistant; // Use chat config section
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Load initial history when component mounts
    useEffect(() => {
        setMessages(getChatHistory());
    }, []);

    // Scroll to bottom when messages change or popup opens
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            inputRef.current?.focus();
        }
    }, [messages, isOpen]);

    // Function to toggle popup visibility
    const togglePopup = (forceOpen = null) => {
        setIsOpen(prev => forceOpen !== null ? forceOpen : !prev);
    };

    // Expose toggle function globally (simple approach, consider context later)
    useEffect(() => {
        window.geminiAssistant = { toggle: togglePopup };
        return () => {
            delete window.geminiAssistant; // Cleanup
        };
    }, []);


    const handleInputChange = (e) => {
        setInputValue(e.target.value);
    };

    const handleSendMessage = useCallback(async () => {
        const trimmedInput = inputValue.trim();
        if (!trimmedInput || isLoading) return;

        setIsLoading(true);
        setInputValue(''); // Clear input immediately

        // Add user message optimistically
        const userMessage = { role: 'user', parts: [{ text: trimmedInput }] };
        setMessages(prev => [...prev, userMessage]);

        try {
            const responseText = await sendMessageToChat(trimmedInput);
            const modelMessage = { role: 'model', parts: [{ text: responseText }] };
            setMessages(prev => [...prev, modelMessage]); // Update with actual history from service if needed
        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessage = { role: 'model', parts: [{ text: `Erro: ${error.message}` }], isError: true };
            // Replace optimistic user message with error? Or just add error? Add error for now.
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    }, [inputValue, isLoading]);

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent newline in textarea
            handleSendMessage();
        }
    };

    const handleClearChat = () => {
        clearChatConversation();
        setMessages([]);
    };

    if (!config?.enabled) {
        return null; // Don't render if disabled in config
    }

    return (
        <div className={`gemini-chat-popup ${isOpen ? 'open' : 'closed'}`}>
            <button className="gemini-chat-toggle-button" onClick={() => togglePopup()} title="Assistente Gemini">
                <i className={`fas ${isOpen ? 'fa-times' : 'fa-comments'}`}></i>
            </button>

            {isOpen && (
                <div className="gemini-chat-window">
                    <div className="gemini-chat-header">
                        <h3>Assistente Gemini</h3>
                        <button onClick={handleClearChat} title="Limpar conversa" className="gemini-chat-clear-button">
                            <i className="fas fa-trash-alt"></i>
                        </button>
                        <button onClick={() => togglePopup(false)} title="Fechar" className="gemini-chat-close-button">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                    <div className="gemini-chat-messages">
                        {messages.map((msg, index) => (
                            <div key={index} className={`gemini-chat-message ${msg.role} ${msg.isError ? 'error' : ''}`}>
                                <div className="gemini-message-icon">
                                    {msg.role === 'user' ? <i className="fas fa-user"></i> : <i className="fas fa-robot"></i>}
                                </div>
                                <div className="gemini-message-content"
                                     dangerouslySetInnerHTML={{ __html: formatResponse(msg.parts[0]?.text || '') }}>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="gemini-chat-message model loading">
                                <div className="gemini-message-icon"><i className="fas fa-robot"></i></div>
                                <div className="gemini-message-content">
                                    <div className="gemini-typing-indicator">
                                        <span></span><span></span><span></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} /> {/* Anchor for scrolling */}
                    </div>
                    <div className="gemini-chat-input-area">
                        <textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={handleInputChange}
                            onKeyPress={handleKeyPress}
                            placeholder="Digite sua mensagem..."
                            rows="2"
                            disabled={isLoading}
                        />
                        <button onClick={handleSendMessage} disabled={isLoading || !inputValue.trim()}>
                            {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GeminiChatPopup;
