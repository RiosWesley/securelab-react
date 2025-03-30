import React, { useState, useEffect, useCallback, useRef } from 'react';
import { generateInsights } from '../services/geminiService';
import GEMINI_CONFIG from '../config/geminiConfig';
import '../styles/gemini-insights.css'; // Import styles

// Helper function to escape HTML (copied from GeminiAssistant, ensure consistency)
const escapeHtml = (unsafe) => {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&")
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/'/g, "&#039;");
}

// Basic Markdown to HTML formatter (copied from GeminiAssistant)
// NOTE: Consider moving helper functions (escapeHtml, formatResponse) to a utils file
const formatResponse = (response) => {
     if (!response) return '';
    let formatted = escapeHtml(response);

    // Code Blocks (``` ```)
    const codeBlocks = [];
    formatted = formatted.replace(/```(?:[a-zA-Z]+\n)?([\s\S]*?)```/g, (match, p1) => {
        const placeholder = `___CODEBLOCK_${codeBlocks.length}___`;
        codeBlocks.push(`<pre class="gemini-code-block"><code>${escapeHtml(p1.trim())}</code></pre>`);
        return placeholder;
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

    // Process Lines (Headings, Lists, Paragraphs)
    const lines = formatted.split('\n');
    let resultHtml = '';
    let currentListType = null; // null, 'ul', 'ol'

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Restore code blocks
        if (trimmedLine.startsWith('___CODEBLOCK_')) {
            if (currentListType) { resultHtml += `</${currentListType}>\n`; currentListType = null; }
            const index = parseInt(trimmedLine.split('_')[2]);
            resultHtml += codeBlocks[index] + '\n';
            continue;
        }

        // Headings (# text) - Simple version
        const headingMatch = trimmedLine.match(/^(#{1,4})\s+(.*)/);
        if (headingMatch) {
            if (currentListType) { resultHtml += `</${currentListType}>\n`; currentListType = null; }
            const level = headingMatch[1].length;
            resultHtml += `<h${level + 2}>${headingMatch[2]}</h${level + 2}>\n`; // Start from h3
            continue;
        }

        // Lists (* item, - item, 1. item)
        const ulMatch = trimmedLine.match(/^([*-])\s+(.*)/);
        const olMatch = trimmedLine.match(/^(\d+)\.\s+(.*)/);

        let isListItem = false;
        let itemContent = '';
        let listTypeRequired = null;
        let orderedAttrs = '';

        if (olMatch) {
            isListItem = true; itemContent = olMatch[2]; listTypeRequired = 'ol'; orderedAttrs = ` value="${olMatch[1]}"`;
        } else if (ulMatch) {
            isListItem = true; itemContent = ulMatch[2]; listTypeRequired = 'ul';
        }

        if (isListItem) {
            if (currentListType !== listTypeRequired) {
                if (currentListType) resultHtml += `</${currentListType}>\n`;
                resultHtml += `<${listTypeRequired}>\n`;
                currentListType = listTypeRequired;
            }
            resultHtml += `<li${orderedAttrs}>${itemContent}</li>\n`; // Render item content directly
        } else { // Not a list item
            if (currentListType) { resultHtml += `</${currentListType}>\n`; currentListType = null; }
            if (trimmedLine.length > 0) {
                resultHtml += `<p>${trimmedLine}</p>\n`; // Treat as paragraph
            }
        }
    }
    if (currentListType) resultHtml += `</${currentListType}>\n`; // Close final list

    return resultHtml.trim();
};


const GeminiInsights = () => {
    const config = GEMINI_CONFIG.insights;
    const [insightsData, setInsightsData] = useState({ summary: "Carregando...", insights: [], source: 'initial' });
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdateTime, setLastUpdateTime] = useState(null);
    const refreshTimer = useRef(null);
    const refreshButtonRef = useRef(null);

    const fetchInsights = useCallback(async () => {
        if (isLoading) return;
        console.log("Refreshing insights...");
        setIsLoading(true);

        // Visual feedback for refresh button
        const icon = refreshButtonRef.current?.querySelector('i');
        if (icon) icon.classList.add('fa-spin');

        try {
            const data = await generateInsights();
            // Limit displayed insights based on config
            if (data?.insights && data.insights.length > (config?.maxInsights ?? 4)) {
                 console.log(`Limiting displayed insights from ${data.insights.length} to ${config?.maxInsights ?? 4}`);
                 data.insights = data.insights.slice(0, config.maxInsights ?? 4);
            }
            setInsightsData(data);
            setLastUpdateTime(new Date());
        } catch (error) { // Should be caught by service, but as fallback
            console.error('Error fetching insights in component:', error);
            setInsightsData({
                summary: "Erro na Análise",
                insights: [{
                    type: "error",
                    title: "Falha ao Buscar Insights",
                    description: error.message || "Erro desconhecido.",
                    priority: "high",
                    relatedItems: []
                }],
                source: 'component-error'
            });
        } finally {
            setIsLoading(false);
             if (icon) setTimeout(() => icon.classList.remove('fa-spin'), 500); // Remove spin after a short delay
            console.log("Insight refresh finished.");
        }
    }, [config?.maxInsights]); // REMOVED isLoading dependency

    // Initial fetch and setup auto-refresh
    useEffect(() => {
        fetchInsights(); // Fetch on mount

        if (config?.autoRefresh && config?.refreshInterval > 0) {
            refreshTimer.current = setInterval(fetchInsights, config.refreshInterval);
            console.log(`Insights auto-refresh started (${config.refreshInterval}ms)`);
        }

        // Cleanup timer on unmount
        return () => {
            if (refreshTimer.current) {
                clearInterval(refreshTimer.current);
                console.log("Insights auto-refresh stopped.");
            }
        };
    }, [fetchInsights, config?.autoRefresh, config?.refreshInterval]); // Dependencies for effect

    const handleManualRefresh = () => {
        // Clear existing timer and fetch immediately
        if (refreshTimer.current) clearInterval(refreshTimer.current);
        fetchInsights();
        // Restart timer if auto-refresh is enabled
        if (config?.autoRefresh && config?.refreshInterval > 0) {
            refreshTimer.current = setInterval(fetchInsights, config.refreshInterval);
        }
    };

    // Handle click on "Perguntar" link
    const handleAskAssistant = (e) => {
        e.preventDefault();
        // Attempt to find and toggle the assistant globally
        // This is a simple approach; context or state management might be better
        if (window.geminiAssistant?.toggle) {
            window.geminiAssistant.toggle(true); // Force open
        } else {
            console.warn("GeminiAssistant toggle function not found on window object.");
            // You might want to implement a more robust way to communicate between components
            // like using React Context or a state management library (Zustand, Redux).
        }
    };

     // Determine source text for summary
     let sourceText = '';
     switch(insightsData.source) {
         case 'gemini': sourceText = '(via Gemini)'; break;
         case 'local': sourceText = '(Análise Local)'; break; // If re-introduced
         case 'gemini-error': sourceText = '(Erro API)'; break;
         case 'local-error': sourceText = '(Erro Local)'; break; // If re-introduced
         case 'component-error': sourceText = '(Erro Componente)'; break;
         case 'initial': sourceText = ''; break; // Don't show source initially
         default: sourceText = '';
     }

    return (
        <div className="gemini-insights-panel">
            <div className="gemini-insights-header">
                <h3><i className="fas fa-lightbulb"></i> Insights</h3>
                <div className="gemini-insights-actions">
                    <button
                        ref={refreshButtonRef}
                        className="gemini-insights-refresh"
                        title="Atualizar insights"
                        onClick={handleManualRefresh}
                        disabled={isLoading}
                    >
                        <i className="fas fa-sync-alt"></i>
                    </button>
                </div>
            </div>
            <div className="gemini-insights-body">
                <div className="gemini-insights-summary">
                    {isLoading && insightsData.source !== 'initial' && ( // Show loading overlay only after initial load attempt
                        <div className="gemini-insights-loading">
                            <div className="gemini-insights-spinner"></div>
                            <p>Gerando insights...</p>
                        </div>
                    )}
                    <div className="gemini-insights-summary-content">
                        <div className="gemini-insights-summary-icon"><i className="fas fa-brain"></i></div>
                        <p>{`${insightsData.summary || "Análise concluída"} ${sourceText}`}</p>
                    </div>
                </div>
                <div className="gemini-insights-list">
                    {insightsData.insights?.length > 0 ? (
                        insightsData.insights.map((insight, index) => {
                             // Don't render error items if there are other valid insights
                             if (insight.type === 'error' && insightsData.insights.length > 1) return null;

                             const type = insight.type || 'info';
                             const priority = insight.priority || 'low';
                             let iconClass = 'fas fa-info-circle';
                             switch (type) {
                                 case 'anomaly': iconClass = 'fas fa-exclamation-triangle'; break;
                                 case 'pattern': iconClass = 'fas fa-chart-line'; break;
                                 case 'recommendation': iconClass = 'fas fa-lightbulb'; break;
                                 case 'error': iconClass = 'fas fa-exclamation-circle'; break; // Icon for error type
                             }

                            return (
                                <div key={index} className={`gemini-insight gemini-insight-${type} gemini-priority-${priority}`}>
                                    <div className="gemini-insight-icon">
                                        <i className={iconClass}></i>
                                    </div>
                                    <div className="gemini-insight-content">
                                        <h4 className="gemini-insight-title">
                                            {/* Optional: Add priority markers visually if needed */}
                                            {escapeHtml(insight.title || 'Insight')}
                                        </h4>
                                        <div
                                            className="gemini-insight-description-content"
                                            dangerouslySetInnerHTML={{ __html: formatResponse(insight.description || 'Sem detalhes.') }}
                                        />
                                        {insight.relatedItems && insight.relatedItems.length > 0 && (
                                            <div className="gemini-insight-related">
                                                {insight.relatedItems.map((item, idx) => (
                                                    <span key={idx} className="gemini-insight-tag">{escapeHtml(item)}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        !isLoading && <div className="gemini-no-insights">Nenhum insight relevante encontrado.</div>
                    )}
                </div>
            </div>
            <div className="gemini-insights-footer">
                <span className="gemini-insights-updated">
                    {lastUpdateTime ? `Atualizado às ${lastUpdateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Aguardando...'}
                </span>
                {/* Link to open the assistant */}
                <a href="#" className="gemini-insights-more" onClick={handleAskAssistant}>
                    Perguntar <i className="fas fa-chevron-right"></i>
                </a>
            </div>
        </div>
    );
};

export default GeminiInsights;
