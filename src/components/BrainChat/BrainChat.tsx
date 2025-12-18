import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Save } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useObjectStore } from '../../stores/objectStore';
import { useAIStore } from '../../stores/aiStore';
import { useCalendarStore } from '../../stores/calendarStore';
import type { ChatMessage } from '../../types/ai';
import { useUIStore } from '../../stores/uiStore';
import { aiService } from '../../services/ai';
import { marked } from 'marked';
import { useToast } from '../common';
import './BrainChat.css';

// Cosine similarity
const cosineSimilarity = (vecA: number[], vecB: number[]) => {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const BrainChat = () => {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { objects, objectTypes, createObject, updateObject } = useObjectStore();
    const { isEnabled, apiKey, chatHistory, addChatMessage } = useAIStore();
    const { setCurrentSection, pushNavHistory } = useUIStore();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory, isLoading]);

    // Handle clicking on "object:ID" links
    const handleMessageClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        // Handle clicks on the pill or its children
        const link = target.closest('a');
        if (link) {
            const href = link.getAttribute('href');
            if (href && href.startsWith('object:')) {
                e.preventDefault();
                const objectId = href.split(':')[1];

                // Navigate to object
                pushNavHistory('chat', null);

                // 2. Switch to object view
                useObjectStore.getState().selectObject(objectId);
                setCurrentSection('objects');
            }
        }
    };

    const renderContent = (content: string) => {
        const renderer = new marked.Renderer();
        const originalLink = renderer.link.bind(renderer);

        // @ts-ignore - Catch-all for marked signature mismatches
        renderer.link = (optionOrHref: any, title?: string, text?: string) => {
            // Check if first arg is an object (Marked 5.x+) or string (older)
            let href = typeof optionOrHref === 'string' ? optionOrHref : optionOrHref?.href;

            if (href && href.startsWith('object:')) {
                const objectId = href.split(':')[1];
                const obj = objects.find(o => o.id === objectId);

                if (obj) {
                    const typeConfig = objectTypes.find(t => t.id === obj.type);
                    const color = typeConfig?.color || '#a855f7';
                    const typeName = typeConfig?.name?.toUpperCase() || obj.type.toUpperCase();
                    const iconName = typeConfig?.icon || 'FileText';

                    // Render Icon (Lucide or Emoji)
                    let iconHtml = iconName;
                    const IconComponent = (LucideIcons as any)[iconName];
                    if (IconComponent) {
                        iconHtml = renderToStaticMarkup(<IconComponent size={14} strokeWidth={2.5} />);
                    }

                    return `
                        <a href="${href}" class="object-link-pill" title="${obj.title}">
                            <span class="obj-type-badge" style="background-color: ${color}">${typeName}</span>
                            <span class="obj-content">${iconHtml} <span class="obj-text">${obj.title}</span></span>
                        </a>
                    `;
                }
            }

            // Fallback to original
            if (typeof optionOrHref === 'string') {
                return (originalLink as any)(optionOrHref, title, text);
            }
            return originalLink(optionOrHref);
        };

        const html = marked.parse(content, { renderer }) as string;
        return <div dangerouslySetInnerHTML={{ __html: html }} onClick={handleMessageClick} />;
    };


    const toast = useToast();

    const handleSaveMsgObject = async (content: string) => {
        try {
            // Convert markdown content to HTML to preserve styles and links in the Editor
            // We use the same specific renderer logic? 
            // Actually, the Editor's extension expects <a href="object:...">.
            // marked.parse() will convert [Title](object:ID) to <a href="object:ID">Title</a>
            // This is exactly what the Editor needs.
            const htmlContent = await marked.parse(content);

            // createObject(type, title, content, autoSelect, initialProperties)
            const newObj = await createObject(
                'note',
                'AI Chat Insight',
                htmlContent as string, // Ensure it's string
                false
            );

            // Add tags separately since createObject signature doesn't support them
            await updateObject(newObj.id, { tags: ['#ai-generated'] });

            toast.success('Nota guardada', 'La respuesta se ha guardado como una nueva nota.');
        } catch (e) {
            console.error(e);
            toast.error('Error', 'No se pudo guardar la nota.');
        }
    };

    const handleSend = async () => {
        if (!input.trim() || !isEnabled || !apiKey || isLoading) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: Date.now()
        };

        addChatMessage(userMsg);
        setInput('');
        setIsLoading(true);

        try {

            // --- ADVANCED PKM RAG (4-PILLAR STRATEGY) ---

            // 1. SELF-QUERYING ROUTER (Intent & Filters)
            let analysis;
            try {
                analysis = await aiService.analyzeQuery(userMsg.content);
                console.log('[BrainChat] Router Analysis:', analysis);
            } catch (e) {
                console.warn('[BrainChat] Router failed, using defaults');
                analysis = { filters: {}, searchQuery: userMsg.content, intent: 'search' };
            }

            // 2. PRE-FILTERING (Hard Filters)
            let filteredObjects = objects.filter(obj => {
                // Type Filter
                if (analysis.filters.type && obj.type.toLowerCase() !== analysis.filters.type.toLowerCase()) {
                    if (!obj.type.toLowerCase().includes(analysis.filters.type.toLowerCase())) return false;
                }

                // Date Filter (Recency)
                if (analysis.filters.dateRange) {
                    const now = new Date();
                    const objDate = new Date(obj.updatedAt);
                    const diffDays = (now.getTime() - objDate.getTime()) / (1000 * 3600 * 24);

                    if (analysis.filters.dateRange === 'last_7_days' && diffDays > 7) return false;
                    if (analysis.filters.dateRange === 'last_30_days' && diffDays > 30) return false;
                }

                return true;
            });

            if (filteredObjects.length === 0) {
                console.warn('[BrainChat] No objects matched filters. Reverting to full search.');
                filteredObjects = objects;
            }

            // 3. VECTOR SEARCH + RECENCY WEIGHTING
            let scoredCandidates: { obj: any; score: number; reason: string }[] = [];

            try {
                let embeddingQuery = analysis.searchQuery;
                // Add short-term history context
                const recentMsgs = chatHistory.slice(-2).filter(m => m.role === 'user');
                if (recentMsgs.length > 0 && embeddingQuery.length < 20) {
                    embeddingQuery = recentMsgs.map(m => m.content).join(' ') + ' ' + embeddingQuery;
                }

                const queryEmbedding = await aiService.getEmbeddings(embeddingQuery);

                scoredCandidates = filteredObjects
                    .map(obj => {
                        let score = obj.embedding ? cosineSimilarity(queryEmbedding, obj.embedding) : 0;

                        // Recency Boost
                        const daysOld = (Date.now() - new Date(obj.updatedAt).getTime()) / (1000 * 3600 * 24);
                        if (daysOld < 1) score += 0.15;
                        else if (daysOld < 7) score += 0.08;
                        else if (daysOld < 30) score += 0.04;

                        // Title Keyword Boost
                        if (embeddingQuery.toLowerCase().includes(obj.title.toLowerCase())) {
                            score += 0.3;
                        }

                        return { obj, score, reason: 'semantic' };
                    })
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 15);

            } catch (e) {
                console.warn('Vector search failed:', e);
            }

            // 4. GRAPH TRAVERSAL (Fetch Neighbors)
            const graphCandidates: typeof scoredCandidates = [];
            const processedIds = new Set(scoredCandidates.map(c => c.obj.id));

            scoredCandidates.forEach(candidate => {
                if (candidate.score > 0.75) {
                    if (candidate.obj.links) {
                        candidate.obj.links.forEach((linkId: string) => {
                            if (!processedIds.has(linkId)) {
                                const linkedObj = objects.find(o => o.id === linkId);
                                if (linkedObj) {
                                    graphCandidates.push({ obj: linkedObj, score: candidate.score * 0.9, reason: 'linked_to_result' });
                                    processedIds.add(linkId);
                                }
                            }
                        });
                    }
                    if (candidate.obj.backlinks) {
                        candidate.obj.backlinks.forEach((linkId: string) => {
                            if (!processedIds.has(linkId)) {
                                const linkedObj = objects.find(o => o.id === linkId);
                                if (linkedObj) {
                                    graphCandidates.push({ obj: linkedObj, score: candidate.score * 0.85, reason: 'backlink_to_result' });
                                    processedIds.add(linkId);
                                }
                            }
                        });
                    }
                }
            });

            // 5. MERGE & DEDUPLICATE
            const allCandidates = [...scoredCandidates, ...graphCandidates];
            const uniqueMap = new Map();
            allCandidates.forEach(c => {
                if (!uniqueMap.has(c.obj.id)) uniqueMap.set(c.obj.id, c);
            });

            const finalContextObjects = Array.from(uniqueMap.values())
                .sort((a, b: any) => b.score - a.score)
                .slice(0, 30);

            // 5. CALENDAR EVENTS CONTEXT
            // We use the store directly to get synchronized events
            const calendarEvents = useCalendarStore.getState().events;
            const now = new Date();
            const relevantEvents = calendarEvents
                .filter(e => new Date(e.start) >= now || new Date(e.end) >= now) // Future or ongoing
                .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                .slice(0, 50);

            const calendarContextString = relevantEvents.length > 0 ? `
CALENDAR EVENTS (Synchronized):
${relevantEvents.map(e => {
                const start = new Date(e.start).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                return `- [${start}] ${e.summary}`;
            }).join('\n')}
` : '';

            // INJECTION: Updated Prompt for Links
            const typeCounts = objects.reduce((acc, obj) => {
                acc[obj.type] = (acc[obj.type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const metadataContext = `
SYSTEM METADATA:
Total Objects: ${objects.length}
Counts by Type: ${JSON.stringify(typeCounts)}
Current Date: ${new Date().toLocaleDateString()}

CRITICAL OUTPUT FORMATTING:
- When mentioning a specific object from the context, YOU MUST format it as a markdown link using its ID.
- The link format MUST be: [Object Title](object: OBJECT_ID)
    - Example: "[Project Alpha](object:12345)" or "[Meeting with John](object:67890)"
        - DO NOT show the raw ID in the text.
        - DO NOT include emojis or icons in the link text, only the title.
`;

            const contextDocs = [
                metadataContext,
                calendarContextString,
                ...finalContextObjects.map(c => {
                    const isFocus = c.score >= 3.0;
                    const charLimit = isFocus ? 8000 : 3000;

                    let cleanContent = c.obj.content.replace(/<[^>]*>/g, ' ').trim();
                    if (!cleanContent) cleanContent = '(No text content - use Title/Properties to infer context)';

                    const props = c.obj.properties && Object.keys(c.obj.properties).length > 0
                        ? JSON.stringify(c.obj.properties)
                        : '(No custom properties)';

                    return `
[OBJECT]
ID: ${c.obj.id}
TYPE: ${c.obj.type.toUpperCase()}
TITLE: ${c.obj.title}
PROPERTIES: ${props}
TAGS: ${c.obj.tags.join(', ') || '(No tags)'}
LINKED_TO: ${(c.obj.links || []).join(', ') || '(No outgoing links)'}
CONTENT:
${cleanContent.slice(0, charLimit)}
[/OBJECT]
`;
                })
            ];

            console.log('[BrainChat] Generated Context:', contextDocs);

            // 6. Call Chat API
            // Map history correctly for the API
            const historyForApi = chatHistory.map(m => ({
                role: m.role,
                parts: [{ text: m.content }] as [{ text: string }]
            }));

            const responseText = await aiService.chat(userMsg.content, contextDocs, historyForApi);

            addChatMessage({
                id: (Date.now() + 1).toString(),
                role: 'model',
                content: responseText,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error(error);
            addChatMessage({
                id: Date.now().toString(),
                role: 'model',
                content: 'Lo siento, tuve un problema procesando tu solicitud. Verifica tu conexión o configuración.',
                timestamp: Date.now()
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isEnabled) {
        return (
            <div className="brain-chat-disabled">
                <Sparkles size={48} />
                <h2>Brain Chat no disponible</h2>
                <p>Configura tu API Key de Gemini en los ajustes para hablar con tu cerebro.</p>
            </div>
        );
    }



    return (
        <div className="brain-chat-container">
            <div className="brain-chat-header">
                <Sparkles className="header-icon" />
                <h1>Chat con mi Cerebro</h1>
            </div>

            <div className="brain-chat-messages">
                {chatHistory.map((msg) => (
                    <div key={msg.id} className={`message - wrapper ${msg.role} `}>
                        <div className="message-avatar">
                            {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                        </div>
                        <div className="message-content-group">
                            <div className="message-bubble">
                                {renderContent(msg.content)}
                            </div>
                            {msg.role === 'model' && msg.id !== 'welcome' && (
                                <div className="message-actions">
                                    <button
                                        onClick={() => handleSaveMsgObject(msg.content)}
                                        className="msg-action-btn"
                                        title="Guardar como nota"
                                    >
                                        <Save size={14} /> Guardar Nota
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="message-wrapper model loading">
                        <div className="message-avatar"><Bot size={18} /></div>
                        <div className="message-bubble">
                            <Loader2 className="animate-spin" size={20} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="brain-chat-input-area">
                <div className="input-wrapper">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Pregunta algo..."
                        rows={1}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="send-btn"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};
